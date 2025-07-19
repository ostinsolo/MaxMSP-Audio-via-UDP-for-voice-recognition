const Max = require('max-api');
const net = require('net');
const fs = require('fs');
const wav = require('wav');
const util = require('util');
const stream = require('stream');
const pipeline = util.promisify(stream.pipeline);

let server;
let port = 7474;
let saveAudio = false;
let recordingAudio = [];
const INPUT_SAMPLE_RATE = 44100;
const OVERLAP_SAMPLES = 1024;

let chunkCounter = 0;
let lastChunk = null; // Store the last chunk for overlap

async function saveAudioFile(audioData, options = {}) {
  const {
    fileName = 'output.wav',
    sampleRate = INPUT_SAMPLE_RATE,
    channels = 1,
    bitDepth = 16
  } = options;

  try {
    const wavWriter = new wav.FileWriter(fileName, {
      channels: channels,
      sampleRate: sampleRate,
      bitDepth: bitDepth,
    });

    const int16Data = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      // More precise conversion from [-1, 1] to [-32768, 32767]
      int16Data[i] = Math.max(-32768, Math.min(32767, Math.round(audioData[i] * 32767)));
    }

    const bufferStream = new stream.Readable({
      read() {
        this.push(Buffer.from(int16Data.buffer));
        this.push(null);
      }
    });

    await pipeline(bufferStream, wavWriter);

    Max.post(`Audio file saved as ${fileName}`);

    // Save raw audio data
    await fs.promises.writeFile('raw_audio_data.txt', audioData.join('\n'));
    Max.post('Raw audio data saved to raw_audio_data.txt');
  } catch (error) {
    Max.post(`Error saving audio file: ${error.message}`);
  }
}

function softClip(value, threshold = 0.8) {
  if (value > threshold) {
    return threshold + (1 - threshold) * Math.tanh((value - threshold) / (1 - threshold));
  } else if (value < -threshold) {
    return -threshold - (1 - threshold) * Math.tanh((-value - threshold) / (1 - threshold));
  }
  return value;
}

function analyzeAudioChunk(audioData, chunkNumber) {
  const changes = [];
  for (let i = 1; i < audioData.length; i++) {
    const diff = Math.abs(audioData[i] - audioData[i-1]);
    if (diff > 0.1) {
      changes.push({index: i, diff: diff});
    }
  }
  changes.sort((a, b) => b.diff - a.diff);
  
  Max.post(`Chunk ${chunkNumber} analysis:`);
  Max.post(`  Total samples: ${audioData.length}`);
  Max.post(`  Significant changes: ${changes.length}`);
  Max.post(`  Top 5 largest changes:`);
  for (let i = 0; i < Math.min(5, changes.length); i++) {
    Max.post(`    Index: ${changes[i].index}, Difference: ${changes[i].diff}`);
  }

  // Return indices to exclude
  return changes.slice(0, Math.min(5, changes.length)).map(change => change.index);
}

function smoothTransition(prevChunk, currentChunk, overlap = OVERLAP_SAMPLES) {
  const length = Math.min(overlap, prevChunk.length, currentChunk.length);
  for (let i = 0; i < length; i++) {
    const weight = i / length;
    currentChunk[i] = prevChunk[prevChunk.length - length + i] * (1 - weight) + currentChunk[i] * weight;
  }
}

function findZeroCrossing(data, direction = 'positive') {
  for (let i = 1; i < data.length; i++) {
    if (direction === 'positive' && data[i-1] < 0 && data[i] >= 0) {
      return i;
    } else if (direction === 'negative' && data[i-1] > 0 && data[i] <= 0) {
      return i;
    }
  }
  return -1;
}

