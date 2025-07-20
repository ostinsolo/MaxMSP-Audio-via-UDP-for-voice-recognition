# Contributing to MaxMSP Audio via UDP for Voice Recognition

Thank you for your interest in contributing to this project! This document outlines how to contribute effectively.

## 🎯 **Project Goals**

This project aims to:
- Eliminate SoX dependency by using native Max/Ableton audio input
- Improve real-time UDP audio streaming performance
- Enhance speech recognition accuracy and speed
- Expand hardware integration capabilities

## 🚀 **How to Contribute**

### **Quick Start for Contributors**
1. Fork this repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Make your changes
5. Test with Max/MSP or Ableton Live
6. Submit a Pull Request

### **Types of Contributions We Need**

#### **🎛️ High Priority - Ableton/Max Audio Integration**
- **Direct audio capture from Ableton Live** (eliminating SoX)
- **Improved Max/MSP jit matrix processing**
- **Buffer optimization** for real-time audio
- **Cross-platform audio device handling**

#### **🌐 Network & Performance**
- **UDP packet optimization** for lower latency
- **Error recovery** for dropped packets  
- **Bandwidth optimization** techniques
- **Multi-client support** for UDP streaming

#### **🎤 Speech Recognition**
- **Additional Vosk language models**
- **Real-time transcription improvements**
- **Voice activity detection**
- **Custom vocabulary support**

#### **🔧 Developer Experience**
- **Better debugging tools**
- **Installation scripts** for different platforms
- **Docker containerization**
- **Unit tests** for core functions

## 📝 **Development Guidelines**

### **Code Style**
- Use **descriptive variable names** (e.g., `audioBufferSize`, not `abs`)
- Add **comprehensive comments** explaining MaxMSP integration points
- Follow **Node.js best practices** for async operations
- Include **error handling** for network operations

### **Audio Processing Standards**
```javascript
// Good: Clear audio processing with error handling
function processAudioChunk(matrixData) {
    try {
        const audioSamples = convertMatrixToFloat32(matrixData);
        if (audioSamples.length === 0) {
            throw new Error('No valid audio samples decoded');
        }
        return audioSamples;
    } catch (error) {
        Max.post(`Audio processing error: ${error.message}`);
        return [];
    }
}

// Bad: Unclear processing without error handling
function proc(data) {
    return convertMatrixToFloat32(data);
}
```

### **Testing Your Contributions**

#### **Required Tests**
1. **Audio Quality**: Test with real audio input from Max/Ableton
2. **Network Stability**: Run for 10+ minutes without dropouts
3. **Cross-Platform**: Test on macOS, Windows (if applicable)
4. **Performance**: Monitor CPU usage during operation

#### **Test Audio Files**
- Use the provided `output.wav` and `code/UDPoutput.wav` for reference
- Test with various sample rates (44.1kHz, 48kHz)
- Verify speech recognition accuracy with `sRtin.js`

## 🐛 **Reporting Issues**

### **Bug Reports**
Include:
- **Max/MSP or Ableton Live version**
- **Operating system** (macOS version, etc.)
- **Node.js version**
- **Audio interface/device** being used
- **Steps to reproduce** the issue
- **Console output** from MaxMSP and Node.js
- **Generated debug files** (`matrix_data.txt`, `float_data.txt`)

### **Feature Requests**
- **Describe the audio workflow** you want to improve
- **Explain the use case** (live performance, studio recording, etc.)
- **Suggest implementation approach** if you have ideas

## 🎛️ **Ableton Live Integration Priority**

We especially need help with:

### **Direct Ableton Audio Capture**
```javascript
// Current approach using SoX (we want to eliminate this)
const sox = require('sox-stream');

// Target approach - direct Ableton Live integration
const abletonAudio = require('ableton-live-audio'); // Doesn't exist yet!
```

### **Max for Live Device Enhancement**
- Improve the `UDP AUDIO.amxd` device
- Better jit matrix configuration
- Reduced latency audio capture
- Multiple audio channel support

## 📂 **Project Structure for New Contributors**

```
UDP AUDIO Project/
├── README.md              # Main documentation
├── CONTRIBUTING.md         # This file
├── code/
│   ├── UDP.js             # 🔥 Main UDP streaming (needs optimization)
│   ├── sRtin.js           # 🎤 Speech recognition (needs Ableton input)
│   ├── TCP.js             # Alternative protocol
│   └── writetobuf.js      # 🐛 Buffer management (has issues)
├── model/vosk-model/      # Speech recognition models
├── UDP AUDIO.amxd         # 🎛️ Max for Live device (needs enhancement)
└── package.json           # Dependencies
```

## 🏆 **Recognition**

Contributors will be:
- **Listed in README.md** contributors section
- **Credited in commit messages** for significant improvements
- **Invited to collaborate** on future audio tech projects

## 💬 **Getting Help**

- **Open an Issue** for questions about the codebase
- **Start a Discussion** for broader audio technology questions
- **Check existing Issues** to see if someone else had similar questions

## ⚡ **Quick Win Opportunities**

Perfect for first-time contributors:

1. **Fix matrix_data.txt NaN values** - debug the jit matrix header parsing
2. **Add error logging** to UDP packet processing
3. **Improve README examples** with more usage scenarios
4. **Add audio format validation** in the conversion functions
5. **Create installation scripts** for different operating systems

---

**Let's build better real-time audio tools together!** 🎵✨ 