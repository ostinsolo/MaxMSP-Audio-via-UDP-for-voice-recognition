/*
 * =======================================================================
 * TCP vs UDP NETWORK PROTOCOLS - AUDIO FILE READING/PROCESSING
 * =======================================================================
 * 
 * This file handles audio file reading and processing operations.
 * 
 * PROTOCOL CONSIDERATIONS FOR AUDIO FILE HANDLING:
 * 
 * TCP (Transmission Control Protocol):
 * ✅ Perfect for transferring complete audio files
 * ✅ Guarantees entire file arrives intact
 * ✅ Built-in error correction for file integrity
 * ✅ Suitable for large audio file downloads
 * ❌ Slower transfer due to overhead
 * ❌ Not suitable for streaming during transfer
 * 
 * UDP (User Datagram Protocol):
 * ✅ Can stream audio while reading/processing
 * ✅ Low latency for real-time audio processing
 * ✅ Can broadcast processed audio to multiple receivers
 * ❌ Risk of incomplete or corrupted audio data
 * ❌ Requires additional verification mechanisms
 * 
 * FILE PROCESSING STRATEGIES:
 * - TCP: Read complete files, then process and stream
 * - UDP: Process audio chunks as they arrive
 * - Hybrid: Use TCP for file transfer, UDP for streaming
 * 
 * THIS FILE (READING): Handles audio file operations that can be
 * integrated with either TCP or UDP network transmission systems.
 * =======================================================================
 */

const path = require('path');
const Max = require('max-api');
const vosk = require('vosk');
const fs = require("fs");
const wav = require('wav');
const wordsToNumbers = require('words-to-numbers').default;

const MODEL_PATH = "../model/vosk-model";
const SAMPLE_RATE = 16000;
const WAV_FILE_PATH = 'temp_output.wav';

Max.post(`Loaded the ${path.basename(__filename)} script`);

function specialFormatting(inputString, options) {
  let formattedString = inputString;

  const isNegative = /^minus\b/.test(inputString);
  if (isNegative) {
    formattedString = formattedString.replace(/\bminus\b/, '').trim();
  }

  const isPercent = /\bpercent\b/.test(formattedString);
  if (isPercent) {
    formattedString = formattedString.replace(/\bpercent\b/, '').trim();
  }

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
// Check if the model directory exists
if (!fs.existsSync(MODEL_PATH)) {
  Max.post("Model not found. Please check the model path.");
  process.exit(1);
}

// Check if the WAV file exists
if (!fs.existsSync(WAV_FILE_PATH)) {
  Max.post(`WAV file not found: ${WAV_FILE_PATH}`);
  process.exit(1);
}

// Initialize Vosk model
vosk.setLogLevel(0);
const model = new vosk.Model(MODEL_PATH);
const rec = new vosk.Recognizer({ model: model, sampleRate: SAMPLE_RATE });

function processWavFile(filePath) {
  return new Promise((resolve, reject) => {
    const reader = new wav.Reader();
    const fileStream = fs.createReadStream(filePath);

    reader.on('format', function (format) {
      if (format.sampleRate !== SAMPLE_RATE) {
        reject(new Error(`Invalid sample rate. Expected ${SAMPLE_RATE}, but got ${format.sampleRate}`));
      }
    });

    reader.on('data', function (chunk) {
      try {
        if (rec.acceptWaveform(chunk)) {
          const result = rec.result();
          if (result && result.text) {
            const convertedText = specialFormatting(result.text, {});
            if (convertedText !== undefined) {
              Max.outlet(convertedText);
            }
          }
        } else {
          const partial = rec.partialResult();
          if (partial && partial.partial) {
            const convertedPartial = specialFormatting(partial.partial, {});
            if (/\b(play|stop|pause|resume|continue|both)\b/i.test(convertedPartial)) {
              Max.outlet(convertedPartial);
            }
          }
        }
      } catch (error) {
        Max.post("Error processing chunk:", error.message);
      }
    });

    reader.on('end', function () {
      const finalResult = rec.finalResult();
      if (finalResult && finalResult.text) {
        const convertedFinalText = specialFormatting(finalResult.text, {});
        Max.post('Final converted text:', convertedFinalText);
        if (convertedFinalText !== undefined) {
          Max.outlet(convertedFinalText);
        }
      }
      resolve();
    });

    reader.on('error', function (err) {
      reject(err);
    });

    fileStream.on('error', function (err) {
      reject(err);
    });

    fileStream.pipe(reader);
  });
}

async function main() {
  try {
    Max.post("Starting to process WAV file...");
    await processWavFile(WAV_FILE_PATH);
    Max.post("Audio processing complete.");
  } catch (error) {
    Max.post("Error processing audio:", error.message);
  } finally {
    rec.free();
    model.free();
  }
}

// Run the main function
main();

// Handle unexpected errors
process.on('uncaughtException', (error) => {
  Max.post("Uncaught Exception:", error.message);
  rec.free();
  model.free();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  Max.post("Unhandled Rejection at:", promise, "reason:", reason);
  rec.free();
  model.free();
  process.exit(1);
});