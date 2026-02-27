#!/bin/bash

# Voice Recognition Setup Script for DevConnect Labs on Raspberry Pi
# This script installs all necessary dependencies for voice recognition

echo "🎤 Setting up Voice Recognition for DevConnect Labs..."

# Update package list
echo "📦 Updating package list..."
sudo apt update

# Install audio recording and processing tools
echo "🔧 Installing audio tools..."
sudo apt install -y sox espeak-ng alsa-utils portaudio19-dev libasound2-dev

# Install additional audio libraries
echo "🔧 Installing additional audio libraries..."
sudo apt install -y libportaudio2 libasound2-plugins

# Add user to audio group for microphone access
echo "👤 Adding user to audio group..."
sudo usermod -a -G audio $USER

# Test audio devices
echo "🎵 Testing audio devices..."
echo "Available audio input devices:"
arecord -l

echo "Available audio output devices:"
aplay -l

# Test microphone recording
echo "🎤 Testing microphone..."
echo "Recording 3 seconds of audio... (speak now!)"
arecord --duration=3 --format=S16_LE --rate=16000 test_voice.wav

if [ -f test_voice.wav ]; then
    echo "✅ Microphone test successful!"
    echo "Playing back recorded audio..."
    aplay test_voice.wav
    rm test_voice.wav
else
    echo "❌ Microphone test failed!"
fi

# Test text-to-speech
echo "🗣️ Testing text-to-speech..."
espeak "Voice recognition setup complete. The system is ready to listen for your commands."

# Check if Google Cloud credentials exist
if [ -f "google-credentials.json" ]; then
    echo "✅ Google Cloud credentials found"
else
    echo "⚠️ Google Cloud credentials not found. Voice recognition will use frontend Web Speech API"
fi

# Set up audio configuration
echo "🔧 Setting up audio configuration..."
cat > ~/.asoundrc << EOF
# Default audio device configuration
pcm.!default {
    type hw
    card 1
    device 0
}

ctl.!default {
    type hw
    card 1
}
EOF

echo "✅ Voice recognition setup complete!"
echo ""
echo "Next steps:"
echo "1. Reboot your Pi: sudo reboot"
echo "2. Start the server: MODE=pi npm start"
echo "3. Open the web interface and test voice recognition"
echo "4. Try voice commands like 'play', 'pause', 'next', 'volume up'"
echo ""
echo "Troubleshooting:"
echo "- If microphone doesn't work, check: arecord -l"
echo "- If no audio output, check: aplay -l"
echo "- Test microphone: arecord --duration=3 test.wav && aplay test.wav"
echo "- Test TTS: espeak 'Hello world'"