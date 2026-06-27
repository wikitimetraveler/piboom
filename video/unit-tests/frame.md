# DevConnect Unit Test Tool — HyperFrames design spec

Brand source: `public/shared/design-tokens.css` (`--zen-primary`) and `public/finance/unit-tests.html`.

## Colors

| Role | Hex |
| --- | --- |
| Background | `#0f172a` |
| Surface | `#1e293b` |
| Text | `#f8fafc` |
| Muted | `#94a3b8` |
| Zen primary | `#4a90a4` |
| Accent soft | `#38bdf8` |
| Pass green | `#22c55e` |
| Fail red | `#ef4444` |
| Border | `rgba(74, 144, 164, 0.25)` |

## Typography

- Titles: Georgia, serif — professional, trustworthy
- Kickers: sans, uppercase, letter-spacing 0.18em
- Body: Inter / system sans

## Mood & motion

- Product walkthrough — one workflow step per beat; **screenshot plate** beside serif titles (see `endless-tour` layout)
- Crossfades; Ken Burns–lite scale on plate images via GSAP
- Publish MP4 to `public/finance/assets/video/unit-tests-reel.mp4`

## Screenshot assets

| Scene | Placeholder (now) | Replace with PNG |
| --- | --- | --- |
| s0 intro | `assets/screenshots/01-unit-tests-overview.svg` | `01-unit-tests-overview.png` |
| s1 generate | `02-generate-from-field-modal.svg` | `02-generate-from-field-modal.png` |
| s2 grid | `03-editable-cells-date-picker.svg` | `03-editable-cells-date-picker.png` |
| s3 run | `05-run-results-pass-fail.svg` | `05-run-results-pass-fail.png` |
| s4 library | `07-export-import.svg` | `07-export-import.png` |
| s5 learn/AI | `08-ai-assistant.svg` | `08-ai-assistant.png` |
| s6 CTA | `09-story-mode.svg` | `09-story-mode.png` |

Capture at `/finance/unit-tests.html?demo=1` per `docs/UNIT_TEST_VIDEO_SCRIPT.md`. Update `src` in `index.html` from `.svg` to `.png` after drop-in.

## Narration source

Scene copy aligns with `public/shared/unit-tests-story-scenes.js` and `docs/UNIT_TEST_VIDEO_SCRIPT.md`.
