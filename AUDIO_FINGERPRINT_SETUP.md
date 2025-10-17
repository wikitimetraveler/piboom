# 🎵 Audio Fingerprinting Setup Guide

This guide explains how to set up the Shazam-like audio fingerprinting feature for the Pi BOOM system.

## Overview

The audio fingerprinting feature allows you to identify any song playing around your Raspberry Pi using microphone input. It works just like Shazam!

**Voice Commands:**
- "What song is this?"
- "What is this song?"
- "Identify song"
- "Name this song"

**Web Interface:**
- Navigate to `/song-identifier.html`
- Click the big button to start listening

## Prerequisites

### 1. ACRCloud Account (Free Tier Available)

The system uses ACRCloud API for audio fingerprinting. You'll need to sign up for a free account:

1. Visit [https://www.acrcloud.com/](https://www.acrcloud.com/)
2. Click "Sign Up" and create a free account
3. Go to Console → Audio & Video Recognition
4. Create a new project with "Audio & Video Recognition" type
5. Copy your credentials:
   - **Host**: (e.g., `identify-us-west-2.acrcloud.com`)
   - **Access Key**: Your access key
   - **Access Secret**: Your access secret

**Free Tier Limits:**
- 500 queries per day
- Perfect for personal use!

### 2. Required System Packages (Raspberry Pi)

The audio fingerprinting service needs to record audio from your microphone:

```bash
# Already included in setup-pi.sh, but you can install manually:
sudo apt-get update
sudo apt-get install -y alsa-utils
```

### 3. Microphone Setup

Make sure your USB microphone is connected and working:

```bash
# List audio input devices
arecord -l

# Test microphone recording (5 seconds)
arecord -D plughw:1,0 -f S16_LE -c 1 -r 44100 -d 5 test.wav
aplay test.wav

# If that doesn't work, try different device numbers:
arecord -D plughw:0,0 -f S16_LE -c 1 -r 44100 -d 5 test.wav
```

## Configuration

### Add to .env File

Add your ACRCloud credentials to the `.env` file in the project root:

```bash
# ACRCloud Audio Fingerprinting
ACRCLOUD_HOST=identify-us-west-2.acrcloud.com
ACRCLOUD_ACCESS_KEY=your_access_key_here
ACRCLOUD_ACCESS_SECRET=your_access_secret_here
```

**Example:**
```bash
ACRCLOUD_HOST=identify-us-west-2.acrcloud.com
ACRCLOUD_ACCESS_KEY=1a2b3c4d5e6f7g8h9i0j
ACRCLOUD_ACCESS_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

### Install Node Dependencies

```bash
# Install the form-data package (required for API calls)
npm install
```

## Usage

### Method 1: Voice Command

1. Start the Pi BOOM system: `npm run pi`
2. Open any page in your browser
3. Initialize voice recognition (click the microphone button)
4. Play a song on speakers or nearby device
5. Say: **"What song is this?"**
6. Wait 10 seconds while the system listens
7. The song will be identified and announced!

### Method 2: Web Interface

1. Navigate to `http://localhost:3000/song-identifier.html`
2. Click the big circular button
3. The system will listen for 10 seconds
4. Results will display with:
   - Song title and artist
   - Album art
   - Album name
   - Release date
   - Confidence score
   - Links to Spotify and YouTube

## How It Works

1. **Audio Recording**: Records 10 seconds of audio from the microphone at 44.1kHz (CD quality)
2. **Fingerprinting**: Creates an acoustic fingerprint of the audio
3. **API Request**: Sends the fingerprint to ACRCloud
4. **Matching**: ACRCloud matches against millions of songs in their database
5. **Results**: Returns song metadata, album art, and streaming links

## Troubleshooting

### "Audio fingerprinting not configured"

**Problem**: ACRCloud credentials are not set in `.env` file.

**Solution**:
```bash
# Edit .env file
nano .env

# Add ACRCloud credentials (see Configuration section above)
# Save and restart the server
npm run pi
```

### "Audio recording failed"

**Problem**: Microphone not detected or wrong device.

**Solution**:
```bash
# List all recording devices
arecord -l

# Test with different device numbers
arecord -D plughw:1,0 -d 5 test.wav  # Try device 1,0
arecord -D plughw:0,0 -d 5 test.wav  # Try device 0,0

# Edit services/audio-fingerprint.service.js and update the device:
# Line 27: '-D', 'plughw:1,0',  // Change 1,0 to your device number
```

### "No music detected" or Low Confidence Scores

**Problem**: Audio quality is poor or music is too quiet.

**Solution**:
- Increase the volume of the music source
- Move the microphone closer to the speakers
- Reduce background noise
- Make sure the song has been playing for at least 10 seconds
- Try recording for longer (edit duration parameter)

### "Rate limit exceeded"

**Problem**: You've exceeded the free tier limit (500 queries/day).

**Solution**:
- Wait 24 hours for the limit to reset
- Upgrade to a paid ACRCloud plan for more queries
- Use the feature more sparingly

## Advanced Configuration

### Change Recording Duration

Edit the API call to record for a different duration (in `controllers/audio-fingerprint.controller.js`):

```javascript
// Default is 10 seconds
const result = await fingerprintService.identifyCurrentlyPlaying(10);

// Change to 15 seconds for better accuracy
const result = await fingerprintService.identifyCurrentlyPlaying(15);
```

### Change Microphone Device

Edit `services/audio-fingerprint.service.js`, line 27:

```javascript
// Default device
'-D', 'plughw:1,0',

// Change to your device (check with arecord -l)
'-D', 'plughw:0,0',  // or whatever your device is
```

### Audio Quality Settings

The system uses optimal settings for ACRCloud:
- **Sample Rate**: 44100 Hz (CD quality)
- **Bit Depth**: 16-bit
- **Channels**: Mono (1 channel)
- **Format**: WAV (S16_LE)

These settings provide the best balance of quality and file size.

## API Response Details

The service returns comprehensive song information:

```javascript
{
  success: true,
  song: {
    title: "Song Title",
    artist: "Artist Name",
    album: "Album Name",
    releaseDate: "2023-01-15",
    duration: 240,  // seconds
    label: "Record Label",
    genres: ["Rock", "Alternative"],
    score: 95,  // confidence (0-100)
    
    // Streaming links
    spotify: "track_id",
    youtube: "video_id",
    deezer: "track_id",
    isrc: "USRC17607839",
    
    albumArt: "https://...",  // Album art URL
    confidence: 95  // 0-100
  },
  
  // Alternative matches if confidence is low
  alternativeMatches: [
    {
      title: "Similar Song",
      artist: "Similar Artist",
      score: 87
    }
  ]
}
```

## Testing

Test the service without voice commands:

```bash
# Start the server
npm run pi

# In another terminal, test the API directly
curl -X POST http://localhost:3000/api/audio-fingerprint/identify \
  -H "Content-Type: application/json" \
  -d '{"duration": 10}'
```

## Security Notes

- **Never commit your `.env` file** to version control
- Keep your ACRCloud credentials private
- The free tier is suitable for personal use
- Consider upgrading to a paid plan for production use

## Resources

- [ACRCloud Documentation](https://docs.acrcloud.com/)
- [ACRCloud Console](https://console.acrcloud.com/)
- [Audio Fingerprinting Wikipedia](https://en.wikipedia.org/wiki/Acoustic_fingerprint)

---

**🎵 Enjoy identifying songs with your Pi BOOM system! 🎵**

