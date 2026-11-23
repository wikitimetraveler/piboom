# Processor assignment tool

Worksheets page: `/finance/processor-assignment-mock.html` (canonical). `/finance/processor-assignment.html` redirects there.

## Behavior (UI — mock only)

- Synthetic processors + loans in the browser (`processor-assignment-mock-data.js`).
- **Dry run** / routing run entirely client-side via `public/finance/js/processor-assignment-client-run.js` (rules scoring + capacity / product matching). No Encompass hub, users, config, pipeline, associate, or auth APIs.
- **Apply (mock)** updates the in-page loans JSON / localStorage only.
- The page does not load a user login or `finance-auth-guard.js`. `/finance/processor-assignment.html` and `/finance/processor-assignment-live.html` redirect here.
- `public/finance/js/processor-assignment.js` is a no-op stub (it used to call hub users and assignment run).

## Server services (tests only — not used by the page)

- `services/processor-assignment.service.js`, `loan-complexity.service.js`, config + associates APIs under `/api/encompass-hub/processor-assignment/*` remain for unit tests. The Worksheets page does not call them.

## Tests

- `tests/unit/processor-assignment.service.test.js`
- `tests/unit/processor-assignment-config.service.test.js`
- Related: `tests/unit/loan-complexity.service.test.js`, `tests/unit/loan-complexity-ai.service.test.js`
