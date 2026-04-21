# Processor assignment tool

Worksheets page: `/finance/processor-assignment.html`.

## Behavior

- Loads pipeline loans via Encompass Hub, scores each loan with **rule-based** complexity (`services/loan-complexity.service.js`) and optionally **OpenAI** (`services/loan-complexity-ai.service.js`, requires `OPENAI_API_KEY`).
- Assigns **Processor** loan associate slots using `PUT …/loans/{guid}/associates/{logId}` (proxied as `/api/encompass-hub/loans/:loanGuid/associates/:logId`). Role slot discovery uses `services/processor-assignment.service.js` (`findProcessorLogId`, etc.).
- **Capacity**: each processor has `maxPoints`; assigned load uses rule points (and/or AI) so dry run / apply respect remaining capacity.
- **Capability matching**: processor entries can include `products: string[]`; loans derive product tags (`fha`, `va`, `jumbo`, `condo`, `cema`, etc.) and assignments are hard-blocked to eligible processors unless override is enabled.

## UI

- **Processors (JSON)** — array of `{ userId, displayName?, maxPoints, products? }`. `products` is optional (`["FHA","VA","Jumbo"]`) and controls product eligibility.
- **Add from Encompass users** — searches `GET /api/encompass-hub/users`; **Add** can append, replace the first template row (`YOUR_ENCOMPASS…`), or replace a specific `userId` (e.g. `test.processor`).
- **Save config** — writes to `localStorage` and, when `DATABASE_URL` is set, **`PUT /api/encompass-hub/processor-assignment/config`**.
- **Reload from database** — **`GET /api/encompass-hub/processor-assignment/config`** (scoped by `X-Encompass-Env`: `correspondent` | `retail`).
- **Run option** — `allowIneligibleOverride` enables fallback assignment to non-matching processors; results include an eligibility note showing matched tags or override usage.

## Persistence

- Table: **`processor_assignment_tool_config`** (`encompass_env` PK, `payload` JSONB, `updated_at`). Created in `services/database.service.js` → `createTables()`.
- Service: `services/processor-assignment-config.service.js`.

## API

See `docs/API_ROUTES.md` (`/api/encompass-hub/processor-assignment/*`).

## Tests

- `tests/unit/processor-assignment.service.test.js`
- `tests/unit/processor-assignment-config.service.test.js`
- Related: `tests/unit/loan-complexity.service.test.js`, `tests/unit/loan-complexity-ai.service.test.js`
