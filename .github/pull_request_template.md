## 📋 **Pull Request Summary**
Brief description of what this PR accomplishes.

## 🎯 **Type of Change**
- [ ] 🐛 Bug fix (fixes an issue)
- [ ] ✨ New feature (adds functionality)
- [ ] 🎛️ Ableton/Max integration improvement
- [ ] ⚡ Performance optimization
- [ ] 📝 Documentation update
- [ ] 🔧 Development tool/infrastructure
- [ ] 🧹 Code cleanup/refactoring

## 🔗 **Related Issues**
Closes #(issue_number)
Related to #(issue_number)

## 🧪 **Testing Performed**

### **Audio Testing**
- [ ] Tested with MaxMSP audio input
- [ ] Tested with Ableton Live (Max for Live)
- [ ] Verified `output.wav` generates correctly
- [ ] Confirmed `code/UDPoutput.wav` quality
- [ ] Tested speech recognition with `sRtin.js`

### **System Testing**
- [ ] macOS testing
- [ ] Windows testing (if applicable)
- [ ] Different audio interfaces tested
- [ ] Various sample rates tested (44.1kHz, 48kHz)

### **Network Testing**
- [ ] UDP streaming stability (10+ minutes)
- [ ] Packet loss handling
- [ ] Multi-client support (if applicable)
- [ ] Latency measurements

## 📊 **Debug File Verification**
- [ ] `code/matrix_data.txt` shows valid numbers (not NaN)
- [ ] `code/float_data.txt` has proper index: value format
- [ ] No errors in MaxMSP console output
- [ ] Node.js console shows expected behavior

## ⚡ **Performance Impact**
- [ ] No performance regression
- [ ] Improved latency: (before/after measurements)
- [ ] Reduced CPU usage: (before/after %)
- [ ] Memory usage optimized

## 💻 **Code Quality**
- [ ] Added error handling for new features
- [ ] Included descriptive comments for MaxMSP integration points
- [ ] Followed project coding standards
- [ ] Updated documentation if needed

## 🎛️ **Ableton Live Integration** (if applicable)
- [ ] Reduces SoX dependency
- [ ] Improves direct audio capture
- [ ] Enhances Max for Live device functionality
- [ ] Better jit matrix processing

## 📸 **Screenshots/Evidence** (Optional)
- MaxMSP patch screenshots
- Console output examples
- Audio waveform comparisons
- Performance graphs

## ⚠️ **Breaking Changes**
- [ ] No breaking changes
- [ ] Breaking changes (explain below)

**Breaking Change Details:**
(Describe any API changes, configuration changes, or compatibility issues)

## 📝 **Additional Notes**
- Dependencies added/removed
- Configuration changes required
- Future improvement opportunities
- Known limitations

## ✅ **Final Checklist**
- [ ] Code compiles and runs without errors
- [ ] All tests pass (manual audio testing)
- [ ] Documentation updated (if needed)
- [ ] CONTRIBUTING.md guidelines followed
- [ ] Ready for review and merge 