# Frontend Patterns

Conventions for tables, grids, shared components, and themes. Use this when building or modifying finance UIs, dashboards, or any page that uses tables or grids.

## Brownfield vs greenfield

| Kind | Meaning | Stack |
|------|---------|--------|
| **Brownfield (Encompass)** | Existing Worksheets / Hub under `public/finance/` (field browsers, unit tests, processor assignment, Screen Test) — keep working as-is | Bootstrap 5 + vanilla JS. Do **not** introduce React or TypeScript without an explicit migration. |
| **Greenfield** | New product UIs or new domains built from scratch | Prefer **React + TypeScript**. |
| **Brownfield (other existing pages)** | Existing Bootstrap + vanilla pages outside Encompass (some Lane/music/nature/disasters pages) | Keep current stack until an explicit migration; do not mix React/TS on the same page. |

Source of truth: `AGENTS.md` + `REPO_MAP.md`.

## Tables & Grids

| Library | Use case | Theme | Files |
|---------|----------|------|-------|
| **AG Grid** (ag-grid-community) | Unit-test execution grid, Encompass custom/native field browsers | alpine | `unit-tests.js`, `encompassCustomFields.js`, `encompassNativeFields.js` |
| **DataTables** | Pipeline, disasters, risk dashboards, tools | Bootstrap 5 | `pipeline-risk-dashboard.html`, loan pipeline tables, disaster tables |

**Rule:** Use AG Grid for Encompass field browsers, unit-test grids, and **Unified Disasters** (`disasters-unified.html`). Use DataTables for pipeline risk and other general tabular data.

### AG Grid

- CDN: `ag-grid-community`
- Theme: `ag-theme-alpine`
- Use `agGrid.createGrid()` or `new agGrid.Grid()`
- Set explicit `colId` per column
- See patterns in: `unit-tests.js`, `encompassCustomFields.js`, `encompassNativeFields.js`

### DataTables

- Bootstrap 5 integration: `dataTables.bootstrap5.min.css`
- Used for pipeline loans, disaster lists, risk summaries

## Geolocation Auto-Fill (Discovery Pages)

Discovery and collection pages auto-fill latitude/longitude from the device when on mobile:

| Page | Inputs | When |
|------|--------|------|
| Tree Discovery | `addTreeLatitude`, `addTreeLongitude` | On load, camera capture, EXIF fallback |
| Critter Discovery | `addCritterLatitude`, `addCritterLongitude` | On load, camera capture, EXIF fallback |
| Album Discovery | `addLatitude`, `addLongitude` | On load |
| Fish Identification | `catchLat`, `catchLng` | On load |
| My Local Spots | `spotLat`, `spotLng` | When opening Add Spot modal |

Use `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: true` and `maximumAge: 60000`. Sync device location to inputs via a `syncDeviceLocationTo*Inputs()` helper called after position is obtained.



## Lane / family maps (`public/family/`)

**Footer credit:** Add `<div data-lane-site-credit></div>` and [`public/family/js/lane-site-credit.js`](../public/family/js/lane-site-credit.js) before closing `</main>` (styles in [`lane-shell.css`](../public/family/css/lane-shell.css)). Copy: “Developed by David E Lane · AI-assisted development” plus date.

**Unified Disasters** ([`public/finance/disasters-unified.html`](../public/finance/disasters-unified.html)) uses AG Grid for the disasters and loans tables, page chrome in [`public/finance/css/disasters-unified.css`](../public/finance/css/disasters-unified.css) (gradient hero, source command deck with freshness dots), and the finance `tool-product-credits-footer` pattern (label **Developed by**, name **David E Lane**).

**CA fire cameras** ([`public/finance/disasters-ca-cameras.html`](../public/finance/disasters-ca-cameras.html)): fixed ALERTCalifornia mounts on a separate page; data from `GET /api/disasters/cameras` (`fire_cameras` table). Unified Disasters links here only (no camera layer on the disaster map). Ingest: `npm run refresh:fire-cameras` or `POST /api/disasters/refresh-cameras`.

