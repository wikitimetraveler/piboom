# BOOM Project - Raspberry Pi 5 Audio System

A high-quality audio streaming and playback system built for the Raspberry Pi 5, featuring a custom wooden enclosure and modern web interface.

## 🎵 Features

- **Web-based Audio Player**: Modern, responsive interface accessible from any device
- **Audio Streaming**: Stream MP3 files directly to web browsers
- **VU Meter Visualization**: Real-time audio frequency visualization
- **Volume Control**: Both system and browser-based volume management
- **Cross-Platform**: Works on Windows for development, Pi for production
- **Real-time Updates**: WebSocket integration for live status updates

## 🛠️ Technical Stack

- **Backend**: Node.js with Express
- **Audio Processing**: Web Audio API with VU meter visualization
- **Real-time Communication**: Socket.IO
- **Frontend**: Vanilla JavaScript with Bootstrap styling
- **Audio Playback**: MP3 streaming with browser-native audio support

## 🏗️ Hardware

- **Raspberry Pi 5**: Main computing unit
- **Custom Wooden Enclosure**: Handcrafted wooden case by Steven Wedekind
- **Metal Components**: Custom metalwork and hardware by Steven Wedekind
- **Audio Output**: High-quality audio interface for premium sound

## 👨‍💻 Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
git clone <repository-url>
cd boom
npm install
```

### Environment Variables
```bash
# For Windows/Cloud development
MODE=cloud

# For Raspberry Pi production
MODE=pi

# Optional: Custom music directory
MUSIC_DIR=/path/to/music

# Optional: Custom port
PORT=3000
```

### Running
```bash
# Development mode (Windows)
npm start

# Production mode (Pi)
MODE=pi npm start
```

## 🎯 Usage

1. **Start the server**: `npm start`
2. **Open browser**: Navigate to `http://localhost:3000`
3. **Select audio file**: Choose from available MP3 files
4. **Control playback**: Use play/pause/stop controls
5. **Adjust volume**: Use the volume slider
6. **Monitor audio**: Watch the VU meter visualization

## 🚀 Deployment to Pi

1. **Transfer code** to Raspberry Pi 5
2. **Install dependencies**: `npm install`
3. **Set environment**: `export MODE=pi`
4. **Start server**: `npm start`
5. **Access remotely**: Use Pi's IP address in browser

## 👥 Credits

### Software Development
**David Lane** - Full-stack development, audio processing, web interface, and system architecture

### Hardware & Enclosure
**Steven Wedekind** - Custom wooden enclosure design, metal fabrication, and all physical components

## 📁 Project Structure

```
boom/
├── config/          # Configuration files
├── controllers/     # API controllers
├── lib/            # Utility libraries
├── music/          # Audio file storage
├── public/         # Web interface files
├── routes/         # API route definitions
├── services/       # Business logic services
├── server.js       # Main server entry point
└── README.md       # This file
```

## 🔧 Configuration Modes

### Cloud Mode (`MODE=cloud`)
- Browser-based audio streaming
- No system audio dependencies
- Perfect for development and testing

### Pi Mode (`MODE=pi`)
- System audio output via mpg123
- Hardware volume control via amixer
- Optimized for Raspberry Pi deployment

## 📝 License

This project is proprietary and confidential. All rights reserved.

---

*Built with ❤️ by David Lane & Steven Wedekind*
