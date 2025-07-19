const Max = require('max-api');
const net = require('net');
const fs = require('fs');
const wav = require('wav');

let server;
let port = 7474;
let saveAudio = false;
let recordingAudio = [];

const INPUT_SAMPLE_RATE = 44100;
const CHUNK_SIZE = 4096;
const OVERLAP_SAMPLES = 1;
const windowFunction = createTukeyWindow(CHUNK_SIZE, 0.5); // 0.5 is the alpha parameter for Tukey window

let chunkCounter = 0;
let lastChunk = new Float32Array(CHUNK_SIZE); // Initialize lastChunk with zeros

function startServer() {
  if (server) {
    server.close();
  }

  server = net.createServer((socket) => {
    Max.post(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', (data) => {
      Max.post(`Received data from ${socket.remoteAddress}:${socket.remotePort}:`);
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
    Max.post(`TCP server listening on 127.0.0.1:${port}`);
  });
}

function changePort(newPort) {
  port = newPort;
  startServer();
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
        floatData[validSamples] = limitAmplitude(value);
        validSamples++;
      } else {
        Max.post(`Invalid audio sample value at index ${i}: ${value}`);
      }
    }
  }

  // Save raw matrix data to a text file
  fs.appendFileSync('matrix_data.txt', `${Array.from(matrixData).join(',')}\n`);
  Max.post('Matrix data saved to matrix_data.txt');

  // Trim the array to only include valid samples
  const trimmedData = floatData.subarray(0, validSamples);

  // Exclude the first 74 samples (indices 0 to 73) from the trimmed data
  const excludedData = trimmedData.subarray(74);

  // Apply Tukey window to the excluded data
  const windowedData = new Float32Array(excludedData.length);
  for (let i = 0; i < excludedData.length; i++) {
    windowedData[i] = excludedData[i] * windowFunction[i];
  }

  // Merge the last chunk with the current chunk
  if (lastChunk) {
    mergeChunks(lastChunk, windowedData);
  }
  lastChunk.set(windowedData.subarray(windowedData.length - OVERLAP_SAMPLES));

  const rawMin = Math.min(...excludedData);
  const rawMax = Math.max(...excludedData);
  const rawAvg = excludedData.reduce((sum, val) => sum + val, 0) / excludedData.length;
  Max.post(`Raw float data - Min: ${rawMin}, Max: ${rawMax}, Avg: ${rawAvg}`);

  Max.post(`Converted matrix data to audio format, length: ${windowedData.length}`);

  const subsetLength = Math.min(windowedData.length, 10);
  const subset = windowedData.slice(0, subsetLength);
  Max.post(`Subset of processed audio data (first ${subsetLength} values): ${JSON.stringify(subset)}`);

  analyzeAudioChunk(windowedData, chunkCounter);

  // Extract the non-overlapping part of the windowed data
  const processedData = windowedData.subarray(OVERLAP_SAMPLES, windowedData.length - OVERLAP_SAMPLES);

  return processedData;
}

function limitAmplitude(value, threshold = 1) {
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
}

function createTukeyWindow(length, alpha) {
  const window = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    if (i < alpha * (length - 1) / 2) {
      window[i] = 0.9 * (1 + Math.cos(Math.PI * (-1 + 2 * i / (alpha * (length - 1)))));
    } else if (i < (1 - alpha / 2) * (length - 1)) {
      window[i] = 1;
    } else {
      window[i] = 0.9 * (1 + Math.cos(Math.PI * (-2 / (alpha * (length - 1)) + 2 * i / (alpha * (length - 1)) + 1)));
    }
  }
  return window;
}

function mergeChunks(prevChunk, currentChunk) {
  const mergeLength = Math.min(OVERLAP_SAMPLES, prevChunk.length, currentChunk.length);
  for (let i = 0; i < mergeLength; i++) {
    const weight = i / mergeLength;
    const prevSample = prevChunk[prevChunk.length - mergeLength + i] * (1 - weight);
    const currentSample = currentChunk[i] * weight;
    currentChunk[i] = prevSample + currentSample;
  }
}

function toggleSaveAudio() {
  saveAudio = !saveAudio;
  Max.post(`Save audio flag set to: ${saveAudio}`);

  if (!saveAudio && recordingAudio.length > 0) {
    Max.post(`Saving recorded audio of length: ${recordingAudio.length}`);
    saveAudioFile(recordingAudio);
    recordingAudio = [];
    chunkCounter = 0; // Reset chunk counter
    lastChunk = new Float32Array(CHUNK_SIZE); // Reset last chunk with zeros
  }
}

function saveAudioFile(audioData) {
  const wavWriter = new wav.FileWriter('output.wav', {
    channels: 1,
    sampleRate: INPUT_SAMPLE_RATE,
    bitDepth: 16,
  });

  const int16Data = new Int16Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    int16Data[i] = Math.max(-32768, Math.min(32767, Math.round(audioData[i] * 32767)));
  }

  wavWriter.write(Buffer.from(int16Data.buffer));
  wavWriter.end();
  Max.post('Audio file saved as output.wav');

  fs.writeFileSync('raw_audio_data.txt', audioData.join('\n'));
  Max.post('Raw audio data saved to raw_audio_data.txt');
}

Max.addHandler('changePort', (newPort) => {
  changePort(newPort);
});

Max.addHandler('saveAudio', () => {
  toggleSaveAudio();
});

startServer();

// Handle SIGINT signal (e.g., when stopping the script)
process.on('SIGINT', () => {
  Max.post('Stopping TCP server...');
  if (server) {
    server.close();
  }
});
