# Planetarium

Full-sky **360° WebGL dome** at [`/planetarium/`](/planetarium/) — astronomy-engine ephemeris, Hipparcos mag≤6 star field, IAU constellation lines, Carl (AstroAI) voice guide, optional Zed HeyGen face, catalog search, ISS TLE passes, and static eclipse/meteor events.

The home hero still uses the lightweight [`FunHomeSky`](../public/shared/js/fun-home-sky.js) sketch; the planetarium page does **not** depend on that ephemeris for planets.

## Surfaces

| Piece | Path / URL |
|-------|------------|
| Dome UI | `/planetarium/` |
| Carl chat | `POST /api/planetarium/assistant/chat` |
| ISS passes + position | `GET /api/planetarium/iss-passes?lat=&lon=&at=` |
| Events / meteors | `GET /api/planetarium/events?from=` |
| Catalog search | `GET /api/planetarium/catalog/search?q=` |
| Star catalog | `data/planetarium/bright-stars.json` |
| Constellation lines | `data/planetarium/constellation-lines.json` |
| Events data | `data/planetarium/sky-events.json`, `meteor-showers.json` |

## Client modules

- `public/planetarium/js/celestial-engine.js` — astronomy-engine wrapper (Sun→Neptune + Moon, refraction on)
- `public/planetarium/js/planetarium-gl.js` — Three.js inner-sky sphere (drag / zoom / pick)
- `public/planetarium/js/planetarium-boot.js` — loads GL then starts the page
- `public/shared/js/planetarium.js` — controls, share URLs, Carl `getSkyContext()`, DOM fallback dome
- `public/shared/js/fun-home-sky.js` — home hero only (also geolocation helpers reused by the desk)
- `public/shared/js/webgpu-planetarium-sky.js` — optional wash if WebGL mount fails
- `public/planetarium/js/planetarium-guide.js` — Carl widget + “show me Jupiter” slew
- `public/planetarium/js/planetarium-heygen.js` — Zed Avatar Realtime tile
- `public/planetarium/js/planetarium-extras.js` — compass, catalog, ISS, events, deep-sky markers
- `public/planetarium/js/planetarium-sky-song.js` — Spirit in the Sky (YouTube audio)

## Rebuild catalogs

```bash
npm run build:planetarium-catalog
# or with fresh download:
node scripts/tools/build-planetarium-catalog.mjs --fetch
```

Sources: ofrohn/d3-celestial stars.6 + constellation lines (BSD-3).

## Deep links

Share / home CTA params: `date`, `time`, `lat`, `lon`, `label`, `face`, `body` (planet id), `select` (constellation / asterism name), `view` (`dome` default, or `horizon`).

## Controls

- **Look up** — zenith view in the wide theater (default). Click again to return overhead after a slew, or toggle off for a horizon window
- **Play / Speed** — animate clock at 1× / 60× / 3600× (honors `prefers-reduced-motion`)
- **Lines** — toggle IAU constellation figures
- **Night vision** — red desk theme
- Drag to spin the dome; wheel to change FOV (up to 180° in look-up)
- Click ISS pass rows to jump sky time to pass start

## Carl context

Each chat turn sends live `getSkyContext()` (observer, date, facing, planets, twilight, selection, engine). Phrases like “show me Mars” or “find M42” slew the dome client-side before Carl answers.

## Out of scope

Air quality (AQI) overlays belong on Unified Disasters, not the dome.
