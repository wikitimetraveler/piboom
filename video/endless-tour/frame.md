# Grateful Dead — Endless Tour · video design spec

Brand source: `public/music/music-pilgrimage-atlas.html` (Pilgrimage Atlas purple gradient theme).

## Colors

| Role | Hex |
| --- | --- |
| Background | `#0f0c29` |
| Surface | `#1a1638` |
| Surface soft | `#242043` |
| Text | `#eee8ff` |
| Muted | `#a89ec4` |
| Accent violet | `#667eea` |
| Accent pink | `#764ba2` |
| Highlight | `#c4b5fd` |
| Rose (Dead) | `#f093fb` |
| Border | `rgba(196, 181, 253, 0.18)` |

## Typography

- Titles: Georgia, serif — warm, archival tour-poster tone
- Kickers: sans-serif, uppercase, letter-spacing 0.18em, `#c4b5fd`
- Body: system sans

## Mood & motion

- Route-map hero: SVG pins light up per era; polyline draws west → east → world
- Crossfades between scenes; slow Ken Burns on Wikimedia venue plates (Fillmore, Barton Hall, Giza)
- Subtle starfield or route glow — deterministic PRNG only
- No whip-pans; power/expo eases

## Sound

- Narration: Google Cloud TTS (`make-narration.mjs`)
- Bed: short audience-recording excerpt from Internet Archive (non-commercial, taper policy) at ~12% volume under voice
- HeyGen avatar intro/outro stitched via `make-heygen-clips.mjs` + ffmpeg (optional bookends)

## What NOT to do

- No studio album stems (copyright)
- No soundboard-only IA items as download (streaming policy)
- No `Math.random()` in composition
