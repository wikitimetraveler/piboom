# Music Historian — API & data reference

Field maps and payload shapes for piBoom music tools. Read this when implementing APIs, AI context, or copy that cites live data.

---

## Pilgrimage Atlas (`/api/music-pilgrimage`)

### `GET /atlas/overview`

| Field | Type | Notes |
|-------|------|-------|
| `artist` | `{ slug, name }` | v1: `grateful-dead` / `Grateful Dead` |
| `totalShows` | number | Row count in `grateful_dead_shows` |
| `mappedShows` | number | Rows with lat/lng |
| `dateRange` | `{ first_show, last_show }` | ISO dates |
| `topVenues` | array | `venueName`, `city`, `state`, `showCount`, `lat`, `lng` |
| `showsByYear` | array | `{ year, show_count }` |

### `GET /atlas` query params

| Param | Values |
|-------|--------|
| `year`, `month`, `day` | Filter by show date |
| `city`, `state`, `venue` | Location filters |
| `mode` | `tour` \| `city` \| `on_this_date` |
| `limit`, `offset` | Pagination (default 200, max 500) |
| `showId` | Jump to single stop |
| `clientId` | UUID — merges personal bookmarks |

### `GET /atlas` response — stop object (`formatStopRow`)

| Field | Type | Source column / rule |
|-------|------|----------------------|
| `id` | number | `grateful_dead_shows.id` |
| `showDate` | string | `show_date` |
| `venueName` | string | `venue_name` |
| `city`, `state`, `country` | string | |
| `lat`, `lng` | number \| null | `latitude`, `longitude` |
| `setlistPreview` | string | First 10 song names from setlist JSON, joined ` · ` |
| `recordingAvailable` | boolean | `recording_available` |
| `archiveIdentifier` | string \| null | `archive_identifier` (archive.org) |
| `notes` | string \| null | `notes` |
| `routeOrder` | number \| null | Pagination order when in tour mode |
| `personal` | object | `{ favorite, wishlist, visited, notes }` from bookmarks |
| `enrichments` | object | `youtubeSearch` URL, `timeMachineUrl` |

### `GET /atlas` response — envelope

| Field | Notes |
|-------|-------|
| `success`, `artist`, `mode`, `filters` | |
| `stats` | `{ total, returned, mappedStops }` |
| `stops` | Stop array |
| `venues` | Aggregated per venue in current page |
| `mapBounds` | `{ north, south, east, west }` or null |
| `pagination` | `{ limit, offset, total, hasMore }` |

### `GET /atlas/stops/:id`

Stop object plus:

| Field | Type | Notes |
|-------|------|-------|
| `setlist` | array | Parsed JSON — setlist.fm shape: `[{ song: [{ name }] }]` |
| `nearbyStops` | array | Same city/state, limit 8 |

### Bookmarks (`/bookmarks`)

**Types:** `favorite` \| `wishlist` \| `visited`

**POST body:** `clientId` (UUID), `bookmarkType`, `showId` OR (`venueName` + `city`), optional `notes`

**List item:** `id`, `bookmarkType`, `showId`, `venueName`, `city`, `state`, `showDate`, `notes`, `updatedAt`

### Saved routes (`/routes`)

**POST body:** `clientId`, `label` (max 120), `filterConfig` — allowed keys: `year`, `month`, `day`, `city`, `state`, `venue`, `mode`

---

## `grateful_dead_shows` (Postgres)

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL | Primary key |
| `show_date` | DATE | UNIQUE with venue + city |
| `venue_name` | VARCHAR | |
| `city`, `state`, `country` | VARCHAR | |
| `latitude`, `longitude` | DECIMAL | Geocoded via Google |
| `setlist` | TEXT | JSON from setlist.fm |
| `attendance` | INTEGER | Often sparse |
| `recording_available` | BOOLEAN | |
| `archive_identifier` | VARCHAR | archive.org id when known |
| `notes` | TEXT | |

**Provenance:** setlist.fm import — see `docs/GRATEFUL_DEAD_SETUP.md`

### Setlist JSON shape (setlist.fm)

