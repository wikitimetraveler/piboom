# HyperFrames — Grateful Dead Endless Tour era reel

~94s narrated HyperFrames film for the Live Music Pilgrimage Atlas. Purple atlas theme, SVG route maps, Google TTS narration, audience-recording bed from Internet Archive.

## Commands

```bash
npm run dev          # preview (long-running — background only)
npm run check        # lint + validate + inspect
npm run render       # render to renders/*.mp4
npm run narration    # regenerate TTS (requires npm start at repo root)
npm run soundtrack   # rebuild IA audience bed
npm run heygen       # intro/outro stubs (needs assets/heygen/config.json)
```

## Publish

After render, copy the latest MP4 to:

`public/music/assets/video/endless-tour-reel.mp4`

Atlas CTA: `public/music/music-pilgrimage-atlas.html`

## Assets

- `assets/narration/scene0–9.mp3` — Google Cloud TTS via `/api/voice/synthesize`
- `assets/soundtrack-bed.mp3` — Cornell 5/8/77 audience excerpt (`make-soundtrack.mjs`)
- `assets/venues/` — Fillmore/Barton/Giza SVG placeholders; Cornell ticket from IA

See `frame.md` and `scenes.json` for creative spec.
