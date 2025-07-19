/*
 * =======================================================================
 * TCP vs UDP NETWORK PROTOCOLS - AUDIO TRANSMISSION COMPARISON  
 * =======================================================================
 * 
 * This file implements UDP (User Datagram Protocol) for audio transmission.
 * 
 * KEY DIFFERENCES BETWEEN TCP AND UDP:
 * 
 * TCP (Transmission Control Protocol):
 * ✅ Connection-oriented: Establishes connection before data transfer
 * ✅ Reliable: Guarantees data delivery and correct order
 * ✅ Error checking: Built-in error detection and correction
 * ✅ Flow control: Manages transmission rate to prevent overwhelming receiver
 * ❌ Higher overhead: Connection setup, acknowledgments, retransmissions
 * ❌ Slower: Additional processing for reliability mechanisms
 * ❌ Not ideal for real-time: Delays from retransmissions can break timing
 * 
 * UDP (User Datagram Protocol):
 * ✅ Connectionless: Direct packet transmission without handshake
 * ✅ Fast: Low latency, minimal overhead
 * ✅ Real-time friendly: No retransmission delays
 * ✅ Broadcasting capable: Can send to multiple receivers
 * ❌ Unreliable: No guarantee of delivery or order
 * ❌ No error correction: Lost packets stay lost
 * ❌ No flow control: Can overwhelm receivers
 * 
 * FOR AUDIO APPLICATIONS:
 * - TCP: Better for file transfer, guaranteed complete audio files
 * - UDP: Better for real-time streaming, live audio transmission
 * 
 * THIS FILE (UDP): Implements fast, low-latency audio streaming with minimal
 * overhead. Optimal for real-time audio applications. Preferred choice!
 * =======================================================================
 */

const dgram = require('dgram');
const fs = require('fs');
const wav = require('wav');
const Max = require('max-api');
const stream = require('stream');
const { pipeline } = require('stream/promises');

let server;
let port = 7778;
let chunkCounter = 0;
let recordingAudio = [];
let recording = false;

const INPUT_SAMPLE_RATE = 44100;
const BIT_DEPTH = 16;
const CHANNELS = 1;
const BUFFER_RESET_INTERVAL = 3000; // Time interval to reset buffer (in milliseconds)