**Map display** uses the **Google Maps JavaScript API** (hybrid / satellite+labels via `mapTypeId: HYBRID`). The browser loads Maps with `GET /api/genealogy/google-api-key` (`GOOGLE_BROWSER_API_KEY` or `GOOGLE_API_KEY` on the server). Shared loader: [`public/family/js/lane-family-google-maps.js`](./../public/family/js/lane-family-google-maps.js).

**Geocoding stays server-side** via [`services/free-geocoding.service.js`](./../services/free-geocoding.service.js) (Mapbox Geocoding API when `MAPBOX_ACCESS_TOKEN` is set, then Nominatim, etc.): `GET /api/genealogy/geocode-address?q=`. Do **not** use `google.maps.Geocoder` on family pages for place resolution; keep using that endpoint. Historical place aliases live in [`services/genealogy-geocode.service.js`](./../services/genealogy-geocode.service.js).

### Lane PDF plate gallery

- **Page:** [`public/family/lane-pdf-gallery.html`](../public/family/lane-pdf-gallery.html) — fetches `GET /api/genealogy/lane-pdf/gallery`.
- **Static plates:** `public/family/assets/lane-pdf/*.jpg` are version-controlled (see `AGENTS.md`); regenerate with `npm run extract:lane-pdf-images` and refresh joins with `npm run build:lane-pdf-candidates`.

## Shared Resources

| Path | Purpose |
|------|---------|
| `public/shared/toast.js` | Shared toast notifications (showToast) — use instead of alert() |
| `public/shared/collection-styles.css` | Shared collection page styles (stats, cards, map, empty/loading, toast) |
| `public/shared/collection-utils.js` | Shared collection utilities (showToast delegates to toast.js, resolvePosterImageUrl, waitForPosterImages, requestDeviceLocation) |
| `public/shared/modern-navbar.js` | Web component navbar (loads image lightbox sitewide) |
| `public/shared/lane-image-lightbox.js` | Click-to-expand images in `main`; opt out with `data-lane-lightbox-ignore` or class `lane-lightbox-ignore`. Always ignored: `#loginModal`, `.login-user-card`, `.collection-media-root` (album/collection carousels use their own ‹ › arrows). |
| `public/shared/lane-image-lightbox.css` | Lightbox overlay styles (z-index above Bootstrap modals) |
| `public/shared/styles.css` | Shared styles |
| `public/shared/user-login.js` | User login |
| `public/shared/user-selector.js` | User selector |
| `public/shared/voice-widget.js` | Voice widget |
| `public/shared/dark-mode.js` | Dark mode toggle |
| `public/shared/quick-actions.js` | Quick actions |
| `public/shared/voice-commands.js` | Voice commands (module) |
| `public/shared/ai-chat-widget.js` | AI chat widget (module) |
| `public/shared/ai-insights-card.js` | AI insights card (module) |
| `public/shared/calculationEngine.js` | Calculation engine |
| `public/shared/calcEngineLibrary.js` | calcMath library |
| `public/shared/map-icons.js` | Shared Google Maps marker SVGs (`mapIcons.get*ForMarker`) — disasters, collections, music research |

### Map marker icons (`map-icons.js`)

Load before creating markers when using custom pins (not default red dots):

```html
<script src="/shared/map-icons.js"></script>
```

| Helper | Use |
|--------|-----|
| `mapIcons.getDisasterIconForMarker(eventType, source)` | Unified disasters, risk dashboards |
| `mapIcons.getLoanIconForMarker(score)` | Encompass loan points on hazard maps |
| `mapIcons.getCollectionIconForMarker('tree' \| 'fish' \| …)` | Nature / bike collection maps |
| `mapIcons.getMusicOriginIconForMarker('birth' \| 'formation')` | [`public/music/music-research.html`](../public/music/music-research.html) — teal star pin = personal birth; amber notes pin = band formation |

Music Research map payloads from `POST /api/music-research/map-data` include `eventType` on each point (`birth` for members and solo artists, `formation` for the main band origin). `getBirthplaceIconForMarker()` remains as an alias for `getMusicOriginIconForMarker('birth')`.

## Finance / Worksheets shell (Bootstrap 5)

Worksheets and Encompass pages under `public/finance/` use **Bootstrap 5.3.3** from jsDelivr (not Bootstrap 4).

