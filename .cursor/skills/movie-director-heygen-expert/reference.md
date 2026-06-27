# Movie Director + HeyGen — reference

## Shot list fields

| Field | Use |
|-------|-----|
| **Beat #** | Matches beat sheet row |
| **Shot type** | ECU, MCU, MS, WS, OTS, screen insert, B-roll |
| **Subject** | Presenter name/avatar, UI surface, map, document |
| **Motion** | Static, slow push-in, hold, cut |
| **Audio** | On-camera line, VO only, music bed (low) |
| **Duration** | Seconds; sum ≈ target length |

## Shot types (quick)

- **MCU (medium close-up)** — Default HeyGen presenter; trustworthy demo host.
- **Screen insert** — Full-frame UI for Encompass/finance tools; keep presenter either before or after, not talking over unreadable text.
- **B-roll** — Disasters map, hazard icons, family plate — use when emotion or context beats talking head.
- **ECU** — Rare; QR/shirt reveal or “one number” moment only.

## Pacing by length

| Target | Beats | Words (approx) | Structure |
|--------|-------|----------------|-----------|
| 30s | 3 | 70–90 | Hook → one proof → CTA |
| 60s | 4–5 | 140–170 | Hook → context → proof → CTA |
| 2–3 min | 5–7 | 280–400 | Hook → stakes → 2 proofs → recap → CTA |

## HeyGen prompt cues (English, for Video Agent)

Keep these in the handoff block to `heygen-video`, not in user-facing chat:

```
Presenter: [MCU, steady, professional studio light, minimal gesture]
Pacing: conversational, pause after key terms
Background: soft neutral or branded blur — no busy motion
Aspect: 16:9 landscape | 9:16 portrait
Do not: rapid cuts, exaggerated expressions, stock-photo backgrounds
```

For **disaster briefing** tone: urgent but controlled; no alarmist music cues in script.

For **Lane / heritage**: warmer delivery; slightly slower on names and dates.

## piBoom embed patterns

| Feature | Where output goes |
|---------|-------------------|
| HeyGen hub listing | `/heygen-hub.html`, `/api/heygen/library` |
| Disaster studio | `disaster-heygen-studio.js`, `disaster-heygen-popup.js` |
| Lane guide QR | `lane-family-guide.js` + line JSON |
| Print kit slots | `lane-heygen-print.html` / `.js` |
| HyperFrames reels | `video/` tree; see `video/scientific-lane/CLAUDE.md` |

## Example: 60s Unit Tests teaser (outline)

1. **Hook (8s)** — “Custom field math breaks in production when spreadsheets lie.”
2. **Context (12s)** — Workbook + Encompass connection in one sentence.
3. **Proof (25s)** — Generate → grid → run → sign-off (name steps, no click-by-click).
4. **CTA (10s)** — Link to `/finance/unit-tests.html?demo=1`.

Hand to `heygen-video` with 16:9, professional avatar, English narration.
