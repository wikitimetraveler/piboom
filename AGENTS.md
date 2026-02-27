# DevConnect Labs – System Self-Knowledge for AI Agents

This document helps AI coding assistants (Cursor, Copilot, etc.) understand what DevConnect Labs is, how it’s structured, and how Encompass and AI are integrated.

## What Is DevConnect Labs?

**DevConnect Labs** is a multi-domain platform built for **Raspberry Pi** and **Windows/Docker**. It combines:

- **Music research** – Voice-activated search, audio fingerprinting, AI recommendations
- **Mortgage & finance** – Loan pipeline, Encompass integration, disaster risk assessment
- **Disaster monitoring** – FEMA, NASA, USGS, NOAA, live fire cameras
- **AI assistants** – LangChain-powered mortgage/Encompass and disaster-risk experts

The mortgage/Encompass and AI domains are the main focus for ongoing development.

## Encompass & ICE Mortgage Technology

- **Encompass** is ICE Mortgage Technology’s loan origination system (LOS).
- DevConnect Labs uses **Encompass Developer Connect** (OAuth, REST APIs).
- Integration points:
  - **Encompass Hub** – `services/encompass-hub.service.js`, `controllers/encompass-hub.controller.js`
  - **Encompass Assistant** – `controllers/encompass-assistant.controller.js`, AI-backed Q&A
  - **Encompass Auth** – `services/encompass-auth.service.js` (OAuth)
  - **ScreenBindings** – In-app binding to Encompass forms from the browser
- Knowledge sources: `knowledge-sources/ice/` (cloned repos, Postman collections), `docs/ICE_KNOWLEDGE_SOURCES.md`
- Build index: `npm run build:ice-knowledge` → `data/knowledge/ice-sources.json`
- Detailed docs: `docs/ENCOMPASS.md`

## AI Integration

- **LangChain** + **PostgreSQL** for persistent conversation memory
- **OpenAI GPT-4** (and GPT-4o-mini) for assistants
- Assistants:
  - **Encompass Assistant** – Mortgage/Encompass Q&A, uses ICE knowledge + Encompass docs
  - **Loan Pipeline AI** – Mortgage operations, correspondent/retail lending
  - **Disaster Risk AI** – Disaster impact on real estate
  - **The Screen Test** – Manifest XML form code review (tool9), issue detection
- Knowledge retrieval: `lib/knowledge/ice-knowledge.service.js` for Encompass
- Detailed docs: `docs/AI_SYSTEM.md`, `docs/LANGCHAIN_MEMORY.md`

## Important Paths

| Area | Paths |
|------|-------|
| Encompass Hub/API | `services/encompass-hub.service.js`, `controllers/encompass-hub.controller.js`, `routes/encompass-hub.routes.js` |
| Encompass Assistant (AI) | `controllers/encompass-assistant.controller.js`, `services/encompass-docs.service.js` |
| ICE Knowledge | `lib/knowledge/ice-knowledge.service.js`, `knowledge-sources/ice/`, `data/knowledge/ice-sources.json` |
| AI Chat / Memory | `controllers/unit-tests-ai.controller.js`, `controllers/loan-pipeline-ai.controller.js` |
| The Screen Test | `controllers/reviewer-ai.controller.js`, `routes/reviewer.routes.js`, `public/finance/tool9.html` |
| Finance UI | `public/finance/` (encompass-assistant.html, tool9.html, pipeline-risk-dashboard.html, etc.) |
| Financial calculations | `public/shared/calculationEngine.js` (DTI, FHA, asset qualifier) |
| AG Grid | `unit-tests.html`, `encompass-custom-fields.html`, `encompass-native-fields.html` (ag-grid-community, theme alpine) |

## Frontend: Tables & Grids

- **AG Grid** (ag-grid-community) – Used for unit-test execution grid, Encompass custom/native field browsers. Theme: alpine. CDN: `ag-grid-community`.
- **DataTables** – Used for pipeline, disasters, risk dashboards, tools.

## Conventions When Editing

1. **Encompass** – Web/cloud/phone only; no local hardware assumptions.
2. **Calculations** – Use `calculationEngine.js` and its factory functions; map to Encompass field IDs via `customIds`.
3. **Grids** – Use AG Grid for Encompass field browsers and unit-test grids; follow patterns in `unit-tests.js`, `encompassCustomFields.js`, `encompassNativeFields.js`.
4. **AI context** – Keep `docs/ICE_KNOWLEDGE_SOURCES.md` updated; run `npm run build:ice-knowledge` after changes.
5. **Services** – Prefer service layer (`services/`) over logic in controllers; reuse patterns from existing services.

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
- **Deployment**: `docs/DOCKER_DEPLOYMENT.md`, `docs/DATABASE_SETUP.md`
- **Glossary**: `docs/GLOSSARY.md`
- **Development workflow**: `docs/DEVELOPMENT_WORKFLOW.md`
- **ICE docs folder**: `knowledge-sources/ice/docs/README.md`