```json
[
  {
    "name": "Set 1",
    "song": [
      { "name": "Bertha" },
      { "name": "Me and My Uncle" }
    ]
  }
]
```

`parseSetlistPreview` extracts `song[].name` only — do not invent songs beyond this.

---

## Grateful Dead tour API (`/api/grateful-dead`)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/shows` | Paginated show list |
| GET | `/shows/:id` | Single show |
| GET | `/stats` | Totals, year breakdown, date range |
| POST | `/import` | setlist.fm ingest |
| GET | `/generate-kml` | KML file path |
| GET | `/download-kml` | KML attachment |
| POST | `/geocode-missing` | Fill lat/lng |

---

## Time Machine (`GET /api/music-history`)

**Query:** `month`, `day` (required), `year` (optional)

**Response:**

| Key | Source | Item fields |
|-----|--------|-------------|
| `albums` | MusicBrainz `/release` | title, artist, date, mbid |
| `events` | Wikipedia | music-related events for date |
| `videos` | YouTube (when year set) | search results |
| `mapData` | Static famous locations | lat, lng, label, year |
| `chartToppers` | (reserved) | |
| `concerts` | (reserved) | |

**Deep link:** `/music/music-time-machine.html?date=YYYY-MM-DD`

---

## Music Research (`POST /api/music-research/*`)

| Endpoint | Purpose |
|----------|---------|
| `/musicbrainz` | Artist lookup |
| `/wikipedia` | Artist/article enrichment |
| `/knowledge-graph` | Google KG |
| `/albums` | Album search |
| `/youtube`, `/youtube-album` | Video search |
| `/map-data` | Birth places / map pins |

### `mapMusicBrainzArtist` output

| Field | MB source |
|-------|-----------|
| `name` | `artist.name` |
| `mbid` | `artist.id` |
| `type` | `artist.type` |
| `isBand` | `type === 'Group'` |
| `birthDate` | `life-span.begin` (year) |
| `birthPlace` | `begin-area.name` or `area.name` |

**Rule:** always `mbGet` from `services/musicbrainz.service.js` (~1 req/s queue).

### Wikimedia rate limit

On `WikimediaRateLimitError` (429): partial MB payload + `wikipediaRateLimited: true`. Full 503 only when both Wikimedia and MB fail.

---

## AI guide context payload (pilgrimage / chat)

Use only fields present in API responses:

```json
{
  "page": "music-pilgrimage-atlas",
  "selectedStop": {
    "id": 123,
    "showDate": "1977-05-08",
    "venueName": "Barton Hall",
    "city": "Ithaca",
    "state": "NY",
    "setlistPreview": "New Minglewood Blues · ...",
    "recordingAvailable": true,
    "archiveIdentifier": "gd1977-05-08"
  },
  "filters": { "year": 1977, "mode": "on_this_date", "month": 5, "day": 8 },
  "bookmarks": [],
  "nearbyStops": []
}
```

**Phase 2 endpoint (planned):** `POST /api/music-pilgrimage/guide/chat`

---

## piBoom file index

| Surface | Path |
|---------|------|
| Atlas UI | `public/music/music-pilgrimage-atlas.html` |
| Atlas JS | `public/music/js/music-pilgrimage-atlas.js` |
| Time Machine | `public/music/music-time-machine.html` |
| Music Research | `public/music/music-research.html` |
| My Dead Shows | `public/music/my-grateful-dead-shows.html` |
| KML viewer | `public/music/kml-viewer.html` |
| Atlas service | `services/music-pilgrimage-atlas.service.js` |
| Personal layer | `services/music-pilgrimage-personal.service.js` |
| MB wrapper | `services/musicbrainz.service.js` |
| Historian persona | `controllers/chat.controller.js` → `historian` |

---

## Deep link cheat sheet

```
/music/music-pilgrimage-atlas.html?year=1977&city=Berkeley&mode=tour
/music/music-pilgrimage-atlas.html?mode=on_this_date&month=5&day=8
/music/music-pilgrimage-atlas.html?show=123
/music/music-time-machine.html?date=1977-05-08
/music/music-research.html
```

MusicBrainz artist URL: `https://musicbrainz.org/artist/{mbid}`
