# Encompass Unit Tests — TypeScript Export

Standalone export copied from piBoom unit-test logic for use on a work machine.

**piBoom source files are not modified.** This folder is self-contained and portable.

## Setup (work computer)

```bash
cd export/encompass-unit-tests-ts
npm install
npm test
npm run dev
```

## Inputs (no Encompass API)

1. **`workbook.json`** — SET / GET / COMPARE rows with `Test 1`, `Test 2`, … columns
2. **`loan-snapshot.json`** — `fields` map plus optional `calculatedFields` formulas

See `samples/` for examples.

## Packages

| Package | Purpose |
|---------|---------|
| `@encompass-unit-tests/core` | Compare, parser, BR parser, workbook, in-memory runner |
| `@encompass-unit-tests/react-shell` | Thin UI: load files, run tests, show results |

## What was removed vs piBoom

- DOM / AG Grid / jQuery / DataTables
- Encompass Hub HTTP calls (replaced by `LoanStore` in memory)
- AI chat, voice/TTS, story mode, learn-mode `localStorage`
- Finance auth and loan GUID env picker

## What was preserved

- COMPARE semantics (`equals`, `approx`, `date`, `contains`, `regex`, ordering)
- SET → GET → COMPARE step order per scenario
- Blank / `null` / `Nothing` normalization
- `customFieldCalcParser` evaluator (copied JS, typed wrapper)
