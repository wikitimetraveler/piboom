#!/bin/bash

echo "🎵 Setting up Pi BOOM Audio System..."
echo "======================================"

# Update package list
echo "📦 Updating package list..."
sudo apt update

# Install audio and voice dependencies
echo "🔊 Installing audio tools..."
sudo apt install -y sox alsa-utils espeak-ng mpg123

# Install additional audio libraries
echo "🎤 Installing audio libraries..."
sudo apt install -y libasound2-dev portaudio19-dev

# Install Node.js if not already installed
if ! command -v node &> /dev/null; then
    echo "📱 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "📦 Installing npm..."
    sudo apt-get install -y npm
else
    echo "✅ npm already installed: $(npm --version)"
fi

# Set up audio permissions
echo "🔐 Setting up audio permissions..."
sudo usermod -a -G audio $USER

# Create .asoundrc for better audio configuration
echo "🎧 Creating audio configuration..."
cat > ~/.asoundrc << EOF
pcm.!default {
    type hw
    card 0
    device 0
}

ctl.!default {
    type hw
    card 0
}
EOF

# Test audio tools
echo "🧪 Testing audio tools..."
echo "Testing arecord..."
arecord --duration=2 test.wav
if [ $? -eq 0 ]; then
    echo "✅ arecord working"
    rm test.wav
else
    echo "❌ arecord failed"
fi

echo "Testing espeak..."
espeak "Audio system test" --stdout | aplay -f S16_LE -r 22050 -c 1
if [ $? -eq 0 ]; then
    echo "✅ espeak working"
else
    echo "❌ espeak failed"
fi

echo "Testing mpg123..."
mpg123 --version
if [ $? -eq 0 ]; then
    echo "✅ mpg123 working"
else
    echo "❌ mpg123 failed"
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

echo ""
echo "🎉 Pi BOOM setup complete!"
echo "=========================="
echo "Next steps:"
echo "1. Reboot your Pi: sudo reboot"
echo "2. Start the system: npm run pi"
echo "3. Open http://localhost:3000 in your browser"
echo "4. Click 'Initialize Voice' to start voice recognition"
echo ""
echo "Voice commands available:"
echo "- 'play', 'pause', 'next', 'previous'"
echo "- 'volume up', 'volume down'"
echo "- 'what song', 'help'"
echo ""
echo "For troubleshooting, check:"
echo "- Microphone permissions: groups $USER"
echo "- Audio devices: arecord -l && aplay -l"
echo "- Volume control: amixer sget Master"
