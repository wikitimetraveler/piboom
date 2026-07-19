# HeyGen API Expert & knowledge RAG

Voice-enabled HeyGen API expert on `/heygen-hub.html`, backed by LangChain + OpenAI, with hybrid retrieval (keyword JSON + optional Postgres **pgvector**).

## Surfaces

| Piece | Path / URL |
|-------|------------|
| Hub UI (chat + mic + TTS) | `/heygen-hub.html#hvlExpertPanel` |
| Chat API | `POST /api/heygen-assistant/chat` |
| Search | `GET /api/heygen-assistant/search?q=` |
| History | `GET` / `DELETE /api/heygen-assistant/history` |
| Health | `GET /api/heygen-assistant/health` |
| Video generation (separate) | `/api/heygen/*` |

## Stack

- **LLM**: LangChain `ChatOpenAI` (`HEYGEN_ASSISTANT_MODEL` or `OPENAI_AGENT_MODEL`)
- **Memory**: PostgreSQL `conversations` / `messages` via `persistConversationTurn` / `getUserConversationHistory` (`assistant_type: heygen`)
- **RAG**: `services/heygen-knowledge.service.js`
  - Keyword: `data/knowledge/heygen-sources.json`
  - Vector: `heygen_knowledge_chunks.embedding vector(1536)` when pgvector is installed
- **Voice**: Web Speech API (mic) + `/shared/tts.js` (`speakWithGoogle`) — same pattern as Encompass Assistant

## Build / refresh

```bash
# Local seed files + optional remote docs + optional embeddings
npm run build:heygen-knowledge

# Offline / CI-friendly (no network fetch, no vectors)
HEYGEN_DOCS_FETCH=0 HEYGEN_SKIP_EMBED=1 npm run build:heygen-knowledge
```

Sources:

- `knowledge-sources/heygen/**` (committed Markdown seeds)
- Optional fetch of official developer pages listed in `scripts/build-heygen-knowledge.js`

Requires for vectors: `DATABASE_URL`, `OPENAI_API_KEY`, and Postgres extension `vector` (pgvector). If vectors are unavailable, keyword JSON still works.

## Env

See `.env.example`:

- `OPENAI_API_KEY` — chat + embeddings
- `DATABASE_URL` — memory + vector store
- `HEYGEN_API_KEY` — video generation only (not required for expert Q&A)
- `HEYGEN_DOCS_FETCH`, `HEYGEN_SKIP_EMBED`, `HEYGEN_EMBEDDING_MODEL`, `HEYGEN_ASSISTANT_MODEL`

## Relation to Encompass AI Expert

Same product patterns: service-layer retrieval, thin controller, citations `[S#]`, Bootstrap + vanilla hub UI, mic + TTS. Encompass remains file-keyword RAG today; HeyGen adds **pgvector** as the first vector store and can be reused later for Encompass if desired.
