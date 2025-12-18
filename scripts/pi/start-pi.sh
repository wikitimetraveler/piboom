#!/bin/bash

# Pi BOOM Audio System Startup Script
# This script sets up the environment for Pi mode operation

echo "🎵 Starting Pi BOOM Audio System in Pi mode..."

# Set the mode to Pi
export MODE=pi

# Set Google Cloud credentials path
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/google-credentials.json"

# Verify the credentials file exists
if [ ! -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "❌ Error: Google Cloud credentials file not found at $GOOGLE_APPLICATION_CREDENTIALS"
    echo "Please ensure google-credentials.json is in the current directory"
    exit 1
fi

echo "✅ Google Cloud credentials found at: $GOOGLE_APPLICATION_CREDENTIALS"

# Check if required audio tools are installed
echo "🔍 Checking system dependencies..."
if ! command -v arecord &> /dev/null; then
    echo "❌ Error: arecord not found. Please install alsa-utils: sudo apt install alsa-utils"
    exit 1
fi

if ! command -v sox &> /dev/null; then
    echo "❌ Error: sox not found. Please install sox: sudo apt install sox"
    exit 1
fi

if ! command -v espeak &> /dev/null; then
    echo "❌ Error: espeak not found. Please install espeak-ng: sudo apt install espeak-ng"
    exit 1
fi

echo "✅ All required audio tools are installed"

# Check if we're on a Raspberry Pi
if [ -f "/proc/device-tree/model" ]; then
    PI_MODEL=$(cat /proc/device-tree/model)
    echo "🍓 Running on: $PI_MODEL"
else
    echo "⚠️  Warning: Not running on Raspberry Pi hardware"
    echo "   Voice recognition may not work properly on non-Pi systems"
fi

echo "🚀 Starting server in Pi mode..."
echo "   Mode: $MODE"
echo "   Google Credentials: $GOOGLE_APPLICATION_CREDENTIALS"
echo "   Port: 3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
npm start
