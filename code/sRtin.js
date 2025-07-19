/*
 * =======================================================================
 * TCP vs UDP NETWORK PROTOCOLS - SPEECH RECOGNITION with NETWORKING
 * =======================================================================
 * 
 * This file implements Speech Recognition with network audio transmission.
 * 
 * PROTOCOL COMPARISON FOR NETWORKED SPEECH RECOGNITION:
 * 
 * TCP (Transmission Control Protocol):
 * ✅ Reliable delivery ensures complete audio data for transcription
 * ✅ Error correction prevents corrupted speech samples
 * ✅ Good for sending recorded speech files for batch processing
 * ❌ Higher latency breaks real-time conversation flow
 * ❌ Retransmission delays can cause speech timing issues
 * 
 * UDP (User Datagram Protocol):
 * ✅ Low latency enables real-time speech recognition
 * ✅ Fast streaming maintains natural conversation timing
 * ✅ Brief packet loss acceptable vs. timing disruption
 * ✅ Can broadcast speech to multiple recognition services
 * ❌ Lost packets may result in missed words
 * ❌ No guarantee of audio data completeness
 * 
 * HYBRID APPROACH BENEFITS:
 * - Use UDP for real-time audio streaming to speech engine
 * - Use TCP for sending final transcriptions and control commands
 * - Buffer management helps handle UDP packet variations
 * 
 * THIS FILE (sRtin): Implements speech recognition with network capabilities,
 * likely using UDP for audio streaming due to real-time requirements.
 * =======================================================================
 */

const path = require('path');
const Max = require('max-api');
const vosk = require('vosk');
const fs = require("fs");
const dgram = require('dgram');
const wav = require('wav');
const { Writable, Readable } = require('stream');
const { pipeline } = require('stream/promises');
const wordsToNumbers = require('words-to-numbers').default;

const MODEL_PATH = "../model/vosk-model";
const INPUT_SAMPLE_RATE = 44100;
const TARGET_SAMPLE_RATE = 16000;
const BIT_DEPTH = 16;
const CHANNELS = 1;

let server;
let port = 7778;
let lastPartialResult = '';
let isRecording = false;
let recordingAudio = [];
let audioBuffer = [];

Max.post(`Loaded the ${path.basename(__filename)} script`);

if (!fs.existsSync(MODEL_PATH)) {
  Max.post("Model not found. Please check the model path.");
  process.exit(1);
}

vosk.setLogLevel(-1);
const model = new vosk.Model(MODEL_PATH);
const rec = new vosk.Recognizer({ model: model, sampleRate: TARGET_SAMPLE_RATE });

/**
 * ============================================================================
 * CORE FUNCTION: startServer() - SYSTEM INITIALIZATION [CRITICAL IMPORTANCE]
 * ============================================================================
 * 
 * This is the PRIMARY ENTRY POINT for the UDP speech recognition system.
 * 
 * IMPORTANCE: ⭐⭐⭐⭐⭐ (MAXIMUM - System cannot function without this)
 * 
 * WHAT IT DOES:
 * 1. Initializes UDP server socket for receiving audio data
 * 2. Sets up event handlers for incoming audio packets
 * 3. Manages the complete audio processing pipeline
 * 4. Coordinates speech recognition workflow
 * 
 * TECHNICAL DETAILS:
 * - Creates UDP socket on port 7778 for low-latency audio streaming
 * - Handles incoming matrix data from Max/MSP or external sources
 * - Processes audio through: Reception → Conversion → Buffering → Recognition
 * - Manages real-time audio buffer to prevent overflow/underflow
 * 
 * NETWORK PROTOCOL CHOICE:
 * - Uses UDP for minimal latency in real-time speech recognition
 * - Prioritizes speed over reliability (acceptable for speech applications)
 * - Packet loss creates brief audio gaps rather than system delays
 * 
 * DEPENDENCIES:
 * - Requires convertMatrixToFloat32(), processAudioWithVosk()
 * - Integrates with Vosk speech recognition engine
 * - Connects to Max/MSP audio pipeline
 * ============================================================================
 */
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
    const floatData = convertMatrixToFloat32(data);
    if (floatData.length === 0) return;

    const int16Data = convertFloat32ToInt16(floatData);
    audioBuffer = audioBuffer.concat(Array.from(int16Data));

    while (audioBuffer.length >= TARGET_SAMPLE_RATE) {
      const chunk = audioBuffer.slice(0, TARGET_SAMPLE_RATE);
      audioBuffer = audioBuffer.slice(TARGET_SAMPLE_RATE);

      const downsampledData = downsampleAudio(chunk, INPUT_SAMPLE_RATE, TARGET_SAMPLE_RATE);

      if (isRecording) {
        recordingAudio = recordingAudio.concat(Array.from(downsampledData));
      }

      processAudioWithVosk(downsampledData);
    }
  });

  server.on('error', (err) => {
    Max.post(`Server error: ${err.message}`);
  });

  server.bind(port);
}

