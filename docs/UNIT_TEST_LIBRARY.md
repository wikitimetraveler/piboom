# Unit Test Library — Searchable Database of Test Cases

The Unit Test Library is a **searchable database** of Excel-based Encompass field tests. This is a key feature for teams: you can find which tests cover any given field across your entire library.

## URL parameters

The Unit Test page (`public/finance/unit-tests.html`) supports optional query parameters for demos and deep links:

| Param | Effect |
|-------|--------|
| `generate=1` | Opt-in: open the **Generate from custom field** modal on load (skipped if grid data is already loaded) |
| `reel=1` | Opt-in: start the **Play highlight reel** story tour on load |
| `demo=1` | Load the offline sample custom field workbook (CUST11FV pipeline, no live Encompass) |
| `storybook=1` | Same as `demo=1` (alias for story/demo workflows) |
| `focus=1` | Start in focus mode (hides story mode chrome) |

Examples:

- `/finance/unit-tests.html?reel=1` — guided tour only
- `/finance/unit-tests.html?demo=1&reel=1` — offline sample + highlight reel
- `/finance/unit-tests.html?generate=1` — jump straight to Generate modal

## TypeScript work shell (portable export)

Download a zip of the standalone TypeScript + React export (no Encompass API) from the Unit Tests page: **More** → **Download TypeScript work shell (ZIP)**. API: `GET /api/unit-tests/ts-export` (zipped on demand from `export/encompass-unit-tests-ts/`). Unzip, `npm install`, `npm run dev`, then load `samples/workbook.json` and `samples/loan-snapshot.json`.

## Search by Field ID

**API:** `GET /api/unit-tests/search?fieldId=CX.TYPE`

Enter an Encompass field ID (e.g. `CX.TYPE`, `353`, `CX.SUNRISE`) to find all unit tests that use that field in their Target column. Results show file name, row count, and field count; click **Load** to open the test.

**UI:** Test Library accordion → Search input → Search button

## How It Works

- Each uploaded Excel file is parsed for `[field]` references in the Target column.
- Field IDs are stored in `unit_test_files.field_ids` (JSONB).
- A GIN index enables fast containment queries (`field_ids ? 'CX.TYPE'`).
- Files are stored in `file_content` (BYTEA), so the library works from any machine sharing the same PostgreSQL database.

## Why It Matters

- **Impact analysis:** Before changing a field, find all tests that cover it.
- **Coverage gaps:** See which fields have no tests.
- **Reuse:** Discover existing tests instead of duplicating work.
- **Portability:** Same searchable library on every machine that connects to the shared DB.

## BR Rules library

Store Encompass business rules and Tool 8 (Alchemist) field-matrix JSON alongside Excel unit tests. Parsed field IDs are indexed for search the same way as Excel library files.

**Supported formats**

| `source_format` | Input | Parser |
|-----------------|-------|--------|
| `encompass_br_xml` | Encompass BR XML export | `public/shared/brRuleParser.js` |
| `encompass_br_vb_snippet` | VB-style condition snippet | `brRuleParser.parseBRConditionSnippet` |
| `tool8_field_matrix_json` | Tool 8 field-matrix JSON | `public/shared/tool8FieldMatrix.js` |

**UI:** Test Library accordion → **BR / Tool 8 library** — upload `.xml`, `.json`, or `.txt`, or use **Save to BR library** in the **Generate from BR Rule** modal.

**API**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/unit-tests/br-rules` | List saved rules (metadata + `field_ids`) |
| `POST` | `/api/unit-tests/br-rules/file` | Multipart upload (field name `file`) |
| `POST` | `/api/unit-tests/br-rules` | Paste JSON body: `{ sourceFormat, body, originalName? }` |
| `GET` | `/api/unit-tests/br-rules/:id` | Fetch rule including `body_text` |
| `GET` | `/api/unit-tests/br-rules/search?fieldId=...` | Search rules by field ID |
| `DELETE` | `/api/unit-tests/br-rules/:id` | Remove rule |

**Load flow:** Click **Load** on a saved rule → server returns `body_text` → `unit-tests-library.js` parses and calls `loadGeneratedTestData` in the main grid (same path as **Generate from BR Rule**).

**Postgres:** `br_rule_files` table via `services/business-rule-files.service.js`.

## Learn Mode

Learn Mode trains from parser logic and worked examples to improve SET-value suggestions and optional VB evaluation notes. It complements the IIf parser (`customFieldCalcParser.js`) with team-specific hints.

**UI:** Sidebar / accordion → **Learn Mode** (`collapseLearnMode`). Paste parser logic or upload example rows; review quality score and generated template rows.

**Team hints (server sync)**

- Browser generates a stable `clientId` in `localStorage` (`unitTestsLearnHintsClientId`).
- Hints sync to Postgres per `clientId` so multiple machines can share learned SET patterns.
- **API:** `GET /api/unit-tests/learn-hints?clientId=...` and `PUT /api/unit-tests/learn-hints` with body `{ clientId?, hints }`.
- When the DB is offline, `localStorage` remains the source of truth (`customFieldCalcParserLearnedSetHintsV1`).

**Service:** `services/unit-tests-learn-hints.service.js` → table `unit_test_learn_hints`.

**Frontend:** `public/finance/js/unit-tests-learn-mode.js` (loaded after `unit-tests.js` on `unit-tests.html`).

## Execution history (Overall Test Sign-off)

Track who confirmed a workbook at the **file level** (not per scenario row). Sign-offs persist in PostgreSQL and reload when the same Excel file is opened again.

**UI:** **Overall Test Sign-off** accordion (`collapseOverallSignOff`). Three roles:

| `testedBy` value | Label |
|------------------|-------|
| `DEVELOPER` | Developer |
| `UAT TESTER` | UAT Tester |
| `POST RELEASE TESTER` | Post Release Tester |

Click **Confirm** next to a role → timestamp stored. When all three are confirmed, the accordion header shows a complete badge.

**Storage:** `test_executions` table. File-level sign-offs use `test_number = 'overall'` (unique per `file_name` + `tested_by`).

**API**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/unit-tests/executions` | Upsert sign-off: `{ fileName, testNumber, testedBy }` |
| `GET` | `/api/unit-tests/executions?fileName=...` | Sign-offs for one workbook (grouped by `test_number`) |
| `GET` | `/api/unit-tests/executions/all` | Paginated admin list (`limit`, `offset`) |
| `DELETE` | `/api/unit-tests/executions/:id` | Remove one record |

**Resilience:** `GET /executions` returns `{ executions: {}, dbUnavailable: true }` when the database is unreachable so the grid still loads. The UI shows a warning that sign-off status may be outdated.

**Frontend:** Sign-off logic lives in `public/finance/js/unit-tests.js` (`saveTestExecutionToDatabase`, `loadTestExecutionsFromDatabase`, `displayOverallSignOff`).

## Frontend modules

| File | Role |
|------|------|
| `public/finance/js/unit-tests.js` | Grid, run engine, sign-off, generate modals |
| `public/finance/js/unit-tests-library.js` | Excel library, BR library, field search accordion |
| `public/finance/js/unit-tests-learn-mode.js` | Learn Mode UI + hint sync |
| `public/finance/js/unit-tests-story-mode.js` | Story / highlight reel |
| `public/finance/js/unit-tests-ai.js` | AI assistant panel |
