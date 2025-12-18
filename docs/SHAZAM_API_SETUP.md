# 🎵 Shazam API Setup Guide

Quick guide to set up Shazam API for song identification (recommended over ACRCloud).

## Why Shazam API?

- ✅ **More Accurate**: Shazam is the industry standard
- ✅ **Faster**: Quicker response times
- ✅ **Simpler**: Easier to set up
- ✅ **Better Data**: High-quality album art and metadata
- ✅ **Free Tier**: 500 requests/month on RapidAPI

## Setup Steps (2 minutes)

### 1. Sign Up for RapidAPI

1. Go to **https://rapidapi.com/**
2. Click **Sign Up** (free account)
3. Verify your email

### 2. Subscribe to Shazam API

1. Go to **https://rapidapi.com/apidojo/api/shazam**
2. Click **"Subscribe to Test"**
3. Choose **"Basic"** plan (Free - 500 requests/month)
4. Click **"Subscribe"**

### 3. Get Your API Key

1. After subscribing, you'll see your API key in the **"Code Snippets"** section
2. Look for **"X-RapidAPI-Key"** - that's your key!
3. Copy it (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0`)

### 4. Add to .env File

Edit your `.env` file and add:

```bash
# Shazam API (Primary song identifier)
SHAZAM_API_KEY=your_rapidapi_key_here
```

**Example:**
```bash
SHAZAM_API_KEY=a1b2c3d4e5mSHp6q7rapidAPIr8s9KEYt0u1v2w3
```

### 5. Restart Server

```bash
npm run pi
```

## That's It! 🎉

Your song identifier will now use Shazam API automatically. ACRCloud acts as a fallback if Shazam fails.

## Usage

Same as before:

**Voice Command:**
- "What song is this?"
- "Identify song"
- "Name this song"

**Web Interface:**
- Navigate to `http://localhost:3000/song-identifier.html`
- Click the big button

## How It Works

The system tries APIs in this order:

1. **Shazam API** (Primary) - Fast and accurate
2. **ACRCloud** (Fallback) - If Shazam fails or not configured

## Pricing

### RapidAPI Shazam - Free Tier
- ✅ **500 requests/month FREE**
- Perfect for personal use
- ~16 song IDs per day

### If You Need More
- **Pro Plan**: $9.99/month - 10,000 requests
- **Ultra Plan**: $49.99/month - 100,000 requests

## Troubleshooting

### "No audio fingerprinting API configured"

**Problem**: API key not set in `.env`

**Solution**:
```bash
# Check your .env file has:
SHAZAM_API_KEY=your_key_here
```

### "Shazam failed, trying ACRCloud fallback"

**Problem**: Shazam API limit reached or service issue

**Solution**: 
- Check your RapidAPI dashboard for usage limits
- The system automatically falls back to ACRCloud (if configured)
- Wait for monthly reset or upgrade plan

### "Invalid API key"

**Problem**: Wrong key or not subscribed

**Solution**:
1. Go to https://rapidapi.com/apidojo/api/shazam
2. Make sure you're subscribed (green "Subscribed" button)
3. Copy the **X-RapidAPI-Key** from the code snippets
4. Paste exactly into `.env` file

## Testing

Test your setup:

```bash
# Start server
npm run pi

# Watch the console for:
# 🎵 Audio Fingerprint Service initialized:
#    Shazam API: ✅ Enabled
#    ACRCloud: ❌ Disabled (or ✅ if also configured)
```

## Benefits Over ACRCloud

| Feature | Shazam | ACRCloud |
|---------|--------|----------|
| Accuracy | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Speed | ⚡ Fast | Slower |
| Setup | Simple | Complex |
| Album Art | High Quality | Standard |
| Free Tier | 500/month | 500/day |
| Best For | Personal use | High volume |

## Links

- **Shazam API**: https://rapidapi.com/apidojo/api/shazam
- **RapidAPI Dashboard**: https://rapidapi.com/developer/dashboard
- **Usage Stats**: https://rapidapi.com/developer/billing

---

**🎵 Enjoy instant song recognition with Shazam! 🎵**

