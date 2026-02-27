# 🎵 BOOM Box - Setup & Configuration Guide

Complete setup instructions for the voice-controlled BOOM box audio system.

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone <your-repo>
cd boom
npm install
```

### 2. Add Music Files
```bash
# Copy your MP3 files to the music directory
cp /path/to/your/music/*.mp3 ./music/
```

### 3. Configure Environment Variables
Create a `.env` file in the project root:
```bash
# DevConnect Labs Environment Variables

# Mode: 'pi' for Raspberry Pi, 'cloud' for cloud deployment
MODE=pi

# Port (default: 3000)
PORT=3000

# Music directory path
MUSIC_DIR=./music

# Default volume (0-100)
DEFAULT_VOLUME=70

# Google API Key (for Knowledge Graph, YouTube, and Maps)
GOOGLE_API_KEY=your_google_api_key_here

# OpenAI API Key (for ChatGPT integration)
OPENAI_API_KEY=your_openai_api_key_here

# Unsplash API Key (for high-quality poster images in Black Light page)
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here

# Songkick API (for Live Concert Finder)
SONGKICK_API_KEY=your_songkick_api_key_here
```

#### Getting API Keys

**Unsplash API (Free)**
1. Go to https://unsplash.com/developers
2. Sign up for a developer account
3. Create a new application
4. Copy your "Access Key" and paste it as `UNSPLASH_ACCESS_KEY` in your `.env` file
5. Free tier: 50 requests/hour

**Songkick API (Free)**
1. Go to https://www.songkick.com/developer
2. Click "Request an API key"
3. Fill out the simple form (usually approved instantly)
4. Copy your API key
5. Add it as `SONGKICK_API_KEY` in your `.env` file
6. Free tier: 5,000 requests/day

**Google API Key**
- Get from Google Cloud Console for Knowledge Graph, YouTube Data API, and Maps

**OpenAI API Key**
- Get from https://platform.openai.com/api-keys

### 4. Start Development Mode
```bash
npm start
# Open http://localhost:3000/player.html
```

## 🔧 Development vs Production Setup

### Windows Development Mode
- **Voice Recognition**: Web Speech API (browser-based)
- **Text-to-Speech**: `say` package
- **Audio Playback**: Browser audio
- **No system dependencies required**

### Raspberry Pi Production Mode
- **Voice Recognition**: System audio tools (`arecord`, `sox`)
- **Text-to-Speech**: `espeak-ng`
- **Audio Playback**: System audio (`mpg123`)
- **Requires system dependencies**

## 🍓 Raspberry Pi Setup

### Prerequisites
- Raspberry Pi 5 with Raspberry Pi OS 64-bit
- MicroSD card (32GB+ recommended)
- Power supply (5V/3A USB-C)
- Network connection (WiFi or Ethernet)

### Initial Pi Setup
```bash
# Update system
sudo apt update && sudo apt upgrade

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be 18.x or higher
npm --version   # Should be 9.x or higher
```

### Install System Dependencies
```bash
# Audio processing tools
sudo apt install sox espeak-ng alsa-utils

# Audio playback
sudo apt install mpg123

# Additional tools
sudo apt install git curl wget
```

### Audio Configuration
```bash
# List audio devices
aplay -l

# Set default audio output (adjust card/device numbers)
sudo nano /etc/asound.conf

# Add this content (adjust for your setup):
pcm.!default {
    type hw
    card 0
    device 0
}

ctl.!default {
    type hw
    card 0
}
```

### Test Audio Setup
```bash
# Test speaker output
speaker-test -t wav -c 2 -l 1

# Test microphone input
arecord -f S16_LE -r 16000 -c 1 -D hw:1,0 test.wav
aplay test.wav

# Test text-to-speech
espeak "Hello from your BOOM box"
```

## 🎤 Voice Control Configuration

### Microphone Setup
1. **Connect USB microphone** to Pi
2. **Check device**: `arecord -l`
3. **Test input levels**: `alsamixer`
4. **Set gain**: Adjust microphone volume to 70-80%

### Voice Recognition Testing
```bash
# Test basic audio capture
arecord -f S16_LE -r 16000 -c 1 -D hw:1,0 -d 5 test.wav

# Test with sox processing
arecord -f S16_LE -r 16000 -c 1 -D hw:1,0 | sox -t raw -r 16000 -s 2 -c 1 - -t wav processed.wav
```

### Command Recognition
The system recognizes these voice commands:
- **"play"** / **"start"** / **"begin"**
- **"pause"** / **"stop"** / **"halt"**
- **"next"** / **"skip"** / **"forward"**
- **"previous"** / **"back"** / **"rewind"**
- **"volume up"** / **"louder"** / **"turn up"**
- **"volume down"** / **"quieter"** / **"turn down"**
- **"what song"** / **"what track"** / **"what is playing"**
- **"help"** / **"commands"** / **"what can you do"**

## 🔄 Mode Switching

### Switch to Pi Mode
```bash
node switch-mode.js pi
```

### Switch to Windows Mode
```bash
node switch-mode.js cloud
```

### Manual Mode Switch
Edit `config/index.js`:
```javascript
const DEV_MODE = 'pi';  // 'pi' for Raspberry Pi, 'cloud' for Windows
```

## 🌐 Network Configuration

### WiFi Setup
```bash
# Configure WiFi
sudo raspi-config
# Navigate to: System Options → Wireless LAN

# Or edit manually
sudo nano /etc/wpa_supplicant/wpa_supplicant.conf
```

### Static IP (Optional)
```bash
sudo nano /etc/dhcpcd.conf

# Add at the end:
interface wlan0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=8.8.8.8
```

### Firewall Configuration
```bash
# Allow web access
sudo ufw allow 3000

# Enable firewall
sudo ufw enable
```

## 📱 Web Interface Access

### Local Access
- **Development**: `http://localhost:3000/player.html`
- **Pi Local**: `http://raspberrypi.local:3000/player.html`

### Network Access
- **From other devices**: `http://[pi-ip-address]:3000/player.html`
- **Find Pi IP**: `hostname -I` or check router admin panel

### HTTPS Setup (Optional)
```bash
# Install certbot
sudo apt install certbot

# Get SSL certificate
sudo certbot certonly --standalone -d yourdomain.com

# Configure Express to use HTTPS
```

## 🔍 Troubleshooting

### Common Issues

#### No Audio Output
```bash
# Check audio devices
aplay -l

# Test ALSA
speaker-test -t wav -c 2 -l 1

# Check volume levels
alsamixer
```

#### Voice Recognition Not Working
```bash
# Test microphone
arecord -f S16_LE -r 16000 -c 1 -D hw:1,0 test.wav

# Check microphone levels
alsamixer

# Verify dependencies
which arecord sox espeak-ng
```

#### Network Access Issues
```bash
# Check Pi IP address
hostname -I

# Test network connectivity
ping 8.8.8.8

# Check firewall
sudo ufw status
```

#### Node.js Issues
```bash
# Check Node.js version
node --version

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Performance Optimization

#### Audio Latency
```bash
# Edit ALSA configuration
sudo nano /etc/asound.conf

# Add low-latency settings
pcm.!default {
    type hw
    card 0
    device 0
    rate 48000
    period_size 256
    buffer_size 1024
}
```

#### System Resources
```bash
# Monitor system resources
htop

# Check audio processes
ps aux | grep -E "(arecord|sox|espeak|mpg123)"

# Monitor audio devices
watch -n 1 "cat /proc/asound/card*/pcm*/sub*/hw_params"
```

## 📊 Monitoring & Logs

### Application Logs
```bash
# View real-time logs
npm start

# Check for errors in console output
# Look for voice recognition and audio processing messages
```

### System Logs
```bash
# Audio system logs
dmesg | grep -i audio

# ALSA logs
cat /var/log/alsa.log

# System messages
journalctl -f
```

### Performance Monitoring
```bash
# CPU usage
top -p $(pgrep -f "node.*server.js")

# Memory usage
free -h

# Audio device status
cat /proc/asound/card*/pcm*/sub*/hw_params
```

## 🔒 Security Considerations

### Network Security
- **Change default Pi password**
- **Use strong WiFi password**
- **Consider VPN for remote access**
- **Regular system updates**

### Application Security
- **Environment variables** for sensitive config
- **Input validation** for voice commands
- **Rate limiting** for API endpoints
- **HTTPS** for production deployment

## 📝 Maintenance

### Regular Updates
```bash
# System updates
sudo apt update && sudo apt upgrade

# Node.js updates
npm update -g npm
npm update

# Check for security updates
npm audit
```

### Backup Configuration
```bash
# Backup important files
cp config/index.js config/index.js.backup
cp .env .env.backup

# Backup music library
rsync -av music/ /backup/music/
```

---

**🎵 Your BOOM box is ready to rock with voice control! Follow these steps for a smooth setup experience.** 🚀✨

