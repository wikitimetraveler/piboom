# HeyGen knowledge sources

Drop Markdown / text snapshots here for the HeyGen API Expert RAG index.

- Local files under this folder are always indexed by `npm run build:heygen-knowledge`.
- Optional live fetch of official developer docs runs when network access is available
  (`HEYGEN_DOCS_FETCH=0` to skip).
- Embeddings land in Postgres (`heygen_knowledge_chunks`) when `DATABASE_URL`,
  `OPENAI_API_KEY`, and the `vector` (pgvector) extension are available.

See `docs/AI_SYSTEM.md` (HeyGen API Expert) and `docs/HEYGEN_KNOWLEDGE.md`.
