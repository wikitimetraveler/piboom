# DevConnect Labs — HeyGen integration map

## Public surfaces

| Surface | Path |
|---------|------|
| Video hub | `/heygen-hub.html` |
| API expert (this RAG) | panel on hub → `POST /api/heygen-assistant/chat` |
| Disaster studio | `/finance/disasters-unified.html#duHeygenStudio` |
| Lane print / QR lines | `/family/lane-heygen-print.html`, `data/lane-heygen-lines.json` |

## Backend

| Piece | Path |
|-------|------|
| Thin routes | `routes/heygen.routes.js` |
| Video client | `services/heygen.service.js` |
| Library catalog | `services/heygen-library.service.js` |
| Expert RAG | `services/heygen-knowledge.service.js` |
| Expert controller | `controllers/heygen-assistant.controller.js` |
| Env | `HEYGEN_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL` |

## Generate vs ask

- **Generate video**: `POST /api/heygen/videos` (requires `HEYGEN_API_KEY`).
- **Ask API questions**: `POST /api/heygen-assistant/chat` (RAG + LangChain memory; retrieval only).

## Voice UX

Hub expert uses mic (Web Speech API) for input and `/shared/tts.js` (`speakWithGoogle`)
for spoken answers — same pattern as Encompass Assistant and Unit Tests AI.
