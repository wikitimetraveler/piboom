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
| GET | `/cameras` | ALERTCalifornia fire cameras — query: `state`, `county` (ILIKE), `limit`, `offset`; geo: `nearLat`, `nearLng`, `radiusMiles` (1–500, default 50 when geo set) — Haversine filter, nearest-first, each row includes `distance_miles` when geo is used |
| POST | `/refresh-cameras` | Refresh camera feed (requires disaster refresh access) |

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
- `DATABASE_URL` – PostgreSQL (disasters table)
- `MAPBOX_ACCESS_TOKEN` – Geocoding (loan addresses, disaster county/state lookup)

## Daily Refresh

Run disaster data pull once per day:

```bash
npm run refresh-disasters
```

Cron example (6 AM daily):

```
0 6 * * * cd /path/to/your-project && npm run refresh-disasters
```

## Related

- **docs/AI_SYSTEM.md** – Disaster Risk AI architecture
- **docs/API_ROUTES.md** – Full API index
