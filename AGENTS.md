# AGENTS.md — DevConnect Labs Agent Rules

This file tells AI coding assistants (Cursor Agent, Copilot, etc.) how to operate in this repo.

**Source of truth:** Use `REPO_MAP.md` + `AGENTS.md` as the source of truth for project structure, conventions, and behavior.

---

# Repo Identity (high level)

DevConnect Labs is a multi-domain platform combining:

* Mortgage / Encompass integration
* AI assistants
* Disaster monitoring
* Music research tools

Primary active domains:

* **Mortgage / Encompass**
* **AI integrations**

The system runs on:

* **Node.js / Express backend**
* **Frontend (brownfield vs greenfield):**
  * **Brownfield** — Existing UIs you must keep working. Primary case: Encompass / Worksheets finance surfaces under `public/finance/` (Hub, field browsers, unit tests, processor assignment, Screen Test). Stack: **Bootstrap + vanilla JS**. Do **not** introduce React or TypeScript without an explicit migration request.
  * **Greenfield** — New product UIs built from scratch (or new domains with no existing frontend). Prefer **React + TypeScript** — the usual modern frontend stack, also useful to demonstrate in a portfolio alongside Encompass Bootstrap work. Examples: new Lane/family, music, nature, or disasters UIs; other new domains.
  * **Brownfield non-Encompass pages** — Existing Bootstrap + vanilla pages outside Encompass may stay as-is until an explicit migration; do not mix React/TS onto the same page without that request.
* **PostgreSQL**
* **LangChain + OpenAI assistants**

---

# Non-Negotiable Conventions

* Prefer **service-layer logic in `services/`** over controllers.
* **Frontend stack — brownfield vs greenfield:**
  * **Brownfield (Encompass)** — Keep Bootstrap + vanilla JS. No React/TypeScript on those surfaces unless explicitly migrating.
  * **Greenfield (new non-Encompass UIs)** — Prefer **React + TypeScript**. Prefer colocated app folders; keep service-layer backend conventions (`routes/` → thin controllers → `services/`).
  * **Brownfield (existing non-Encompass Bootstrap pages)** — Preserve the current stack until an explicit migration.
* Tables use **AG Grid or DataTables** depending on page (Encompass grids stay on the existing AG Grid + vanilla patterns).
* Calculations must use:

`public/shared/calculationEngine.js`

* Shared **pure math** (`calcMath`) lives in `public/shared/calcEngineLibrary.js`. Extend `calcMath` there—do **not** introduce parallel math libraries or duplicate calculator modules for new features (e.g. GSE scenario ratios belong as named helpers on `calcMath`, not a new `public/shared/*-math.js` file).

* Encompass integrations follow patterns in:

```
services/encompass-*.service.js
controllers/encompass-*.controller.js
routes/encompass-*.routes.js
```

* Controllers should remain **thin** and call services.

---

# Key Paths

