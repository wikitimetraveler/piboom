# Database Schema Overview
**Complete documentation of all tables and geocoded data**

---

## 📊 **TOTAL TABLES: 14+** (header count tracks major documented tables; see `services/database.service.js` for the full `createTables()` list)

### 🗺️ **GEOCODED TABLES** (Tables with latitude/longitude coordinates)

---

## 1. **`loans`** - Loan Pipeline & Disaster Risk Analysis

**Purpose:** Stores loan applications with disaster risk assessments and flood zone data

**Columns with Coordinates:**
- `latitude` (DECIMAL 10,8) - Property latitude ✅ **GEOCODED** (via free OpenStreetMap)
- `longitude` (DECIMAL 11,8) - Property longitude ✅ **GEOCODED**

**Address Fields:**
- `property_address` (VARCHAR 500) - Street address
- `city` (VARCHAR 100)
- `state` (VARCHAR 2) - State abbreviation
- `county` (VARCHAR 100)
- `zip_code` (VARCHAR 10)

**Risk Assessment Data:**
- `disaster_risk_score` (INTEGER) - Risk score 0-15
- `disaster_declaration_count` (INTEGER) - Number of recent disasters
- `fema_data` (JSONB) - Full FEMA disaster data
- `last_risk_analysis` (TIMESTAMP) - When risk was last calculated

**Flood Zone Data:**
- `flood_zone` (VARCHAR 20) - FEMA flood zone designation (A, AE, X, etc.)
- `flood_zone_type` (VARCHAR 100) - Zone type description
- `dfirm_id` (VARCHAR 50) - Digital Flood Insurance Rate Map ID
- `base_flood_elevation` (DECIMAL 10,2) - BFE if available
- `flood_zone_data` (JSONB) - Complete flood zone data including boundaries
- `last_flood_zone_check` (TIMESTAMP) - When flood zone was last checked

**Loan Information:**
- `loan_number` (VARCHAR 50) UNIQUE - Unique loan identifier
- `borrower_name` (VARCHAR 255)
- `loan_amount` (DECIMAL 12,2)
- `loan_type` (VARCHAR 50) - Conventional, FHA, VA, etc.
- `milestone` (VARCHAR 100) - Loan processing stage
- `encompass_loan_guid` (VARCHAR 100) - Integration ID

**Metadata:**
- `id` (SERIAL PRIMARY KEY)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Geocoding Status:**
- ✅ **ACTIVE** - Loans are automatically geocoded when missing coordinates
- Uses FREE OpenStreetMap Nominatim API (no charges)
- Geocoding triggered in `analyzeLoanRisk()` function

---

## 2. **`disasters`** - Unified Disaster Data

**Purpose:** Stores disaster data from multiple sources (FEMA, NOAA, NASA, NWS, etc.)

**Columns with Coordinates:**
- `lat` (DOUBLE PRECISION) - Disaster latitude ✅ **GEOCODED** (via free service)
- `lng` (DOUBLE PRECISION) - Disaster longitude ✅ **GEOCODED**
- `geom` (geography Point,4326) - **Generated** from lat/lng when PostGIS is enabled (GiST index `idx_disasters_geom`)

**Geographic Data:**
- `county_fips` (CHAR 5) - County FIPS code (required)
- `county_name` (TEXT) - County name
- `state_abbr` (VARCHAR 3) - State/province abbreviation

**Disaster Information:**
- `source` (TEXT) - Data source (fema, firms, usgs, nws, nhc, cameras)
- `event_type` (TEXT) - Type of disaster (wildfire, earthquake, hurricane, etc.)
- `start_time` (TIMESTAMPTZ) - When disaster started
- `end_time` (TIMESTAMPTZ) - When disaster ended (if applicable)
- `severity` (TEXT) - Severity rating/description
- `title` (TEXT) - Disaster title/name

**Additional Data:**
- `source_id` (TEXT) - Original source identifier
- `raw` (JSONB) - Complete raw data from source
- `created_at` (TIMESTAMPTZ) - When record was created

**Unique Constraint:**
- `(county_fips, source, source_id, start_time)` - Prevents duplicates

**Geocoding Status:**
- ✅ **ACTIVE** - Disasters are geocoded by county/state when ingested
- ❌ **DISABLED** for camera feeds (no reverse geocoding of camera locations)
- ✅ **ENABLED** for FEMA, FIRMS fires, earthquakes, hurricanes, NWS alerts
- Uses FREE OpenStreetMap Nominatim API
- 90-day rolling window (old disasters automatically pruned)

