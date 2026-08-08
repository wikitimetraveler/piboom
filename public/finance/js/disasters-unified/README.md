# Unified Disasters JS modules

Load **in this order** from `disasters-unified.html`:

1. `core.js` — shared `var` state + loading helpers
2. `geo-data.js` — US state/county geo + stats helpers
3. `map-overlays.js` — Leaflet live `/near` ring + graph NEAR rays
4. `geo-picker.js` — Leaflet hazard lens (state → county, lazy load)
5. `ingest.js` — pull APIs, `loadDisasters`, source deck
6. `grid.js` — AG Grid + risk intelligence
7. `map.js` — Google Maps markers + YouTube (after county load)
8. `graph-panel.js` — D3 force ego-network (persisted impact graph)
9. `app.js` — selection, AI, bootstrap

Graph ego API: `GET /api/disaster-impact-graph/disaster/:disasterId/ego` (as-of reseed; not live `/near`).

Geo assets: `npm run build:us-geo` → `public/finance/assets/geo/`
(writes `us-states.geojson`, `us-states.topojson`, and `counties/*.geojson` — **commit these** so production does not need a build step).
State outlines load from `us-states.geojson` (no CDN). Fallback: local `/shared/vendor/topojson-client.min.js` + topojson.

Regenerate from monolith: `node scripts/tools/split-disasters-unified.mjs`
