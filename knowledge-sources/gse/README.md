# GSE / mortgage knowledge sources

Markdown in this folder is indexed by `npm run build:gse-knowledge` into:

- `data/knowledge/gse-sources.json` (keyword / offline)
- Postgres `gse_knowledge_chunks` (pgvector when `DATABASE_URL` + OpenAI embeddings are available)

Do not put secrets or borrower PII here. Prefer public agency summaries and DevConnect Labs ops notes.