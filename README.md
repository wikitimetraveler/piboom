# 🎵 Pi BOOM Music Research System

A voice-activated Raspberry Pi system designed for comprehensive music research and discovery, with integrated audio playback capabilities. **Voice activation is the primary interface** - simply speak your commands to explore artists, get AI-powered insights, and control music playback.

**🔥 Multi-API Mashup Architecture**: This system intelligently combines multiple APIs and data sources to create a unified, comprehensive music research experience that no single service could provide alone.

## ✨ Primary Features

- **🎤 Voice-Activated Music Research**: "Search Pink Floyd", "Tell me about Tool", "Who is Maynard?"
- **🤖 ChatGPT AI Integration**: Ask anything about music - "Ask what makes Pink Floyd unique", "Recommend progressive metal", "Explain the difference between genres"
- **🗺️ Interactive Artist Maps**: Visualize band member birth places and musical journeys
- **📊 Comprehensive Timelines**: Chronological artist and band history
- **🎬 YouTube Integration**: Discover and play related music videos
- **🔍 Multi-Source Research**: Google Knowledge Graph, Wikipedia, MusicBrainz, and YouTube APIs
- **📱 Responsive Web Interface**: Beautiful, modern UI with collapsible sections

## 🔊 Secondary Features

- **🎵 Local Audio Player**: High-quality MP3 playback using mpg123
- **🎤 Voice-Controlled Playback**: "Play", "Pause", "Next", "Previous", "Volume up"
- **🔊 System Volume Control**: Hardware volume control via amixer/pactl
- **🎤 Text-to-Speech Feedback**: Voice confirmation using espeak
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

### 4. Start Music Research
- **Primary Interface**: Go to `http://localhost:3000/music-research.html` for the main music research system
- **Secondary Interface**: Go to `http://localhost:3000/player.html` for audio playback controls

### 5. Initialize Voice
Click "Initialize Voice" button to start voice recognition for hands-free operation

## 🎤 Voice Commands

### 🔍 Music Research Commands
| Command | Example | Action |
|---------|---------|---------|
| **search [artist]** | "search Pink Floyd" | Search for artist information |
| **tell me about [artist]** | "tell me about Tool" | Get detailed artist info |
| **who is [artist]** | "who is Maynard" | Quick artist lookup |
| **music research** | "music research" | Open research page |

### 🤖 ChatGPT AI Commands
| Command | Example | Action |
|---------|---------|---------|
| **ask [question]** | "ask what makes Pink Floyd unique" | Get AI insights about music |
| **recommend [genre/mood]** | "recommend progressive metal" | Get music recommendations |
| **explain [topic]** | "explain the difference between Pink Floyd and Led Zeppelin" | Get detailed explanations |

### 🎵 Audio Player Commands
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
- `express` - Web server framework
- `socket.io` - Real-time communication for voice commands
- `play-sound` - Audio playback interface
- `@google-cloud/speech` - Speech recognition (optional)
- `openai` - ChatGPT API integration for AI-powered music insights
- `axios` - HTTP client for multi-API requests
- `cors` - Cross-origin resource sharing for API calls

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

### ChatGPT Integration
- **API**: OpenAI GPT models for intelligent music analysis
- **Voice Commands**: "Ask [question]", "Recommend [genre]", "Explain [topic]"
- **Context-Aware**: Understands music terminology and artist relationships
- **Real-time Responses**: Instant AI insights delivered via voice and text

### Multi-API Configuration
- **Google APIs**: Knowledge Graph, Maps, and YouTube Data APIs
- **OpenAI API**: ChatGPT integration for AI analysis
- **Environment Variables**: All API keys stored securely in `.env` file
- **Rate Limiting**: Intelligent API usage to respect service limits
- **Fallback Handling**: Graceful degradation when APIs are unavailable

### Database Configuration (Optional)
- **PostgreSQL**: Album collection storage (optional)
- **Auto-creates tables**: Records table created on first run
- **Cloud-ready**: Works with Render's external database
- **Local development**: Works with or without database
- **No database?**: App runs normally, database features are disabled

To enable database features, add to your `.env` file:
```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md#-database-configuration) for detailed setup instructions.

## 🔥 Multi-API Mashup Architecture

This system creates a powerful music research platform by intelligently combining multiple APIs and data sources:

### 📊 Data Sources & APIs
| API/Service | Purpose | Data Provided |
|-------------|---------|---------------|
| **Google Knowledge Graph** | Artist Discovery | Rich entity data, images, descriptions |
| **Wikipedia API** | Detailed Information | Comprehensive biographies, band histories |
| **MusicBrainz API** | Music Metadata | Discographies, relationships, identifiers |
| **YouTube Data API** | Video Content | Music videos, live performances, interviews |
| **OpenAI ChatGPT** | AI Analysis | Intelligent insights, recommendations, explanations |
| **Google Maps API** | Geographic Data | Birth places, concert venues, geographic context |

### 🎯 Mashup Benefits
- **Comprehensive Coverage**: No single API provides complete artist information
- **Rich Context**: Combines factual data with AI analysis and visual content
- **Interactive Experience**: Maps, timelines, videos, and text in one interface
- **Voice Integration**: All data sources accessible through natural speech commands
- **Real-time Synthesis**: Multiple APIs queried simultaneously for instant results

### 🔄 Data Flow
1. **Voice Input** → Speech recognition processes command
2. **Multi-API Query** → System queries relevant APIs in parallel
3. **Data Fusion** → Results combined into unified presentation
4. **AI Enhancement** → ChatGPT adds analysis and insights
5. **Interactive Output** → Maps, timelines, videos, and text displayed together

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
