# Planetarium

Full-sky **360° WebGL dome** at [`/planetarium/`](/planetarium/) — astronomy-engine ephemeris, Hipparcos mag≤6.5 star field (J2000 precessed to of-date via EQJ→HOR), IAU constellation lines, Carl (AstroAI) voice guide, optional Zigzag HeyGen face, catalog search, ISS TLE passes, and static eclipse/meteor events.

**Planet worlds** — graphics-first body home pages at [`/planetarium/worlds/`](/planetarium/worlds/) (shared template [`body.html?id=mars`](/planetarium/worlds/body.html?id=mars)): circular WebGPU NASA **sphere** (not a rectangular stage), interactive equirectangular **surface map** (pan / click / site pins → `lookAt`), research desk from static dossiers, and Carl with world-dossier context.

The home hero still uses the lightweight [`FunHomeSky`](../public/shared/js/fun-home-sky.js) sketch; the planetarium page does **not** depend on that ephemeris for planets. Enlarged hero globes link to **Open {Planet}** (world page) and **View in sky** (dome).

## Surfaces

| Piece | Path / URL |
|-------|------------|
| Theater (lie-back dome) | `/planetarium/` |
| **Field** (phone outdoor instrument) | `/planetarium/field.html` — horizon + night chrome by default; Face / Find / Carl / Tonight / More dock; lite PWA manifest |
| **Planet worlds hub** | `/planetarium/worlds/` |
| **Planet world page** | `/planetarium/worlds/body.html?id=mars` (mercury–pluto + moon) |
| **SpaceX rockets** | `/planetarium/spacex.html` — Falcon 1 / 9 / Heavy / Starship plus every tracked launch date; Zigzag hangar chat with Elon (`?talk=1`) |
| Carl chat | `POST /api/planetarium/assistant/chat` |
| ISS passes + position | `GET /api/planetarium/iss-passes?lat=&lon=&at=` |
| Events / meteors | `GET /api/planetarium/events?from=` |
| Catalog search | `GET /api/planetarium/catalog/search?q=` |
| SpaceX catalog | `GET /api/planetarium/spacex?rocket=&q=&when=&year=` — snapshot from Launch Library 2 |
| Star catalog | `data/planetarium/bright-stars.json` |
| Constellation lines | `data/planetarium/constellation-lines.json` |
| Events data | `data/planetarium/sky-events.json`, `meteor-showers.json` |
| World dossiers | `data/planetarium/worlds/{id}.json`, `index.json` |
| SpaceX snapshot | `data/planetarium/spacex-catalog.json` (`npm run fetch:spacex-catalog`) |
| SpaceX hangar chat | `data/planetarium/spacex-hangar-chat.json` — Zigzag ↔ Elon scripted beats |

### Theater vs Field

| | Theater | Field |
|---|---------|-------|
| Default view | Look-up dome | Horizon |
| Night chrome | Opt-in | On (Dim / Red / Deep) — UI only, sky unfiltered |
| Primary chrome | Masthead + control clusters + right desk | Full-bleed sky + bottom dock + sheets |
| Compass / AR | Discover tab | **Face** dock slot |
| HeyGen Zigzag / Spirit in the Sky | Yes | No |
| Share `app=` | (theater) | `app=field` reopens Field |

## Sky frames (theater GL)

- **Stars / constellation lines** — Hipparcos J2000 RA/Dec rigidly rotated with `Rotation_EQJ_HOR` (precession + nutation). No atmospheric refraction on the star field.
- **Planets / Moon / Sun** — `Equator(..., ofdate=true)` then `Horizon(..., 'normal')` (refraction on).
- **Look-up** — equidistant fisheye projector (cube map → full-sky disc); FOV up to **180°** (default ~160°).
- **Horizon / Field** — perspective camera (FOV capped ~110°).
- **Milky Way** — galactic-plane band (`Rotation_EQJ_GAL`), not an altitude wash.
- Hero SVG fallback still uses lightweight [`FunHomeSky`](../public/shared/js/fun-home-sky.js) math (approximate; not the GL path).

## Client modules

