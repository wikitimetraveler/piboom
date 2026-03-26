# Sven UX video doc (plan)

## Goal

Add [docs/SVEN_UX_VIDEO_SCRIPT.md](docs/SVEN_UX_VIDEO_SCRIPT.md) that **mimics [docs/UNIT_TEST_VIDEO_SCRIPT.md](docs/UNIT_TEST_VIDEO_SCRIPT.md)** section-for-section: same headings pattern, timecodes, Narration blockquotes, On-screen / Actions bullets, per-scene **Screenshot** filenames, **Key Phrases**, **Screenshot Checklist** table, **Technical Notes**, plus Sven-specific humor (Bootstrap `mr-2` vs BS5 punchline).

## Structure to mirror (from unit test example)

Match this skeleton so HeyGen / editors can swap scripts the same way:

1. **Title** — e.g. `# Sven on UI/UX – Video Script`
2. **Meta block** — **Target**, **Duration**, **Format** (same three lines as unit test doc)
3. **Intro (0:00–0:30)** — Narration (blockquote), On-screen bullets, **Screenshot:** `screenshots/sven-01-....png` + one-line caption
4. **Scene 1, 2, 3…** — Each with:
   - Time range in heading
   - **Narration:** (may appear twice if mid-scene beat, like Scene 1 in unit test)
   - **Actions:** numbered list where it helps
   - **Screenshot:** path + dash + short description
   - `---` between scenes
5. **Outro** — Narration, On-screen
6. **Optional:** extra block (e.g. "Optional: The mr-2 punchline scene" as 20–30s) — parallel to "Optional: AI Assistant"
7. **Key Phrases for Captions/Subtitles** — bullet list
8. **Screenshot Checklist (for future videos)** — markdown table `| # | Screenshot | Captures |`
9. **Folder:** e.g. `docs/screenshots/` or `docs/sven-ux-video/` (state explicitly)
10. **Technical Notes for Video Tools** — aspect ratio, resolution, sample URLs (e.g. `/nature/rock-discovery.html`, Worksheets hub), prerequisites

## Sven-specific content (inside that template)

- **Character:** Sven = public UI/UX voice aligned with [.cursor/agents/modern-ui-ux.md](.cursor/agents/modern-ui-ux.md); not a replacement for the agent file.
- **Humor rule:** one sharp beat per scene where used; **signature line** about spotting **`mr-2`** on an otherwise Bootstrap 5 page (ghost of Bootstrap 4); optional mention of fix `me-2`.
- **Cross-link** at top or bottom: companion to [docs/UNIT_TEST_VIDEO_SCRIPT.md](docs/UNIT_TEST_VIDEO_SCRIPT.md) (series).

## Optional discoverability

- One bullet in [AGENTS.md](AGENTS.md) documentation index → `docs/SVEN_UX_VIDEO_SCRIPT.md` (optional).

## Out of scope

- HeyGen export, code changes, edits to `modern-ui-ux.md` unless requested.

## Todos

- [x] Draft `docs/SVEN_UX_VIDEO_SCRIPT.md` using the **exact** section order and formatting conventions of `UNIT_TEST_VIDEO_SCRIPT.md`
- [x] Index link in `AGENTS.md` (also added `UNIT_TEST_VIDEO_SCRIPT.md` for series parity)
