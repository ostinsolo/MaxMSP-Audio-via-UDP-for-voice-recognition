const net = require('net');
const fs = require('fs');
const wav = require('wav');
const Max = require('max-api');
const stream = require('stream');
const { pipeline } = require('stream/promises');

let server;
let port = 7474;
let chunkCounter = 0;
let recordingAudio = [];

const INPUT_SAMPLE_RATE = 44100;
const BIT_DEPTH = 16;
const CHANNELS = 1;

function startServer() {
  if (server) {
    server.close();
  }

  server = net.createServer((socket) => {
    Max.post(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', (data) => {
      Max.post(`Received data from ${socket.remoteAddress}:${socket.remotePort}:`);
      Max.post(`Data size: ${data.length} bytes`);

      // Convert received Jitter matrix data to float32 format
      const floatData = convertMatrixToFloat32(data);

      // Save the converted float data if recording
      recordingAudio.push(...floatData.map(item => item.value));

      // Write float32 data to a single file with index
      writeFloatDataToFile(floatData);
      
      chunkCounter++;
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

function convertMatrixToFloat32(matrixData) {
  const floatData = [];
  let indexCounter = 0;

  // Skip the first 74 values (indices 0 to 73)
  const skipCount = 74 * 4; // 74 values * 4 bytes per float

  for (let i = 0; i < matrixData.length; i += 4) {
    if (i < skipCount) {
      continue; // Skip the first 74 values
    }
    const value = matrixData.readFloatBE(i); // Assuming big-endian float representation
    floatData.push({ index: indexCounter, value: value });
    indexCounter++;
  }

  return floatData;
}

function writeFloatDataToFile(floatData) {
  const output = floatData.map(item => `${item.index}: ${item.value}`).join('\n') + '\n';
  fs.appendFileSync('float_data.txt', output);
  Max.post(`Float32 data appended to float_data.txt (Chunk ${chunkCounter})`);
}

async function saveAudioFile(audioData, options = {}) {
  const {
    fileName = 'output.wav',
    sampleRate = INPUT_SAMPLE_RATE,
    channels = CHANNELS,
    bitDepth = BIT_DEPTH
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

function startRecording() {
  recordingAudio = [];
  Max.post('Recording started.');
}

async function stopRecording() {
  if (recordingAudio.length === 0) {
    Max.post('No audio data to save.');
    return;
  }

  await saveAudioFile(recordingAudio);
  recordingAudio = []; // Clear recording buffer
  Max.post('Recording stopped and saved.');
}

startServer();

// Max/MSP Handlers
Max.addHandler('startRecording', () => {
  startRecording();
});

Max.addHandler('stopRecording', () => {
  stopRecording();
});

// Handle SIGINT signal (e.g., when stopping the script)
process.on('SIGINT', () => {
  Max.post('Stopping TCP server...');
  if (server) {
    server.close();
  }
});