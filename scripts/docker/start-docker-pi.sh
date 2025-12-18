#!/bin/bash

echo "🐳 Starting Pi BOOM with Docker..."
echo "=================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "Installing Docker..."
    
    # Update package list
    sudo apt update
    
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    echo "✅ Docker installed! Please reboot and run this script again."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed!"
    echo "Installing Docker Compose..."
    
    sudo apt update
    sudo apt install -y docker-compose-plugin
    
    echo "✅ Docker Compose installed!"
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found! Creating template..."
    cat > .env << EOF
# Pi BOOM Environment Variables
NODE_ENV=production
MODE=pi
PORT=3000

# Add your API keys here:
# OPENAI_API_KEY=your_openai_key_here
# GOOGLE_CLOUD_PROJECT_ID=your_project_id_here
# GOOGLE_APPLICATION_CREDENTIALS=/app/google-credentials.json
EOF
    echo "📝 Please edit .env file with your API keys and run this script again."
    exit 1
fi

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
docker-compose -f docker-compose.pi.yml down

# Build and start the container
echo "🏗️  Building and starting Pi BOOM container..."
docker-compose -f docker-compose.pi.yml up --build -d

# Wait for container to be ready
echo "⏳ Waiting for container to start..."
sleep 10

# Check container status
if docker-compose -f docker-compose.pi.yml ps | grep -q "Up"; then
    echo "✅ Pi BOOM is running!"
    echo "🌐 Open http://localhost:3000 in your browser"
    echo "🎤 Voice activation will be available in Pi mode"
    echo ""
    echo "📊 Container status:"
    docker-compose -f docker-compose.pi.yml ps
    echo ""
    echo "📝 To view logs: docker-compose -f docker-compose.pi.yml logs -f"
    echo "🛑 To stop: docker-compose -f docker-compose.pi.yml down"
else
    echo "❌ Failed to start container!"
    echo "📝 Check logs: docker-compose -f docker-compose.pi.yml logs"
    exit 1
fi
