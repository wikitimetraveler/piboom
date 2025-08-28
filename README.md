# 🎵 Pi BOOM Audio System

A Raspberry Pi-powered audio system with voice activation, designed for hands-free music control and high-quality audio playback.

## ✨ Features

- **🎤 Voice Commands**: Control music with natural voice commands
- **🔊 High-Quality Audio**: Local audio playback using mpg123
- **🎵 Music Library**: Support for MP3, WAV, and FLAC formats
- **📱 Web Interface**: Touch-friendly web UI for manual control
- **🔊 System Volume Control**: Hardware volume control via amixer/pactl
- **🎤 Text-to-Speech**: Voice feedback using espeak
- **📡 Real-time Communication**: Socket.IO for instant voice command processing

## 🚀 Quick Start (Raspberry Pi)

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd piBoom
chmod +x setup-pi.sh
./setup-pi.sh
```

### 2. Start the System
```bash
npm run pi
```

### 3. Open Web Interface
Navigate to `http://localhost:3000` in your browser

### 4. Initialize Voice
Click "Initialize Voice" button to start voice recognition

## 🎤 Voice Commands

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

## 🛠️ System Requirements

- **Hardware**: Raspberry Pi 3B+ or newer (4B recommended)
- **OS**: Raspberry Pi OS (Bullseye or newer)
- **Storage**: 8GB+ SD card
- **Audio**: Built-in audio or USB audio interface
- **Microphone**: USB microphone or built-in mic (Pi 4)

## 📦 Dependencies

### System Tools
- `sox` - Audio processing
- `alsa-utils` - Audio recording and playback
- `espeak-ng` - Text-to-speech
- `mpg123` - MP3 playback
- `libasound2-dev` - ALSA development libraries
- `portaudio19-dev` - PortAudio development libraries

### Node.js Packages
- `express` - Web server
- `socket.io` - Real-time communication
- `play-sound` - Audio playback interface
- `@google-cloud/speech` - Speech recognition (optional)

## 🔧 Configuration

### Audio Settings
- **Sample Rate**: 16kHz for voice recognition
- **Channels**: Mono for voice, Stereo for music
- **Format**: 16-bit signed little-endian

### Voice Recognition
- **Engine**: Google Speech API (configurable)
- **Language**: English (configurable)
- **Timeout**: 3-second audio chunks
- **Silence Removal**: Automatic silence detection

## 📁 Project Structure

```
piBoom/
├── config/          # Configuration files
├── controllers/     # API controllers
├── lib/            # Utility libraries
├── music/          # Music library
├── public/         # Web interface
├── routes/         # API routes
├── services/       # Core services
├── setup-pi.sh     # Pi setup script
└── server.js       # Main server
```

## 🎯 Pi Mode Features

- **Local Audio Playback**: Direct hardware audio output
- **System Volume Control**: Hardware volume via amixer
- **Voice Recognition**: Real-time microphone input
- **Text-to-Speech**: Local espeak synthesis
- **Audio Processing**: Real-time audio analysis

## 🔍 Troubleshooting

### Microphone Issues
```bash
# Check microphone permissions
groups $USER

# List audio devices
arecord -l
aplay -l

# Test microphone
arecord --duration=5 test.wav
aplay test.wav
```

### Audio Playback Issues
```bash
# Check volume
amixer sget Master

# Set volume
amixer sset Master 70%

# Test audio
mpg123 --version
```

### Voice Recognition Issues
```bash
# Check espeak
espeak "test" --stdout | aplay

# Check sox
sox --version

# Restart audio service
sudo systemctl restart alsa-utils
```

## 🚀 Deployment

### Production Setup
1. Run `./setup-pi.sh` for initial setup
2. Configure audio devices in `~/.asoundrc`
3. Set up auto-start with systemd
4. Configure firewall rules
5. Set up SSL certificates (optional)

### Auto-start Service
```bash
sudo nano /etc/systemd/system/pi-boom.service
```

```ini
[Unit]
Description=Pi BOOM Audio System
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/piBoom
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable pi-boom
sudo systemctl start pi-boom
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on Raspberry Pi
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Raspberry Pi Foundation for the amazing hardware
- ALSA project for audio support
- Node.js community for the runtime
- Open source audio tools (sox, espeak, mpg123)

---

**🎵 Pi BOOM - Your Voice-Controlled Audio Companion! 🎵**