| Area                     | Paths                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Encompass Hub/API        | `services/encompass-hub.service.js`, `controllers/encompass-hub.controller.js`, `routes/encompass-hub.routes.js` |
| Processor assignment     | `services/processor-assignment.service.js`, `services/processor-assignment-config.service.js`, `public/finance/processor-assignment.html`, `public/finance/js/processor-assignment.js` |
| Encompass Assistant (AI) | `controllers/encompass-assistant.controller.js`, `services/encompass-docs.service.js`                            |
| ICE Knowledge            | `lib/knowledge/ice-knowledge.service.js`, `knowledge-sources/ice/`, `data/knowledge/ice-sources.json`            |
| AI Chat / Memory         | `controllers/unit-tests-ai.controller.js`, `controllers/loan-pipeline-ai.controller.js`                          |
| Screen Test tool         | `controllers/reviewer-ai.controller.js`, `routes/reviewer.routes.js`, `public/finance/tool9.html`                |
| Unit Tests               | `public/finance/unit-tests.html`, `public/shared/customFieldCalcParser.js`, `public/shared/unit-tests-utils.js` — Story Mode offline demo (`?demo=1`, **Load offline demo**, or **Play highlight reel** with no grid rows yet) uses synthetic workbook data, not live Encompass. URL deep links: `?generate=1` (open Generate modal), `?reel=1` (start highlight reel). See `docs/UNIT_TEST_LIBRARY.md` (URL parameters).   |
| Worksheets UI            | `public/finance/` (URLs unchanged; product name Worksheets)                                                      |
| Design tokens / dark mode | `public/shared/design-tokens.css` (`--zen-primary`, `--lf-*`, finance aliases); `public/shared/dark-mode.js` (sitewide zen); Encompass grids: `encompass-dark-mode.js` |
| Financial calculations   | `public/shared/calculationEngine.js` (UI engine); pure helpers: `public/shared/calcEngineLibrary.js` (`calcMath`)  |
| GSE scenario analyzer      | `public/gse-analyzer.html`, `routes/gse.routes.js`, `controllers/gse.controller.js`, `services/gse-scenario.service.js`, `data/gse/` |
| AG Grid pages            | `unit-tests.html`, `encompass-custom-fields.html`, `encompass-native-fields.html`                                |
| Hazard webcams (national) | `services/hazard-webcam-ingest.service.js`, `public/finance/disasters-webcams.html`, `npm run refresh:hazard-webcams` — see `docs/DISASTER_RISK.md`. Loan `disaster_risk_score` = **ops triage** (not probability); live `GET /api/disasters/near` ≠ graph `NEAR` without `seeded_at`. |
| HeyGen hub + API Expert | `/heygen-hub.html` (library + voice/TTS expert panel); video API `/api/heygen/*`; expert RAG `/api/heygen-assistant/*` (`services/heygen-knowledge.service.js`, pgvector table `heygen_knowledge_chunks`); build `npm run build:heygen-knowledge` — see `docs/HEYGEN_KNOWLEDGE.md`. |
| Lane family / genealogy | `public/family/`, `services/genealogy.service.js`, `routes/genealogy.routes.js` — maps: Google Maps JS (loader `lane-family-google-maps.js`) + server geocode `geocodeAddressFree` via `/api/genealogy/*`; see `docs/FRONTEND_PATTERNS.md` (Lane / family maps). **Lane hub/tool footer credit** (presentation + software byline): `public/family/js/lane-site-credit.js`. **Image lightbox:** `public/shared/lane-image-lightbox.js` (sitewide via `modern-navbar.js`; museum exhibit card uses `openElement` on `#museumPosterContent`). |

### Lane PDF plate gallery (tracked assets)

- **UI:** `public/family/lane-pdf-gallery.html` — data from `GET /api/genealogy/lane-pdf/gallery` (`services/genealogy.service.js`).
- **Plate JPEGs:** `public/family/assets/lane-pdf/*.jpg` are **committed** (plain git, not LFS) so clones show thumbnails without a local extract.
- **Regenerate plates + manifest:** `npm run extract:lane-pdf-images` (requires `data/lanegenealogies01chap.pdf`). **Refresh candidate join:** `npm run build:lane-pdf-candidates` after manifest changes.
- **Lane Historians frontispiece crops (p4-i0):** `npm run extract:lane-frontispiece-portraits` — writes `public/family/assets/lane-historians/portrait-*.jpg` (edit `scripts/tools/extract-lane-frontispiece-portraits.mjs` bounds if needed).
- **Gallery deep link:** `/family/lane-pdf-gallery.html?plate=p4-i0&pdfPage=4` filters to the plate and scroll/highlights the card. Optional committee portrait context: `&portrait=john-wm-lane` (or `jas-h-fitts`, `geo-w-lane`, `dr-edwd-b-lane`) shows a banner linking to `/family/lane-historians.html#lh-portrait-<slug>`.
- **Data:** `data/lane-pdf-image-manifest.json`, `data/lane-pdf-photo-candidates.json`, `data/lane-pdf-person-portraits.json`, `data/lane-pdf-book-illustrations.json` (printed-book illustration index → plate `imageId`s; merged into gallery API).
- **Saved filter views (presets):** stored **server-side** in Postgres per browser `clientId` (`/api/genealogy/lane-pdf/presets*`). The gallery **Export presets** button downloads a JSON backup named **`lane-pdf-gallery-filter-presets.json`** (that filename is the browser download only—not a file committed under `data/`).

---

# Documentation Index

Project documentation is located in `/docs`.

Key files:

