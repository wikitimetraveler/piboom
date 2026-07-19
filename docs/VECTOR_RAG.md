# Vector RAG (pgvector) + GraphRAG

Hybrid keyword + semantic retrieval for the Encompass knowledge stores and the disaster-impact graph. Vectors are always **additive**: every store keeps its committed-JSON keyword search as an always-on fallback, so a fresh clone, offline run, or DB-less test still works.

## Architecture

- **Embeddings**: OpenAI `text-embedding-3-small` (1536 dims), configurable via `ENCOMPASS_EMBEDDING_MODEL`. Shared helpers live in [`lib/knowledge/embedding-utils.js`](../lib/knowledge/embedding-utils.js) (`embedTexts`, `embedQuery`, `chunkText`, `hashContent`, `toVectorLiteral`).
- **Storage**: Postgres `pgvector` extension (enabled idempotently via `ensurePgvectorExtension()` in [`services/database.service.js`](../services/database.service.js)). Each store has its own chunk table with an `embedding vector(1536)` column and an HNSW cosine index.
- **Retrieval**: each service runs `searchVector()` (cosine `<=>`) and `searchKeyword()` in parallel, then merges (vector boosted, dedup by key). Existing method signatures are unchanged, so controllers need no edits.
- **Shared schema**: `ensureKnowledgeVectorTable()` in [`services/database.service.js`](../services/database.service.js) creates the same chunk table shape + HNSW cosine index for Encompass docs, ICE, and HeyGen. Boot `createTables()` ensures all three.

## Stores and jobs

| Store | Table | Service | Backfill job |
|-------|-------|---------|--------------|
| Developer Connect docs | `encompass_docs_chunks` | [`services/encompass-docs.service.js`](../services/encompass-docs.service.js) | `npm run scrape:encompass-docs` |
| ICE knowledge | `ice_knowledge_chunks` | [`lib/knowledge/ice-knowledge.service.js`](../lib/knowledge/ice-knowledge.service.js) | `npm run build:ice-knowledge` |
| HeyGen API docs | `heygen_knowledge_chunks` | [`services/heygen-knowledge.service.js`](../services/heygen-knowledge.service.js) | `npm run build:heygen-knowledge` |
| Disaster impact graph nodes | `graph_nodes.embedding` | [`services/disaster-impact-graph.service.js`](../services/disaster-impact-graph.service.js) (`findSimilarNodes`) | `npm run embed:graph-nodes` |

Combined refresh: `npm run refresh:encompass-knowledge` (docs scrape + ICE build).

## Behavior without a database or API key

- No `OPENAI_API_KEY` / `DATABASE_URL` / pgvector → backfills write JSON only (`vectorReady:false`); retrieval returns keyword results.
- Backfills are idempotent: docs/ICE upserts use `content_hash` to skip unchanged chunks; `embed:graph-nodes` embeds only nodes missing an embedding unless `GRAPH_EMBED_FORCE=1`.

## GraphRAG

`graph_nodes` carries an optional `embedding` column alongside its relational structure. `findSimilarNodes(text, { nodeType, limit })` returns semantically similar nodes and is folded into the Disaster Processor Expert context in [`controllers/loan-pipeline-ai.controller.js`](../controllers/loan-pipeline-ai.controller.js), complementing (not replacing) the structural `NEAR` / recursive-CTE traversal. Semantic matches are a context/recall aid — **not** a live proximity signal and **not** a loss probability; loan `disaster_risk_score` remains ops triage.

## Environment variables

```bash
OPENAI_API_KEY=...
DATABASE_URL=postgresql://...
ENCOMPASS_EMBEDDING_MODEL=text-embedding-3-small
ENCOMPASS_DOCS_SKIP_EMBED=0   # 1 = docs JSON only
ICE_SKIP_EMBED=0              # 1 = ICE JSON only
GRAPH_EMBED_FORCE=0          # 1 = re-embed all graph nodes
```