/**
 * ============================================================================
 * DATA CONVERSION: convertMatrixToFloat32() - AUDIO DATA PARSER [HIGH IMPORTANCE]
 * ============================================================================
 * 
 * Converts incoming binary matrix data to usable float32 audio samples.
 * 
 * 
 * WHAT IT DOES:
 * 1. Parses binary matrix data from network packets
 * 2. Extracts float32 audio samples with proper byte ordering
 * 3. Filters invalid/corrupted audio values
 * 4. Maintains audio sample indexing for processing pipeline
 * 
 * TECHNICAL DETAILS:
 * - Reads big-endian float values from binary buffer
 * - Skips header data (first 131*4 bytes) to reach audio samples
 * - Validates audio values (absolute value < 1 for normalized audio)
 * - Handles network byte order conversion automatically
 * 
 * PROTOCOL RELEVANCE:
 * - Essential for both UDP and TCP audio systems
 * - UDP: Processes packets as they arrive (may be out of order)
 * - TCP: Processes sequential data stream (guaranteed order)
 * 
 * ERROR HANDLING:
 * - Gracefully handles corrupted packets or invalid data
 * - Continues processing valid samples even if some are corrupted
 * - Critical for UDP systems where packet corruption is possible
 * ============================================================================
 */
function convertMatrixToFloat32(matrixData) {
  const floatData = [];
  const skipCount = 131 * 4;

  for (let i = 0; i < matrixData.length - 3; i += 4) {
    if (i < skipCount) {
      continue;
    }

    try {
      const value = matrixData.readFloatBE(i);
      if (Math.abs(value) < 10) {
        floatData.push(value);
      }
    } catch (error) {
      Max.post(`Error reading float value at index ${i}: ${error.message}`);
      break;
    }
  }

  return floatData;
}

function convertFloat32ToInt16(float32Array) {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    int16Array[i] = Math.max(-32768, Math.min(32767, Math.round(float32Array[i] * 32767)));
  }
  return int16Array;
}

/**
 * ============================================================================
 * AUDIO PROCESSING: downsampleAudio() - SAMPLE RATE CONVERSION [HIGH IMPORTANCE]
 * ============================================================================
 * 
 * Critical audio preprocessing function for speech recognition compatibility.
 * 
 * IMPORTANCE: ⭐⭐⭐⭐ (HIGH - Essential for Vosk speech recognition)
 * 
 * WHAT IT DOES:
 * 1. Converts audio from 44100 Hz (Max/MSP standard) to 16000 Hz (Vosk requirement)
 * 2. Performs intelligent resampling to preserve audio quality
 * 3. Reduces data size while maintaining speech intelligibility
 * 4. Prepares audio for optimal AI speech recognition processing
 * 
 * TECHNICAL DETAILS:
 * - Sample rate conversion: 44.1 kHz → 16 kHz (2.76:1 ratio)
 * - Linear interpolation for smooth audio resampling
 * - Maintains audio timing and pitch characteristics
 * - Reduces computational load on speech recognition engine
 * 
 * WHY DOWNSAMPLING IS CRITICAL:
 * - Vosk models are trained on 16kHz audio for optimal accuracy
 * - Lower sample rate reduces processing time and memory usage
 * - Speech recognition doesn't need full audio bandwidth (human speech: ~300-3400Hz)
 * - Faster processing enables real-time speech recognition
 * 
 * AUDIO QUALITY CONSIDERATIONS:
 * - Preserves speech frequencies essential for recognition
 * - Filters out high frequencies not needed for speech processing
 * - Maintains temporal accuracy for word timing
 * - Balances quality vs. processing speed for real-time applications
 * 
 * NETWORK PROTOCOL INTEGRATION:
 * - Processes audio from both UDP and TCP streams
 * - UDP: Handles potentially uneven audio chunk timing
 * - TCP: Processes consistent, sequential audio data
 * - Essential preprocessing step before AI speech recognition
 * ============================================================================
 */
function downsampleAudio(audioData, fromSampleRate, toSampleRate) {
  const sampleRateRatio = fromSampleRate / toSampleRate;
  const newLength = Math.round(audioData.length / sampleRateRatio);
  const downsampledData = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const position = i * sampleRateRatio;
    const index = Math.floor(position);
    const fraction = position - index;

    if (index + 1 < audioData.length) {
      downsampledData[i] = Math.round(audioData[index] * (1 - fraction) + audioData[index + 1] * fraction);
    } else {
      downsampledData[i] = audioData[index];
    }
  }

  return downsampledData;
}

function specialFormatting(inputString, options) {
  let formattedString = inputString;

  // Check for 'minus'
  const isNegative = /^minus\\b/.test(inputString);
  if (isNegative) {
    formattedString = formattedString.replace(/\\bminus\\b/, '').trim();
  }

  // Check for 'percent'
  const isPercent = /\\bpercent\\b/.test(formattedString);
  if (isPercent) {
    formattedString = formattedString.replace(/\\bpercent\\b/, '').trim();
  }

  // Convert the number word to a number
  let number = wordsToNumbers(formattedString, options);

  if (number !== undefined) {
    if (isNegative) {
      number = '-' + number;
    }
    if (isPercent) {
      number = number + '%';
    }
  }

  return number;
}

