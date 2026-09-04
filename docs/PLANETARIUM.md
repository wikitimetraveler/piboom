# Planetarium

Full-sky dome at [`/planetarium/`](/planetarium/) — date/time sky from `FunHomeSky`, Carl (AstroAI) voice guide, optional Zed HeyGen face, catalog search, ISS passes, and static eclipse/meteor events.

## Surfaces

| Piece | Path / URL |
|-------|------------|
| Dome UI | `/planetarium/` |
| Carl chat | `POST /api/planetarium/assistant/chat` |
| ISS passes | `GET /api/planetarium/iss-passes?lat=&lon=` |
| Events / meteors | `GET /api/planetarium/events?from=` |
| Catalog search | `GET /api/planetarium/catalog/search?q=` |
| Catalog data | `data/planetarium/catalog-index.json` |
| Events data | `data/planetarium/sky-events.json`, `meteor-showers.json` |

## Client modules

- `public/shared/js/fun-home-sky.js` — stars, planets, asterisms, share URL helper
- `public/shared/js/planetarium.js` — dome paint, selection, `getSkyContext()`
- `public/shared/js/webgpu-planetarium-sky.js` — optional WebGPU / 2D backdrop
- `public/planetarium/js/planetarium-guide.js` — Carl widget (fresh `skyContext` each turn)
- `public/planetarium/js/planetarium-heygen.js` — Zed Avatar Realtime tile + short handoff before Carl’s answer
- `public/planetarium/js/planetarium-extras.js` — compass, catalog, ISS, events, deep sky
- `public/shared/js/celestial-ambience.js` — generative drone bed (not loaded on planetarium; home plays Children of the Sun instead)
- `public/planetarium/js/planetarium-sky-song.js` — **Spirit in the Sky** only (Norman Greenbaum, 1969) via hidden YouTube audio `YqYN-1vMM9k` (no on-page video tile). Starts at 0:15 on page load; the **Spirit in the Sky** control toggles play/pause. If the browser blocks autoplay, the first click on the page unlocks audio.

## Deep links

Share / home CTA params: `date`, `time`, `lat`, `lon`, `label`, `face`, `body` (planet id), `select` (star / asterism name).

Home hero **Open full sky** builds these via `FunHomeSky.buildPlanetariumUrl`.

## Carl context

Each chat turn sends live `getSkyContext()` (observer, date, facing, planets, twilight, **selection**, `refreshedAt`). Changing date / facing shows “Sky updated — Ask Carl for a fresh read.”

## Out of scope

Air quality (AQI) overlays belong on Unified Disasters, not the dome.
