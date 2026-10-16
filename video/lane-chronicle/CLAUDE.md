# HyperFrames — Lane Chronicle featurette

~150s narrated 16:9 film: HeyGen ancestor photo-avatars + 1891 register codes + Postgres graph.

Catalog: `../../data/lane-chronicle-movie.json`  
Script: `../../docs/LANE_CHRONICLE_MOVIE_SCRIPT.md`  
Cinema: `/family/lane-cinema.html`

## Commands

```bash
npm run narration    # Google TTS for beats 1, 6, 7 (server on :3000)
npm run heygen       # optional host-narrator stubs
npm run dev          # preview (background only)
npm run check
npm run render
```

After render, copy the latest MP4 to:

`public/family/assets/video/lane-chronicle-movie.mp4`

HeyGen ancestor MP4s are referenced from `public/family/assets/video/` (monorepo-relative).
