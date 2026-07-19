---
name: nature-discovery-bootstrap
description: Builds or migrates public/nature discovery and collection static HTML to Bootstrap 5, and aligns Collection Address sections with the tree-discovery card pattern. Use when editing nature pages under public/nature/, adding map/address/save flows, matching tree or rock discovery UX, or when the user mentions Bootstrap 5 for nature tools.
---

# Nature discovery pages — Bootstrap 5 & Collection Address

## Project constraints

- This skill targets existing **Bootstrap 5** + **vanilla JS** nature pages. New non-Encompass apps may use React + TypeScript per `AGENTS.md`; do not mix stacks on the same page without an explicit migration.
- Shared assets: `/shared/styles.css`, `/shared/menu-config.js`, `/shared/modern-navbar.js`, `/shared/user-selector.js` as needed.
- Deeper patterns: `docs/FRONTEND_PATTERNS.md`.

## Bootstrap 5 baseline (static pages)

Use the CSS bundle (JS only if the page uses Bootstrap modals, dropdowns, or collapse):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
```

### Class replacements (BS4 → BS5)

| BS4 | BS5 |
|-----|-----|
| `mr-*`, `ml-*` | `me-*`, `ms-*` |
| `pl-*`, `pr-*` | `ps-*`, `pe-*` |
| `form-group` | `mb-3` (or spacing utility) + `form-label` on labels |
| `form-row` | `row` + `g-2` / `g-3` |
| `sr-only` | `visually-hidden` |
| `badge badge-light` | `badge bg-light` (+ text color class if needed) |
| `float-left` / `float-right` | `float-start` / `float-end` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `input-group-append` | nested `input-group-text` or second control in `input-group` (BS5 structure) |

**Data attributes:** `data-toggle` → `data-bs-toggle`, `data-target` → `data-bs-target`.

## Collection Address block (match tree discovery)

Canonical layout lives in `public/nature/tree-discovery.html` (card titled **Collection Address**). New or migrated pages should mirror it unless there is a deliberate product reason not to.

### Structure

1. **Section title:** `<h5 class="card-title">` (or `h6` if nested) with `<i class="bi-geo-alt"></i> Collection Address`.
2. **Street Address** — full width, label + `placeholder="Start typing an address"` if using Places autocomplete.
3. **Row:** City `col-md-6`, State `col-md-3`, Zip `col-md-3` — each with a **visible** label (not placeholder-only).
4. **County** — full width.
5. **Row:** Latitude and Longitude — `col-md-6` each, **readonly**, `class="form-control bg-light"` (or equivalent), placeholders `lat` / `lng`.
6. **Geocoded / internal coords:** If JS needs separate hidden values (e.g. `rockAddressLat` / `rockAddressLng`), use `<input type="hidden">` — do **not** duplicate a second visible lat/lng row.
7. **Button:** `btn btn-outline-success btn-sm mt-2`, icon `bi-geo-alt-fill`, label **Use my phone's location** (wire to existing geolocation handler).
8. **Helper text:** `small.form-text.text-muted.d-block.mt-2`, e.g. *Used when saving [the entity] to your collection. Location is requested automatically when you open the page.* (adjust noun only).

### Visual container

Wrap in a bordered, rounded inner panel or card body consistent with tree discovery (subtle border + light shadow). Example reference: `public/nature/rock-discovery.html` Collection Address inset after Bootstrap 5 migration.

## Checklist (new nature save + map page)

- [ ] BS5 CSS link; utilities updated if porting from BS4.
- [ ] Collection Address matches tree-discovery field order and labels.
- [ ] Single visible lat/lng pair; extras hidden if required by save logic.
- [ ] Green outline location button copy matches tree pattern.
- [ ] Autocomplete still bound to the street input id expected by existing scripts.
- [ ] Skip link + main landmark if the page follows other nature accessibility patterns.

## Reference files

- `public/nature/tree-discovery.html` — Collection Address markup (BS4 classes; map mentally to BS5 equivalents).
- `public/nature/rock-discovery.html` — BS5 + Collection Address + hidden geocode fields + map flow.
