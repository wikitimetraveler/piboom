# Unit Test HyperFrame — screenshot assets

Place **1920×1080** (or cropped 16:9) PNGs here. Names match `docs/UNIT_TEST_VIDEO_SCRIPT.md`.

| File | Scene | Capture |
|------|-------|---------|
| `01-unit-tests-overview.png` | s0 | Full page, grid + toolbar |
| `02-generate-from-field-modal.png` | s1 | Generate modal |
| `03-editable-cells-date-picker.png` | s2 | Editable grid / date picker |
| `05-run-results-pass-fail.png` | s3 | Pass/fail shading |
| `07-export-import.png` | s4 | Library / export |
| `08-ai-assistant.png` | s5 | Learn Mode or AI panel |
| `09-story-mode.png` | s6 | Story Mode + reel button |

**Capture URL:** `/finance/unit-tests.html?demo=1`

**Swap placeholders:** SVG mocks ship today. When PNGs are ready, save with the names above and change `src` in `video/unit-tests/index.html` from `.svg` to `.png`, then `npm run check && npm run render`.
