# AI System Architecture

Overview of piBoom's AI integration for assistants, memory, and retrieval. Use this when working on Encompass AI, loan pipeline AI, or disaster risk AI.

## Stack

| Component | Purpose |
|-----------|---------|
| LangChain | Conversation orchestration, memory, retrieval |
| PostgreSQL | Persistent storage for conversations, messages |
| OpenAI GPT-4 / GPT-4o-mini | Model for assistants |
| ice-knowledge.service | Encompass/ICE knowledge retrieval |
| encompass-docs.service | Encompass docs search |

## Assistants

### 1. Encompass Assistant

- **Controller**: `controllers/encompass-assistant.controller.js`
- **UI**: `public/finance/encompass-assistant.html`
- **Sources**: Encompass docs + ICE knowledge (repos, Postman)
- **Model**: GPT-4
- **Context**: piBoom tech stack, calculation engine, Encompass Hub/ScreenBindings
- **Endpoints**: `/api/encompass-assistant/search`, `/chat`, `/summary`

### 2. Loan Pipeline AI

- **Controller**: `controllers/unit-tests-ai.controller.js` or loan-pipeline AI routes
- **Context**: Correspondent/retail lending, pipeline data, disaster risk
- **Memory**: LangChain + PostgreSQL

### 3. Disaster Risk AI

- **Context**: FEMA, disasters, flood zones, real estate impact
- **Data**: Disaster and loan pipeline services

## Memory & Persistence

- **LangChain + PostgreSQL** – Conversations persisted across restarts
- **Tables**: `conversations`, `messages`
- **Per-user, per-session** – User and session IDs
- **Details**: `docs/LANGCHAIN_MEMORY.md`

### API Endpoints (LangChain)

- `POST /api/chat/langchain/chat` – Send message with memory
- `GET /api/chat/langchain/history` – Conversation history
- `DELETE /api/chat/langchain/history` – Clear history
- `GET /api/chat/langchain/stats` – Conversation stats

## Knowledge Retrieval (Encompass)

- **Service**: `lib/knowledge/ice-knowledge.service.js`
- **Data**: `data/knowledge/ice-sources.json` (from `npm run build:ice-knowledge`)
- **Indexes**: ICE repos, Postman, Developer Connect docs
- **Execution**: Disabled; retrieval only, no live API execution
- **Usage**: Encompass Assistant searches before each response

## System Prompts

- Encompass Assistant – Large system prompt in `encompass-assistant.controller.js` covering:
  - Documentation sources
  - piBoom tech stack
  - Calculation engine
  - Encompass Hub/ScreenBindings
  - Solution design approach

## Patterns

1. **RAG** – Search docs + knowledge → build context → call LLM
2. **Memory** – LangChain loads prior messages from PostgreSQL
3. **Service layer** – Controllers call services (encompass-docs, ice-knowledge, langchain-memory)

## Environment Variables

```bash
OPENAI_API_KEY=...
DATABASE_URL=postgresql://...
```

## Checklist for AI Work

- [ ] Use existing services; avoid duplicating retrieval logic
- [ ] Keep Encompass system prompt in sync with new features
- [ ] Run `npm run build:ice-knowledge` after ICE source changes
- [ ] Test with real Encompass/loan/disaster context
- [ ] See `AGENTS.md` and `docs/ENCOMPASS.md` for Encompass-specific details