/**
 * ============================================================================
 * UDP AUDIO SERVER: startServer() - PURE UDP AUDIO STREAMING [HIGH IMPORTANCE]
 * ============================================================================
 * 
 * Creates UDP server specifically optimized for real-time audio streaming.
 * 
 * 
 * WHAT IT DOES:
 * 1. Initializes UDP socket for high-speed audio data reception
 * 2. Handles incoming audio packets with minimal processing overhead
 * 3. Streams audio directly to Max/MSP buffers for real-time playback
 * 4. Records audio data when recording mode is active
 * 
 * UDP-SPECIFIC ADVANTAGES:
 * - FASTEST possible audio transmission (no TCP handshake delays)
 * - Direct packet-to-audio conversion for minimal latency
 * - Can handle packet loss gracefully (brief audio glitches vs. delays)
 * - Optimal for live audio streaming and real-time applications
 * 
 * AUDIO PROCESSING PIPELINE:
 * 1. Receives UDP packets → convertMatrixToFloat32()
 * 2. Validates audio data → Max.outlet('writeAudioChunk')
 * 3. Optional recording → recordingAudio array
 * 4. File logging → writeFloatDataToFile()
 * 
 * REAL-TIME FEATURES:
 * - Automatic buffer clearing every 3 seconds
 * - Live audio streaming to Max/MSP
 * - Recording capability for later analysis
 * - Error handling that doesn't interrupt audio flow
 * 
 * COMPARISON TO TCP: UDP is preferred here because audio applications
 * benefit more from speed than reliability - brief dropouts are better
 * than noticeable delays that would make real-time audio unusable.
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

        if (floatData.length === 0) {
            return;
        }

        // Send audio data to Max/MSP buffers
        Max.outlet('writeAudioChunk', ...floatData.map(item => item.value));

        // Save the converted float data if recording
        if (recording) {
            recordingAudio.push(...floatData.map(item => item.value));
        }

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

    const skipCount = 3 * 4; // Adjusted to ensure correct data skipping

    for (let i = 0; i < matrixData.length - 3; i += 4) {
        if (i < skipCount) {
            continue; 
        }

        try {
            const value = matrixData.readFloatBE(i); // Assuming big-endian float representation

            if (Math.abs(value) < 1) {
                floatData.push({ index: indexCounter, value: value });
                indexCounter++;
            }
        } catch (error) {
            Max.post(`Error reading float value at index ${i}: ${error.message}`);
            break;
        }
    }

    if (lastValue !== null && floatData.length > 0) {
        const currentFirstValue = floatData[0]?.value;
        const difference = Math.abs(lastValue - currentFirstValue);
    }

    if (floatData.length > 0) {
        const lastFloatValue = floatData[floatData.length - 1]?.value;
        if (Math.abs(lastFloatValue) < 1e+20) {
            lastValue = lastFloatValue;
            lastIndex = floatData.length - 1;
        }
    }

    return floatData;
}

function writeFloatDataToFile(floatData) {
    const output = floatData.map(item => `${item.index}: ${item.value}`).join('\n') + '\n';
   // fs.appendFileSync('float_data.txt', output);
}

/**
 * ============================================================================
 * AUDIO EXPORT: saveAudioFile() - AUDIO RECORDING & FILE OUTPUT [MEDIUM-HIGH IMPORTANCE]
 * ============================================================================
 * 
 * Converts recorded audio data into standard WAV files for playback/analysis.
 * 
 * 
 * WHAT IT DOES:
 * 1. Converts float32 audio data to 16-bit integer WAV format
 * 2. Creates properly formatted WAV files with correct headers
 * 3. Handles audio stream-to-file conversion asynchronously
 * 4. Provides configurable audio format options (sample rate, bit depth, channels)
 * 
 * AUDIO FORMAT CONVERSION:
 * - Input: Float32 audio samples (-1.0 to +1.0 range)
 * - Output: 16-bit signed integer WAV file (-32768 to +32767)
 * - Proper scaling and clamping to prevent audio distortion
 * - Standard WAV format compatible with all audio software
 * 
 * FILE OUTPUT FEATURES:
 * - Asynchronous processing doesn't block audio streaming
 * - Configurable output filename and audio parameters
 * - Error handling for file system operations
 * - Integration with Node.js streaming pipeline for efficiency
 * 
 * PROTOCOL RELEVANCE:
 * - Works with audio data from both UDP and TCP streams
 * - UDP: May contain gaps from lost packets (creates silence in file)
 * - TCP: Complete, sequential audio data (perfect file reproduction)
 * 
 * USAGE SCENARIOS:
 * - Recording live audio streams for later analysis
 * - Creating backup copies of network audio transmissions
 * - Debugging audio processing pipeline
 * - Archiving real-time audio sessions
 * ============================================================================
 */
async function saveAudioFile(audioData, options = {}) {
    const {
        fileName = 'UDPoutput.wav',
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
    } catch (error) {
        Max.post(`Error saving audio file: ${error.message}`);
    }
}

function startRecording() {
    recordingAudio = [];
    recording = true;
    Max.post('Recording started.');
}

async function stopRecording() {
    if (recordingAudio.length === 0) {
        Max.post('No audio data to save.');
        return;
    }

    await saveAudioFile(recordingAudio);
    recordingAudio = []; // Clear recording buffer
    recording = false;
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

// Periodic buffer reset every 2 seconds
setInterval(() => {
    Max.outlet('clearBuffer'); // Signal to clear the buffer and reset
}, BUFFER_RESET_INTERVAL);

// Handle SIGINT signal (e.g., when stopping the script)
process.on('SIGINT', () => {
    Max.post('Stopping UDP server...');
    if (server) {
        server.close();
    }
});
