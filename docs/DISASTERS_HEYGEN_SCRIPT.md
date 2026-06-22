# Unified Disasters — HeyGen script pack

**Lane:** Business / mortgage ops  
**Duration:** ~25s booth popup · optional ~2 min schema walkthrough  
**Popup URL:** `/finance/disasters-unified.html?demo=heygen`  
**Cached MP4:** `public/finance/assets/disaster-heygen-demo.mp4`  
**Catalog:** `data/disaster-heygen-demo.json`

Canonical script source: `services/disaster-heygen.service.js`

---

## Booth popup (~25s) — paste this first

**Title:** Unified Disasters Demo  
**Aspect ratio:** 16:9  
**Motion:** subtle nod, calm professional presenter  
**Expressiveness:** low

### Narration

> This is Unified Disasters — one dashboard for FEMA declarations, wildfires, earthquakes, hurricanes, and weather alerts. Each event links to Encompass pipeline loans and hazard webcams nearby, refreshed on a rolling ninety-day window. Tap Open Unified Disasters below to explore hotspots, counties, and AI briefings on a real event.

### On-screen (optional B-roll)

- `disasters-unified.html` — map with hotspots
- Brief pan of loan count / webcam panel

### CTA line (spoken or on-screen)

> Open Unified Disasters below.

### HeyGen fields (YAML)

```yaml
clipId: disasters-demo-short
title: Unified Disasters Demo
durationTarget: 25s
aspectRatio: 16:9
avatarMode: stock
voiceTone: professional, clear, mortgage-adjacent
motionPrompt: subtle nod, calm presenter
expressiveness: low
script: |
  This is Unified Disasters — one dashboard for FEMA declarations, wildfires,
  earthquakes, hurricanes, and weather alerts. Each event links to Encompass
  pipeline loans and hazard webcams nearby, refreshed on a rolling ninety-day
  window. Tap Open Unified Disasters below to explore hotspots, counties, and
  AI briefings on a real event.
outputPath: public/finance/assets/disaster-heygen-demo.mp4
qrUrl: /finance/disasters-unified.html?demo=heygen
```

---

## Schema walkthrough (~2 min) — optional second render

Use for a longer HeyGen or screen-capture + TTS video. Full narration in `docs/UNIFIED_DISASTERS_DB_SCHEMA_VIDEO_SCRIPT.md`.

**Title:** Unified Disasters Schema

### Narration (spoken-speed opening)

> This is Unified Disasters—one screen for FEMA declarations, wildfires, earthquakes, hurricanes, and weather alerts, plus the loans and hazard webcams around them. Under the hood there is no separate Unified Disasters table. Everything lives in shared Postgres: disasters for rolling events, fire_cameras for fixed webcam mounts, and loans for pipeline properties with risk scores and flood data…

*(Continue from `SCHEMA_WALKTHROUGH_SCRIPT` in `services/disaster-heygen.service.js`.)*

---

## Regenerate via API

```bash
node scripts/tools/generate-disaster-heygen-demo.mjs --force --direct --cache-local
```

Requires `HEYGEN_API_KEY` in `.env`.

---

## Key lines for captions

- One dashboard for FEMA, wildfires, earthquakes, hurricanes, and alerts
- Events link to pipeline loans and hazard webcams nearby
- Rolling ninety-day refresh
- Open Unified Disasters to explore hotspots and AI briefings
