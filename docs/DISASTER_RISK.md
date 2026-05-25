# Disaster Risk & Pipeline Risk

Disaster data feeds, loan pipeline risk analysis, and the Disaster Risk AI assistant. Use this when working on FEMA overlays, flood zones, pipeline-risk-dashboard, or disaster-related AI.

## Overview

| Area | Purpose |
|------|---------|
| **Disasters Service** | Multi-source disaster data (FEMA, NASA FIRMS, USGS, NWS, NHC) |
| **Loan Pipeline + Risk** | Pipeline loans, geocoding, FEMA overlap, flood zones, risk summaries |
| **Disaster Risk AI** | AI assistant for disaster impact on real estate |
| **Pipeline Risk Dashboard** | `public/finance/pipeline-risk-dashboard.html` – map, tables, AI widgets |
| **Unified Disasters** | `public/finance/disasters-unified.html` – multi-source disasters AG Grid, voice commands, disaster **processor** expert AI (`sessionId: unified-disaster-processor`) |

## Data Sources (disasters.service.js)

| Source | Event Types | API/Endpoint |
|--------|-------------|--------------|
| **FEMA** | Disaster declarations | `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries` |
| **NASA FIRMS** | Active fires (VIIRS) | `https://firms.modaps.eosdis.nasa.gov/api/...` (requires NASA_API_KEY) |
| **USGS** | Earthquakes | USGS earthquake feeds |
| **NWS** | Weather alerts | `https://api.weather.gov/alerts/active?status=actual&message_type=alert` |
| **NHC** | Hurricanes | NHC feeds |

Schema: `disasters` table (county_fips, source, event_type, start_time, lat, lng, etc.).

## Key Paths

| Component | Path |
|-----------|------|
| Disasters controller | `controllers/disasters.controller.js` |
| Disasters service | `services/disasters.service.js` |
| Hazard webcam ingest | `services/hazard-webcam-ingest.service.js` |
| Hazard webcams UI | `public/finance/disasters-webcams.html`, `public/finance/js/hazard-webcam-viewer.js`, `public/finance/js/hazard-webcam-address-search.js` |
| Disaster risk service | `services/disaster-risk.service.js` |
| Loan pipeline controller | `controllers/loan-pipeline.controller.js` |
| Loan pipeline AI | `controllers/loan-pipeline-ai.controller.js` |
| Pipeline risk dashboard | `public/finance/pipeline-risk-dashboard.html` |

## API Endpoints

### Disasters (`/api/disasters`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List disasters (query: state, county, source, event, since) |
| POST | `/refresh` | Refresh from all sources (FEMA, FIRMS, USGS, NWS, NHC) |
| GET | `/stats` | Stats |
| GET | `/export.csv` | CSV export |
| GET | `/cameras` | Hazard webcams (national catalog) — query: `state`, `county` (ILIKE), `source`, `hazard` (JSONB tag), `mediaType`, `limit`, `offset`; geo: `nearLat`, `nearLng`, `radiusMiles` (1–500, default 50 when geo set) — Haversine filter, nearest-first, each row includes `distance_miles` when geo is used |
| GET | `/cameras/stats` | Counts by source + last update time |
| GET | `/cameras/:id/snapshot` | Latest still image URL (USGS NIMS resolves via listFiles on demand) |
| POST | `/refresh-cameras` | Ingest hazard webcams — query/body `sources=all` or comma list (`alertcalifornia`, `usgs_nims`, `usgs_volcano`, `faa_weathercam`, `webcoos`, `ucsd_hpwren`, `ucsd_pier`); requires disaster refresh access |

### Loan Pipeline (`/api/loan-pipeline`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/loans` | All loans — query: `milestone`, `state`, `county` (ILIKE), `riskLevel` (`low`/`medium`/`high`), `nearLat`, `nearLng`, `radiusMiles` (1–500; Haversine filter after SQL; requires loan coordinates) |
| GET | `/loans/:id` | Single loan |
| POST | `/generate` | Generate test loans |
| POST | `/analyze` | Risk analysis for all loans |
| POST | `/analyze/:id` | Risk analysis for one loan |
| GET | `/risk-summary` | Risk analysis summary |
| GET | `/fema-disasters` | FEMA disasters from loan data |
| GET | `/query-fema` | Query FEMA API directly |
| GET | `/flood-zones` | FEMA NFHL flood zones |
| GET | `/flood-zones-loans` | Loans grouped by flood zones |
| POST | `/update-flood-zones` | Update flood zones for all loans |
| POST | `/geocode-loans` | Geocode loans missing coordinates |
| POST | `/regeocode-loans` | Re-geocode incorrect coordinates |
| GET | `/kml` | Download KML |
| DELETE | `/cleanup` | Cleanup test loans |

### Loan Pipeline AI (`/api/loan-pipeline/ai`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | Chat with loan pipeline AI |
| POST | `/chat-disaster-expert` | Disaster expert AI — `expertProfile: processor` + `sessionId: unified-disaster-processor` use processor-operations prompt; context may include `selectedDisaster`, `selectedLoan`, `nearbyLoans`, `nearbyCameras`, `loanFilterMeta`, `page: disasters-unified` |
| POST | `/insights` | Generate AI insights |
| POST | `/analyze` | Analyze dashboard data |
| GET | `/history` | Conversation history |

## Environment Variables

