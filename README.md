# 🎵 BOOM Box - Voice-Controlled Audio Player

A retro-style audio player with **real voice control** that works on both Windows (development) and Raspberry Pi (production). Built with Node.js, Express, and Web Speech API.

## ✨ Features

- 🎵 **Audio Playback**: MP3, WAV, FLAC, and more formats
- 🎤 **Voice Activation**: Control playback with voice commands
- 🔊 **Text-to-Speech**: Audible feedback and status updates
- 🎛️ **Volume Control**: Hardware and software volume management
- 🌐 **Web Interface**: Modern, responsive control panel
- 📱 **Mobile Friendly**: Works on all devices
- 🔄 **Cross-Platform**: Windows development, Raspberry Pi production
- 🎧 **High-Quality Audio**: Hifime UAE23HD USB Type C DAC (Sabre ES9018 + SA9023) for superior sound
- ⚡ **Real-time Control**: Instant response to voice commands

## 🎤 Voice Commands

Say these commands to control your BOOM box:

- **"play"** or **"start"** → Start music playback
- **"pause"** or **"stop"** → Pause music
- **"next"** or **"skip"** → Next track
- **"previous"** or **"back"** → Previous track  
- **"volume up"** or **"louder"** → Increase volume
- **"volume down"** or **"quieter"** → Decrease volume
- **"what song"** → Show current track info
- **"help"** → List available commands

## 🛠️ Technical Stack

- **Backend**: Node.js + Express
- **Audio**: `play-sound` library, `mpg123` (Pi mode)
- **Voice Recognition**: Web Speech API (browser-based)
- **Text-to-Speech**: `say` package (Windows), `espeak` (Pi)
- **Frontend**: Vanilla JavaScript, Web Audio API
- **Real-time**: Socket.IO for communication

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Windows 10/11 (development) or Raspberry Pi (production)

### Installation
```bash
git clone <your-repo>
cd boom
npm install
```

### Development Mode (Windows)
```bash
# Start the server
npm start

# Open http://localhost:3000/player.html
# Initialize Voice → Start Listening → Speak commands!
```

### Production Mode (Raspberry Pi)
```bash
# Switch to Pi mode
node switch-mode.js pi

# Install system dependencies
sudo apt install sox espeak-ng alsa-utils

# Start the server
npm start
```

## 🎯 Usage

### Voice Control Setup
1. **Initialize Voice** - Sets up speech recognition
2. **Start Listening** - Microphone activates, listens for commands
3. **Speak Commands** - Use natural language to control playback
4. **Stop Listening** - Deactivates microphone

### Manual Controls
- **File Selection**: Choose from your music library
- **Playback Controls**: Standard play/pause/next/previous buttons
- **Volume Slider**: Adjust audio level
- **VU Meter**: Visual audio level indicator

## 🔧 Configuration

### Environment Variables
```bash
MODE=cloud|pi          # Operating mode
MUSIC_DIR=./music      # Music directory path
PORT=3000              # Server port
```

### Easy Mode Switching
```bash
# Switch to Windows development mode
node switch-mode.js cloud

# Switch to Raspberry Pi production mode  
node switch-mode.js pi
```

## 🍓 Deployment to Pi

1. **Transfer files** to Raspberry Pi
2. **Switch to Pi mode**: `node switch-mode.js pi`
3. **Install dependencies**: `sudo apt install sox espeak-ng alsa-utils`
4. **Start server**: `npm start`
5. **Access from network**: `http://[pi-ip]:3000/player.html`

## 📁 Project Structure
```
boom/
├── config/           # Configuration files
├── controllers/      # API controllers
├── lib/             # Utility libraries
├── music/           # Music files directory
├── public/          # Web interface files
├── routes/          # API routes
├── services/        # Business logic services
├── server.js        # Main server file
├── switch-mode.js   # Mode switching utility
└── README.md        # This file
```

## 🎵 Supported Audio Formats
- MP3 (primary)
- WAV
- Other formats supported by `play-sound` library

## 🔍 Troubleshooting

### Voice Recognition Issues
- **Browser Compatibility**: Use Chrome, Edge, or Safari
- **Microphone Permissions**: Allow microphone access when prompted
- **HTTPS Required**: Some browsers require HTTPS for microphone access

### Audio Issues
- **Windows**: Ensure audio drivers are installed
- **Pi**: Check ALSA configuration and audio output

### Development vs Production
- **Windows**: Uses Web Speech API + `say` package
- **Pi**: Uses system audio tools (`arecord`, `espeak`)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on both Windows and Pi
5. Submit a pull request 

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Web Speech API for voice recognition
- `say` package for Windows text-to-speech
- `espeak` for Raspberry Pi text-to-speech
- Express.js community for the web framework

- **Special thanks** to **David Lane** (B.S. Pure Mathematics , A.S. Computer Science, Youngstown State University 1991 whose 30+ years of development experience guided this project's architecture and elegant coding solutions
- **AI Collaboration**: This project demonstrates the power of human expertise combined with AI assistance (ChatGPT and Cursor)
 **Special thanks** to **Steven Wedekind** for his master craftmanship with all things crafted
---
This shows that the BOOM box is the result of human mathematical ability + human craftmanship + development wisdom + AI collaboration - a perfect example of how the future of development should work! 🧮🤖🎵
**🎤 Ready to rock with voice control? Initialize Voice and Start Listening!** 🎵✨
