/*
 * =======================================================================
 * TCP vs UDP NETWORK PROTOCOLS - LEGACY ASR (Automatic Speech Recognition)
 * =======================================================================
 * 
 * This file implements an older version of Automatic Speech Recognition.
 * 
 * PROTOCOL RELEVANCE FOR SPEECH RECOGNITION:
 * 
 * TCP (Transmission Control Protocol):
 * ✅ Reliable for sending complete audio files for processing
 * ✅ Guarantees all speech data arrives for accurate transcription
 * ❌ Higher latency - not suitable for real-time speech recognition
 * ❌ Overhead delays can interrupt natural speech flow
 * 
 * UDP (User Datagram Protocol):
 * ✅ Fast streaming for real-time speech recognition
 * ✅ Low latency enables natural conversation flow  
 * ✅ Can handle brief audio dropouts without breaking recognition
 * ❌ Lost packets may cause missed words or phrases
 * 
 * FOR SPEECH RECOGNITION:
 * - TCP: Better for batch processing of recorded speech files
 * - UDP: Better for live speech recognition and voice control
 * 
 * THIS FILE (OLDASA): Legacy speech recognition implementation.
 * May use local processing without network protocols, but principles
 * apply when integrating with network-based speech services.
 * =======================================================================
 */

const path = require('path');
const Max = require('max-api');
const vosk = require('vosk');
const fs = require("fs");
const record = require('node-record-lpcm16');
const wordsToNumbers = require('words-to-numbers').default;

const SOX_PATH = path.join(__dirname, '/ASA Project/sox-14.4.2');

let lastPartialResult = '';

function specialFormatting(inputString, options) {
  let formattedString = inputString;

  // Check for 'minus'
  const isNegative = /^minus\b/.test(inputString);
  if (isNegative) {
    formattedString = formattedString.replace(/\bminus\b/, '').trim();
  }

  // Check for 'percent'
  const isPercent = /\bpercent\b/.test(formattedString);
  if (isPercent) {
    formattedString = formattedString.replace(/\bpercent\b/, '').trim();
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

// Update the PATH environment variable to include /usr/local/bin and SOX_PATH
process.env.PATH = [process.env.PATH, '/usr/local/bin', SOX_PATH].join(':');

const MODEL_PATH = "../model/vosk-model"; // Update the model path
const SAMPLE_RATE = 16000;

Max.post(`Loaded the ${path.basename(__filename)} script`);

// Check if the model directory exists
if (!fs.existsSync(MODEL_PATH)) {
  Max.post("Model not found. Please check the model path.");
  process.exit(1);
}

// Initialize Vosk model
vosk.setLogLevel(0);
const model = new vosk.Model(MODEL_PATH);
const rec = new vosk.Recognizer({ model: model, sampleRate: SAMPLE_RATE });

// Initialize node-record-lpcm16 with SoX path
const recording = record.record({
  sampleRate: SAMPLE_RATE,
  channels: 1,
  threshold: 0,
  recordProgram: process.platform === 'win32' ? path.join(SOX_PATH, 'sox.exe') : 'sox',
  silence: '10.0',
});

// Stream audio data to Vosk recognizer
recording.stream().on('data', (data) => {
  Max.post('Received audio data chunk');
  // Log the contents of the audio chunk
  Max.post(`Audio chunk data: ${data.toString('hex')}`);

  if (rec.acceptWaveform(data)) {
    const result = rec.result();
    if (result && result.text) {
      // Convert recognized text to numbers
      const convertedText = specialFormatting(result.text, {});

      Max.post(`Final Result: ${result.text}`);
      Max.post(`Converted Final Result: ${convertedText}`);

      if (convertedText !== undefined) {
        Max.outlet(convertedText);
      }

      // Output the last partial result
      if (lastPartialResult !== '') {
        Max.outlet(lastPartialResult);
        lastPartialResult = '';
      }
    }
  } else {
    const partial = rec.partialResult();
    if (partial && partial.partial) {
      const convertedPartial = specialFormatting(partial.partial, {});

      Max.post(`Partial Result: ${partial.partial}`);
      Max.post(`Converted Partial Result: ${convertedPartial}`);

      // Check if the partial result contains 'play', 'stop', 'pause', or 'resume'
      if (/\b(play|stop|pause|resume|continue|both)\b/i.test(convertedPartial)) {
        Max.outlet(convertedPartial);
      } else {
        // Store the last partial result
        lastPartialResult = convertedPartial;
      }
    }
  }
});

// Handle audio processing completion
recording.stream().on('end', () => {
  Max.post("Audio processing complete.");
  const finalResult = rec.finalResult();
  if (finalResult && finalResult.text) {
    // Convert final recognized text to numbers
    const convertedFinalText = specialFormatting(finalResult.text, {});
    Max.post('Final text:', finalResult.text);
    Max.post('Final converted text:', convertedFinalText);

    if (convertedFinalText !== undefined) {
      Max.outlet(convertedFinalText);
    }

    // Output the last partial result if it exists
    if (lastPartialResult !== '') {
      Max.outlet(lastPartialResult);
      lastPartialResult = '';
    }
  }
  rec.free();
  model.free();
});

// Handle SIGINT signal (e.g., when stopping the script)
process.on('SIGINT', () => {
  Max.post("Stopping microphone...");
  recording.stop();
});

// Start recording
recording.start();
Max.post("Recording started.");