- `public/planetarium/js/celestial-engine.js` — astronomy-engine wrapper (Sun→Neptune + Moon; `j2000ToAltAz` / `eqjToEnuMatrix` for stars; refraction on planets)
- `public/planetarium/js/planetarium-gl.js` — Three.js inner-sky sphere; Look-up fisheye; drag / zoom / angular pick
- `public/planetarium/js/planetarium-boot.js` — loads GL then starts the page
- `public/shared/js/planetarium.js` — controls, share URLs, Carl `getSkyContext()`, DOM fallback dome
- `public/shared/js/fun-home-sky.js` — home hero only (also geolocation helpers reused by the desk); `buildPlanetariumUrl` / `buildWorldUrl`
- `public/shared/js/webgpu-planetarium-sky.js` — optional wash if WebGL mount fails
- `public/planetarium/js/planetarium-guide.js` — Carl widget + “show me Jupiter” slew (world pages skip slew)
- `public/planetarium/js/planetarium-heygen.js` — Zigzag Avatar Realtime tile
- `public/planetarium/js/planetarium-extras.js` — compass, catalog, ISS, events, deep-sky markers
- `public/planetarium/js/planetarium-field.js` — Field dock, bottom sheets, night levels, first-run calibrate
- `public/shared/css/planetarium-field.css` — Field night instrument chrome (does not restyle theater)
- `public/planetarium/js/planetarium-sky-song.js` — Spirit in the Sky (YouTube audio; theater only)
- `public/planetarium/js/planetarium-world.js` — body home page globe + research desk
- `public/planetarium/js/planetarium-worlds-hub.js` — worlds hub card grid
- `public/shared/css/planetarium-world.css` — worlds hub / body page chrome
- `public/planetarium/spacex.html` + `js/planetarium-spacex.js` + `js/planetarium-spacex-pad.js` + `js/planetarium-spacex-hangar.js` + `public/shared/css/planetarium-spacex.css` — SpaceX vehicles, launch dates, Three.js lift-off pad, Zigzag ↔ Elon hangar chat

## Rebuild catalogs

```bash
npm run build:planetarium-catalog
# or with fresh download:
node scripts/tools/build-planetarium-catalog.mjs --fetch
```

SpaceX launch snapshot (Launch Library 2):

```bash
npm run fetch:spacex-catalog
# rewrite rocket copy from the existing launch list (no network):
node scripts/tools/fetch-spacex-catalog.mjs --rebuild
```

Sources: ofrohn/d3-celestial stars.6 + constellation lines (BSD-3).

## Deep links

Share / home CTA params: `date`, `time`, `lat`, `lon`, `label`, `face`, `body` (planet id), `select` (constellation / asterism name), `view` (`dome` default on theater, `horizon` default on Field), `app=field` (Field share links).

World pages: `id` (or `body`) on `/planetarium/worlds/body.html` — e.g. `?id=mars`.

SpaceX catalog: `/planetarium/spacex.html?rocket=falcon-9&when=upcoming&q=starlink&year=2024`. Hangar chat: `/planetarium/spacex.html?talk=1`.

Home hero: enlarge a globe → **Open {Planet}** world page + **View in sky** dome; Ctrl/Meta+click a sky planet dot opens the world page.

## Controls

- **Look up** — zenith view in the wide theater (default). Click again to return overhead after a slew, or toggle off for a horizon window
- **Play / Speed** — animate clock at 1× / 60× / 3600× (honors `prefers-reduced-motion`)
- **Lines** — toggle IAU constellation figures
- **Night vision** — red desk theme
- Drag to spin the dome; wheel to change FOV (Look-up fisheye up to 180°; horizon/Field perspective to ~110°)
- Click ISS pass rows to jump sky time to pass start
- Planet pick HUD / Tonight table: **Open {Planet} home** when the selection is a known world body

## Carl context

Each chat turn sends live `getSkyContext()` (observer, date, facing, planets, twilight, selection, engine). On world pages, context also includes the open `world` dossier excerpt; session id is `planetarium-carl-{id}`. Phrases like “show me Mars” or “find M42” slew the dome client-side before Carl answers (theater / Field only).

## Out of scope

Air quality (AQI) overlays belong on Unified Disasters, not the dome.
