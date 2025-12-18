# Voice Activation Setup Guide for BOOM Project

This guide explains how to set up voice activation on your Raspberry Pi 5 for the BOOM audio system.

## 🎤 What Voice Activation Does

- **Voice Commands**: Control your music with voice commands like "play", "pause", "volume up"
- **Text-to-Speech**: The system speaks back to confirm commands and provide feedback
- **Hands-Free Operation**: Perfect for when you're working on projects or have messy hands
- **Accessibility**: Makes the system easier to use for everyone

## 🛠️ Required System Dependencies

### Install Audio Tools
```bash
# Update package list
sudo apt update

# Install audio recording and processing tools
sudo apt install sox espeak-ng alsa-utils

# Install additional audio libraries
sudo apt install libasound2-dev portaudio19-dev
```

### Verify Installation
```bash
# Check if tools are available
which arecord
which sox
which espeak
which aplay

# Test audio recording
arecord --duration=3 test.wav
aplay test.wav
rm test.wav
```

## 🎯 Voice Commands Available

| Command | Aliases | Action |
|---------|---------|---------|
| **play** | start, begin, go | Start playing current track |
| **pause** | stop, halt, wait | Pause current track |
| **next** | skip, forward, advance | Skip to next track |
| **previous** | back, rewind, last | Go to previous track |
| **volume up** | louder, turn up | Increase volume by 10% |
| **volume down** | quieter, turn down | Decrease volume by 10% |
| **what song** | what track, current song | Announce current track |
| **help** | commands, what can you do | List available commands |

## 🚀 Setup Steps

### 1. Install Node.js Dependencies
```bash
cd /path/to/boom
npm install
```

### 2. Test Voice System
1. Start the server: `MODE=pi npm start`
2. Open the web interface
3. Click "Initialize Voice" button
4. Click "Test Voice" to hear the system speak
5. Click "Start Listening" to begin voice recognition

### 3. Configure Audio Devices
```bash
# List available audio devices
arecord -l
aplay -l

# Set default audio device (if needed)
# Edit /etc/asound.conf or ~/.asoundrc
```

## 🔧 Troubleshooting

### Common Issues

#### "Voice service not available"
- **Cause**: Not running in Pi mode
- **Solution**: Set `MODE=pi` environment variable

#### "Missing audio recording tools"
- **Cause**: sox or arecord not installed
- **Solution**: Run `sudo apt install sox alsa-utils`

#### "No audio input detected"
- **Cause**: Microphone not configured or permissions issue
- **Solution**: 
  ```bash
  # Check microphone permissions
  sudo usermod -a -G audio $USER
  
  # Test microphone
  arecord --duration=5 test.wav
  aplay test.wav
  ```

#### "Voice feedback not working"
- **Cause**: espeak not installed or audio output issue
- **Solution**: 
  ```bash
  sudo apt install espeak-ng
  espeak "Test message"
  ```

### Audio Device Configuration

#### USB Microphone
```bash
# List USB audio devices
lsusb | grep -i audio

# Set as default (edit ~/.asoundrc)
pcm.!default {
    type hw
    card 1
    device 0
}
```

#### Built-in Audio
```bash
# Use built-in audio
pcm.!default {
    type hw
    card 0
    device 0
}
```

## 🎵 Advanced Configuration

### Custom Voice Commands
Edit `services/voice.service.js` to add new commands:

```javascript
let voiceCommands = {
  'play': ['play', 'start', 'begin', 'go'],
  'custom': ['your', 'custom', 'words'],  // Add new command
  // ... existing commands
};
```

### Voice Recognition Accuracy
- Speak clearly and at normal volume
- Minimize background noise
- Use consistent phrasing
- Position microphone 6-12 inches from mouth

### Performance Optimization
```bash
# Reduce CPU usage by limiting audio processing
# Edit voice.service.js to adjust recording duration and quality

# Lower sample rate for faster processing
'-r', '8000',  // Instead of 16000
```

## 🔒 Security Considerations

- Voice commands are processed locally on the Pi
- No audio data is sent to external services
- Commands are limited to audio playback functions
- System can be disabled via web interface

## 📱 Integration with Touchscreen

The voice system works alongside the touchscreen interface:
- Use voice for quick commands
- Use touchscreen for detailed control
- Both interfaces stay synchronized
- Voice feedback confirms all actions

## 🎉 Getting Started

1. **Install dependencies** using the commands above
2. **Start the server** in Pi mode
3. **Initialize voice** from the web interface
4. **Test the system** with voice commands
5. **Enjoy hands-free** music control!

---

*Voice activation makes your BOOM box truly hands-free and accessible!*