- `NASA_API_KEY` – NASA FIRMS fire data
- `DATABASE_URL` – PostgreSQL (disasters table, `fire_cameras` hazard webcams)
- `MAPBOX_ACCESS_TOKEN` – Geocoding (loan addresses, disaster county/state lookup, ALERTCalifornia camera county backfill)
- `WEBCOOS_API_TOKEN` – NOAA WebCOOS assets API (required for WebCOOS webcam ingest)
- `USGS_NIMS_API_KEY` – Optional USGS NIMS API key (higher rate limits if enforced)
- `ARCGIS_API_KEY` – Optional ArcGIS key for ALERTCalifornia ingest
- `DISASTER_REFRESH_TOKEN` – Bearer token for `POST /api/disasters/refresh-cameras` when not on localhost

## Hazard webcams (fixed mounts)

Webcams are **fixed mounts** stored in Postgres `fire_cameras` (not rolling disaster events). Sources:

| Source | Provider | Hazard tags | Media |
|--------|----------|-------------|-------|
| `alertcalifornia` | ALERTCalifornia ArcGIS | fire | live / still |
| `usgs_nims` | USGS NIMS hydrology cams | river, flood, snow, hazard | still_image |
| `usgs_volcano` | USGS + AVO Ashcam (volcview + avo-volcview merged) | volcano | still_image |
| `faa_weathercam` | FAA Aviation Weather Cameras (`weathercams.faa.gov/api`) | aviation, weather | still_image |
| `webcoos` | NOAA WebCOOS | coastal | live_stream / still |
| `ucsd_hpwren` | HPWREN curated seeds | fire, hazard | still_image |
| `ucsd_pier` | Scripps COOL Lab pier | coastal | live_stream |

Ingest is **manual / separate cron** (heavy; can upsert 1000+ rows):

```bash
npm run refresh:hazard-webcams
# or subset:
node scripts/refresh-hazard-webcams.js --sources=usgs_nims,alertcalifornia
```

UCSD mounts are seeded from `data/hazard-webcam-seeds.json`. Each row stores `image_url`, `media_type`, `refresh_minutes`, and `hazard_types` for viewer refresh and future AI snapshot analysis (`nearbyCameras` in Disaster Processor Expert context).

UI: [`public/finance/disasters-webcams.html`](../public/finance/disasters-webcams.html) (legacy [`disasters-ca-cameras.html`](../public/finance/disasters-ca-cameras.html) redirects with `?state=CA&hazard=fire&source=alertcalifornia`).

**Address search:** Google Places autocomplete on the catalog page centers the map, draws a radius circle, and loads nearest mounts via `GET /api/disasters/cameras?nearLat=&nearLng=&radiusMiles=`. Deep links: `?lat=&lng=&radius=&address=`. Alaska volcano preset: `?state=AK&hazard=volcano`. If client Google geocode fails, search falls back to `GET /api/disasters/geocode-address?q=` (Mapbox/Nominatim via `geocodeAddressFree`; camera ingest geocode cache unchanged).

## Daily Refresh

Run disaster data pull once per day:

```bash
npm run refresh-disasters
```

Cron example (6 AM daily):

```
0 6 * * * cd /path/to/your-project && npm run refresh-disasters
```

## Mood music (Disaster Processor Expert)

When the floating **Disaster Processor Expert** AI chat opens on:

- `public/finance/disasters-unified.html`
- `public/finance/pipeline-risk-dashboard.html`

…the app plays a local ambient MP3 from `music/disasters/` based on the selected disaster type/source. Music does **not** auto-play on grid/marker selection alone.

| Mood | Typical signals | File |
|------|-----------------|------|
| fire | FIRMS, ALERTCalifornia, wildfire | `music/disasters/fire.mp3` |
| flood | flood zones, flooding | `music/disasters/flood.mp3` |
| hurricane | NHC, tropical storms | `music/disasters/hurricane.mp3` |
| earthquake | USGS, quake | `music/disasters/earthquake.mp3` |
| storm | NWS, severe weather | `music/disasters/storm.mp3` |
| default | FEMA/other | `music/disasters/default.mp3` |

Implementation: `public/shared/disaster-mood-music.js`, mapping in `lib/disaster-mood-music.js`, streamed via `/api/audio/stream/disasters%2F<file>.mp3`.

Mute: music icon in the AI chat header, or `localStorage` key `dc_disaster_music_muted` = `1`. See `music/disasters/README.md`.

## Cinematic Google Earth KML (Unified Disasters)

On `public/finance/disasters-unified.html`, after you select a disaster and the page loads nearby **Encompass loans** and **hazard webcams**, use **Export Google Earth KML** in the selection banner. This is a **manual** action — nothing auto-downloads on row click.

The export uses the **current page state** (same loan list and camera list shown in the UI, same radius/scope filters).

| Layer | Contents |
|-------|----------|
| Selected disaster | Event placemark + optional radius ring |
| Affected Encompass loans | Risk-colored loan placemarks from the grid |
| Nearby hazard webcams | Camera placemarks with feed/snapshot links |
| `gx:Tour` | Guided flyover: disaster → loans → webcams → overview |
| `gx:SoundCue` | Disaster mood track via `/api/audio/stream/disasters%2F<file>.mp3` |

**Google Earth only:** `gx:Tour` and `gx:SoundCue` require Google Earth (desktop or web). Generic KML viewers may show placemarks but not the tour or audio.

**Audio fallback:** If the mapped MP3 is missing under `music/disasters/`, the KML still downloads; the tour runs without sound.

Implementation: `lib/disaster-kml-export.js`, browser wrapper `public/shared/disaster-kml-export.js`.

## Related

- **docs/AI_SYSTEM.md** – Disaster Risk AI architecture
- **docs/API_ROUTES.md** – Full API index
