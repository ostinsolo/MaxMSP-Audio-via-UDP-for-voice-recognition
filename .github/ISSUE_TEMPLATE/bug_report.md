---
name: Bug Report
about: Report a bug with audio processing, networking, or speech recognition
title: '[BUG] '
labels: 'bug'
assignees: ''
---

## 🐛 **Bug Description**
A clear description of what the bug is.

## 🎛️ **Audio Setup**
- **Max/MSP Version**: (e.g., Max 8.5.6)
- **Ableton Live Version**: (if using Max for Live)
- **Audio Interface**: (e.g., Built-in, Focusrite, etc.)
- **Sample Rate**: (e.g., 44100 Hz)
- **Buffer Size**: (e.g., 128 samples)

## 💻 **System Info**
- **OS**: (e.g., macOS 13.5, Windows 11)
- **Node.js Version**: `node --version`
- **npm Version**: `npm --version`

## 🔄 **Steps to Reproduce**
1. Open MaxMSP and load `UDP AUDIO.amxd`
2. Run `node code/UDP.js`
3. Start audio playback in Ableton/Max
4. Observe the issue...

## ❌ **Expected vs Actual Behavior**
**Expected**: Audio should stream smoothly with no dropouts
**Actual**: Getting audio dropouts every few seconds

## 📊 **Debug Information**

### **Console Output**
```
Paste MaxMSP console output here
```

```
Paste Node.js console output here
```

### **Generated Files**
- [ ] `code/matrix_data.txt` shows: (numbers/NaN values)
- [ ] `code/float_data.txt` shows: (normal values/errors)
- [ ] `output.wav` plays: (normal audio/silence/distortion)

### **Network Information**
- **UDP Port**: (default 7778)
- **Packet Loss**: (if known)
- **Local/Remote**: (localhost or network streaming)

## 📎 **Additional Context**
- Screenshots of MaxMSP patch
- Audio samples demonstrating the issue
- Any custom modifications to the scripts

## 🎯 **Priority Impact**
- [ ] Blocks development work
- [ ] Affects live performance
- [ ] Minor inconvenience
- [ ] Feature request 