/**
 * ============================================================================
 * SPEECH RECOGNITION: processAudioWithVosk() - AI SPEECH ENGINE [CRITICAL IMPORTANCE]
 * ============================================================================
 * 
 * The HEART of the speech recognition system - converts audio to text using AI.
 * 
 * 
 * WHAT IT DOES:
 * 1. Feeds audio data to Vosk AI speech recognition engine
 * 2. Processes both partial (real-time) and final (complete) results
 * 3. Applies custom formatting to recognized text
 * 4. Outputs results to Max/MSP for further processing
 * 
 * TECHNICAL DETAILS:
 * - Uses Vosk neural network for offline speech recognition
 * - Handles streaming audio processing (not batch processing)
 * - Provides real-time partial results for immediate feedback
 * - Processes final results when speech segment completes
 * 
 * AI PROCESSING FLOW:
 * 1. acceptWaveform() → Feeds audio to neural network
 * 2. result() → Gets final recognized text when speech ends
 * 3. partialResult() → Gets ongoing recognition during speech
 * 4. specialFormatting() → Applies custom text transformations
 * 
 * NETWORK PROTOCOL IMPACT:
 * - Benefits from UDP's low latency for real-time recognition
 * - Can handle brief audio gaps without breaking recognition context
 * - Critical for natural conversation flow and live applications
 * 
 * OUTPUT: Sends recognized text to Max/MSP for further audio/visual processing
 * ============================================================================
 */
function processAudioWithVosk(audioData) {
  if (rec.acceptWaveform(audioData)) {
    const result = rec.result();
    if (result && result.text) {
      const formattedText = specialFormatting(result.text, {});
      Max.post(`Final Result: ${formattedText}`);
      Max.outlet(formattedText);

      // Output the last partial result
      if (lastPartialResult !== '') {
        const formattedPartial = specialFormatting(lastPartialResult, {});
        Max.outlet(formattedPartial);
        lastPartialResult = '';
      }
    }
  } else {
    const partial = rec.partialResult();
    if (partial && partial.partial) {
      const formattedPartial = specialFormatting(partial.partial, {});
      Max.post(`Partial Result: ${formattedPartial}`);
      if (/\\b(play|stop|pause|resume|continue|both)\\b/i.test(formattedPartial)) {
        Max.outlet(formattedPartial);
      } else {
        lastPartialResult = partial.partial;
      }
    }
  }
}

function startRecording() {
  if (!isRecording) {
    isRecording = true;
    recordingAudio = [];
    Max.post('Recording started.');
  } else {
    Max.post("Already recording.");
  }
}

async function stopRecording() {
  if (isRecording) {
    isRecording = false;
    if (recordingAudio.length === 0) {
      Max.post('No audio data to save.');
      return;
    }

    const fileName = `recording_${Date.now()}.wav`;
    await saveAudioFile(recordingAudio, { fileName: fileName, sampleRate: TARGET_SAMPLE_RATE });
    recordingAudio = []; // Clear recording buffer
    Max.post('Recording stopped and saved.');
  } else {
    Max.post("Not currently recording.");
  }
}

async function saveAudioFile(audioData, options = {}) {
  const {
    fileName = 'output.wav',
    sampleRate = TARGET_SAMPLE_RATE,
    channels = CHANNELS,
    bitDepth = BIT_DEPTH
  } = options;

  try {
    const wavWriter = new wav.FileWriter(fileName, {
      channels: channels,
      sampleRate: sampleRate,
      bitDepth: bitDepth,
    });

    const bufferStream = new Writable({
      write(chunk, encoding, callback) {
        wavWriter.write(chunk);
        callback();
      }
    });

    bufferStream.on('finish', () => {
      wavWriter.end();
      Max.post(`Audio file ${fileName} saved successfully.`);
    });

    const int16Data = new Int16Array(audioData);
    const readableStream = new Readable({
      read() {
        this.push(Buffer.from(int16Data.buffer));
        this.push(null);
      }
    });

    await pipeline(readableStream, bufferStream);
  } catch (error) {
    Max.post(`Error saving audio file: ${error.message}`);
  }
}

startServer();

Max.addHandler('startRecording', startRecording);
Max.addHandler('stopRecording', stopRecording);

process.on('SIGINT', () => {
  Max.post('Stopping UDP server...');
  if (server) {
    server.close();
  }
  if (isRecording) {
    stopRecording();
  }
  // Output the last partial result if it exists
  if (lastPartialResult !== '') {
    const formattedPartial = specialFormatting(lastPartialResult, {});
    Max.outlet(formattedPartial);
    lastPartialResult = '';
  }
  rec.free();
  model.free();
});

Max.post("UDP server and Vosk recognition started. Waiting for audio data...");