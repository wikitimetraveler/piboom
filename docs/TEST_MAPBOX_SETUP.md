# Testing Mapbox Geocoding API

## 🧪 Test Script Created

I've created `test-mapbox-geocoding.js` that will:
- Test Nominatim (currently working ✅)
- Test Mapbox (if you add API key)
- Compare results side-by-side
- Show response times and accuracy

## 📝 To Test Mapbox:

### Step 1: Get Free Mapbox API Key

1. **Sign up for free account:**
   - Go to: https://account.mapbox.com/auth/signup/
   - Create a free account (no credit card required)
   - You get **100,000 requests/month FREE**

2. **Get your access token:**
   - After signup, go to: https://account.mapbox.com/access-tokens/
   - Copy your **Default Public Token** (starts with `pk.`)

### Step 2: Add to .env File

```bash
# Add this to your .env file:
MAPBOX_API_KEY=pk.your_token_here
```

### Step 3: Run the Test

```bash
node test-mapbox-geocoding.js
```

The test will:
- ✅ Test Nominatim (always works)
- ✅ Test Mapbox (if key is set)
- ✅ Compare results side-by-side
- ✅ Show response times
- ✅ Show distance between results (accuracy comparison)

## 📊 What to Expect:

### Nominatim (Current - FREE):
- ✅ Always works (no API key needed)
- ⏱️ 200-1500ms response time
- 🎯 Good accuracy
- ⚠️ 1 request/second limit

### Mapbox (If you add key):
- ✅ Faster responses (~100-300ms)
- ✅ Higher rate limits
- ✅ 100k/month FREE
- ⚠️ Requires API key

## 💡 Recommendation:

**You don't need to test Mapbox right now** because:
1. ✅ Nominatim is working perfectly for your research
2. ✅ It's 100% FREE (Mapbox is free too, but requires signup)
3. ✅ With caching, you'll rarely need API calls
4. ✅ No API key management needed

**Test Mapbox later IF:**
- You need faster than 1 req/sec
- You need more volume
- You want to compare quality

The test script is ready when you need it! 🎉

