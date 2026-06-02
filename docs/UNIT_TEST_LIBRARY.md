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