**CSS (head):**

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
```

**JS (before `</body>`, after jQuery when the page needs jQuery):**

```html
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous"></script>
```

`bootstrap.bundle.min.js` includes Popper — do **not** add a separate Popper script for Bootstrap-only usage.

**Calculator / Worksheets chrome:** Standalone calculators under `public/finance/*-calculator.html` share **`/finance/css/worksheets-shell.css`**, `body.worksheets-shell`, a top **`navbar`** (light bar for Hub / Unit Tests / Home), **`main-content`**, and static HTML **tool-pills** (`nav.nav-pills`) linking to sibling calculators—the same vocabulary as **`unit-tests.html`**. Prefer this markup instead of injecting duplicate strips via **`public/finance/js/calculator-pills.js`** (deprecated no-op if pills already exist). **Dark primary navbars** (e.g. FHA Streamline worksheet) remain `navbar-dark`; shell styles target light navbars only (`:not(.navbar-dark)`).

**Encompass field hints:** Add **`data-encompass-field="<id>"`** on worksheet inputs/results where a native ID or `CUSTOM.*` placeholder is known. Authoritative suggestion map: **`public/shared/encompass-calculator-field-suggestions.json`** (aligned with `calculationEngine.js` factories). Tools that read bindings can surface the attribute next to **`emid`** where both exist.

**jQuery:** Keep only where required (DataTables, legacy `$()` helpers, some calculators). Bootstrap 5 components use `data-bs-*` attributes (e.g. `data-bs-toggle="collapse"`, `data-bs-target="#id"`, `data-bs-dismiss="modal"`).

**Utilities (v4 → v5):** `ml-*` → `ms-*`, `mr-*` → `me-*`, `pl-*` → `ps-*`, `pr-*` → `pe-*`, `font-weight-bold` → `fw-bold`, modal close → `button.btn-close` with `data-bs-dismiss="modal"`.

## Navigation (modern-navbar)

The shared navbar (`public/shared/modern-navbar.js`) uses a hub-first structure with 5 top-level items: Home, Worksheets, Music, Entertainment, More.

### Nav structure

| Nav item | Contents |
|----------|----------|
| **Home** | Link to `/` |
| **Worksheets** | Worksheets Hub, Encompass Assistant, Encompass Hub, Pipeline Risk, Unit Tests, The Screen Test |
| **Music** | Music Research, Album Discovery, My Collection, Song Identifier, Spotify, Time Machine, All Music Tools |
| **Entertainment** | Boombox, Visualizer, Black Light, Poster Generator, Art Gallery, Ouija Board, All Entertainment |
| **More** | Bike Store, Wolfman Dave, Levi Assistant, Voice Guide, Family, Nature, Hub (All Tools) |

Additional tools (Parser, Mashup, Automator, Ruler, Transformer, Alchemist, Encompass Users, Risk Analysis, Grateful Dead Timeline, etc.) are reachable via **Worksheets Hub** (`/finance/index.html`) or **Hub** (`/`).

### Global Tool Search

- **Ctrl+K** (or Cmd+K on Mac) opens the tool search overlay from any page with the navbar.
- **Search button** in the navbar also opens the overlay.
- Search by tool name or keyword (e.g. "unit test", "encompass", "parser").
- Tool index: `public/shared/tool-search-index.js` — add new tools here.

### Attributes

| Attribute | Purpose |
|-----------|---------|
| `brand="Custom Name"` | Override brand text (default: `DevConnect Labs`) |
| `compact` | Hide Entertainment as top-level; show only Home, Worksheets, Music, More |

Example: `<modern-navbar brand="My App" compact></modern-navbar>`

### Hub deep-links

The index hub page supports hash-based deep-links that auto-expand accordion sections: `/#headingMusic`, `/#headingEntertainment`, `/#headingBike`, `/#headingAI`, `/#headingNature`.

## Finance UI Structure

```
public/finance/
├── encompass-assistant.html
├── tool9.html              # The Screen Test
├── pipeline-risk-dashboard.html
├── encompass-hub-test.html
├── unit-tests.html
├── encompass-custom-fields.html
├── encompass-native-fields.html
├── processor-assignment.html   # Complexity + processor capacity; Encompass users picker; encompassFetch + hub config API
├── asset-qualifier-calculator.html
├── closing-cost-calculator.html
├── cashout-refinance-calculator.html
├── fha-streamline-ntb-calculator.html
├── va-irrrl-calculator.html
└── js/
    ├── main.js
    ├── tool9.js
    ├── unit-tests.js
    ├── unit-tests-ai.js
    ├── encompassHub.js
    ├── encompassAnalytics.js
    ├── processor-assignment.js
    └── ...
```

## Boolean / Yes-No Display

**Rule:** All sections and columns that display boolean or yes-no values must produce **Yes** when true and **No** when false. Do not use "Y"/"N" or raw `true`/`false` for user-facing display.

| Context | Display |
|---------|---------|
| Boolean true | Yes |
| Boolean false | No |

Use `value ? 'Yes' : 'No'` or equivalent. AG Grid/DataTables cell renderers and inline templates should follow this convention.

## Bootstrap & Styling

- Bootstrap 5 for layout and components
- Bootstrap Icons
- **Shared tokens:** [`public/shared/design-tokens.css`](../public/shared/design-tokens.css) — loaded via [`styles.css`](../public/shared/styles.css) (`@import`). Defines `--zen-primary` (#4a90a4), finance aliases (`--primary-blue` → zen), ICE, and Lane heritage (`--lf-*`, `--lane-heritage-*` aliases).
- **Dark mode (sitewide zen):** [`public/shared/dark-mode.js`](../public/shared/dark-mode.js) — `body.dark-mode`, localStorage `devConnectLabs_darkMode`. Overrides zen + `--lf-*` on Lane magazine/hub pages. Encompass grid tools use separate `encompass-dark-mode.js`.
- Finance worksheets: prefer tokens over inline `:root`; shell pages import tokens through `worksheets-shell.css` or `/shared/design-tokens.css`.
- Lane magazine / trading cards: use `--lf-*` (see `lane-magazine.css`, `lane-trading-cards.css`); trading cards cinematic UI uses `--lf-gold`, `--lf-surface-dark`.
- Dashboard-only variables still allowed (e.g. `--primary-color`, `--danger-color` on pipeline-risk pages).
- Inter or similar fonts via Google Fonts; Lane heritage serif: `--lf-serif` (Source Serif 4 on hub)

## Speech / Google TTS

**Rule: always use Google Cloud TTS first.** Shared stack: [`public/shared/tts.js`](../public/shared/tts.js) → `POST /api/voice/synthesize`.

| Path | When |
|------|------|
| `speakWithGoogle` / `speakNarrationAwaitEnd` | Default for all Listen, phrase practice, reels, guide speak-back |
| Browser `speechSynthesis` | Last-resort only if synthesize fails or `audio.play()` is blocked |

- Desktop **and** mobile — do not short-circuit mobile to system voices.
- Arabic (Jordan / Syria / Holy Land phrases and guides) must use `ar-XA-*` Google voices, never an English browser voice reading Arabic script.
- Do not invent page-local TTS helpers that skip Google; extend `tts.js` or thin page wrappers (`JordanI18N.speak`, etc.).

## Toast Notifications

Use the shared toast instead of `alert()` for user feedback. Include `toast.js` and `collection-styles.css` on pages that need feedback.

**API:**
```javascript
// Simple message
showToast('Copied to clipboard', { type: 'success' });

// With title
showToast('Save Failed', { title: 'Error', type: 'error' });

// Backward compat (collection-utils style)
showToast('Success', 'Tree saved', 'success');
showToast('Error', 'Failed to load', 'error', 5000);
```

**Types:** `success`, `error`, `warning`, `info` (aliases: `ok` → success, `err`/`danger` → error)

## Voice Commands

Pages can integrate `voice-commands.js` for voice activation. Commands like "Open screen test" are defined in `public/shared/voice-commands.js`.

## Related

- **AGENTS.md** – AG Grid, DataTables conventions
- **docs/CALCULATION_ENGINE.md** – Forms with calculations
- **docs/DISASTER_RISK.md** – Pipeline risk dashboard
