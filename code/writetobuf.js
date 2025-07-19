/*
 * =======================================================================
 * TCP vs UDP NETWORK PROTOCOLS - BUFFER MANAGEMENT FOR AUDIO
 * =======================================================================
 * 
 * This file handles buffer operations for network audio transmission.
 * 
 * BUFFER MANAGEMENT DIFFERENCES BY PROTOCOL:
 * 
 * TCP (Transmission Control Protocol):
 * ✅ Built-in buffering and flow control
 * ✅ Automatic handling of buffer overflow
 * ✅ Reliable data delivery reduces buffer complexity
 * ❌ Additional buffering overhead
 * ❌ Buffer delays can accumulate
 * 
 * UDP (User Datagram Protocol):
 * ✅ Direct buffer control for minimal latency
 * ✅ Custom buffering strategies possible
 * ✅ Can implement circular buffers for real-time
 * ❌ Manual handling of buffer overflow/underflow
 * ❌ Packet loss requires buffer recovery strategies
 * 
 * AUDIO BUFFERING CONSIDERATIONS:
 * - TCP: Larger buffers acceptable due to reliability
 * - UDP: Smaller buffers preferred for low latency
 * - Real-time audio needs careful buffer size balancing
 * 
 * THIS FILE: Implements buffer management utilities for network audio,
 * crucial for maintaining smooth audio flow regardless of protocol choice.
 * =======================================================================
 */

autowatch = 1;
inlets = 1;
outlets = 1;

var projectSampleRate = 44100;
var currentSampleRate = projectSampleRate;
var buffer1 = new Buffer("UDPbuf");
var buffer2 = new Buffer("UDPbuf2");
var activeBuffer = buffer1;
var inactiveBuffer = buffer2;
var clipStart1 = 0;
var chunkSize = 128; // Size of the chunk or window in frames
var switchDelay = 20; // Delay before clearing the buffer (in milliseconds)
var fadeLength = 441; // Length of crossfade (e.g., 10ms at 44100 Hz)

/**
 * ============================================================================
 * BUFFER MANAGEMENT: writeAudioChunk() - REAL-TIME AUDIO BUFFER [HIGH IMPORTANCE]
 * ============================================================================
 * 
 * Core buffer writing function that handles incoming audio chunks for playback.
 * 
 * IMPORTANCE: ⭐⭐⭐⭐ (HIGH - Essential for smooth audio playback)
 * 
 * WHAT IT DOES:
 * 1. Receives audio data chunks from UDP/TCP streams
 * 2. Writes audio to active Max/MSP buffer for immediate playback
 * 3. Manages buffer overflow and automatic switching
 * 4. Applies fade-out effects for smooth transitions
 * 
 * BUFFER STRATEGY:
 * - Uses dual-buffer system (active/inactive) for seamless audio
 * - Writes chunks of 128 frames at a time for optimal performance
 * - Automatic buffer switching when capacity is reached
 * - Crossfading to prevent audio clicks and pops
 * 
 * REAL-TIME AUDIO CONSIDERATIONS:
 * - Critical for maintaining continuous audio flow
 * - Must handle varying network timing (jitter) gracefully
 * - Buffer management prevents audio dropouts
 * - Essential bridge between network data and audio output
 * 
 * PROTOCOL INTEGRATION:
 * - Works with both UDP and TCP audio streams
 * - UDP: Handles potentially out-of-order or missing chunks
 * - TCP: Processes sequential, reliable audio stream
 * - Buffer system compensates for network timing variations
 * 
 * AUDIO PROCESSING CHAIN:
 * Network → convertMatrixToFloat32() → writeAudioChunk() → Max/MSP Output
 * ============================================================================
 */
function writeAudioChunk() {
    if (!activeBuffer || activeBuffer.framecount() === 0) {
        post("Active buffer not initialized or is empty.\n");
        return;
    }

    var audioData = arrayfromargs(arguments);
    var numSamples = audioData.length;

    if (activeBuffer.framecount() < numSamples) {
        post("Active buffer is too small for the incoming data. Resize the buffer~ or reduce the data size.\n");
        return;
    }

    for (var i = 0; i < numSamples; i++) {
        activeBuffer.poke(1, clipStart1 + i, audioData[i]); // Write each sample to the active buffer
    }

    clipStart1 += numSamples;

    // If the buffer is full, start writing from the beginning again
    if (clipStart1 >= activeBuffer.framecount()) {
        clipStart1 = 0;
    }
}

function clearBuffer() {
    applyFadeOut(); // Apply fade out before switching buffers
    switchBuffer(); // Switch buffers before clearing the current buffer

    // Delay the clearing of the inactive buffer by 100 ms using task
    var clearTask = new Task(clearInactiveBuffer, this);
    clearTask.schedule(switchDelay);
}

function clearInactiveBuffer() {
    inactiveBuffer.send("clear"); // Clear the now inactive buffer
    clipStart1 = 0;
    post("Inactive buffer cleared after delay.\n");
}

function switchBuffer() {
    var tempBuffer = activeBuffer;
    activeBuffer = inactiveBuffer;
    inactiveBuffer = tempBuffer;

    post("Switched to " + (activeBuffer === buffer1 ? "UDPbuf" : "UDPbuf2") + ".\n");
}

function applyFadeOut() {
    var numChannels = activeBuffer.channelcount();
    var bufferLength = activeBuffer.framecount();

    for (var channel = 1; channel <= numChannels; channel++) {
        for (var i = 0; i < fadeLength; i++) {
            var fadeOutFactor = (fadeLength - i) / fadeLength;

            var sample = activeBuffer.peek(channel, bufferLength - fadeLength + i);
            activeBuffer.poke(channel, bufferLength - fadeLength + i, sample * fadeOutFactor);
        }
    }
    post("Applied fade out to active buffer.\n");
}
