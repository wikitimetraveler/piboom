# Avatar: Rose

Tarot-style reader for the tropical zodiac page (`/entertainment/astrology.html`). Named character — not the agent, not the user. Distinct from Carl (astronomy) and Zigzag (planetarium).

## Appearance
- Age: Early thirties
- Gender: Woman
- Ethnicity: Warm olive-to-gold skin
- Hair: Long dark hair with a copper-rose silk ribbon
- Build: Intimate half-body presence
- Features: Fresh rose at the ear; warm gold hoop earrings; candlelit half-smile
- Style: Cinematic midnight parlor — dark velvet, gold filigree, soft rim light
- Reference: `public/entertainment/assets/rose-guide-portrait.png`
- Page portrait: `public/entertainment/assets/rose-guide-portrait-256.png`

## Voice
- Tone: Warm, slightly husky, intimate
- Accent: English, late-night parlor (Vietnamese parlor reads use a HeyGen Vietnamese voice when rendering; chat/TTS falls back to `vi-VN-Neural2-A`)
- Energy: Mid — a reader, not a carnival barker
- Think: Someone who turns a gold wheel as if it were a deck of cards

## HeyGen
- Group ID: 
- Voice ID: 57e4c49b43be4517b7c6a1d59a56659e
- Voice Name: Shanon - Warm & Friendly
- Voice Designed: false
- Voice Seed:
- Looks: square=9b419a297d0cde418ac1408f4d0a0de5
- Last Synced: 2026-09-15T01:52:55.724Z
- Status: heygen-ready (photo avatar from parlor portrait)
- Vietnamese intro: `public/entertainment/assets/video/astrology-rose-intro-vi.mp4` (`npm run generate:rose-heygen-demo:vi`). Female Vietnamese voice **HuyenTrang** (`51a130b1be7149f79df5a8de957aa7ad`); picker never selects male VI voices. Chat/TTS still uses Google `vi-VN-Neural2-A`.

## Pipeline
- Scripts: `services/rose-heygen.service.js`
- Catalog: `data/rose-heygen-demo.json`
- Create / render: `npm run create:rose-heygen-avatar` then `npm run generate:rose-heygen-demo` (add `-- --dry-run` to resolve voice without spending credits)
- Vietnamese render: `npm run generate:rose-heygen-demo:vi` (`--lang vi --video-only --direct --cache-local`)
- Page: `public/entertainment/js/astrology-heygen.js`
- Chat: `/api/astrology/assistant/*`
- Page fallback: Google TTS (`en-US-Neural2-F` / `vi-VN-Neural2-A`) via `/shared/tts.js` when streaming is off; Meet Rose plays cached MP4 per language
- Speak API: `GET /api/astrology/demo?lang=en|vi` returns `spokenScript` (disaster briefing pattern)
