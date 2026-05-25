# Live Music Pilgrimage Atlas

Map-first music journey tool for exploring Grateful Dead tour history with personal pilgrimage bookmarks and saved routes.

## v1 Scope

- **Artist:** Grateful Dead only (`grateful_dead_shows` table)
- **Exploration modes:** tour route, city grouping, on-this-date
- **Personal layer:** browser `clientId` (UUID in `localStorage`) for favorites, wishlist, visited, notes, and saved filter routes
- **No AI in v1:** map + timeline + stop story is the core experience

## UI

- Page: [`public/music/music-pilgrimage-atlas.html`](../public/music/music-pilgrimage-atlas.html)
- Script: [`public/music/js/music-pilgrimage-atlas.js`](../public/music/js/music-pilgrimage-atlas.js)

Deep links:

```
/music/music-pilgrimage-atlas.html?year=1977&city=Berkeley&mode=tour
/music/music-pilgrimage-atlas.html?mode=on_this_date&month=5&day=8
/music/music-pilgrimage-atlas.html?show=123
```

## API (`/api/music-pilgrimage`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/atlas/overview` | Totals, date range, top venues, shows by year |
| GET | `/atlas` | Combined payload: filters, stops, venues, map bounds, pagination. Query: `year`, `month`, `day`, `city`, `state`, `venue`, `mode`, `limit`, `offset`, `showId`, `clientId` |
| GET | `/atlas/stops/:id` | Stop detail with full setlist and nearby stops. Query: `clientId` |
| GET | `/atlas/venues` | Venue index. Query: `state` |
| GET | `/bookmarks` | List bookmarks. Query: `clientId` (UUID) |
| POST | `/bookmarks` | Upsert bookmark. Body: `clientId`, `bookmarkType` (`favorite` \| `wishlist` \| `visited`), `showId` or venue fields, optional `notes` |
| DELETE | `/bookmarks/:id` | Remove bookmark. Query/body: `clientId` |
| GET | `/routes` | Saved filter routes. Query: `clientId` |
| POST | `/routes` | Save route preset. Body: `clientId`, `label`, `filterConfig` |
| DELETE | `/routes/:id` | Delete saved route. Query/body: `clientId` |

## Database

Tables (created in `database.service.js` and lazily via personal service):

- `music_pilgrimage_bookmarks` — per-browser bookmarks for shows or venues
- `music_pilgrimage_saved_routes` — named filter presets (`filter_config` JSONB)

## Key Paths

| Component | Path |
|-----------|------|
| Atlas read model | `services/music-pilgrimage-atlas.service.js` |
| Personal bookmarks/routes | `services/music-pilgrimage-personal.service.js` |
| Controller | `controllers/music-pilgrimage.controller.js` |
| Routes | `routes/music-pilgrimage.routes.js` |
| Unit tests | `tests/unit/music-pilgrimage-atlas.service.test.js` |

## Phase 2: AI Music Guide (not implemented in v1)

Add an optional floating guide after the non-AI experience is stable:

- **Endpoint:** `POST /api/music-pilgrimage/guide/chat`
- **Context:** selected stop (venue, date, setlist preview), current filter route, user's bookmarked stops, nearby shows in same city/year
- **Prompt role:** "Pilgrimage guide" — explain why a venue or run matters, suggest 2–3 related stops on the map, and link to Time Machine / YouTube search (no fabricated setlists)
- **Memory:** reuse LangChain session keyed by `clientId` + `page: music-pilgrimage-atlas`
- **Guardrails:** cite only data present in API responses; say when archive/recording status is unknown

Smallest next step for AI phase: add read-only guide panel that calls existing chat infrastructure with a structured context payload from the selected stop.

## Related

- [`docs/GRATEFUL_DEAD_SETUP.md`](GRATEFUL_DEAD_SETUP.md) — tour data import
- [`public/music/music-time-machine.html`](../public/music/music-time-machine.html) — on-this-date history
- [`public/music/my-grateful-dead-shows.html`](../public/music/my-grateful-dead-shows.html) — attendance tracking