**Data Sources:**
1. **FEMA** - Disaster declarations
2. **FIRMS** - NASA wildfire detections
3. **USGS** - Earthquake data
4. **NWS** - Weather alerts
5. **NHC** - Hurricane data
6. **CA Fire Cameras** - Fire camera feeds (geocoding disabled)

---

## 3. **`grateful_dead_shows`** - Grateful Dead Concert History

**Purpose:** Stores Grateful Dead concert/show data

**Columns with Coordinates:**
- `latitude` (DECIMAL 10,8) - Venue latitude ✅ **GEOCODED** (via free service)
- `longitude` (DECIMAL 11,8) - Venue longitude ✅ **GEOCODED**

**Location Data:**
- `venue_name` (VARCHAR 255)
- `city` (VARCHAR 255)
- `state` (VARCHAR 100)
- `country` (VARCHAR 100)

**Show Information:**
- `show_date` (DATE) - Concert date
- `setlist` (TEXT) - Songs played
- `attendance` (INTEGER) - Number of attendees
- `recording_available` (BOOLEAN)
- `archive_identifier` (VARCHAR 255)
- `notes` (TEXT)

**Metadata:**
- `id` (SERIAL PRIMARY KEY)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Unique Constraint:**
- `(show_date, venue_name, city)`

**Geocoding Status:**
- ✅ **ACTIVE** - Venues are geocoded when shows are added
- Uses FREE OpenStreetMap Nominatim API

---

## 4. **`venues`** - Concert Venues (Expandable Collections)

**Purpose:** Stores venue information for all artists (expandable concert system)

**Columns with Coordinates:**
- `latitude` (DECIMAL 10,8) - Venue latitude ✅ **GEOCODED** (via free service)
- `longitude` (DECIMAL 11,8) - Venue longitude ✅ **GEOCODED**

**Location Data:**
- `name` (VARCHAR 255) - Venue name
- `city` (VARCHAR 255)
- `state` (VARCHAR 100)
- `country` (VARCHAR 100)

**Venue Information:**
- `capacity` (INTEGER) - Seating capacity
- `venue_type` (VARCHAR 100) - Type of venue
- `website` (VARCHAR 500)

**Metadata:**
- `id` (SERIAL PRIMARY KEY)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Unique Constraint:**
- `(name, city, state)`

**Geocoding Status:**
- ✅ **ACTIVE** - Venues are geocoded when created
- Uses FREE OpenStreetMap Nominatim API

---

## 5. **`trees`** - Tree Collection

**Purpose:** Stores tree identification and location data

**Columns with Coordinates:**
- `latitude` (DECIMAL 10,8) - Tree location latitude ✅ **Auto-fills from device GPS on mobile** (or address/EXIF)
- `longitude` (DECIMAL 11,8) - Tree location longitude ✅ **Auto-fills from device GPS on mobile** (or address/EXIF)

**Location Data:**
- `location_name` (VARCHAR 255) - Descriptive location name

**Tree Information:**
- `tree_name` (VARCHAR 255) - Common name
- `scientific_name` (VARCHAR 255)
- `confidence` (VARCHAR 50) - Identification confidence
- `features` (TEXT[]) - Array of features
- `region` (VARCHAR 255)
- `fun_facts` (TEXT[]) - Interesting facts
- `conservation_status` (VARCHAR 100)
- `description` (TEXT)
- `photo_url` (TEXT)
- `notes` (TEXT)
- `rating` (INTEGER 1-5)

**Metadata:**
- `id` (SERIAL PRIMARY KEY)
- `user_id` (VARCHAR 100) - Who added it
- `added_date` (TIMESTAMP)
- `updated_date` (TIMESTAMP)
- `ai_analysis` (TEXT) - AI-generated analysis

**Geocoding Status:**
- ✅ **Auto-fills from device GPS** on Album Discovery page when adding to collection (or address/EXIF)
- Coordinates used for mapping only

---

## 📚 **NON-GEOCODED TABLES** (No coordinates)

---

## 6. **`users`** - User Accounts

**Purpose:** Stores user account information

**Columns:**
- `id` (VARCHAR 100) PRIMARY KEY - Username
- `name` (VARCHAR 255) - Display name
- `password` (VARCHAR 255) - Hashed password
- `avatar` (VARCHAR 255) - Avatar image URL
- `color` (VARCHAR 50) - User color theme
- `description` (TEXT) - User bio
- `created_date` (TIMESTAMP)

**Default Users:**
- cosmic-turtle / Dufus
- wizened-wizard — password set on server (`database.service.js` user seed / bcrypt)
- jerry-garcia / Fooze
- easy-levi / Zip Knot
- fuzz-maestro / Fly Dog

---

## 7. **`records`** - Vinyl/Album Collection

