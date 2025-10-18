# 🎵 Song Identifier - Shazam API Setup

Your Pi BOOM system now has **Shazam-powered song identification**! Identify any song playing around you in seconds.

## ✅ **100% FREE Forever** (500 identifications/month)

## 🚀 Quick Setup (2 minutes)

### 1. Get Free Shazam API Key (RapidAPI)

1. Go to **https://rapidapi.com/apidojo/api/shazam**
2. Click **"Sign Up"** if you don't have an account (free)
3. Click **"Subscribe to Test"** button
4. Choose **"Basic"** plan (**FREE** - 500 requests/month)
5. Click **"Subscribe"**

### 2. Copy Your API Key

After subscribing, you'll see code snippets. Look for:

```javascript
'X-RapidAPI-Key': 'a1b2c3d4e5...'
```

That long string is your API key!

### 3. Add to .env File

Edit your `.env` file and add:

```bash
# Shazam API (via RapidAPI) - 500/month FREE
SHAZAM_API_KEY=64c1fece7bmshca019fae58f796bp1f7161jsn9073a849804b
```

(Use your actual key, not this example)

### 4. Restart Server

```bash
npm run pi
```

You should see:
```
🎵 Audio Fingerprint Service initialized:
   Shazam API: ✅ Enabled (500/month FREE)
```

### 5. Test It!

**Voice Command:**
- Say: **"What song is this?"**
- System listens for 10 seconds
- Song identified and announced!

**Web Interface:**
- Go to: `http://localhost:3000/song-identifier.html`
- Click the big button
- Results appear with album art, song info, and links!

## 🎤 Voice Commands

Say any of these:
- **"What song is this?"**
- **"What is this song?"**
- **"Identify song"**
- **"Name this song"**

## 📱 What You Get

When identified, you'll see:
- ✅ Song title and artist
- ✅ Album art (high quality)
- ✅ Album name and release date
- ✅ Confidence score
- ✅ Direct links to Spotify and YouTube
- ✅ Genre information

## 💰 Pricing

### Free Tier (What You Get)
- ✅ **500 identifications per month**
- ✅ **No credit card required**
- ✅ **Perfect for personal use**
- ✅ ~16 songs per day

### If You Need More
- **Pro**: $9.99/month - 10,000 requests
- **Ultra**: $49.99/month - 100,000 requests

(But 500/month is plenty for home use!)

## ❓ Troubleshooting

### "Shazam API not configured"
- Make sure `SHAZAM_API_KEY` is in your `.env` file
- Restart server: `npm run pi`

### "Invalid API key"
- Check you copied the full key from RapidAPI
- Make sure you're subscribed to the Shazam API (green "Subscribed" button)

### "Rate limit exceeded"
- Free tier: 500 per month
- Check usage at: https://rapidapi.com/developer/billing
- Resets monthly

### "No music detected"
- Increase volume of music source
- Move microphone closer
- Reduce background noise
- Let song play for at least 10 seconds before identifying

## 🔗 Useful Links

- **Shazam API**: https://rapidapi.com/apidojo/api/shazam
- **Your Dashboard**: https://rapidapi.com/developer/dashboard
- **Usage Stats**: https://rapidapi.com/developer/billing

---

**🎵 Enjoy Shazam-powered song identification! 🎵**

