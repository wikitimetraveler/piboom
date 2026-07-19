# HeyGen API v3 — capabilities overview (DevConnect Labs seed)

Source of truth for live docs: https://developers.heygen.com/docs/quick-start  
Machine index: https://developers.heygen.com/llms.txt (or Mintlify mirror).

Auth header: `X-Api-Key: $HEYGEN_API_KEY`. Prefer MCP → CLI → raw API for agents.

## Flagship: Video Agent (`POST /v3/video-agents`)

- Natural-language prompt → script, avatar/voice selection, scene composition, render.
- Modes: `generate` (fire-and-forget) and `chat` (multi-turn revisions).
- Optional: `avatar_id`, `voice_id`, `style_id`, `orientation` (`landscape`|`portrait`),
  `files` (asset_ids), `callback_url` / `callback_id`.
- Poll `GET /v3/video-agents/{session_id}` for progress/`video_id`; then
  `GET /v3/videos/{video_id}` for `video_url`. Or use webhooks.

Styles: `GET /v3/video-agents/styles`. Interactive sessions support storyboard review
and follow-up messages before final render.

## Direct video (`POST /v3/videos`)

- Structured JSON: you choose avatar look, voice, and script (or audio).
- Engines: Avatar IV (default), Avatar III, Avatar V (highest fidelity, opt-in).
- Types include avatar, image-to-video, cinematic_avatar.
- Defaults often recommended: `aspect_ratio: "auto"`, `resolution: "1080p"`.
- Batch: up to 100 creates per batch call; poll one batch id.

## Avatars

- **Group** = character identity; **look** = outfit/pose. Pass **look id** as `avatar_id`.
- Create from footage (digital twin), photo, or text prompt (`POST /v3/avatars`).
- Consent flow required for private digital twins.
- List looks: `GET /v3/avatars/looks`. List groups: avatar groups endpoints.
- Avatar Realtime / Live Avatar: streaming / conversational (separate product surfaces).

## Voices & audio

- List/search voices; design custom voices from a description; clone from audio.
- Starfish TTS: `POST /v3/voices/speech` (engine-compatible voices).
- Background music & SFX: semantic search via audio catalog endpoints.

## Translation, lipsync, proofread

- Video Translation (speed / precision) with voice clone + lip-sync (30+ languages;
  marketing materials cite broader dialect coverage for translation product).
- Lipsync speed vs precision on existing videos.
- Proofread sessions: edit SRT before final translation render.
- Batch translation / lipsync / assets supported.

## Assets, webhooks, HyperFrames

- `POST /v3/assets` — image/video/audio/PDF (size limits apply).
- Webhooks for completion/failure; signing secrets on create/rotate.
- HyperFrames: HTML/CSS/JS compositions → rendered video
  (`POST /v3/hyperframes/renders`). Distinct from avatar Video Agent.

## Versioning

- Prefer **v3 only**. Legacy v1/v2 supported until **October 31, 2026**.
- See endpoint version comparison in official docs.

## DevConnect Labs wrappers (this repo)

- HTTP client: `services/heygen.service.js` — looks, voices, assets, `POST /v3/videos`, poll.
- Routes: `/api/heygen/*` (health, library, avatars, voices, scripts, videos).
- Hub UI: `/heygen-hub.html` + library registry `data/heygen-video-library.json`.
- Domain scripts: disaster / finance / music / Lane HeyGen helpers.
- Expert chat (RAG): `/api/heygen-assistant/*` — does **not** generate videos; explains API
  and points at `/api/heygen/videos` for generation.
- Cursor skills: heygen-video / heygen-avatar (v3 Video Agent pipeline); movie-director-heygen-expert.

## Agent rules (from HeyGen docs)

1. Do not invent curl flows before verifying auth (MCP / CLI / `HEYGEN_API_KEY`).
2. Video Agent for prompt-driven prototypes; direct `/v3/videos` for brand-controlled pipelines.
3. Never paste API keys into chat UIs.