function convertMatrixToAudio(matrixData) {
  chunkCounter++;
  Max.post(`Processing chunk ${chunkCounter}, size: ${matrixData.length} bytes`);

  const floatData = new Float32Array(Math.floor(matrixData.length / 4));
  let validSamples = 0;

  for (let i = 0; i < floatData.length; i++) {
    if (i * 4 + 3 < matrixData.length) {
      const value = matrixData.readFloatBE(i * 4);
      if (!isNaN(value) && isFinite(value)) {
        floatData[validSamples] = softClip(value);
        validSamples++;
      } else {
        Max.post(`Invalid audio sample value at index ${i}: ${value}`);
      }
    }
  }

  // Trim the array to only include valid samples
  const trimmedData = floatData.subarray(0, validSamples);

  // Crossfade with the last chunk
  const crossfadeLength = Math.min(OVERLAP_SAMPLES, trimmedData.length);
  const crossfadedData = new Float32Array(trimmedData.length + (lastChunk ? lastChunk.length - crossfadeLength : 0));

  if (lastChunk) {
    // Copy the last chunk's non-overlapping samples
    crossfadedData.set(lastChunk.subarray(0, lastChunk.length - crossfadeLength));

    // Apply crossfade
    for (let i = 0; i < crossfadeLength; i++) {
      const weightA = (crossfadeLength - i) / crossfadeLength;
      const weightB = i / crossfadeLength;
      crossfadedData[lastChunk.length - crossfadeLength + i] =
        lastChunk[lastChunk.length - crossfadeLength + i] * weightA +
        trimmedData[i] * weightB;
    }

    // Copy the current chunk's non-overlapping samples
    crossfadedData.set(trimmedData.subarray(crossfadeLength), lastChunk.length);
  } else {
    // No previous chunk, just copy the current chunk
    crossfadedData.set(trimmedData);
  }

  // Update the last chunk
  lastChunk = trimmedData.slice(-OVERLAP_SAMPLES);

  const rawMin = Math.min(...crossfadedData);
  const rawMax = Math.max(...crossfadedData);
  const rawAvg = crossfadedData.reduce((sum, val) => sum + val, 0) / crossfadedData.length;
  Max.post(`Raw float data - Min: ${rawMin}, Max: ${rawMax}, Avg: ${rawAvg}`);

  Max.post(`Converted matrix data to audio format, length: ${crossfadedData.length}`);

  const subsetLength = Math.min(crossfadedData.length, 10);
  const subset = crossfadedData.slice(0, subsetLength);

  const indicesToExclude = analyzeAudioChunk(crossfadedData, chunkCounter);

  // Filter out significant changes
  const filteredData = crossfadedData.filter((_, index) => !indicesToExclude.includes(index));

  return filteredData;
}

function startServer() {
  if (server) {
    server.close();
  }

  server = net.createServer((socket) => {
    Max.post(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', (data) => {
    //  Max.post(`Received data from ${socket.remoteAddress}:${socket.remotePort}:`);
      Max.post(`Data size: ${data.length} bytes`);

      // Convert received Jitter matrix data to audio format
      const audioData = convertMatrixToAudio(data);

      // Save the converted audio data if recording
      if (saveAudio) {
        recordingAudio.push(...audioData);
      }
    });

    socket.on('close', () => {
      Max.post(`Client disconnected: ${socket.remoteAddress}:${socket.remotePort}`);
    });

    socket.on('error', (err) => {
      Max.post(`Socket error: ${err.message}`);
    });
  });

  server.on('error', (err) => {
    Max.post(`Server error: ${err.message}`);
  });

  server.listen(port, '127.0.0.1', () => {
 //   Max.post(`TCP server listening on 127.0.0.1:${port}`);
  });
}

function changePort(newPort) {
  port = newPort;
  startServer();
}

async function toggleSaveAudio() {
  saveAudio = !saveAudio;
  Max.post(`Save audio flag set to: ${saveAudio}`);

  if (!saveAudio && recordingAudio.length > 0) {
    Max.post(`Saving recorded audio of length: ${recordingAudio.length}`);
    await saveAudioFile(recordingAudio, {
      fileName: `recording_${Date.now()}.wav`,
      sampleRate: INPUT_SAMPLE_RATE,
      channels: 1,
      bitDepth: 16
    });
    recordingAudio = [];
    chunkCounter = 0; // Reset chunk counter
    lastChunk = null; // Reset last chunk
  }
}

Max.addHandler('changePort', (newPort) => {
  changePort(newPort);
});

Max.addHandler('saveAudio', async () => {
  await toggleSaveAudio();
});

startServer();

// Handle SIGINT signal (e.g., when stopping the script)
process.on('SIGINT', () => {
  Max.post('Stopping TCP server...');
  if (server) {
    server.close();
  }
});
