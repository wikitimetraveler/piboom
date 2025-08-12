# BOOM Project Setup Guide

## Hardware Assembly

### 1. Raspberry Pi 5 Setup
- Install microSD card with Raspberry Pi OS
- Connect 5V/5A power supply
- Ensure proper cooling (Pi 5 can get warm)

### 2. Audio Chain Assembly
- **Pi → DAC**: Connect HifiMe UAE23HD via USB-C to USB-A cable
- **DAC → Amplifier**: Connect via RCA stereo cable
- **Amplifier → Speakers**: Connect via 14 AWG speaker wire
- **Power**: Connect amplifier to power source

### 3. Display & Input
- Connect SunFounder 7" touchscreen to Pi
- Pair iClever BK09 Bluetooth keyboard
- Test touchscreen responsiveness

## Software Setup

### 1. System Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install audio tools
sudo apt install -y mpg123 alsa-utils

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Project Setup
```bash
# Clone/install project
cd /path/to/boom
npm install

# Create environment file
cp .env.example .env
# Edit .env as needed
```

### 3. Environment Configuration
```bash
# .env file should contain:
PORT=3000
MUSIC_DIR=./music
DEFAULT_VOLUME=70
MODE=pi  # Important: must be 'pi' for local audio
```

### 4. Audio System Configuration
```bash
# Check audio devices
aplay -l

# Set default audio device (if needed)
# Edit /etc/asound.conf or ~/.asoundrc
```

## Testing & Verification

### 1. Audio Test
```bash
# Test audio output
speaker-test -t wav -c 2

# Test mpg123
mpg123 /path/to/test.mp3
```

### 2. Web Interface
- Navigate to `http://your-pi-ip:3000`
- Upload music files to `./music` directory
- Test playback controls

## Troubleshooting

### Common Issues
- **No audio**: Check ALSA configuration, DAC connections
- **High latency**: Ensure Pi 5 has adequate cooling
- **Touchscreen not working**: Check display drivers and connections

### Performance Tips
- Use Class 10+ microSD for better I/O
- Ensure adequate power supply (5V/5A minimum)
- Monitor Pi 5 temperature during operation

