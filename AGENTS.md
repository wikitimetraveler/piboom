# AGENTS.md — DevConnect Labs Agent Rules

This file tells AI coding assistants (Cursor Agent, Copilot, etc.) how to operate in this repo.

## Repo Identity (high level)
DevConnect Labs is a multi-domain platform (Mortgage/Encompass + AI + Disaster + Music).
Primary active domains: Mortgage/Encompass + AI integration.

## Non-Negotiable Conventions
- Prefer service-layer logic in `services/` over controllers.
- Do not introduce React. Frontend is Bootstrap 5 + vanilla JS + AG Grid/DataTables.
- Calculations must use `public/shared/calculationEngine.js` and its factory functions.
- For Encompass integrations, follow patterns in:
  - `services/encompass-*.service.js`
  - `controllers/encompass-*.controller.js`
  - `routes/encompass-*.routes.js`

## Key Paths

| Area | Paths |
|------|------|
| Encompass Hub/API | `services/encompass-hub.service.js`, `controllers/encompass-hub.controller.js`, `routes/encompass-hub.routes.js` |
| Encompass Assistant (AI) | `controllers/encompass-assistant.controller.js`, `services/encompass-docs.service.js` |
| ICE Knowledge | `lib/knowledge/ice-knowledge.service.js`, `knowledge-sources/ice/`, `data/knowledge/ice-sources.json` |
| AI Chat / Memory | `controllers/unit-tests-ai.controller.js`, `controllers/loan-pipeline-ai.controller.js` |
| The Screen Test | `controllers/reviewer-ai.controller.js`, `routes/reviewer.routes.js`, `public/finance/tool9.html` |
| Finance UI | `public/finance/` (encompass-assistant.html, tool9.html, pipeline-risk-dashboard.html, unit-tests.html, etc.) |
| Financial calculations | `public/shared/calculationEngine.js` (DTI, FHA, asset qualifier) |
| AG Grid | `unit-tests.html`, `encompass-custom-fields.html`, `encompass-native-fields.html` (ag-grid-community, theme alpine) |

## Documentation Index

- **Project overview**: `README.md`
- **Encompass**: `docs/ENCOMPASS.md`, `docs/ICE_KNOWLEDGE_SOURCES.md`
- **AI**: `docs/AI_SYSTEM.md`, `docs/LANGCHAIN_MEMORY.md`
- **Calculations**: `docs/CALCULATION_ENGINE.md`
- **The Screen Test**: `docs/SCREEN_TEST.md`
- **Disaster & risk**: `docs/DISASTER_RISK.md`
- **API routes**: `docs/API_ROUTES.md`
- **Config & env**: `docs/CONFIG.md`
- **Frontend patterns**: `docs/FRONTEND_PATTERNS.md`
- **Structure**: `docs/PROJECT_STRUCTURE.md`
- **Deployment**: `docs/DATABASE_SETUP.md`, `docs/archive/DOCKER_DEPLOYMENT.md`
- **Glossary**: `docs/GLOSSARY.md`
- **Development workflow**: `docs/DEVELOPMENT_WORKFLOW.md`

## DevOps Agent Mission
Keep the build green with the smallest safe changes.

When asked to "run and fix", follow this loop:
1) Run the exact command provided by the user. If none is provided, run `npm test`.
2) Read the terminal output and identify the FIRST failing test or error.
3) Make the smallest change that fixes the failure (avoid refactors).
4) Re-run the same command.
5) Repeat until it passes, or a hard blocker is proven.

## Hard Blockers (must stop and report)
Stop and report if any of these are true:
- Missing required env vars / secrets (OAuth, DB, API keys)
- Network-only dependencies cannot be reached (ICE, FEMA, NASA) and no mock exists
- Tests depend on local files not present in repo
- Command cannot run due to missing install step

When blocked: propose the minimal next step (e.g., add `.env.example`, add mocks, add local test DB setup).

## What NOT to do
- Do not change behavior unrelated to the failing test.
- Do not rename or reorganize folders while fixing tests.
- Do not update snapshots unless asked.
- Do not disable tests to "make it pass."

## Preferred Fix Order
1) Fix production code bug
2) Fix test only if the test is incorrect relative to documented behavior
3) Add mocks/fixtures for external API calls
4) Add explicit env validation + helpful error messaging

## Command Defaults (use these unless user gives a different command)
- Install: `npm ci` (CI) or `npm install` (local)
- Unit tests: `npm test`
- CI bundle: `npm run ci` (if defined)
- Lint: `npm run lint` (if defined)

## Output Requirements (always include at end)
- Command executed
- What failed (1–3 bullets)
- What changed (files + short summary)
- Final result (PASS / BLOCKED)

### Example Report

```
## DevOps Agent Report

**Command executed:** `npm test`

**What failed (first failure):**
- `tests/unit/tts.test.js` – "speakWithGoogle falls back to browser speech when API fails"
- `expect(result).toBe(true)` failed (got `false`)
- Cause: `window.speechSynthesis.getVoices is not a function` – the mock lacked `getVoices`

**What changed:**
- **File:** `tests/unit/tts.test.js`
- **Change:** Added `getVoices: jest.fn(() => [])` to the `speechSynthesis` mock so `speakWithBrowser` can call `getVoices()` without throwing

**Final result:** PASS
```
