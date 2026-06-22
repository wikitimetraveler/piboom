# Music Research — HeyGen script pack

**Lane:** Music Historian / discovery  
**Duration:** ~25s booth popup · optional ~45s full intro  
**Popup URL:** `/music/music-research.html?demo=heygen`  
**QR landing:** `/music/music-historian-line.html?short=1&autoplay=1`  
**Cached MP4 (after render):** `public/music/assets/video/music-research-heygen-short.mp4`  
**Catalog:** `data/music-heygen-demo.json`

Canonical script source: `services/music-heygen.service.js`

HyperFrames body scenes (Google TTS, not HeyGen): see **Scene list** below.

---

## Booth popup (~25s) — paste this for Wednesday

**Title:** Music Research Demo  
**Aspect ratio:** 16:9  
**Motion:** subtle nod, warm scholarly presenter  
**Expressiveness:** low

### Narration

> Welcome to Music Research — your Historian guide to artists through era, place, and evidence. Search a name above: timeline, map, and sources assemble around the artist. Ask in chat — I separate documented fact from interpretation. Tap Open Music Research below to explore — or try Time Machine and the Pilgrimage Atlas for deeper roads.

### On-screen (optional B-roll)

- `music-research.html` — search → Knowledge Graph card → timeline + map

### CTA line

> Open Music Research below.

### HeyGen fields (YAML)

```yaml
clipId: music-research-demo-short
title: Music Research Demo
durationTarget: 25s
aspectRatio: 16:9
avatarMode: stock
voiceTone: scholarly, warm, place-aware
motionPrompt: subtle nod, warm scholarly presenter speaking to camera
expressiveness: low
script: |
  Welcome to Music Research — your Historian guide to artists through era,
  place, and evidence. Search a name above: timeline, map, and sources
  assemble around the artist. Ask in chat — I separate documented fact from
  interpretation. Tap Open Music Research below to explore — or try Time
  Machine and the Pilgrimage Atlas for deeper roads.
outputPath: public/music/assets/video/music-research-heygen-short.mp4
qrUrl: /music/music-research.html?demo=heygen
relatedLinks:
  - /music/music-time-machine.html
  - /music/music-pilgrimage-atlas.html
```

---

## Full Historian intro (~45s) — optional

**Title:** Music Historian — Welcome

### Narration

> Welcome to Music Research at DevConnect Labs. I am your Historian — here to help you read an artist through era, place, and evidence. Search a name: Knowledge Graph facts, a chronological timeline, birth and formation points on the map, and chat grounded in documented sources. For any calendar date, open Music Time Machine. For Grateful Dead tour stops, open the Live Music Pilgrimage Atlas. Let us start with an artist you love.

---

## HyperFrames scene list (Google TTS — do not render in HeyGen)

Use for a future `video/music-research/` reel. Narration only; screen capture from the live page.

| Scene | Kicker | Title | Narration |
|-------|--------|-------|-----------|
| s0 | Music Research | One search, many lenses | Search once — timeline, map, and sources assemble around the artist. |
| s1 | Knowledge Graph | Fast factual anchor | Google's entity card gives a quick anchor before we go deeper. |
| s2 | Timeline | Chronological context | Births, band formation, releases — era at a glance. |
| s3 | Map | Place matters | Teal pins mark personal origins; amber marks where the band formed. |
| s4 | Historian | Ask with guardrails | Chat separates documented fact from interpretation — no invented setlists. |
| s5 | Next stops | Time Machine · Atlas | Time Machine for on-this-date history; Pilgrimage Atlas for the Dead tour. |

Palette: ice/teal from `music-research.html` (`--ice-primary`, light green/blue gradients).

---

## Regenerate via API

```bash
node scripts/tools/generate-music-heygen-demo.mjs --force --direct --cache-local
```

Requires `HEYGEN_API_KEY` in `.env`. Until MP4 exists, popup shows the script banner with paste instructions.

---

## Key lines for captions

- Historian guide — era, place, and evidence
- Timeline, map, and sources around one search
- Documented fact vs interpretation in chat
- Time Machine · Pilgrimage Atlas for deeper roads
