---
name: encompass-ai-langchain
description: Applies DevConnect Labs patterns for LangChain, OpenAI, and Encompass-facing AI features—RAG via ICE knowledge and Encompass docs, persistent chat memory, and form/manifest review. Use when editing Encompass Assistant, loan pipeline AI, LangChain memory, reviewer/Screen Test, processor-assignment AI scoring, or when the user mentions LangChain, OpenAI assistants, or Encompass AI.
---

# Encompass apps: AI and LangChain

## Stack (this repo)

| Piece | Role |
|-------|------|
| `@langchain/openai` (`ChatOpenAI`) | LLM calls |
| `@langchain/core/messages` | `HumanMessage`, `AIMessage`, `SystemMessage` |
| `services/langchain-memory.service.js` | Conversation chains + PostgreSQL-backed history |
| `lib/knowledge/ice-knowledge.service.js` | ICE repos/Postman/docs retrieval (build: `npm run build:ice-knowledge`) |
| `services/encompass-docs.service.js` | Official Encompass Developer Connect docs search |

**Persistence:** `DATABASE_URL`; memory tables documented in `docs/LANGCHAIN_MEMORY.md`.  
**Secrets:** `OPENAI_API_KEY` (and Encompass OAuth vars only where Hub/API calls apply—not for pure LLM+RAG endpoints).

## Where code lives

| Feature | Primary files |
|---------|----------------|
| Encompass Assistant (docs + ICE RAG, chat, summary) | `controllers/encompass-assistant.controller.js`, `public/finance/encompass-assistant.html` |
| LangChain REST API (`/api/chat/langchain/*`) | `routes/chat.routes.js`, wired to LangChain memory service |
| Loan pipeline AI | `controllers/loan-pipeline-ai.controller.js` → `services/langchain-memory.service.js` |
| Unit Tests AI | `controllers/unit-tests-ai.controller.js` |
| Screen Test / form manifest AI | `controllers/reviewer-ai.controller.js`, `public/finance/tool9.html` |
| Optional loan complexity scoring (processors) | `services/loan-complexity-ai.service.js` (see `docs/PROCESSOR_ASSIGNMENT.md`) |

Thin controllers call services; do not duplicate retrieval or memory wiring in routes.

## Design patterns

1. **RAG (Encompass Assistant)** — Search `encompass-docs` + `ice-knowledge`, assemble context, then `ChatOpenAI` with the system prompt in `encompass-assistant.controller.js`. Retrieval only; ICE knowledge does not execute APIs.
2. **Memory** — Prefer existing `langchain-memory.service.js` helpers and DB history for conversational flows (`GET/POST/DELETE` `/api/chat/langchain/*` per `docs/AI_SYSTEM.md`).
3. **Testing** — Mock `@langchain/openai` and `@langchain/core/messages` in unit tests (`tests/unit/encompass-assistant.controller.test.js` style); mock `langchain-memory.service.js` where the controller depends on chains.
4. **Calculations vs AI** — Encompass field math belongs in `public/shared/calculationEngine.js`; AI explains or maps behavior—it does not replace the engine unless the product asks for that explicitly.

## Checklist before shipping AI changes

- [ ] Reuse existing services; no parallel RAG pipelines.
- [ ] After ICE source changes: `npm run build:ice-knowledge`.
- [ ] Assistant/system prompts stay accurate if APIs or UI capabilities change.
- [ ] Frontend stays Bootstrap + vanilla JS (no React).
- [ ] Credential failures: align with `.env.example` / `docs/CONFIG.md`; document blockers rather than weakening tests.

## Deep reference

- Architecture overview: `docs/AI_SYSTEM.md`
- Conversation memory API and behavior: `docs/LANGCHAIN_MEMORY.md`
- Encompass APIs + Hub: `docs/ENCOMPASS.md`
- ICE index and sources tracker: `docs/ICE_KNOWLEDGE_SOURCES.md`
