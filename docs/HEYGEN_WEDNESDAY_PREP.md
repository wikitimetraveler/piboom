# HeyGen Wednesday — booth prep (business + music)

**Family / Lane:** already in progress — QR lines, print kit, cached MP4s. Finish tomorrow if needed.

**Wednesday focus:** Unified Disasters (business) + Music Historian (second lane).

**Do not change:** Unified Disasters keeps its live HeyGen API studio (`disaster-heygen-studio.js`, bottom dock, `/api/heygen/*`). Demo booth popup (`?demo=heygen`) and API studio are separate — use whichever fits the moment.

---

## Quick demo URLs (local server)

| Lane | Popup URL | Full page after close |
|------|-----------|------------------------|
| **Disasters** | `/finance/disasters-unified.html?demo=heygen` | same URL without query |
| **Music** | `/music/music-research.html?demo=heygen` | `/music/music-research.html` |
| **Music QR landing** | `/music/music-historian-line.html?short=1&autoplay=1` | Historian card + video popup |

Cached MP4s play offline after first load — no HeyGen API at demo time.

---

## Wednesday checklist

### Before the session

- [ ] **Disasters** — MP4 already at `public/finance/assets/disaster-heygen-demo.mp4` (regenerate only if you want a new take)
- [ ] **Music** — paste booth script from [`MUSIC_RESEARCH_HEYGEN_SCRIPT.md`](MUSIC_RESEARCH_HEYGEN_SCRIPT.md) into HeyGen; save MP4 to `public/music/assets/video/music-research-heygen-short.mp4` **or** run `node scripts/tools/generate-music-heygen-demo.mjs --force --direct --cache-local`
- [ ] Reuse avatar/voice IDs from `data/disaster-heygen-demo.json` (business) — copy into music catalog if you want one presenter voice
- [ ] Test both popup URLs in browser

### At the invite (2 clips max)

1. **Business** — Unified Disasters ~25s booth script → QR → popup → “Open Unified Disasters”
2. **Music** — Historian ~25s booth script → same pattern → “Open Music Research”

**Talking point:** HeyGen is sparse bookends (booth QR, legacy lines). HyperFrames + Google TTS carry long tours — we do not burn credits per search.

### After renders

```bash
# Disasters (only if regenerating)
node scripts/tools/generate-disaster-heygen-demo.mjs --force --direct --cache-local

# Music (after HeyGen session or API)
node scripts/tools/generate-music-heygen-demo.mjs --force --direct --cache-local
```

---

## Script docs (paste into HeyGen dashboard)

| Lane | Doc |
|------|-----|
| Disasters booth + schema walkthrough | [`DISASTERS_HEYGEN_SCRIPT.md`](DISASTERS_HEYGEN_SCRIPT.md) |
| Music Historian booth + HyperFrames beats | [`MUSIC_RESEARCH_HEYGEN_SCRIPT.md`](MUSIC_RESEARCH_HEYGEN_SCRIPT.md) |

---

## Catalog JSON

| File | Purpose |
|------|---------|
| `data/disaster-heygen-demo.json` | Disasters popup video + avatar/voice IDs |
| `data/music-heygen-demo.json` | Music popup video + scripts + CTA links |

---

## Family (tomorrow)

- `data/lane-heygen-lines.json` — per-person scripts + cached shorts
- `public/family/lane-heygen-line.html?person=…&short=1`
- Print kit: `public/family/lane-heygen-print.html`
