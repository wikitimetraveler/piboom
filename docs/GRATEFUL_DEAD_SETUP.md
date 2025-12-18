# Grateful Dead Tour System Setup

## Overview
The Grateful Dead Tour system fetches tour data from setlist.fm, stores it in PostgreSQL, and generates KML files for Google Earth visualization.

## Environment Variables

Add these to your `.env` file:

```bash
# Required for data import
SETLISTFM_API_KEY=your_setlist_fm_api_key_here
GOOGLE_API_KEY=your_google_api_key_here

# Required for database (already in your .env)
DATABASE_URL=your_postgresql_connection_string
```

## API Keys Setup

### 1. setlist.fm API Key (Free)
1. Go to https://www.setlist.fm/
2. Create a free account
3. Go to https://www.setlist.fm/settings/api
4. Request an API key (usually approved within hours)
5. Add to `.env` as `SETLISTFM_API_KEY`

### 2. Google Geocoding API Key
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable the "Geocoding API"
4. Create credentials (API key)
5. Add to `.env` as `GOOGLE_API_KEY`

## Usage Options

### Option 1: Manual Script (Recommended)
```bash
# Generate KML file manually
npm run generate-gd-kml
```

### Option 2: API Endpoints
```bash
# Start the server
npm start

# Import data from setlist.fm
curl -X POST http://localhost:3000/api/grateful-dead/import

# Generate KML file
curl http://localhost:3000/api/grateful-dead/generate-kml

# Download KML file
curl http://localhost:3000/api/grateful-dead/download-kml -o grateful-dead-tour.kml

# Get tour statistics
curl http://localhost:3000/api/grateful-dead/stats
```

## API Endpoints

- `GET /api/grateful-dead/shows` - List all shows (paginated)
- `GET /api/grateful-dead/shows/:id` - Get single show details
- `GET /api/grateful-dead/stats` - Get tour statistics
- `POST /api/grateful-dead/import` - Import data from setlist.fm
- `GET /api/grateful-dead/generate-kml` - Generate KML file
- `GET /api/grateful-dead/download-kml` - Download KML file
- `POST /api/grateful-dead/geocode-missing` - Geocode venues without coordinates

## Database Schema

The system creates a `grateful_dead_shows` table with:
- Show date, venue, city, state, country
- Latitude/longitude coordinates
- Setlist data (JSON)
- Attendance, recording availability
- Archive.org identifiers

## Generated Files

- `data/grateful-dead-endless-tour.kml` - Google Earth compatible KML file
- Contains all Grateful Dead shows from 1965-1995
- Clickable placemarks with venue details
- Chronologically ordered

## Features

### Data & API
- **Free APIs**: Uses setlist.fm (free) and Google Geocoding
- **Rate Limited**: Respects API limits (2 req/sec for setlist.fm)
- **Geocoding**: Automatically gets venue coordinates
- **KML Compatible**: Works in Google Earth desktop and web
- **No TimeStamp Elements**: Web-compatible format
- **Rich Descriptions**: Includes setlists, attendance, recording info

### Web Interface
- **KML Viewer** (`/music/kml-viewer.html`): Interactive map viewer with timeline and YouTube integration
- **My Grateful Dead Shows** (`/music/my-grateful-dead-shows.html`): 
  - Track shows you've attended
  - Load and browse all shows
  - Mark attendance with ratings and notes
  - View your tour statistics
- **Google Earth Network Links**: Auto-updating KML files that connect directly to your server

### Google Earth Integration
- **Static KML Files**: Download and open in Google Earth
- **Network Links**: Auto-updating files that refresh from your server
  - `data/grateful-dead-tour.networklink.kml`
  - `data/grateful-dead-endless-tour.networklink.kml`
  - See `GOOGLE_EARTH_NETWORK_LINKS.md` for details

## Troubleshooting

### No API Keys
- Script will warn about missing keys
- Can still generate KML from existing database data

### Database Issues
- Ensure `DATABASE_URL` is set correctly
- Check PostgreSQL connection

### Geocoding Failures
- Some venues may not geocode successfully
- Use `/api/grateful-dead/geocode-missing` to retry failed venues

## Data Sources

- **setlist.fm**: 2,318 Grateful Dead shows (1965-1995)
- **Google Geocoding**: Venue coordinates
- **Archive.org**: Recording availability (manual enhancement)

## Web Pages

### KML Viewer (`/music/kml-viewer.html`)
- Interactive map with Google Maps
- Timeline view of all shows
- YouTube video integration
- Voice commands support
- Load preset timelines or upload custom KML
- Download network link files for Google Earth

### My Grateful Dead Shows (`/music/my-grateful-dead-shows.html`)
- **Load All Shows**: Browse complete database of Grateful Dead shows
- **Track Attendance**: Mark shows you've attended
- **Personal Notes**: Add ratings and notes to your shows
- **Statistics**: View your tour stats (venues visited, cities, date ranges)
- **"I Was There" Button**: Quick-add shows from the full catalog

## File Structure

```
services/grateful-dead-tour.service.js           # Core logic
services/user-show-attendance.service.js         # User attendance tracking
controllers/grateful-dead-tour.controller.js     # API endpoints
controllers/user-show-attendance.controller.js   # User attendance API
routes/grateful-dead-tour.routes.js              # Route definitions
routes/user-show-attendance.routes.js            # User attendance routes
scripts/generate-grateful-dead-kml.js            # Standalone script
data/grateful-dead-endless-tour.kml              # Generated KML file
data/*.networklink.kml                           # Network link files for Google Earth
public/music/kml-viewer.html                     # Interactive KML viewer
public/music/my-grateful-dead-shows.html         # Personal show tracker
```
