# Use Node.js 18 LTS as base image
FROM node:18-bullseye-slim

# Set working directory
WORKDIR /app

# Install system dependencies for voice functionality
RUN apt-get update && apt-get install -y \
    # Audio processing tools
    sox \
    alsa-utils \
    espeak-ng \
    mpg123 \
    # Audio development libraries
    libasound2-dev \
    portaudio19-dev \
    # Additional utilities
    curl \
    wget \
    # Clean up
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create audio configuration for container
RUN echo 'pcm.!default {\n    type hw\n    card 0\n    device 0\n}\nctl.!default {\n    type hw\n    card 0\n}' > /etc/asound.conf

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 3000

# Set environment variables for cloud deployment
ENV NODE_ENV=production
ENV MODE=cloud
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]
