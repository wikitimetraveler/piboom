# Unified Disasters JS modules

Load **in this order** from `disasters-unified.html`:

1. `core.js` — shared `var` state + loading helpers
2. `ingest.js` — pull APIs, `loadDisasters`, source deck
3. `grid.js` — AG Grid + risk intelligence
4. `map.js` — map markers + YouTube
5. `app.js` — selection, AI, bootstrap

Regenerate from monolith: `node scripts/tools/split-disasters-unified.mjs`
