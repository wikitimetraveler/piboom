# Encompass ICE RAG — HyperFrames design spec

Brand source: `public/shared/css/finance-fire-gate.css`, `public/shared/design-tokens.css`, `docs/VECTOR_RAG.md`.

Technical explainer — path chips and service names on screen; Google TTS narration only (no HeyGen presenter in body).

## Colors

| Role | Hex |
| --- | --- |
| Background | `#0a1628` |
| Surface | `#1a2856` |
| Text | `#e8f4f8` |
| Muted | `#94a3b8` |
| Ice accent | `#4a90a4` |
| Mint | `#5ba88a` |
| Crystal | `#b8e0ec` |
| Border | `rgba(74, 144, 164, 0.35)` |

## Typography

- Titles: Instrument Serif / Georgia — technical but readable
- Kickers: DM Sans / system sans, uppercase, letter-spacing 0.2em
- Body: DM Sans / system sans
- Panel mono chips: ui-monospace for paths / table names

## Mood & motion

- Architecture walkthrough — one pipeline stage per beat
- Crossfades; right panel shows store / job / SQL surface
- Google TTS narration only
- Publish MP4 to `public/shared/assets/video/ice-rag-reel.mp4`

## Accuracy constraints (on-screen + VO)

- Hybrid = vector + keyword; keyword is always-on fallback
- `executionAllowed=false` — retrieval only
- GraphRAG `findSimilarNodes` ≠ live `GET /api/disasters/near`
- Prefer real service/file names over marketing metaphors