* `README.md`
* `docs/ENCOMPASS.md`
* `docs/PROCESSOR_ASSIGNMENT.md`
* `docs/ICE_KNOWLEDGE_SOURCES.md`
* `docs/AI_SYSTEM.md`
* `docs/LANGCHAIN_MEMORY.md`
* `docs/CALCULATION_ENGINE.md`
* `docs/SCREEN_TEST.md`
* `docs/DISASTER_RISK.md`
* `docs/UNIFIED_DISASTERS_DB_SCHEMA.md`
* `docs/UNIFIED_DISASTERS_DB_SCHEMA_VIDEO_SCRIPT.md`
* `docs/API_ROUTES.md`
* `docs/CONFIG.md`
* `docs/FRONTEND_PATTERNS.md`
* `docs/LANE_FAMILY_TREE_SCHEMA.md` (Lane `laneData.json` nodes/links + Postgres graph)
* `docs/LANE_POSTGRES_GRAPH.md` (Lane Postgres import / `lane_dataset` registry)
* `docs/PROJECT_STRUCTURE.md`
* `docs/DATABASE_SETUP.md`
* `docs/GLOSSARY.md`
* `docs/DEVELOPMENT_WORKFLOW.md`
* `docs/IIF_PARSER_PHASE2.md`
* `docs/UNIT_TEST_LIBRARY.md`
* `docs/UNIT_TEST_VIDEO_SCRIPT.md` (video shot list: unit tests)
* `docs/SVEN_UX_VIDEO_SCRIPT.md` (video shot list: Sven UI/UX series)
* `docs/MUSIC_GRAPH.md` (collection-seeded music graph: artist → album → venue → show → member)

---

# DevOps Agent Mission

Keep the build **green** with the smallest safe change.

When asked to **run and fix**, follow this loop:

1. Run the exact command provided by the user.
2. If none is provided, run:

```
npm run ci
```

3. Identify the **FIRST failing test or error**.
4. Make the **smallest change possible**.
5. Re-run the same command.
6. Repeat until:

* All tests pass
  OR
* A hard blocker is confirmed.

Avoid large refactors while fixing tests.

---

# Hard Blockers (must stop and report)

Stop and report if any of these occur:

* Missing required environment variables
* Missing OAuth/API credentials
* Database connection unavailable
* Network-only dependencies unreachable
  (ICE, FEMA, NASA, etc.)
* Tests depend on files not present in repo
* Install step has not been run
* Build cannot execute

When blocked, propose the **smallest next step**, such as:

* Add `.env.example`
* Create mock services
* Add test fixtures
* Document setup requirements

---

# What NOT to do

Agents must **never do the following unless explicitly requested**:

* Change unrelated functionality
* Refactor large areas of code
* Rename folders or restructure the repo
* Disable tests to make them pass
* Update snapshots automatically
* Modify deployment configuration
* Modify `.env` files

Agents must also **NOT run system-level commands**:

* Do not run scripts requiring `sudo`
* Do not run:

```
npm run install-pi-deps
```

* Do not run Raspberry Pi mode:

```
npm run pi
```

unless explicitly requested.

---

# Preferred Fix Order

When resolving test failures:

1. Fix **production code bug**
2. Fix **test only if the test is incorrect**
3. Add **mocks or fixtures for external APIs**
4. Add **clear validation errors**

External services (ICE, FEMA, NASA) should be mocked in tests.

---

# Command Defaults

Use these commands unless instructed otherwise.

Install dependencies

```
npm ci
```

Run unit tests

```
npm test
```

CI command

```
npm run ci
```

Build (safe build step)

```
npm run build
```

Rebuild ICE knowledge index

```
npm run build:ice-knowledge
```

Finance tests

```
npm run test:finance
```

Lint (if configured)

```
npm run lint
```

---

# Output Requirements

After completing a DevOps loop, always produce a summary.

Include:

* Command executed
* First failure detected
* Files modified
* Final status

Possible statuses:

* **PASS**
* **BLOCKED**

---

# Example DevOps Agent Report

```
## DevOps Agent Report

Command executed:
npm test

What failed (first failure):

tests/unit/tts.test.js
"speakWithGoogle falls back to browser speech when API fails"

expect(result).toBe(true)
Received false

Cause:
speechSynthesis mock lacked getVoices()

What changed:

File:
tests/unit/tts.test.js

Change:
Added mock

getVoices: jest.fn(() => [])

Final Result:
PASS
```

---

# Summary

DevConnect Labs prioritizes:

* Stable service architecture
* Small safe changes
* Reliable CI builds
* Predictable test behavior
