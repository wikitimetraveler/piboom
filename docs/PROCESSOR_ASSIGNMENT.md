# Processor assignment tool

Worksheets page: `/finance/processor-assignment-mock.html` (canonical). `/finance/processor-assignment.html` redirects there.

## Behavior (UI — mock only)

- Synthetic processors + loans in the browser (`processor-assignment-mock-data.js`).
- **Dry run** / routing run entirely client-side via `public/finance/js/processor-assignment-client-run.js` (rules scoring + capacity / product matching). No Encompass hub, users, config, pipeline, or associate APIs.
- **Apply (mock)** updates the in-page loans JSON / localStorage only.
- Handlers (filters, preview, dry run, apply) remain; they never call `/api/encompass-hub/*`.

## Server services (still available for tests / optional live page)

- Live UI preserved at `/finance/processor-assignment-live.html` for Encompass pipeline runs.
- `services/processor-assignment.service.js`, `loan-complexity.service.js`, config + associates APIs under `/api/encompass-hub/processor-assignment/*`.

## Tests

- `tests/unit/processor-assignment.service.test.js`
- `tests/unit/processor-assignment-config.service.test.js`
- Related: `tests/unit/loan-complexity.service.test.js`, `tests/unit/loan-complexity-ai.service.test.js`
