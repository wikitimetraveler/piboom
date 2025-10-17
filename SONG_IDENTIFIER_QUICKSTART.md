# 🎵 Song Identifier - Quick Start Guide

Your Pi BOOM system now has **Shazam-like song identification**! Identify any song playing around you in seconds.

## 🚀 Quick Setup (5 minutes)

### 1. Get Free ACRCloud Credentials

1. Go to **https://www.acrcloud.com/**
2. Click **"Sign Up"** (free tier: 500 queries/day)
3. Go to **Console → Create Project**
4. Select **"Audio & Video Recognition"**
5. Copy your credentials:
   - Host (e.g., `identify-us-west-2.acrcloud.com`)
   - Access Key
   - Access Secret

### 2. Add to .env File

Edit your `.env` file and add:

```bash
# ACRCloud Audio Fingerprinting
ACRCLOUD_HOST=identify-us-west-2.acrcloud.com
ACRCLOUD_ACCESS_KEY=your_access_key_here
ACRCLOUD_ACCESS_SECRET=your_access_secret_here
```

### 3. Restart Server

```bash
npm run pi
```

### 4. Test It!

**Option A: Voice Command**
1. Open any page
2. Click the microphone button to enable voice
3. Play a song on speakers
4. Say: **"What song is this?"**
5. Wait 10 seconds - the song will be identified!

**Option B: Web Interface**
1. Go to http://localhost:3000/song-identifier.html
2. Click the big button
3. Wait 10 seconds - results appear!

## 🎤 Voice Commands

Say any of these:
- **"What song is this?"**
- **"What is this song?"**
- **"Identify song"**
- **"Name this song"**

## 📱 Web Interface

Navigate to: **http://localhost:3000/song-identifier.html**

Features:
- ✅ Beautiful circular button interface
- ✅ Real-time listening animation
- ✅ Album art display
- ✅ Song metadata (title, artist, album, release date)
- ✅ Confidence score
- ✅ Direct links to Spotify and YouTube
- ✅ Alternative matches if confidence is low

## 🎯 What You Get

When a song is identified, you'll see:
- **Song Title** and **Artist Name**
- **Album Art** (high quality)
- **Album Name** and **Release Date**
- **Duration** and **Record Label**
- **Genres**
- **Confidence Score** (0-100%)
- **Links** to open on Spotify, YouTube, or Deezer
- **Alternative Matches** (if uncertain)

## 🔧 Microphone Setup

Make sure your USB microphone is working:

```bash
# List audio devices
arecord -l

# Test microphone (5 second recording)
arecord -D plughw:1,0 -d 5 test.wav
aplay test.wav
```

If you get errors, try different device numbers (0,0 or 1,0).

## ❓ Troubleshooting

### "Audio fingerprinting not configured"
- Make sure you added the ACRCloud credentials to `.env`
- Restart the server with `npm run pi`

### "Could not identify the song"
- Increase the volume
- Make sure the song has been playing for at least 10 seconds
- Reduce background noise
- Move microphone closer to speakers

### "Audio recording failed"
- Check microphone is connected: `arecord -l`
- Test microphone: `arecord -D plughw:1,0 -d 5 test.wav`
- Try different device numbers if needed

### Free Tier Limit Reached
- Free tier: 500 identifications per day
- Limit resets every 24 hours
- Upgrade to paid plan for more queries

## 📖 Full Documentation

See [AUDIO_FINGERPRINT_SETUP.md](AUDIO_FINGERPRINT_SETUP.md) for complete setup instructions, troubleshooting, and advanced configuration.

## 🎉 Have Fun!

Now you can identify any song playing around you - just like Shazam! Perfect for:
- 📻 Radio songs you don't recognize
- 🎵 Music playing at cafes or stores
- 🎶 Songs stuck in your head (hum/play them)
- 🔍 Discovering new music

---

**🎵 Powered by ACRCloud | Built for Pi BOOM 🎵**