**Purpose:** Stores music record/album collection

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `user_id` (VARCHAR 100) - Owner
- `artist` (VARCHAR 255)
- `album` (VARCHAR 255)
- `year` (VARCHAR 50)
- `genre` (VARCHAR 100)
- `label` (VARCHAR 255)
- `notes` (TEXT)
- `cover_url` (TEXT)
- `spotify_id` (VARCHAR 100)
- `musicbrainz_id` (VARCHAR 100)
- `rating` (INTEGER 1-5)
- `story` (TEXT) - Album story/provenance
- `valuation` (DECIMAL 10,2) - Estimated value
- `ai_analysis` (TEXT) - AI analysis
- `family_member_id` (INTEGER) - Genealogy link
- `family_member_name` (VARCHAR 255)
- `storage_zone` (VARCHAR 1) - Physical shelf zone: `A`–`G` (Workbench, Bookshelf, Console, Cooler, GarageBox1, GarageBox2, GarageBox3), or NULL
- `storage_slot` (INTEGER) - Slot index within zone (1..N); NULL if `storage_zone` is NULL
- `added_date` (TIMESTAMP)
- `updated_date` (TIMESTAMP)

**Unique Constraint:**
- `(artist, album, user_id)`

**Physical storage:** Display as concatenated code, e.g. `C4` = zone C + slot 4. Both columns NULL means not assigned.

---

## 8. **`conversations`** - Chat Conversations

**Purpose:** Stores conversation sessions for LangChain memory

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `user_id` (VARCHAR 100) NOT NULL
- `session_id` (VARCHAR 255) NOT NULL
- `assistant_type` (VARCHAR 50) DEFAULT 'levi'
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Unique Constraint:**
- `(user_id, session_id)`

---

## 9. **`messages`** - Chat Messages

**Purpose:** Stores individual chat messages

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `conversation_id` (INTEGER) REFERENCES conversations(id) ON DELETE CASCADE
- `user_id` (VARCHAR 100) NOT NULL
- `role` (VARCHAR 20) CHECK (role IN ('system', 'user', 'assistant'))
- `content` (TEXT) NOT NULL
- `created_at` (TIMESTAMP)

---

## 10. **`user_show_attendance`** - "I Was There" Feature

**Purpose:** Tracks which shows users attended

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `user_id` (INTEGER) NOT NULL
- `show_id` (INTEGER) REFERENCES grateful_dead_shows(id) ON DELETE CASCADE
- `was_there` (BOOLEAN) DEFAULT true
- `personal_notes` (TEXT)
- `rating` (INTEGER 1-5)
- `photos` (TEXT[]) - Array of photo URLs
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Unique Constraint:**
- `(user_id, show_id)`

---

## 11. **`artists`** - Music Artists

**Purpose:** Stores artist information for expandable concert collections

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `name` (VARCHAR 255) NOT NULL UNIQUE
- `genre` (VARCHAR 100)
- `formed_year` (INTEGER)
- `disbanded_year` (INTEGER)
- `country` (VARCHAR 100)
- `bio` (TEXT)
- `image_url` (VARCHAR 500)
- `spotify_id` (VARCHAR 100)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

## 12. **`concerts`** - Concert Records

**Purpose:** Stores concert records for all artists (expandable system)

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `artist_id` (INTEGER) REFERENCES artists(id) ON DELETE CASCADE
- `venue_id` (INTEGER) REFERENCES venues(id) ON DELETE CASCADE
- `concert_date` (DATE) NOT NULL
- `tour_name` (VARCHAR 255)
- `setlist` (TEXT)
- `attendance` (INTEGER)
- `recording_available` (BOOLEAN) DEFAULT false
- `archive_identifier` (VARCHAR 255)
- `notes` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Unique Constraint:**
- `(artist_id, venue_id, concert_date)`

**Geocoding:**
- Coordinates accessed via `venue_id` → `venues` table (geocoded)

---

## 13. **`user_concert_collections`** - User Concert History

**Purpose:** Tracks user's personal concert attendance for all artists

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `user_id` (VARCHAR 100) NOT NULL
- `concert_id` (INTEGER) REFERENCES concerts(id) ON DELETE CASCADE
- `was_there` (BOOLEAN) DEFAULT true
- `personal_notes` (TEXT)
- `rating` (INTEGER 1-5)
- `photos` (TEXT[]) - Array of photo URLs
- `ticket_price` (DECIMAL 10,2)
- `seat_location` (VARCHAR 255)
- `weather_notes` (TEXT)
- `companions` (TEXT[]) - Array of companion names
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Unique Constraint:**
- `(user_id, concert_id)`

**Geocoding:**
- Coordinates accessed via `concert_id` → `concerts` → `venues` (geocoded)

