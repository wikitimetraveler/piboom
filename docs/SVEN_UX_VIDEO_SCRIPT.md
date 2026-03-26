# Sven UX video character doc

**Target:** DevConnect Labs product UI / UX (HeyGen or similar avatar + screen capture)  
**Duration:** ~90 seconds–3 minutes (expand only if you add B-roll)  
**Format:** Screen recording + voiceover or AI avatar

---

## Who is Sven

**Sven** is the **public-facing** UI/UX guide for DevConnect Labs videos—not a replacement for internal engineering rules. He explains *why* the product looks and behaves the way it does (hierarchy, consistency, feedback, accessibility, avoiding generic “template” UI).

For **implementation** detail (Bootstrap + vanilla JS, shared CSS, `FRONTEND_PATTERNS`, etc.), use [.cursor/agents/modern-ui-ux.md](../.cursor/agents/modern-ui-ux.md). Keep that file **technical**; keep Sven **human and script-shaped**.

---

## Voice rules

- **One concrete gripe or praise per beat**—never stack three lectures in one breath.
- Prefer **one sharp line** over a rant; let the cut land, then move on.
- **Ground jokes in real UI** (spacing, a missing loading state, a rogue utility class) so builders recognize the punchline.
- Tone: calm, exacting, slightly dry—cares about users, allergic to sloppy chrome.

---

## Signature punchline (Bootstrap)

Use as a **single optional beat** at the end of a video (or its own 15–30 second clip).

**Paste into HeyGen / teleprompter:**

> "You say you're on Bootstrap five. Then I find `mr-2` in the markup. That's not a margin—that's the ghost of Bootstrap four, waving hello. The living use `me-2`. I'm not angry. I'm just… disappointed."

**Fix for contributors (not necessarily on-screen):** Bootstrap 5 uses logical margin utilities—replace `mr-*` / `ml-*` with `me-*` / `ms-*`.

**B-roll:** One line in an editor or DevTools, or a static slide: `mr-2` → `me-2`.

---

## Cross-links

- **Series / workflow reference:** [UNIT_TEST_VIDEO_SCRIPT.md](UNIT_TEST_VIDEO_SCRIPT.md) (unit test tool video—same shot-list style if you expand Sven into a full script later).
- **Principles source of truth:** [.cursor/agents/modern-ui-ux.md](../.cursor/agents/modern-ui-ux.md).

---

## Scene stubs (2–3 beats)

Use these as blocks; add timecodes when you lock edit length.

### Stub 1: Hierarchy (hub or Worksheets entry)

**Narration (example):**
> "First rule: I should know where to look. One clear title, one obvious primary action—everything else waits its turn."

**On-screen:** Home or hub (`/` or finance index)—navbar, hero, primary vs secondary buttons.

**Screenshot:** `sven-ux-video/01-hub-hierarchy.png` – Full width, title + CTA visible.

---

### Stub 2: Shared patterns (Nature + Collection Address)

**Narration (example):**
> "Same chrome between tools means users don't re-learn the app every time. Labeled fields, predictable grids—that's the contract."

**On-screen:** `/nature/rock-discovery.html` or `/nature/tree-discovery.html`—**Collection Address** block (street, city / state / zip, county, lat / lng).

**Screenshot:** `sven-ux-video/02-collection-address.png` – Address card, labels visible.

---

### Stub 3: Optional—feedback (one async moment)

**Narration (example):**
> "If the machine is thinking, the interface should admit it—disabled button, spinner, status text. Silence is not minimalism; it's rude."

**On-screen:** Any tool with a visible loading state (e.g. rock discovery ask / async action).

**Screenshot:** `sven-ux-video/03-loading-state.png` – Before/after or mid-request.

---

## Screenshot checklist (minimal)

| # | File | Captures |
|---|------|----------|
| 1 | `01-hub-hierarchy.png` | Hub, hierarchy, primary action |
| 2 | `02-collection-address.png` | Labeled address / collection block |
| 3 | `03-loading-state.png` | Optional: loading / disabled control |

**Folder:** `docs/sven-ux-video/` (create when capturing).

---

## Technical notes (video tools)

- **Aspect ratio:** 16:9; **resolution:** 1920×1080 recommended.
- **Sample URLs:** `/`, `/nature/rock-discovery.html`, `/finance/unit-tests.html` (adjust for your host).
- **Prerequisites:** Running app; optional user selection if the page requires it.

---

## Expanding later

If you need a **full** timecoded script (Intro / Scene 1–4 / Outro / table) like [UNIT_TEST_VIDEO_SCRIPT.md](UNIT_TEST_VIDEO_SCRIPT.md), duplicate that file’s section headings and hang these stubs + punchline on the same skeleton.
