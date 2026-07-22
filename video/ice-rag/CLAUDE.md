# HyperFrames — Encompass ICE RAG (technical)

~92s narrated architecture reel: dual stores, ingest/build, pgvector HNSW, hybrid merge, assistant consumers, ops refresh.

## Commands

```bash
npm run dev          # preview (background)
npm run check        # lint + validate
npm run ensure-audio # fail if narration missing/silent
npm run narration    # TTS via npm start at repo root
npm run render       # ensure-audio then renders/*.mp4
npm run publish      # narrate → ensure → render → public MP4
```

## Publish

From repo root (preferred): `npm run publish:ice-rag-reel`  
Output: `public/shared/assets/video/ice-rag-reel.mp4` — publish aborts without audible audio.

See `frame.md`, `scenes.json`, and `docs/ICE_RAG_VIDEO_SCRIPT.md`.
