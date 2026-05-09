---
name: storybook-framing
description: >-
  Applies StoryBook-style framing and HyperFrames-style guided reels on static Lane
  family pages (Bootstrap 5 + vanilla JS): full-screen intro beats, hero kickers,
  onboarding callouts, Context vs Evidence copy, anchored floating scene overlays,
  optional TTS. Use when building or refactoring narrative-heavy family/history UI,
  guided highlight reels, era-aligned story modes, memorial- or chronology-wall
  pages, or when the user mentions StoryBook framing, HyperFrames, story scenes,
  or Lane memorial-wall patterns.
---

# StoryBook framing (Lane narrative UI)

## Project constraints

- **Bootstrap 5** + **vanilla JS** only (`AGENTS.md`). No React.
- Canonical reference implementation: `public/family/lane-memorial-wall.html`, `public/family/css/lane-memorial-wall.css`, `public/family/js/lane-memorial-wall.js`.
- Shared patterns: `docs/FRONTEND_PATTERNS.md`; shell/nav: `public/family/css/lane-shell.css`, pill nav as used on sibling pages.

## StoryBook framing (page structure)

Layer the experience so users always know *where they are*, *why it matters*, and *how to read evidence*:

1. **Opening beat (optional)** — Full-viewport intro: subdued motion or gradient fallback, vignette, **kicker + title + subtitle**, cite **primary source** where relevant (external link acceptable). Provide **Skip** with clear `aria-label`. Fade or remove intro without trapping focus.
2. **Hero** — Centered stack: **kicker** (small caps / tracking), **serif headline** for emotional weight, **subcopy** for behavior (what clicks do, sort order, filters).
3. **Onboarding strip** — Bordered panel with left accent; explain **how to use** the tool in one short paragraph. Include **quick actions** and **in-page anchors** (`#wall`, etc.) where the page is long.
4. **Context vs Evidence** — When mixing general history with family records, state plainly: **Context** = broad background; **Evidence** = Lane-specific records/snippet text. Keep labels consistent across modal/detail views.

## HyperFrames-style story mode (guided reel)

When the page lists time-ordered or sectioned content (centuries, cohorts, rooms):

1. **Controls** — A compact **Story mode** panel: toggle to **play highlight reel**, checkboxes for **era chapter intros** and **optional narration**.
2. **Scenes** — Timed beats aligned to **anchors in the DOM** (scroll highlights). Each scene: **kicker**, **title**, **short body copy** (`aria-live` on the overlay region).
3. **Floating caption** — Prefer a **fixed-position overlay** positioned near the **spotlight row/section**, clamped inside the viewport (`max-width`, safe padding); **pointer-events: none** on the overlay if it must not steal clicks from the list. Optional blur/shadow so text stays readable over the wall.
4. **Audio** — Reuse Lane **Listen / TTS** stack (`tts.js`, `lane-tts.js`) where narration is toggled on; browser fallback when server voice is unavailable.
5. **Interruptibility** — Stop audio and clear overlays on toggle-off, route change where applicable; do not strand focus inside a hidden overlay.

## Visual continuity

- Reuse memorial/history palette tokens (`--history-*` or page-local equivalents) and **thin gold/stone borders** for inscription surfaces.
- **Typography**: serif for titles, neutral sans for UI chrome; avoid generic gradient hero looks; favor **CSS variables** already on the page family.

## When not to use

- Dense data grids or Encompass/finance tools where narrative chrome adds noise.
- Flows that must minimize motion (respect `prefers-reduced-motion` if adding non-essential animation).

## Verification checklist

- [ ] Intro skippable; main content reachable without the flash
- [ ] Story overlay readable at sm / md / lg
- [ ] Keyboard: modals and toggles operable; focus returns sensibly after story off
- [ ] Copy matches **Context** / **Evidence** wording if both appear in modals
