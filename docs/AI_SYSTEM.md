# AI System Architecture

Overview of DevConnect Labs's AI integration for assistants, memory, and retrieval. Use this when working on Encompass AI, loan pipeline AI, or disaster risk AI.

## Stack

| Component | Purpose |
|-----------|---------|
| LangChain | Conversation orchestration, memory, retrieval |
| PostgreSQL | Persistent storage for conversations, messages |
| OpenAI GPT-4 / GPT-4o-mini | Model for assistants |
| ice-knowledge.service | Encompass/ICE knowledge retrieval (`data/knowledge/ice-sources.json`) |
| encompass-docs.service | Official Developer Connect docs retrieval (`data/encompass-docs.json`) |
| Python/FastAPI Service | PostGIS disaster queries, pgvector RAG operations, text processing, data analytics |

### Service Architecture

```
Node.js (Port 3000)              Python/FastAPI (Port 8000)
├─ LangChain orchestration       ├─ PostGIS spatial queries
├─ OpenAI API calls              ├─ pgvector semantic search
├─ ICE knowledge retrieval       ├─ Text processing (field IDs, keywords)
├─ Encompass docs search         ├─ Data analytics (pandas/numpy)
└─ Web UI serving                └─ Encompass RAG operations
         │                                  │
         └──────────┬───────────────────────┘
                    ▼
            PostgreSQL Database
            ├─ langchain_memory (conversations, messages)
            ├─ ice_knowledge_chunks (pgvector embeddings)
            ├─ encompass_docs_chunks (pgvector embeddings)
            ├─ heygen_knowledge_chunks (pgvector embeddings)
            └─ disasters (PostGIS spatial data)
```

## Assistants

### 1. Encompass Assistant

- **Controller**: `controllers/encompass-assistant.controller.js`
- **UI**: `public/finance/encompass-assistant.html`
- **Sources**: Encompass docs + ICE knowledge (repos, Postman)
- **Model**: GPT-4
- **Context**: DevConnect Labs tech stack, calculation engine, Encompass Hub/ScreenBindings
- **Endpoints**: `/api/encompass-assistant/search`, `/chat`, `/summary`
- **Related (optional AI scoring)**: Processor assignment can use OpenAI for loan difficulty points (`services/loan-complexity-ai.service.js`); see `docs/PROCESSOR_ASSIGNMENT.md`.

### 2. Loan Pipeline AI

- **Controller**: `controllers/unit-tests-ai.controller.js` or loan-pipeline AI routes
- **Context**: Correspondent/retail lending, pipeline data, disaster risk
- **Memory**: LangChain + PostgreSQL

### 3. Disaster Risk AI

- **Context**: FEMA, disasters, flood zones, real estate impact
- **Data**: Disaster and loan pipeline services

### 4. The Screen Test (Form Code Review)

- **Controller**: `controllers/reviewer-ai.controller.js`
- **UI**: `public/finance/tool9.html`
- **Model**: GPT-4o (128K context for large manifests)
- **Scope**: Encompass manifest XML — CustomFieldList, Field definitions, Calculation, Option, Audit
- **Behavior**: Parses manifest, extracts field IDs and calculations; AI reviews for syntax errors, type mismatches, deprecated patterns. Does NOT flag "field not in manifest" — Encompass form code can access all native and custom fields.
- **Endpoints**: `POST /api/reviewer/ai/chat`
- **Voice**: "Open screen test", "Open the screen test", "Check for issues"

### 5. HeyGen API Expert

- **Controller**: `controllers/heygen-assistant.controller.js`
- **UI**: `/heygen-hub.html` (panel `#hvlExpertPanel`) — mic input + Google TTS via `/shared/tts.js`
- **Sources**: `services/heygen-knowledge.service.js` — keyword JSON + optional **pgvector** (`heygen_knowledge_chunks`)
- **Memory**: LangChain helpers + PostgreSQL (`persistConversationTurn`, session `heygen-api-expert`)
- **Model**: `HEYGEN_ASSISTANT_MODEL` or `OPENAI_AGENT_MODEL` (default gpt-4o)
- **Endpoints**: `/api/heygen-assistant/{chat,search,summary,history,health}`
- **Docs**: `docs/HEYGEN_KNOWLEDGE.md`
- **Build**: `npm run build:heygen-knowledge`

## Memory & Persistence

- **LangChain + PostgreSQL** – Conversations persisted across restarts
- **Tables**: `conversations`, `messages`
- **Per-user, per-session** – User and session IDs
- **Vector RAG (shared pattern)**: `encompass_docs_chunks`, `ice_knowledge_chunks`, `heygen_knowledge_chunks` — each `embedding vector(1536)` + HNSW when pgvector is enabled
- **Details**: `docs/LANGCHAIN_MEMORY.md`, `docs/VECTOR_RAG.md`, `docs/HEYGEN_KNOWLEDGE.md`

### API Endpoints (LangChain)

- `POST /api/chat/langchain/chat` – Send message with memory
- `GET /api/chat/langchain/history` – Conversation history
- `DELETE /api/chat/langchain/history` – Clear history
- `GET /api/chat/langchain/stats` – Conversation stats

## Knowledge Retrieval (Encompass)

RAG is **hybrid**: committed-JSON keyword search plus optional Postgres `pgvector` semantic search (full details in `docs/VECTOR_RAG.md`). Keyword is the always-on fallback, so retrieval still works in a fresh clone, offline, or without a DB. When `DATABASE_URL` + `OPENAI_API_KEY` + pgvector are present, each store also runs a cosine vector search and merges results. The Encompass Assistant and Unit Tests AI both search both stores, assemble context, then call the LLM.

