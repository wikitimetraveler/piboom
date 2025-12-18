# FREE Geocoding & Reverse Geocoding Guide

## 🆓 100% FREE Alternatives to Google Maps API

All options below are **completely free** with no API key required (or generous free tiers).

---

## ✅ BEST OPTION: OpenStreetMap Nominatim

### **Why it's best:**
- ✅ **100% FREE** - No API key, no charges ever
- ✅ Unlimited requests (be respectful - 1 req/sec)
- ✅ Global coverage
- ✅ Reverse geocoding included
- ✅ Open source community project

### **Usage:**
I've created `services/free-geocoding.service.js` with ready-to-use functions:

```javascript
import { geocodeAddressFree, reverseGeocodeFree } from './services/free-geocoding.service.js';

// Geocode an address
const result = await geocodeAddressFree('123 Main St, Austin, TX', 'TX', 'Travis');
// Returns: { latitude: 30.2672, longitude: -97.7431, validated: true }

// Reverse geocode (lat/lng to address)
const location = await reverseGeocodeFree(30.2672, -97.7431);
// Returns: { county: 'Travis', state: 'TX', address: '...' }
```

### **Rate Limits:**
- **1 request per second** (required by Nominatim)
- Code includes automatic 1-second delay between requests
- For bulk operations, you MUST respect this limit

### **API Endpoints:**
- Geocoding: `https://nominatim.openstreetmap.org/search?format=json&q=ADDRESS&countrycodes=us`
- Reverse: `https://nominatim.openstreetmap.org/reverse?format=json&lat=LAT&lon=LNG`

---

## 🔄 ALTERNATIVE OPTIONS

### 1. **Geocode.maps.co**
- ✅ Free, no API key required
- ✅ Fast response times
- **Endpoint:** `https://geocode.maps.co/search?q=ADDRESS`

### 2. **LocationIQ** (Free Tier)
- ✅ **5,000 requests/day FREE**
- ⚠️ Requires free API key registration
- ✅ Good for higher volume needs
- **Sign up:** https://locationiq.com

### 3. **Geocod.io** (Free Tier)
- ✅ **2,500 addresses/day FREE** (US & Canada only)
- ✅ No credit card required
- ⚠️ Requires free account registration
- **Sign up:** https://geocod.io

### 4. **BigDataCloud** (Free Tier)
- ✅ Free client-side reverse geocoding
- ✅ Good for browser-based apps
- **Website:** https://bigdatacloud.com

---

## 🚀 HOW TO USE IN YOUR CODE

### Step 1: Replace Google Geocoding

**Before (Google - costs money):**
```javascript
const coords = await geocodeAddressValidated(address, state, county);
```

**After (Free - no cost):**
```javascript
import { geocodeAddressFree } from './services/free-geocoding.service.js';

const coords = await geocodeAddressFree(address, state, county);
```

### Step 2: Replace Reverse Geocoding

**Before (Google - costs money):**
```javascript
const location = await reverseGeocodeCountyState(lat, lng);
```

**After (Free - no cost):**
```javascript
import { reverseGeocodeFree } from './services/free-geocoding.service.js';

const location = await reverseGeocodeFree(lat, lng);
```

### Step 3: Update Function Calls

The free service functions have the same interface as the Google versions, so you can do a simple find-and-replace:

1. Replace `geocodeAddressValidated` → `geocodeAddressFree`
2. Replace `reverseGeocodeCountyState` → `reverseGeocodeFree`
3. Replace `geocodeCountyState` → `geocodeCountyStateFree`

---

## ⚠️ IMPORTANT NOTES

### Rate Limiting
- **Nominatim requires 1 request per second maximum**
- The service includes automatic delays
- For bulk operations, add additional delays between batches

### Accuracy
- Nominatim is generally accurate but may be slightly less precise than Google
- Results are community-maintained (OpenStreetMap)
- For research/testing purposes, it's excellent

### User-Agent Required
- Nominatim requires a proper User-Agent header
- Already included in the service functions
- Don't remove it or requests will be blocked

### Response Format
- Nominatim uses different field names than Google
- The service functions normalize the response to match your existing code
- County/state extraction handles Nominatim's format automatically

---

## 📊 COMPARISON TABLE

| Service | Free Tier | API Key | Rate Limit | Best For |
|---------|-----------|---------|------------|----------|
| **Nominatim** | Unlimited | ❌ No | 1/sec | Research, testing |
| **Geocode.maps.co** | Unlimited* | ❌ No | Unknown | Quick projects |
| **LocationIQ** | 5,000/day | ✅ Yes (free) | Unknown | Higher volume |
| **Geocod.io** | 2,500/day | ✅ Yes (free) | Unknown | US/Canada only |
| **Google Maps** | $200 credit | ✅ Yes | High | Production (paid) |

*_Geocode.maps.co has no stated limit but may have fair use policies_

---

## 🔧 EXAMPLE USAGE IN YOUR SERVICES

### In `disaster-risk.service.js`:

```javascript
// Replace the disabled Google functions:
import { geocodeAddressFree, reverseGeocodeFree, geocodeCountyStateFree } from './free-geocoding.service.js';

async function geocodeAddressValidated(address, expectedState = null, expectedCounty = null) {
  return await geocodeAddressFree(address, expectedState, expectedCounty);
}

export async function reverseGeocodeCountyState(lat, lng) {
  const result = await reverseGeocodeFree(lat, lng);
  return { county: result.county, state: result.state };
}

async function geocodeCountyState(county, state) {
  return await geocodeCountyStateFree(county, state);
}
```

---

## ✅ RECOMMENDATION

**Use OpenStreetMap Nominatim** (`free-geocoding.service.js`) because:
1. It's 100% free forever
2. No registration required
3. Unlimited requests (just respect 1/sec limit)
4. Works globally
5. Community-maintained and reliable

Perfect for research projects like yours! 🎉

---

## 🆘 IF YOU NEED MORE VOLUME

If you need more than 1 request/second:
1. Use **LocationIQ** free tier (5,000/day) - requires free account
2. Use **Geocod.io** free tier (2,500/day) - US/Canada only
3. Implement caching to reduce duplicate requests

---

**Remember:** Always be respectful of free services. They're provided by the community!

