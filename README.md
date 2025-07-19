# MaxMSP Audio via UDP for Voice Recognition

A real-time audio streaming and voice recognition system using MaxMSP, Node.js, and UDP networking protocols. This project enables low-latency audio transmission from Max/MSP or Ableton Live to Node.js scripts for speech recognition processing.

## 🔗 Repository
- **GitHub**: [https://github.com/ostinsolo/MaxMSP-Audio-via-UDP-for-voice-recognition.git](https://github.com/ostinsolo/MaxMSP-Audio-via-UDP-for-voice-recognition.git)

## 📋 Prerequisites

### Required Software

1. **SoX (Sound eXchange)** - Audio processing library
   - **Download**: [https://sourceforge.net/projects/sox/files/latest/download](https://sourceforge.net/projects/sox/files/latest/download)
   - Install SoX and ensure it's available in your system PATH
   - *Note: Some scripts in this repo are working to eliminate the SoX dependency by using native Max/Ableton input instead*

2. **Node.js** (version 12 or higher)
   - Download from [nodejs.org](https://nodejs.org/)

3. **Max/MSP** or **Ableton Live** (with Max for Live)

## ⚡ Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/ostinsolo/MaxMSP-Audio-via-UDP-for-voice-recognition.git
cd MaxMSP-Audio-via-UDP-for-voice-recognition
```

### 2. Install Node Dependencies
```bash
npm install
```
*You can also add this command to a MaxMSP message box to install dependencies directly from Max*

### 3. Understanding Node.js in Max
- Open the Node.js helper in Max: **Help → Reference → node**
- Or **Option + Click** on any `node` object to see usage examples
- This will help you understand how Node.js scripts integrate with MaxMSP

### 4. Load the Max Device
- Open `UDP AUDIO.amxd` in Max/MSP or drag it to an Ableton Live track
- This device uses `jit` objects to capture audio as float32 matrices

## 🎯 Project Overview

This project implements **real-time audio streaming via UDP** for voice recognition applications. The system:

1. **Captures audio** using MaxMSP `jit` objects as float32 number matrices
2. **Transmits audio data** via UDP for low-latency networking
3. **Processes speech recognition** using the Vosk speech recognition library
4. **Supports multiple input sources** including Max/MSP audio input and Ableton Live

### Why UDP for Audio?
- **Low Latency**: Minimal delay for real-time applications
- **Fast Transmission**: No connection overhead
- **Real-time Friendly**: No retransmission delays that break audio timing
- **Efficient**: Optimal for streaming applications where occasional packet loss is acceptable

## 📁 Script Documentation

### Core Audio Transmission Scripts

#### `UDP.js` - **UDP Audio Streaming** ⚡ *[Recommended]*
- **Purpose**: Real-time audio transmission using UDP protocol
- **Use Case**: Low-latency audio streaming for live applications
- **Features**: Fast, connectionless transmission with minimal overhead
- **Best For**: Real-time audio streaming, live performance, voice chat

#### `TCP.js` - **TCP Audio Transmission**
- **Purpose**: Reliable audio transmission using TCP protocol  
- **Use Case**: Guaranteed audio delivery with higher latency
- **Features**: Connection-oriented, reliable data delivery
- **Best For**: Audio file transfer, non-real-time applications

#### `UDPdown.js` - **UDP Audio Receiver**
- **Purpose**: Handles incoming UDP audio streams
- **Use Case**: Receiving and processing UDP audio packets
- **Features**: Handles packet ordering and buffering for UDP streams
- **Integration**: Works with `UDP.js` for complete audio pipeline

### Speech Recognition & Processing

#### `sRtin.js` - **Speech Recognition Engine**
- **Purpose**: Real-time speech recognition with network audio
- **Dependencies**: Vosk speech recognition model
- **Features**: 
  - Converts audio streams to text
  - Supports multiple languages via Vosk models
  - Network-enabled for remote speech processing
- **Model Location**: `model/vosk-model/` directory

### Audio Management & Utilities

#### `writetobuf.js` - **Audio Buffer Management**
- **Purpose**: Handles audio buffering and memory management
- **Use Case**: Smooth audio playback and recording
- **Features**: Circular buffering, overflow/underflow protection
- **Critical For**: Maintaining audio quality during network transmission

#### `READING.js` - **Audio File Processing**
- **Purpose**: Reads and processes audio files
- **Use Case**: Loading audio files for analysis or transmission
- **Features**: File format handling, audio preprocessing
- **Supports**: WAV, and other audio formats via Node.js libraries

### Communication Protocols

#### `SERI.js` - **Serial Communication**
- **Purpose**: Hardware communication via serial ports
- **Use Case**: Connecting external devices, sensors, or controllers
- **Features**: RS-232, USB serial communication
- **Applications**: MIDI controllers, Arduino devices, hardware integration

### Legacy & Development Scripts

#### `OLDASA.js` - **Legacy Implementation**
- **Purpose**: Previous version of audio processing scripts
- **Status**: Kept for reference and backward compatibility

## 🛠 Technical Details

### Audio Processing Pipeline
1. **Input**: MaxMSP captures audio using `jit` objects
2. **Matrix Conversion**: Audio converted to float32 number matrices  
3. **Network Transmission**: Matrices sent via UDP to Node.js scripts
4. **Decoding**: Node.js scripts decode the float32 matrices back to audio
5. **Processing**: Audio processed for speech recognition or other applications

### Network Architecture
- **Primary Protocol**: UDP (User Datagram Protocol)
- **Port Configuration**: Configurable in individual scripts
- **Data Format**: Float32 audio matrices from MaxMSP `jit` objects
- **Sample Rate**: 44.1kHz input, 16kHz processing (for speech recognition)

### Dependencies Overview
```json
{
  "vosk": "Speech recognition engine",
  "sox-stream": "Audio processing (being phased out)",
  "serialport": "Hardware communication",
  "fluent-ffmpeg": "Audio format conversion",
  "max-api": "MaxMSP integration"
}
```

### Matrix Processing & Data Flow

#### **How MaxMSP Jit Objects Work**
Your MaxMSP device uses `jit` objects to capture audio as **float32 matrices**:

1. **Audio Capture**: MaxMSP records audio input
2. **Matrix Creation**: Audio converted to binary matrix format with header + audio data
3. **Network Transmission**: Matrix sent as UDP/TCP packets to Node.js scripts
4. **Header Skipping**: Scripts skip matrix header bytes to reach actual audio samples
5. **Float32 Decoding**: Binary data converted back to floating-point audio values

#### **Why We Skip Matrix Header Bytes**
MaxMSP jit matrices include metadata headers before the actual audio data. Different scripts skip different amounts:

- **`sRtin.js`**: Skips 524 bytes (131 * 4) - for speech recognition processing  
- **`UDP.js`**: Skips 12 bytes (3 * 4) - for basic UDP streaming
- **`oldscript/`**: Skips 296 bytes (74 * 4) - legacy implementation

*The skip count depends on your specific MaxMSP jit object configuration and matrix dimensions.*

## 📊 Debug Files & Audio Outputs

### **Text Files for Debugging** 
The scripts generate several text files to help you debug the matrix processing:

#### **`code/matrix_data.txt`**
- **Location**: `code/` directory
- **Contains**: Raw decoded float32 values from matrix processing
- **Purpose**: Debug matrix decoding - if you see `NaN` values, the matrix header skip count is wrong
- **How to Check**: Look for actual numbers vs. `NaN` - numbers mean successful decoding

#### **`code/float_data.txt`** 
- **Location**: `code/` directory  
- **Contains**: Processed float32 audio samples with index numbers
- **Format**: `index: value` (e.g., `0: 0.234`, `1: -0.123`)
- **Purpose**: Verify audio samples are being extracted correctly
- **Note**: Some scripts have this disabled with `// fs.appendFileSync`

### **Audio Output Files**
The scripts generate audio files you can listen to for testing:

#### **`output.wav`** (Root directory)
- **Location**: Project root folder
- **Contains**: Recorded audio from your sessions
- **Sample Rate**: 44,100 Hz (CD quality)  
- **Format**: 16-bit WAV file
- **How to Check**: Double-click to play in any audio player

#### **`code/UDPoutput.wav`**
- **Location**: `code/` directory
- **Contains**: Audio specifically processed through UDP streaming
- **Purpose**: Test UDP audio quality and verify network transmission
- **How to Check**: Compare with `output.wav` to check UDP vs. other protocols

### **How to Debug Your Setup**

1. **Check Matrix Processing**:
   ```bash
   # Look at matrix_data.txt
   head -20 code/matrix_data.txt
   # If you see NaN values, matrix header skip count needs adjustment
   ```

2. **Verify Audio Samples**:
   ```bash
   # Check float_data.txt (if enabled)
   tail -50 code/float_data.txt  
   # Should show: "index: audio_value" format
   ```

3. **Test Audio Quality**:
   - Play `output.wav` - should contain your recorded audio
   - Play `code/UDPoutput.wav` - should sound similar (UDP version)
   - No sound = matrix decoding problem
   - Distorted sound = wrong sample rate or bit depth

4. **Monitor Real-time Processing**:
   - Watch MaxMSP console for debug messages
   - Look for "converted X samples" or error messages
   - Check for "NaN" or "invalid audio value" warnings

## 🔧 Configuration

### Audio Settings
- **Input Sample Rate**: 44,100 Hz
- **Processing Sample Rate**: 16,000 Hz (for speech recognition)
- **Bit Depth**: 16-bit
- **Channels**: Mono (1 channel)

### Network Settings
- **Default UDP Port**: 7778
- **Default TCP Port**: 7474
- **Buffer Size**: Configurable per application

## 📖 Usage Examples

### Basic UDP Audio Streaming
1. Open `UDP AUDIO.amxd` in Max/MSP
2. Run `node code/UDP.js` to start the UDP server
3. Audio from Max will stream in real-time to the Node.js script

### Speech Recognition
1. Ensure Vosk model is installed in `model/vosk-model/`
2. Run `node code/sRtin.js` to start speech recognition
3. Speak into your audio input - text will be output in real-time

### Hardware Integration
1. Connect serial device to your computer
2. Run `node code/SERI.js` for serial communication
3. Configure port and baud rate as needed

## 🐛 Troubleshooting

### Common Issues
- **SoX not found**: Ensure SoX is installed and in your system PATH
- **Port conflicts**: Check if ports 7778/7474 are available
- **Audio dropouts**: Adjust buffer sizes in the scripts
- **Node modules missing**: Run `npm install` in the project directory

### Performance Optimization  
- Use UDP for lowest latency
- Adjust buffer sizes based on your system
- Monitor CPU usage during real-time processing
- Consider using dedicated audio interfaces for best results

## 🤝 Contributing

Feel free to contribute improvements, especially:
- Eliminating SoX dependency (work in progress)
- Performance optimizations
- Additional audio format support
- Enhanced error handling

## 📄 License

This project is open source. See LICENSE file for details.

---

*For support or questions, please open an issue on the GitHub repository.* 