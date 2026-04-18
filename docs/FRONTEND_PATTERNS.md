# Frontend Patterns

Conventions for tables, grids, shared components, and themes. Use this when building or modifying finance UIs, dashboards, or any page that uses tables or grids.

## Tables & Grids

| Library | Use case | Theme | Files |
|---------|----------|------|-------|
| **AG Grid** (ag-grid-community) | Unit-test execution grid, Encompass custom/native field browsers | alpine | `unit-tests.js`, `encompassCustomFields.js`, `encompassNativeFields.js` |
| **DataTables** | Pipeline, disasters, risk dashboards, tools | Bootstrap 5 | `pipeline-risk-dashboard.html`, loan pipeline tables, disaster tables |

**Rule:** Use AG Grid for Encompass field browsers and unit-test grids. Use DataTables for pipeline, disasters, and general tabular data.

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

Interactive maps on the Lane genealogy pages use **Mapbox GL JS** for the map canvas and **server-side** geocoding via [`services/free-geocoding.service.js`](./../services/free-geocoding.service.js) (Mapbox Geocoding API when `MAPBOX_ACCESS_TOKEN` is set, then Nominatim, etc.). Endpoints: `GET /api/genealogy/mapbox-access-token`, `GET /api/genealogy/geocode-address?q=`. Historical place aliases live in [`services/genealogy-geocode.service.js`](./../services/genealogy-geocode.service.js). Family map UIs use the **`satellite-streets-v12`** style (satellite imagery plus labels/roads) for readability.

**Do not** add the Google Maps JavaScript API or `google.maps.Geocoder` to these family pages. Other areas of the repo may still use Google Maps keys for legacy UIs; do not copy that pattern into new `public/family/` work.

## Shared Resources

| Path | Purpose |
|------|---------|
| `public/shared/toast.js` | Shared toast notifications (showToast) — use instead of alert() |
| `public/shared/collection-styles.css` | Shared collection page styles (stats, cards, map, empty/loading, toast) |
| `public/shared/collection-utils.js` | Shared collection utilities (showToast delegates to toast.js, resolvePosterImageUrl, waitForPosterImages, requestDeviceLocation) |
| `public/shared/modern-navbar.js` | Web component navbar |
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
- Custom CSS variables in pages (e.g. `--primary-color`, `--danger-color`)
- Inter or similar fonts via Google Fonts

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
