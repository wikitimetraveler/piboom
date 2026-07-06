# HeyGen Advanced Office Hours — Demo Cheat Sheet

**Session:** 10 AM · Advanced users  
**Server:** `npm start` → `http://localhost:3000`  
**Health:** `GET /api/heygen/health` → `{ "configured": true }`

---

## 30-second pitch

> We use HeyGen sparingly — booth popups, ancestor QR lines, and live disaster briefings where a real face matters. Long product tours run through our HyperFrames pipeline with Google TTS and cached MP4s, so demos work offline and we are not re-rendering on every visit. Everything is cataloged in the hub and wired into Bootstrap pages with `?demo=heygen` popups and optional live API studio.

---

## Browser tab preset (open before call)

| # | Tab | URL |
|---|-----|-----|
| 1 | Video hub | http://localhost:3000/heygen-hub.html |
| 2 | Disasters booth popup | http://localhost:3000/finance/disasters-unified.html?demo=heygen |
| 3 | Disasters live studio | http://localhost:3000/finance/disasters-unified.html#duHeygenStudio |
| 4 | Unit Tests reel | http://localhost:3000/finance/unit-tests.html?reel=1 |
| 5 | Lane HyperFrame line | http://localhost:3000/family/lane-hyperframe-line.html?person=sarah-dickinson-lane |
| 6 | Music booth popup | http://localhost:3000/music/music-research.html?demo=heygen |
| 7 | HeyGen dashboard | https://app.heygen.com |

**Backup tabs:** Lane photo avatar (`/family/lane-heygen-line.html?person=jonathan-homer-lane&short=1`), print kit (`/family/lane-heygen-print.html`), mortgage-tools reel (`/finance/assets/video/mortgage-tools-reel.mp4`).

---

## Demo order (60–90 min)

1. **Unified Disasters booth** — cached MP4, QR → popup → CTA (`?demo=heygen`)
2. **Disasters live studio** — pick avatar, preview script, render event briefing or schema walkthrough
3. **HyperFrames — Unified Disasters reel** — same product, 58s narrated tour (Google TTS, not HeyGen credits)
4. **Unit Tests** — pre-rendered MP4 + in-page Story Mode (`?demo=1&reel=1`)
5. **Lane photo avatars** — portrait → photo avatar → QR line
6. **Lane HyperFrame-first** — reel primary, HeyGen fallback
7. **Hub catalog** — filter HeyGen vs HyperFrames by domain

---

## HyperFrames deep-dive packet

**Primary folder:** `video/unified-disasters/`  
**Backup folder:** `video/unit-tests/`

| File | What to show |
|------|----------------|
| `hyperframes.json` | Schema-compliant project manifest |
| `frame.md` | Design spec — colors, typography, mood (command-center pacing) |
| `scenes.json` | 7 beats — one capability per scene |
| `make-narration.mjs` | Google TTS + render pipeline |
| `data/hyperframes-library.json` | Published catalog entry → `unified-disasters-reel.mp4` |

**Talking point:** HyperFrames handles 55–90s product tours; HeyGen handles the 25s booth hook and live “generate briefing for this FEMA event” moments.

**Endless Tour hybrid:** `video/endless-tour/make-heygen-clips.mjs` stitches HeyGen intro/outro with HyperFrames body — ask about aspect-ratio handoff.

---

## Prep status (verified)

- [x] `HEYGEN_API_KEY` configured — `/api/heygen/health` OK
- [x] Hub + library — 19+ catalog entries at `/heygen-hub.html`
- [x] Music booth MP4 — `public/music/assets/video/music-research-heygen-short.mp4` (avatar `f6a9e6cd…`, video `78bc686d…`)
- [x] Live studio rehearsal — briefing preview + render polled to `completed` (video `8d358bc0…`, library `disasters-briefing-8d358bc0…`)

### Regenerate commands (only if you want fresh takes)

```bash
node scripts/tools/generate-music-heygen-demo.mjs --force --direct --cache-local
node scripts/tools/generate-disaster-heygen-demo.mjs --force --direct --cache-local
node scripts/tools/generate-lane-heygen-line.mjs --person jonathan-homer-lane --short --force --direct --cache-local
```

---

## Advanced questions to raise (pick 2–3)

1. **Photo avatars at scale** — We batch ancestor portraits via `generate-lane-heygen-line.mjs` with per-person voice IDs. Best practice for consistency across short + full cuts when reusing the same portrait?

2. **HeyGen bookends + HyperFrames body** — Endless Tour uses HeyGen intro/outro stitched to a HyperFrames narrated body. Recommended handoff for aspect ratio and voice continuity?

3. **Live API vs cached MP4** — Booth QR uses cached MP4 (offline demos); disasters studio generates briefings on demand from live row data. Credit/latency tradeoffs for production at scale?

---

## Repo integration (if they ask)

| Layer | Path |
|-------|------|
| Routes | `routes/heygen.routes.js` |
| Controller | `controllers/heygen.controller.js` |
| v3 API client | `services/heygen.service.js` |
| Script builders | `services/disaster-heygen.service.js`, `services/music-heygen.service.js` |
| Catalog merge | `services/heygen-library.service.js` |
| Hub UI | `public/shared/js/heygen-hub.js` |
| Live studio UI | `public/finance/js/disaster-heygen-studio.js` |

---

## Morning-of (9:30 AM)

- [ ] Server running; health check OK
- [ ] Open tab preset above; mute notifications
- [ ] Play disasters popup once (confirm MP4)
- [ ] Play unified-disasters HyperFrames reel once
- [ ] Optional: queue one live studio render before call if you want a fresh `videoId` to poll live
