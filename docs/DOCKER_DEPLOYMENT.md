# Docker Deployment Guide for Pi BOOM

This guide explains how to deploy your Pi BOOM application using Docker, which includes all the necessary voice dependencies for cloud deployment.

## 🐳 What This Docker Setup Includes

### Voice Dependencies
- **espeak-ng** - Text-to-speech engine for voice responses
- **sox** - Audio processing for voice commands
- **alsa-utils** - Audio recording and playback utilities
- **mpg123** - MP3 audio playback
- **libasound2-dev** - ALSA development libraries
- **portaudio19-dev** - PortAudio development libraries

### Security Features
- Non-root user execution
- Health checks
- Proper environment variable handling
- Optimized layer caching

## 🚀 Quick Start

### Local Docker Development (Windows/Mac)

1. **Build the Docker image:**
   ```bash
   npm run docker:build
   ```

2. **Run the container:**
   ```bash
   npm run docker:run
   ```

3. **Or use Docker Compose:**
   ```bash
   docker-compose up -d
   ```

### Raspberry Pi Docker Deployment

1. **Setup Docker on Pi:**
   ```bash
   ./setup-docker-pi.sh
   ```

2. **Start Pi BOOM with Docker:**
   ```bash
   ./start-docker-pi.sh
   ```

3. **Or use npm scripts:**
   ```bash
   npm run docker:pi-build    # Build and start
   npm run docker:pi-logs     # View logs
   npm run docker:pi-stop     # Stop container
   ```

### Deploy to Render

1. **Push your code to GitHub** (make sure all files are committed)

2. **Connect to Render:**
   - Go to [render.com](https://render.com)
   - Connect your GitHub repository
   - Render will automatically detect the `render.yaml` file

3. **Set Environment Variables:**
   In Render dashboard, add your environment variables:
   ```
   OPENAI_API_KEY=your_openai_key
   GOOGLE_CLOUD_PROJECT_ID=your_project_id
   GOOGLE_APPLICATION_CREDENTIALS=/app/google-credentials.json
   DATABASE_URL=<automatically set if using render.yaml>
   ```
   
   **Note:** If you created a database separately in Render, you'll need to manually add the `DATABASE_URL` environment variable with your external database URL.

4. **Deploy:**
   - Render will automatically build and deploy using the Dockerfile
   - Your app will be available at the provided URL

## 💾 Database Configuration

### Local Development (Optional)

**Your app works WITHOUT a database** - database features are optional. If `DATABASE_URL` is not set, the app will run normally but skip database features.

To use the database locally, create a `.env` file:

```bash
# Option 1: Connect to Render's External Database
DATABASE_URL=postgresql://user:password@dpg-xxx.oregon-postgres.render.com:5432/piboom

# Option 2: Connect to Local PostgreSQL
DATABASE_URL=postgresql://localhost:5432/piboom

# Option 3: Leave blank (no database)
# DATABASE_URL=
```

### Getting Render's External Database URL

1. Go to your Render dashboard
2. Click on your database service
3. Find **External Database URL** in the dashboard
4. Copy and paste it into your local `.env` file

### Running Local PostgreSQL (Alternative)

If you want to run PostgreSQL locally instead:

```bash
# Install PostgreSQL
# Mac: brew install postgresql
# Windows: Download from postgresql.org
# Linux: sudo apt install postgresql

# Start PostgreSQL and create database
createdb piboom

# Add to .env
DATABASE_URL=postgresql://localhost:5432/piboom
```

## 🔧 Docker Commands

### Build Commands
```bash
# Build the Docker image
docker build -t devconnect-labs .

# Build with npm script
npm run docker:build
```

### Run Commands
```bash
# Run container with environment file
docker run -p 3000:3000 --env-file .env devconnect-labs

# Run with npm script
npm run docker:run

# Run in background
docker run -d -p 3000:3000 --env-file .env --name devconnect-labs-container devconnect-labs
```

### Docker Compose
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up --build -d
```

## 🎤 Voice Functionality

### What Works in Different Modes

#### Cloud Mode (Render/Heroku)
- **Text-to-Speech**: espeak-ng provides voice responses (console output)
- **Voice Recognition**: Frontend Web Speech API handles input
- **Chat Integration**: Full AI-powered responses
- **Music Research**: Complete API integration

#### Pi Mode (Local Pi with Docker)
- **Text-to-Speech**: espeak-ng with actual audio output through speakers
- **Voice Recognition**: Frontend Web Speech API + backend processing
- **Audio Playback**: Direct hardware access to speakers/headphones
- **Microphone Access**: Direct hardware access to USB/built-in mics
- **Music Playback**: Local file playback with hardware audio

### Mode Comparison
| Feature | Pi Mode (Docker) | Cloud Mode (Docker) |
|---------|------------------|---------------------|
| Voice Recognition | Frontend + Backend | Frontend Web Speech API |
| Text-to-Speech | espeak + hardware audio | espeak (console only) |
| Audio Playback | Local files + hardware | Web-based playback |
| Microphone Access | Direct hardware access | Browser permissions |
| Hardware Integration | Full Pi hardware access | No hardware access |

## 🔍 Troubleshooting

### Common Issues

#### "espeak not found"
- **Cause**: Docker image doesn't include espeak
- **Solution**: Rebuild the Docker image with the updated Dockerfile

#### "Audio device not available"
- **Cause**: Container doesn't have audio access
- **Solution**: This is expected in cloud mode - TTS will log to console

#### "Permission denied"
- **Cause**: Running as root or file permissions
- **Solution**: The Dockerfile creates a non-root user for security

#### "Environment variables not set"
- **Cause**: Missing .env file or incorrect variable names
- **Solution**: Check your .env file and Render environment variables

### Debug Commands
```bash
# Check container logs
docker logs devconnect-labs-container

# Enter container shell
docker exec -it devconnect-labs-container /bin/bash

# Test voice functionality
docker exec devconnect-labs-container espeak "Test message"

# Check health endpoint
curl http://localhost:3000/health
```

## 📁 File Structure

```
devconnect-labs/
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose setup
├── render.yaml            # Render deployment config
├── .dockerignore          # Files to exclude from Docker build
├── docs/DOCKER_DEPLOYMENT.md   # This guide
└── ...
```

## 🔒 Security Considerations

- **Non-root execution**: Container runs as `appuser`
- **Environment variables**: Sensitive data via .env file
- **Health checks**: Automatic container health monitoring
- **Minimal base image**: Uses slim Node.js image

## 🎯 Performance Optimization

- **Layer caching**: Dependencies installed before code copy
- **Production builds**: Only production npm packages
- **Health checks**: Automatic restart on failure
- **Resource limits**: Can be configured in docker-compose.yml

## 🌐 Production Deployment

### Render.com Setup
1. Connect GitHub repository
2. Select "Docker" as environment
3. Render will use the Dockerfile automatically
4. Set environment variables in dashboard
5. Deploy!

### Other Platforms
- **Heroku**: Add `heroku.yml` with Docker configuration
- **AWS ECS**: Use the Dockerfile directly
- **Google Cloud Run**: Deploy container image
- **DigitalOcean App Platform**: Use Docker deployment

## 📞 Support

If you encounter issues with Docker deployment:

1. Check the container logs: `docker logs <container-name>`
2. Verify environment variables are set correctly
3. Test locally first: `npm run docker:run`
4. Check Render deployment logs in dashboard

---

**Your Pi BOOM app now has full voice support in the cloud! 🎉**