### Explaining RAG + graph DBs to users

Encompass Assistant and HeyGen API Expert share a speakable architecture story in [`lib/knowledge/rag-explain-prompt.js`](../lib/knowledge/rag-explain-prompt.js): **“two currents, one dock”** (keyword + vector → hybrid merge) and the **graph archipelago** (structural `NEAR` + GraphRAG `findSimilarNodes`). Chat turns inject a live retrieval-status note (vector ready vs keyword-only). Quick-prompt chips on `/finance/encompass-assistant.html` and `/heygen-hub.html` trigger that explainer.

| Store | Data file / table | Service | Build / maintain job |
|-------|-------------------|---------|----------------------|
| ICE knowledge (repos, Postman, doc snapshots) | `data/knowledge/ice-sources.json` + `ice_knowledge_chunks` | `lib/knowledge/ice-knowledge.service.js` | `npm run build:ice-knowledge` → `scripts/build-ice-knowledge.js` |
| Official Developer Connect docs | `data/encompass-docs.json` + `encompass_docs_chunks` | `services/encompass-docs.service.js` | `npm run scrape:encompass-docs` → `scripts/scrape-encompass-docs.js` |
| Disaster impact graph nodes (GraphRAG) | `graph_nodes.embedding` | `services/disaster-impact-graph.service.js` (`findSimilarNodes`) | `npm run embed:graph-nodes` |

- **Combined refresh**: `npm run refresh:encompass-knowledge` runs the docs scrape then the ICE build.
- **Execution**: Disabled; retrieval only, no live API execution.
- **Scrape behavior**: `scrapeDocumentation()` **merges** into the existing store (by title/category), so a partial/rate-limited scrape refreshes captured pages without discarding the committed seed. Tune throttle with `ENCOMPASS_DOCS_SCRAPE_DELAY_MS` (default 1200ms).
- **Docs store seed**: `data/encompass-docs.json` ships with concise per-page summaries + canonical URLs so RAG returns useful citations offline; run the scrape when outbound access to Developer Connect is available to replace summaries with full page text.
- **Scrape endpoint auth**: `POST /api/encompass-assistant/scrape` is gated by `lib/encompass-docs-refresh-auth.js` — localhost when no token is set, otherwise Bearer / `x-encompass-docs-scrape-token` (`ENCOMPASS_DOCS_SCRAPE_TOKEN`), optionally scoped to admin/ops role.
- **Cadence**: refresh when ICE publishes notable changes, or at least quarterly. ICE repo/Postman artifacts remain manual drop-ins under `knowledge-sources/ice/` before running the ICE build.
- **Hybrid vectors (optional)**: the same backfill jobs also embed into `ice_knowledge_chunks` / `encompass_docs_chunks` (pgvector) when `OPENAI_API_KEY` + `DATABASE_URL` + pgvector are available; retrieval merges vector + keyword. GraphRAG node embeddings via `npm run embed:graph-nodes`. See `docs/VECTOR_RAG.md`.

## System Prompts

- Encompass Assistant – Large system prompt in `encompass-assistant.controller.js` covering:
  - Documentation sources
  - DevConnect Labs tech stack
  - Calculation engine
  - Encompass Hub/ScreenBindings
  - Solution design approach

## Patterns

1. **RAG (hybrid)** – Search docs + knowledge (keyword + optional pgvector) → merge → build context → call LLM
2. **Memory** – LangChain loads prior messages from PostgreSQL
3. **Service layer** – Controllers call services (encompass-docs, ice-knowledge, langchain-memory)
4. **GraphRAG** – Semantic node lookup (`findSimilarNodes`) complements structural graph traversal

## Environment Variables

```bash
OPENAI_API_KEY=...
DATABASE_URL=postgresql://...
# Hosted docs scrape endpoint gate (localhost is open when unset)
ENCOMPASS_DOCS_SCRAPE_TOKEN=...
# Optional throttle between Developer Connect scrape requests (ms, default 1200)
ENCOMPASS_DOCS_SCRAPE_DELAY_MS=1200
# Hybrid vector RAG (optional; keyword fallback always works). See docs/VECTOR_RAG.md
ENCOMPASS_EMBEDDING_MODEL=text-embedding-3-small
ENCOMPASS_DOCS_SKIP_EMBED=0
ICE_SKIP_EMBED=0
GRAPH_EMBED_FORCE=0
HEYGEN_API_KEY=...
# Optional: HEYGEN_ASSISTANT_MODEL, HEYGEN_EMBEDDING_MODEL, HEYGEN_DOCS_FETCH=0, HEYGEN_SKIP_EMBED=1
```

## Checklist for AI Work

- [ ] Use existing services; avoid duplicating retrieval logic
- [ ] Keep Encompass system prompt in sync with new features
- [ ] Run `npm run build:ice-knowledge` after ICE source changes
- [ ] Run `npm run scrape:encompass-docs` (or `npm run refresh:encompass-knowledge`) to refresh Developer Connect docs; commit updated `data/encompass-docs.json`
- [ ] Run `npm run build:heygen-knowledge` after HeyGen source/docs changes; commit `data/knowledge/heygen-sources.json` when appropriate
- [ ] Voice surfaces: include `/shared/tts.js` and mic UX like Encompass / HeyGen hub
- [ ] Test with real Encompass/loan/disaster context
- [ ] See `AGENTS.md` and `docs/ENCOMPASS.md` for Encompass-specific details
