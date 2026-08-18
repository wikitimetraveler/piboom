# Encompass Integration

Comprehensive guide to DevConnect Labs's Encompass (ICE Mortgage Technology) integration. Use this when building or modifying Encompass features.

## Overview

- **Encompass** – ICE Mortgage Technology loan origination system (LOS)
- **Deployment** – Web/cloud/phone; no local hardware assumptions
- **Auth** – OAuth 2.0 via Encompass Developer Connect

## Architecture

### 1. Encompass Hub Service (`services/encompass-hub.service.js`)

REST API integration with Encompass:

- **Pipeline** – Loan pipeline queries, filters, status
- **Loans** – Loan read/update via API
- **OAuth** – Token management via `encompass-auth.service.js`
- **Base URL** – `ENCOMPASS_API_BASE` or default `https://concept.api.elliemae.com/encompass/v1`
- **V3** – Uses `/encompass/v3` where applicable

Key fields: `Loan.LoanGuid`, `Loan.LoanNumber`, `Loan.LoanStatus`, `Loan.CurrentMilestoneName`, `Fields.11`–`Fields.15` (address), etc.

### 2. Encompass Assistant (`controllers/encompass-assistant.controller.js`)

AI assistant for Encompass Developer Connect:

- Uses **encompass-docs.service.js** – Search official Developer Connect docs (`data/encompass-docs.json`; refresh with `npm run scrape:encompass-docs`)
- Uses **ice-knowledge.service.js** – Search ICE repos, Postman, sample code (`data/knowledge/ice-sources.json`; build with `npm run build:ice-knowledge`)
- System prompt includes DevConnect Labs tech stack, calculations class, Encompass context
- Endpoints: `/search`, `/chat`, `/summary`, `/scrape` (admin, token-gated)
- Refresh both stores together: `npm run refresh:encompass-knowledge`

### 3. Knowledge Sources (`knowledge-sources/ice/`)

| Location | Contents |
|----------|----------|
| `repos/` | Cloned ICE public repos (bindings, samples, LO Connect, token exchange, etc.) |
| `postman/` | Postman collections and environments |
| `docs/` | HTML/Markdown snapshots from Developer Connect |

Build index: `npm run build:ice-knowledge` → `data/knowledge/ice-sources.json`.  
Companion docs store (official Developer Connect pages): `npm run scrape:encompass-docs` → `data/encompass-docs.json`.  
Both jobs also embed into pgvector (`ice_knowledge_chunks`, `encompass_docs_chunks`) for hybrid keyword+semantic retrieval when a DB + `OPENAI_API_KEY` are available; keyword search is the offline fallback. See `docs/VECTOR_RAG.md`.  
Tracker: `docs/ICE_KNOWLEDGE_SOURCES.md`.

### 4. ScreenBindings / In-App Binding

In-browser binding to Encompass forms via Encompass Hub. The assistant knows both:

- Server-side Encompass APIs (Hub)
- ScreenBindings for in-app binding workflows

### 5. Encompass Auth (`services/encompass-auth.service.js`)

- OAuth token acquisition and refresh
- Token caching
- `ensureEncompassToken()`, `clearEncompassTokenCache()`

## Key APIs Used

- **Loan Pipeline** – Pipeline queries, filters
- **Loans** – CRUD operations
- **Loan Associates (v1)** – `GET/PUT/DELETE …/encompass/v1/loans/{id}/associates[/{logId}]` for milestone / milestone-free role slots (processor assignment tool proxies these under `/api/encompass-hub/loans/:loanGuid/associates`)
- **Processor assignment** – UI at `public/finance/processor-assignment.html`: rule/AI complexity scoring, capacity-aware processor slots, dry run / apply via `POST /api/encompass-hub/processor-assignment/run`. Processors can be picked from company users (`GET /api/encompass-hub/users`); config persists in Postgres (`GET`/`PUT /api/encompass-hub/processor-assignment/config`, table `processor_assignment_tool_config`, one row per `X-Encompass-Env`). Services: `services/processor-assignment.service.js`, `services/processor-assignment-config.service.js`, `services/loan-complexity.service.js`, `services/loan-complexity-ai.service.js`.
- **OAuth** – Token exchange
- **Users/Organizations** – Via Settings API
- **Enhanced Conditions** – Live CRUD UI at `/finance/enhanced-conditions.html` (`/api/encompass-conditions` catalog/invoke plus `/types`, `/templates`, `/loans/:loanId/conditions`). Condition Manager CDO conversion remains dry-run (`POST /convert`); apply after conversion via the CRUD page.
- **Custom Fields** – Field management

