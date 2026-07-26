---
name: google-maps-expert
description: >-
  Implements and hardens Google Maps JavaScript API features: AdvancedMarkerElement,
  mapId, async loading, InfoWindows, bounds fitting, geocoding handoff, and
  generic pin markers. Use when editing map pages, inventing origins maps, shop
  pins, disaster markers, Lane family maps, or when the user mentions Google Maps,
  Advanced Markers, mapId, Marker deprecation, or map UX polish.
---

# Google Maps Expert

## Non-negotiables

1. **AdvancedMarkerElement** for new markers — not legacy `google.maps.Marker` when the marker library is available.
2. Maps that use Advanced Markers need a **`mapId`** (`DEMO_MAP_ID` is fine for unstyled maps).
3. Load with **`loading=async`** + **`libraries=marker`** (and `places` only if needed). Prefer `google.maps.importLibrary('marker')` after base load.
4. Reuse repo helper: `public/shared/google-advanced-markers.js` (`createMapMarker`, `createPinContent`, `ensureMarkerLibrary`, `openMapInfoWindow`).
5. API key via server endpoints (`laneFamilyLoadGoogleMaps` / music research key) — never hardcode keys in new pages.
6. Graceful fallback: if Maps fails, keep list/directions UI and a clear status message.

## Marker patterns

| Use case | Marker content |
|----------|----------------|
| Product / photo pins | `createMapMarker({ icon: { url, scaledSize } })` |
| Place / origin / shop pins | `createPinContent({ color, label })` → `createMapMarker({ content })` |
| Dense disaster maps | Shared SVG icons from `map-icons.js` as Advanced Marker content |

## Map UX checklist

- [ ] `fitBounds` with padding when multiple pins; single pin uses sensible zoom (14–16 shop, 2–4 world)
- [ ] InfoWindow opens via `openMapInfoWindow` (Advanced Marker-safe)
- [ ] List ↔ map sync (click row focuses pin; active state on list)
- [ ] Reset / “show all” restores bounds
- [ ] `streetViewControl: false` unless the page needs it
- [ ] Mobile: map container has min-height; invalidate/resize after accordion/show

## Glazed / donuts maps

- Shop: `#gzShopMap` — one generic pin (`S`), hybrid optional
- Origins: `#gzOriginsMap` — numbered generic pins from `donuts[].origin.{lat,lng,place,year}`; **no product-photo markers**
- Loader: `/family/js/lane-family-google-maps.js` then `/shared/google-advanced-markers.js` then `/donuts/js/donuts-map.js`

## Deprecation cheat sheet

| Old | New |
|-----|-----|
| `new google.maps.Marker({ icon })` | `AdvancedMarkerElement` + `content` / `createMapMarker` |
| Script without `loading=async` | `loading=async` + callback or `importLibrary` |
| No `mapId` with Advanced Markers | Set `mapId: googleAdvancedMarkers.DEFAULT_MAP_ID` |

## When blocked

Report: missing `GOOGLE_BROWSER_API_KEY` / `GOOGLE_API_KEY`, referrer restrictions, or CSP blocking Maps script. Propose smallest fix (env, allowlist, local vendor).