---

## 14. **`processor_assignment_tool_config`** - Processor assignment tool state

**Purpose:** Persists Worksheets **Processor assignment** page settings per Encompass API environment (correspondent vs retail).

**Columns:**
- `encompass_env` (VARCHAR 32) PRIMARY KEY – `correspondent` or `retail` (matches `X-Encompass-Env` on hub routes)
- `payload` (JSONB) NOT NULL DEFAULT `{}` – string fields such as `processorsJson`, `rulesJson`, `roleConfigJson`, plus `pipelineLimit`, `delayMs`, `complexityMode`, `complexityAiModel`, `complexityMaxPoints`
- `updated_at` (TIMESTAMP)

**API:** `GET` / `PUT /api/encompass-hub/processor-assignment/config` (see `docs/API_ROUTES.md`). **Service:** `services/processor-assignment-config.service.js`. Created in `database.service.js` → `createTables()`.

**Geocoding:** None (configuration only).

---

## 🗺️ **GEOCODING SUMMARY**

### ✅ **Tables with ACTIVE Geocoding:**
1. **`loans`** - Property addresses geocoded automatically
2. **`disasters`** - Disaster locations geocoded by county/state
3. **`grateful_dead_shows`** - Venues geocoded automatically
4. **`venues`** - Venues geocoded when created

### ❌ **Geocoding DISABLED:**
- **Camera feeds** in disasters table (reverse geocoding disabled)

### 📍 **Tables with Coordinates (Device GPS Auto-Fill):**
- **`trees`**, **critters**, **fish_catches**, **records** (locationLat/lng) - Auto-fill from device GPS on mobile discovery pages

### 🔄 **Geocoding Service:**
- **ALL geocoding uses FREE OpenStreetMap Nominatim API**
- No charges for geocoding operations
- Rate limit: 1 request/second (automatically handled)
- Fallback to alternative free services if Nominatim fails

### 🌐 **PostGIS (disaster spatial graph)**

On Render managed Postgres, run once at startup: `CREATE EXTENSION IF NOT EXISTS postgis` (non-fatal if unavailable).

| Table | Generated column | Index |
|-------|------------------|-------|
| `disasters` | `geom` from `lat`/`lng` | `idx_disasters_geom` (GiST) |
| `fire_cameras` | `geom` from `lat`/`lng` | `idx_fire_cameras_geom` (GiST) |
| `loans` | `geom` from `latitude`/`longitude` | `idx_loans_geom` (GiST) |

**Services:** `services/disaster-spatial.service.js` (proximity queries), `services/disaster-impact-graph.service.js` (`NEAR` edges via `ST_DWithin`). **API:** `GET /api/disasters/near`.

---

## 📈 **DATA STATISTICS**

To get current data counts, run:
```sql
SELECT 
  'loans' as table_name, COUNT(*) as count FROM loans
UNION ALL
SELECT 'disasters', COUNT(*) FROM disasters
UNION ALL
SELECT 'grateful_dead_shows', COUNT(*) FROM grateful_dead_shows
UNION ALL
SELECT 'venues', COUNT(*) FROM venues
UNION ALL
SELECT 'concerts', COUNT(*) FROM concerts
UNION ALL
SELECT 'records', COUNT(*) FROM records
UNION ALL
SELECT 'trees', COUNT(*) FROM trees;
```

---

## 🔍 **KEY INDEXES**

### Loans:
- `idx_loans_state_county` - Query by location
- `idx_loans_risk_score` - Filter by risk level
- `idx_fema_data` (GIN) - JSONB search on FEMA data
- `idx_loans_flood_zone` - Filter by flood zone

### Disasters:
- `idx_disasters_start_time` - Time-based queries
- `idx_disasters_state` - Filter by state
- `idx_disasters_fips` - Filter by county FIPS

### Geographic:
- All tables with coordinates have location indexes for mapping queries

---

## 🎯 **GEOCODING WORKFLOW**

### Loans:
1. Loan created without coordinates
2. `analyzeLoanRisk()` called
3. If no coordinates → geocode using `geocodeAddressFree()`
4. Coordinates saved to database
5. Risk analysis uses coordinates for distance calculations

### Disasters:
1. Disaster ingested from API
2. County/state extracted
3. If coordinates missing → geocode using `geocodeCountyStateFree()`
4. Coordinates saved with disaster record
5. Used for distance calculations to loans

### Venues:
1. Venue created with name/city/state
2. Automatically geocoded using `geocodeVenue()`
3. Coordinates saved for mapping

---

**Last Updated:** After free geocoding integration (OpenStreetMap Nominatim)
**Geocoding Charges:** $0.00 (100% free service)

