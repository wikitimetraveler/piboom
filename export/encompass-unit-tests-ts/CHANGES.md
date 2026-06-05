# What changed in this export (vs piBoom)

**piBoom source files were not modified.** This folder is a portable copy for a work machine.

## Removed

| piBoom area | Reason |
|-------------|--------|
| `unit-tests.js` AG Grid, modals, Excel UI | DOM / jQuery-style orchestration |
| Encompass Hub `fetch` (field-reader / field-writer) | Replaced by in-memory `LoanStore` |
| AI chat (`unit-tests-ai.js`) | Out of scope |
| Story mode / highlight reel | Out of scope |
| Learn mode `localStorage` hints | Inert in Node; not wired in work shell |
| Voice / TTS | Out of scope |
| Finance auth / loan GUID picker | Out of scope |

## Preserved (behavior)

- `compareValues` modes: `equals`, `approx`, `date`, `contains`, `regex`, `gt`, `gte`, `lt`, `lte`, `not`
- Blank / `null` / `Nothing` handling via `isBlankForTest` + `coerce`
- SET → GET → COMPARE row order per scenario (`Test 1`, `Test 2`, …)
- COMPARE pass status = `info` (piBoom convention)
- Full `customFieldCalcParser` evaluator (verbatim JS copy + typed wrapper)

## Added

- TypeScript interfaces (`UnitTestWorkbook`, `LoanSnapshot`, `ScenarioResult`, …)
- `executeScenario` / `executeAllScenarios` pure runner
- `createLoanStore` in-memory field adapter
- JSON fixture inputs (`samples/workbook.json`, `samples/loan-snapshot.json`)
- Vitest tests ported from piBoom: `unit-tests-utils`, `customFieldCalcParser` (4 files), `brRuleParser`, compare integration fixture (158 tests)
- Thin React work shell (file load + results table)

## Type-safety-only tweaks

- `UnitTestAction` union type on row `Action`
- Explicit `CompareMode` type
- `StepResult.status` includes piBoom statuses (`info`, `err`, `skipped`)

## Transfer

Copy the entire `export/encompass-unit-tests-ts/` folder to the work computer, then:

```bash
npm install
npm test
npm run dev
```

Load `samples/workbook.json` and `samples/loan-snapshot.json` in the UI to verify.
