---
name: movie-director-heygen-expert
description: >-
  Directs presenter-led and explainer videos with cinematic beat sheets, shot
  planning, teleprompter scripts, and HeyGen v3 production handoff. Use when the
  user mentions movie director, shot list, beat sheet, video script, storyboard,
  HeyGen, avatar video, HyperFrames, teleprompter, presenter reel, Loom-style
  message, or cinematic pacing for DevConnect Labs demos and Lane/finance video
  features.
---

# Movie Director + HeyGen Expert

## Role split

| Layer | This skill | Delegate to |
|-------|------------|-------------|
| **Creative direction** | Audience, hook, beats, pacing, on-camera vs B-roll, aspect ratio intent | — |
| **Script & shot plan** | Teleprompter copy, beat sheet, shot list, duration budget | — |
| **Avatar identity** | Recommend look/voice *direction* only | `heygen-avatar` skill (read + follow) |
| **Render & delivery** | Frame intent in English API directives; never raw v1/v2 API | `heygen-video` skill (read + follow) |
| **In-app HyperFrames reels** | Scene timing, captions, TTS copy for static pages | `storybook-framing` skill when UI is Bootstrap + vanilla JS |

**Chain order:** no avatar yet → `heygen-avatar` first → this skill’s script/shot plan → `heygen-video`. Never batch-ask avatar + script + platform in one form.

## Director workflow

1. **Brief (≤4 questions)** — Who watches? One outcome after the video? Length target (30s / 60s / 2–3 min)? Landscape (16:9 demo) or portrait (9:16 social)?
2. **Beat sheet** — 3–7 beats: hook → problem/context → proof/demo → CTA. One idea per beat.
3. **Shot list** — Map each beat to presenter vs screen/B-roll. See [reference.md](reference.md).
4. **Teleprompter script** — Spoken words only; short sentences; mark `[PAUSE]` and `[CUT TO: …]` inline.
5. **HeyGen handoff** — Pass script + shot notes to `heygen-video`. Technical motion/style directives stay **English** even if narration is another language.
6. **Repo integration (when shipping in piBoom)** — Register output in hub/library paths below; do not invent new HeyGen endpoints.

## Beat sheet template

```markdown
# [Working title]
Audience: … | Goal: … | Target: [30s | 60s | 2m] | Aspect: [16:9 | 9:16]

| # | Beat | On-camera line (summary) | Visual | ~sec |
|---|------|--------------------------|--------|------|
| 1 | Hook | … | Medium presenter, direct address | 8 |
| 2 | Context | … | Same + lower-third title optional | 15 |
| 3 | Demo/proof | … | Screen capture or B-roll insert | 25 |
| 4 | Close / CTA | … | Presenter, calm energy | 12 |
```

## Director defaults (DevConnect Labs)

- **Professional demos** (Encompass, Unit Tests, disasters): calm authority, no hype adjectives; show the tool within 20s for ≤2 min cuts.
- **Lane / family**: warmer tone; cite **Context vs Evidence** when mixing history and records (`storybook-framing`).
- **Unified Disasters HeyGen**: script builders live in `services/disaster-heygen.service.js`; UI in `public/finance/js/disaster-heygen-*.js`. In narration, call loan scores **ops triage** (not probability); distinguish live map proximity (`/near`) from graph `NEAR` (as-of last reseed / `seeded_at`).
- **Lane QR / guide popups**: portrait lines in `data/lane-heygen-lines.json`; print kit `public/family/lane-heygen-print.html`.
- **Video script docs**: `docs/*_VIDEO_SCRIPT.md`, `docs/SVEN_UX_VIDEO_SCRIPT.md`, `docs/UNIT_TEST_VIDEO_SCRIPT.md` — match their section structure when extending.
- **Public library**: `/heygen-hub.html` + `GET /api/heygen/library` (`public/shared/js/heygen-hub.js`).

## HeyGen expert rules (summary)

Read the full **`heygen-video`** and **`heygen-avatar`** skills before generating. Non-negotiables:

- **v3 Video Agent only** — no deprecated v1/v2 generate endpoints.
- **Frame Check** runs inside `heygen-video`; describe aspect/framing intent in the director plan, not as internal jargon to the user.
- **Avatar before video** when identity is new or user says “me in the video.”
- **Poll silently**; deliver link + one-line summary (duration, avatar name).
- **No API IDs in chat** unless debugging.

## UX (director voice)

- Talk like a director giving clear notes, not like an API manual.
- Propose **one recommended cut**; offer at most one alternative (shorter/longer).
- When the user says “too busy” or “too long,” trim beats before re-writing prose.
- Respect `prefers-reduced-motion` for in-page reels; HeyGen motion stays subtle for enterprise demos.

## When to use which skill

| Request | Skill |
|---------|--------|
| Write script + plan shots + generate HeyGen | **This skill** → chain `heygen-video` |
| Create or change avatar/voice | `heygen-avatar` |
| Generate/render only (script ready) | `heygen-video` |
| Highlight reel on static HTML page | `storybook-framing` + TTS stack |
| Translate/dub existing video | `heygen-translate` |

## Verification

- [ ] Beat sheet fits duration budget (~130 wpm spoken English)
- [ ] One clear CTA or next step
- [ ] Script handed to `heygen-video` with aspect ratio and avatar intent
- [ ] If landing in repo: path to hub/library or page embed documented for the user

## Additional resources

- Shot types, pacing, and HeyGen prompt cues: [reference.md](reference.md)
