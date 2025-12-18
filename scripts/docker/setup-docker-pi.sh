#!/bin/bash

echo "🐳 Setting up Docker for Pi BOOM..."
echo "=================================="

# Update package list
echo "📦 Updating package list..."
sudo apt update

# Install Docker if not already installed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    echo "✅ Docker installed! Please logout and login again to use Docker."
else
    echo "✅ Docker already installed: $(docker --version)"
fi

# Install Docker Compose if not already installed
if ! command -v docker-compose &> /dev/null; then
    echo "🐳 Installing Docker Compose..."
    sudo apt install -y docker-compose-plugin
    
    # Create symlink for compatibility
    sudo ln -sf /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose
    
    echo "✅ Docker Compose installed!"
else
    echo "✅ Docker Compose already installed: $(docker-compose --version)"
fi

# Install audio tools for host system (needed for hardware access)
echo "🔊 Installing audio tools for host system..."
sudo apt install -y \
    alsa-utils \
    alsa-tools \
    pulseaudio \
    pulseaudio-utils

# Set up audio permissions
echo "🔐 Setting up audio permissions..."
sudo usermod -a -G audio $USER
sudo usermod -a -G pulse-access $USER

# Create audio configuration
echo "🎧 Creating audio configuration..."
sudo mkdir -p /etc/alsa/conf.d

# Create ALSA configuration for better audio support
sudo tee /etc/asound.conf > /dev/null << 'EOF'
# Pi BOOM Audio Configuration
pcm.!default {
    type hw
    card 0
    device 0
}

ctl.!default {
    type hw
    card 0
}

# USB audio support
pcm.usb {
    type hw
    card 1
    device 0
}

ctl.usb {
    type hw
    card 1
}
EOF

# Test audio setup
echo "🧪 Testing audio setup..."
echo "Available audio devices:"
arecord -l
echo ""
aplay -l

# Create .env template if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env template..."
    cat > .env << 'EOF'
# Pi BOOM Environment Variables
NODE_ENV=production
MODE=pi
PORT=3000

# Add your API keys here:
# OPENAI_API_KEY=your_openai_key_here
# GOOGLE_CLOUD_PROJECT_ID=your_project_id_here
# GOOGLE_APPLICATION_CREDENTIALS=/app/google-credentials.json
EOF
    echo "⚠️  Please edit .env file with your API keys!"
fi

# Make scripts executable
chmod +x start-docker-pi.sh

echo ""
echo "🎉 Docker setup complete for Pi BOOM!"
echo "====================================="
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Run: ./start-docker-pi.sh"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "Docker commands:"
echo "- Start: ./start-docker-pi.sh"
echo "- Stop: docker-compose -f docker-compose.pi.yml down"
echo "- Logs: docker-compose -f docker-compose.pi.yml logs -f"
echo "- Rebuild: docker-compose -f docker-compose.pi.yml up --build -d"
echo ""
echo "⚠️  You may need to logout and login again for Docker permissions to take effect."
