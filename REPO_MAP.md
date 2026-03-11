# REPO_MAP.md — DevConnect Labs (Architecture Snapshot)

**Source of truth:** Use `REPO_MAP.md` + `AGENTS.md` as the source of truth for project structure, conventions, and behavior.

## Runtime entrypoints
- Server: `server.js`
- TypeScript server (alt): `server.ts` (run via `npm run ts:dev`)
- Public web root: `public/`

## Layering rules
- Routes -> Controllers -> Services
- Controllers are thin: request parsing + response formatting only
- Services contain business logic and external integrations
- No React. Frontend is Bootstrap + vanilla JS + AG Grid/DataTables.
- Calculations live in `public/shared/calculationEngine.js` (factory functions)

## Backend structure
- Routes: `routes/`
- Controllers: `controllers/`
- Services: `services/`
- DB: `services/database.service.js`
- Knowledge: `lib/knowledge/ice-knowledge.service.js`

## Key domains
### Encompass
- Auth: `services/encompass-auth.service.js`
- Hub: `services/encompass-hub.service.js`
- Controllers: `controllers/encompass-*.controller.js`
- Routes: `routes/encompass-*.routes.js`

### AI / LangChain
- Memory: `services/langchain-memory.service.js`, `docs/LANGCHAIN_MEMORY.md`
- Assistants: `controllers/*-ai.controller.js` (encompass-assistant, unit-tests-ai, loan-pipeline-ai, reviewer-ai)

### Finance tools
- UI: `public/finance/`
- Unit Tests: `public/finance/unit-tests.html`, `public/finance/js/unit-tests.js`, `public/shared/customFieldCalcParser.js`, `public/shared/unit-tests-utils.js`, `services/unit-tests-file.service.js`
- Screen Test: `public/finance/tool9.html`, `controllers/reviewer-ai.controller.js`
- Encompass field browsers: `encompass-custom-fields.html`, `encompass-native-fields.html`

### Nature
- UI: `public/nature/` (nature-hub.html, tree-discovery.html, critter-discovery.html, fish-identification.html, tree/critter/fish-collection.html, share-collection.html)
- Lat/long auto-fill from device GPS on mobile for tree, critter, fish discovery pages
- Routes: `routes/nature-collection.routes.js`, `routes/critter-collection.routes.js`, `routes/critter-discovery.routes.js`

### Local Spots
- UI: `public/local/local-spots.html` (thrift, taco trucks, gardens, bike trails; lat/lng auto-fill when adding spot on mobile)
- Routes: `routes/local-spots.routes.js`

## Commands (source of truth)
- Dev: `npm run dev`
- Test: `npm run test`
- CI: `npm run ci`
- Build: `npm run build`
- ICE knowledge: `npm run build:ice-knowledge`

## "Don't surprise me" constraints
- Avoid repo-wide refactors unless asked
- Prefer smallest safe change
- Don't run docker/pi/sudo scripts unless asked
