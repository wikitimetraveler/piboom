# Avatar: Rami

## Appearance
- Age: Late 30s
- Gender: Man
- Ethnicity: Jordanian — warm olive skin
- Hair: Short dark hair, trimmed beard with early grey
- Build: Steady, unhurried presence
- Features: Open smile, linen shirt in sand tones, red-and-white shemagh folded at the shoulder
- Style: Local guide at golden hour — sandstone walls, dry desert light
- Reference: public/jordan/assets/rami-guide-portrait.png (1024×1024 avatar source)
- Page portrait: public/jordan/assets/rami-guide-portrait-256.png (guide dock, story chip, chat header)

## Voice
- Tone: Warm, patient, quietly proud
- Accent: Jordanian Arabic; English with a light Levantine accent
- Energy: Measured storyteller — the pace of someone pouring tea, not selling a tour
- Think: Archaeologist who also knows which bakery opens at five

## Languages
- en — English read (page default)
- ar — Jordanian-leaning Modern Standard Arabic read

## HeyGen
- Group ID: 2cf7659eb12044d789601ae6ee97336f
- Voice ID (en): 02d5366a90af4c7a87157808ff352e33 — Rami
- Voice ID (ar): a0bd2e5d41a74643be47ac75ca9171a2 — Rami Idris
- Voice Designed: false
- Looks: square=125eef25a4cc42e6a4109bd014d00123 (photo avatar, 1024×1024 — rendered at 16:9)
- Status: heygen-ready-with-video (en + ar popup clips cached)
- Last Synced: 2026-07-29T02:12:45.686Z

## Pipeline
- Scripts: `services/jordan-heygen.service.js`
- Catalog: `data/jordan-heygen-demo.json`
- Render: `npm run generate:jordan-heygen-demo` (add `-- --dry-run` to resolve avatar/voice without spending credits)
- Page fallback: `public/jordan/js/jordan-heygen.js` speaks the same script through Google TTS when no MP4 is cached
