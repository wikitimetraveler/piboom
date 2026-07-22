# Encompass ICE RAG — HyperFrames Video Script

**Target:** Technical architecture explainer (LOS AI Labs)  
**Duration:** ~90 seconds  
**Format:** HyperFrames HTML composition + Google TTS (no avatar body)  
**Project:** `video/ice-rag/`  
**Publish:** `public/shared/assets/video/ice-rag-reel.mp4`  
**Hub catalog:** `data/hyperframes-library.json` → id `ice-rag`

Source of truth for behavior: `docs/VECTOR_RAG.md`, `docs/AI_SYSTEM.md`, `docs/ICE_KNOWLEDGE_SOURCES.md`.

---

## Beat sheet

| # | Beat | On-screen title | ~sec |
|---|------|-----------------|------|
| 0 | Contract | Hybrid RAG for Encompass | 0–10 |
| 1 | Stores | ICE · Dev Connect docs | 10–20 |
| 2 | Ingest | Repos · Postman · docs | 20–30 |
| 3 | Build | Normalize · hash · embed | 30–40 |
| 4 | Vectors | 1536-d · HNSW cosine | 40–50 |
| 5 | Search | Promise.all · merge · boost | 50–60 |
| 6 | Consumers | Assistant · Unit Tests AI | 60–71 |
| 7 | Ops | refresh:encompass-knowledge | 71–90 |

---

## Narration (TTS)

Exact strings live in `video/ice-rag/make-narration.mjs`. Spoken copy covers:

1. Dual stores; keyword always-on; pgvector optional; retrieval not execution  
2. `ice-knowledge.service` / `encompass-docs.service` + chunk tables  
3. `knowledge-sources/ice/` layout; scrape merge semantics  
4. `build:ice-knowledge` / `scrape:encompass-docs`; `content_hash` upserts  
5. `text-embedding-3-small`, `vector(1536)`, HNSW, `<=>` distance  
6. Parallel hybrid merge; vector +5 boost; keyword fallback  
7. Controllers; `executionAllowed=false`  
8. Combined refresh; SKIP_EMBED flags; GraphRAG ≠ live `/near`

---

## Produce (audio is mandatory)

`npm run render` in `video/ice-rag` **refuses** to run unless every narration MP3 exists and is audible (`ensure-audio`). Prefer the one-shot publish from repo root:

```bash
# TTS needs the app running
npm start

# another shell — narrate → ensure audio → render → publish → verify MP4 audio
npm run publish:ice-rag-reel
```

Manual:

```bash
cd video/ice-rag
npm run narration
npm run ensure-audio
npm run render
```

Preview: `cd video/ice-rag && npm run dev`

---

## Accuracy checklist

- [ ] Keyword fallback stated as always-on  
- [ ] Vector path requires `DATABASE_URL` + `OPENAI_API_KEY` + pgvector  
- [ ] `executionAllowed=false` / no live ICE execution from RAG  
- [ ] GraphRAG called out as sibling, not `GET /api/disasters/near`  
- [ ] Real paths: `ice_knowledge_chunks`, `encompass_docs_chunks`, `embedding-utils`