## Environment Variables

```bash
ENCOMPASS_API_BASE=https://concept.api.elliemae.com/encompass/v1
ENCOMPASS_CLIENT_ID=...
ENCOMPASS_CLIENT_SECRET=...
ENCOMPASS_INSTANCE_ID=...
ENCOMPASS_PIPELINE_LIMIT=50
```

## Financial Calculations → Encompass Fields

Use `public/shared/calculationEngine.js` with `customIds` to map to Encompass field IDs:

```javascript
createDTICalculatorConfig({ customIds: { annualIncome: 'field_4002' } })
createFHACalculatorConfig({ customIds: { ... } })
createAssetQualifierConfig({ customIds: { ... } })
```

## AG Grid Usage

Encompass field browsers and unit-test grids use **AG Grid Community** (theme: alpine) via CDN. Pattern: `agGrid.createGrid()` or `new agGrid.Grid()`, with explicit `colId` per column. See `encompassCustomFields.js`, `encompassNativeFields.js`, `unit-tests.js`.

## Public UI Pages

| Page | Purpose |
|------|---------|
| `encompass-assistant.html` | AI Encompass Q&A |
| `encompass-hub.html` | Hub API test page |
| `encompass-hub-test.html` | Hub test utilities |
| `encompass-custom-fields.html` | Custom field browser |
| `encompass-native-fields.html` | Native field browser |
| `encompass-users.html` | User management |
| `processor-assignment.html` | Complexity scoring + processor assignment (users picker, DB-backed config) |
| `encompass-analytics.html` | Analytics |
| `pipeline-risk-dashboard.html` | Loan pipeline + risk |
| `tool9.html` | **The Screen Test** — Manifest XML form code review, issue detection |

### The Screen Test (`tool9.html`)

AI-powered review of Encompass manifest XML form code:

- **Input**: Paste or upload manifest XML (CustomFieldList, Field, Calculation, Option, Audit)
- **Extract**: Field IDs and calculation expressions
- **Check for Issues**: AI analyzes for calculation syntax, type mismatches, deprecated patterns, [#] vs [@] misuse. Does NOT flag "field not in manifest" — Encompass form code can reference all native fields (e.g. [19]) and custom fields from other packages.
- **Endpoints**: `POST /api/reviewer/ai/chat`
- **Controller**: `controllers/reviewer-ai.controller.js`, `routes/reviewer.routes.js`

## Developer Connect References

- [Developer Connect](https://developer.icemortgagetechnology.com/developer-connect/docs)
- [Postman Collection](https://developer.icemortgagetechnology.com/developer-connect/docs/postman-collection)
- [OAuth / Token](https://developer.icemortgagetechnology.com/developer-connect/docs/oauth)

## Checklist for Encompass Work

- [ ] Keep `ICE_KNOWLEDGE_SOURCES.md` and `ice-sources.json` updated
- [ ] Run `npm run build:ice-knowledge` after ICE repo/doc changes
- [ ] Run `npm run scrape:encompass-docs` (or `npm run refresh:encompass-knowledge`) to refresh Developer Connect docs; commit updated `data/encompass-docs.json`
- [ ] Use calculations class + `customIds` for financial fields
- [ ] Assume web/cloud/phone deployment only
- [ ] Follow existing service/controller/route patterns
- [ ] See `AGENTS.md` for high-level system overview
