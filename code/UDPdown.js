/*
 * =======================================================================
 * TCP vs UDP NETWORK PROTOCOLS - UDP DOWNLINK IMPLEMENTATION
 * =======================================================================
 * 
 * This file implements UDP downlink (receiving) functionality for audio.
 * 
 * DOWNLINK PROTOCOL COMPARISON:
 * 
 * TCP DOWNLINK:
 * ✅ Guaranteed data reception and order
 * ✅ Automatic error recovery and retransmission
 * ✅ Flow control prevents data loss
 * ❌ Higher latency due to acknowledgments
 * ❌ Can stall on network issues
 * 
 * UDP DOWNLINK:
 * ✅ Immediate data reception, no waiting
 * ✅ Low latency for real-time applications
 * ✅ Can handle out-of-order packets
 * ✅ No connection state to maintain
 * ❌ Packets can be lost without notification
 * ❌ No automatic error recovery
 * ❌ Manual handling of packet ordering
 * 
 * AUDIO DOWNLINK CONSIDERATIONS:
 * - UDP: Preferred for live audio streaming/playback
 * - TCP: Better for downloading complete audio files
 * - Buffering strategies crucial for UDP audio quality
 * 
 * THIS FILE (UDP DOWNLINK): Implements fast audio reception with minimal
 * latency. Optimized for real-time audio streaming applications.
 * =======================================================================
 */

const dgram = require('dgram');
const fs = require('fs');
const wav = require('wav');
const Max = require('max-api');
const stream = require('stream');
const { pipeline } = require('stream/promises');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

let server;
let port = 7777;
let chunkCounter = 0;
let recordingAudio = [];

const INPUT_SAMPLE_RATE = 44100;
const BIT_DEPTH = 16;
const CHANNELS = 1;

function startServer() {
  if (server) {
    server.close();
  }

  server = dgram.createSocket('udp4');

  server.on('listening', () => {
    const address = server.address();
    Max.post(`UDP server listening on ${address.address}:${address.port}`);
  });

  server.on('message', (data, rinfo) => {
    // Max.post(`Received data from ${rinfo.address}:${rinfo.port}`);
    // Max.post(`Data size: ${data.length} bytes`);

    // Convert received Jitter matrix data to float32 format
    const floatData = convertMatrixToFloat32(data);

    if (floatData.length === 0) {
      // Max.post('No valid float data to process.');
      return;
    }

    // Max.post(`Processed ${floatData.length} float data points`);

    // Save the converted float data if recording
    recordingAudio.push(...floatData);

    // Write float32 data to a single file with index
    writeFloatDataToFile(floatData);

    chunkCounter++;
  });

  server.on('error', (err) => {
    Max.post(`Server error: ${err.message}`);
  });

  server.bind(port);
}

let lastValue = null;
let lastIndex = null;

function convertMatrixToFloat32(matrixData) {
  const floatData = [];
  let indexCounter = 0;

  const skipCount = 131 * 4; // Adjusted to ensure correct data skipping

  for (let i = 0; i < matrixData.length - 3; i += 4) {
    if (i < skipCount) {
      continue;
    }

    try {
      const value = matrixData.readFloatBE(i); // Assuming big-endian float representation

      // Check if the value is within a reasonable range
      if (Math.abs(value) < 1e+7) {
        floatData.push(value);
        indexCounter++;
      } else {
        // Max.post(`Skipping value ${value} at index ${indexCounter} due to its large magnitude.`);
      }
    } catch (error) {
      Max.post(`Error reading float value at index ${i}: ${error.message}`);
      break; // Stop processing further values
    }
  }

  if (lastValue !== null && floatData.length > 0) {
    const currentFirstValue = floatData[0];
    const difference = Math.abs(lastValue - currentFirstValue);
    // Max.post(`Last value of previous chunk: ${lastValue}, First value of current chunk: ${currentFirstValue}`);
    // Check for a significant discontinuity between the last value of the previous chunk and the first value of the current chunk
    if (difference > 0.01) { // Adjust threshold as needed
      // Max.post(`Discontinuity detected between chunks at index ${lastIndex} and 0, potential click source`);
      // Max.post(`Difference: ${difference}`);
    }
  }

  // Update lastValue and lastIndex only if the last value is within the reasonable range
  if (floatData.length > 0) {
    const lastFloatValue = floatData[floatData.length - 1];
    if (Math.abs(lastFloatValue) < 1e+20) {
      lastValue = lastFloatValue;
      lastIndex = floatData.length - 1;
    }
  }

  return floatData;
}

function writeFloatDataToFile(floatData) {
  const output = floatData.join('\n') + '\n';
  fs.appendFileSync('float_data.txt', output);
  // Max.post(`Float32 data appended to float_data.txt (Chunk ${chunkCounter})`);
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
    Max.post(`Audio file ${fileName} saved successfully.`);

    // Downsample the audio file to 16000 Hz
    downsampleAudio(fileName, 'output_16000.wav');
  } catch (error) {
    Max.post(`Error saving audio file: ${error.message}`);
  }
}

function downsampleAudio(inputFile, outputFile) {
  ffmpeg(inputFile)
    .audioFrequency(16000)
    .on('end', () => {
      Max.post(`Downsampled audio file saved as ${outputFile}.`);
    })
    .on('error', (err) => {
      Max.post(`Error during downsampling: ${err.message}`);
    })
    .save(outputFile);
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
  Max.post('Stopping UDP server...');
  if (server) {
    server.close();
  }
});
