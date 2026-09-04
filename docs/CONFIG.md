# Configuration & Environment

Central reference for environment variables used by DevConnect Labs. **Never commit secrets.** Use `.env` locally and configure secrets in your deployment provider (e.g. Render).

## Required (Core)

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default 3000) |
| `NODE_ENV` | `development` or `production` |
| `DATABASE_URL` | PostgreSQL connection string (LangChain memory, disasters, loan pipeline, processor assignment tool config, unit test file library, etc.) |
| `OPENAI_API_KEY` | OpenAI API key (Encompass Assistant, Screen Test, Loan Pipeline AI, etc.) |

## Encompass / ICE

| Variable | Purpose |
|----------|---------|
| `ENCOMPASS_CLIENT_ID` | Encompass API client ID |
| `ENCOMPASS_CLIENT_SECRET` | Encompass API client secret |
| `ENCOMPASS_USERNAME` | `user.id@encompass:tebexxxxxxx` |
| `ENCOMPASS_PASSWORD` | Encompass password |
| `ENCOMPASS_AUTH_URL` | OAuth token URL (default: `https://concept.api.elliemae.com/oauth2/v1/token`) |
| `ENCOMPASS_API_BASE` | API base URL (default: `https://concept.api.elliemae.com/encompass/v1`) |
| `ENCOMPASS_WEBHOOK_SIGNING_KEY` | Webhook signature verification |
| `ENCOMPASS_DOCS_SCRAPE_TOKEN` | Bearer / `x-encompass-docs-scrape-token` for hosted `POST /api/encompass-assistant/scrape` (localhost open when unset) |
| `ENCOMPASS_DOCS_SCRAPE_DELAY_MS` | Throttle between Developer Connect scrape requests (default 1200ms) |
| `ENCOMPASS_EMBEDDING_MODEL` | Embedding model for hybrid vector RAG (default `text-embedding-3-small`) |
| `ENCOMPASS_DOCS_SKIP_EMBED` / `ICE_SKIP_EMBED` | `1` = build JSON index only, skip pgvector embeddings |
| `GRAPH_EMBED_FORCE` | `1` = re-embed all disaster-graph nodes (`npm run embed:graph-nodes`) |

Hybrid vector RAG + GraphRAG details: `docs/VECTOR_RAG.md`.

## Geocoding & Maps

| Variable | Purpose |
|----------|---------|
| `GOOGLE_API_KEY` | General Google APIs; also fallback for browser Maps if `GOOGLE_BROWSER_API_KEY` is unset |
| `GOOGLE_BROWSER_API_KEY` | Referrer-restricted key for **Google Maps JavaScript API** on public pages (recommended for `/family/` Lane maps) |
| `MAPBOX_ACCESS_TOKEN` / `MAPBOX_API_KEY` / `MAP_KEY` | **Server-side** geocoding in `free-geocoding.service.js` (not required for drawing Google Maps if you only need the map canvas) |

## Disaster & Risk

| Variable | Purpose |
|----------|---------|
| `NASA_API_KEY` | NASA FIRMS fire data (active fires) |

Home WebGPU NASA globe textures (optional local assets): run `npm run fetch:nasa-blue-marble` to download public-domain Blue Marble + city lights + LRO Moon color map into `public/shared/textures/earth/` and `public/shared/textures/moon/` (2048×1024). No API key. If missing, compute globes fall back to procedural surfaces. Live FIRMS points on Earth still use `NASA_API_KEY` + the disasters DB.

## Music & Media

| Variable | Purpose |
|----------|---------|
| `SPOTIFY_CLIENT_ID` | Spotify OAuth client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify OAuth client secret |
| `SPOTIFY_REDIRECT_URI` | OAuth callback URL |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Google Cloud credentials JSON (local) |
| `GOOGLE_CREDENTIALS_JSON` | Full service-account JSON string (preferred on Render — fixes missing `/google-credentials.json`) |
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project ID |
| `SHAZAM_API_KEY` | Shazam/RapidAPI song identification |
| `SETLISTFM_API_KEY` | Setlist.fm API |
| `LIVEKIT_URL` | LiveKit WebSocket URL — self-hosted (`wss://livekit.thelanefamily.us`) or Cloud (`wss://…livekit.cloud`). Setup: [`docs/LIVEKIT_VM.md`](LIVEKIT_VM.md) |
| `LIVEKIT_API_KEY` | LiveKit API key (server-only; mints room tokens) |
| `LIVEKIT_API_SECRET` | LiveKit API secret (server-only) |
| `LIVEKIT_AGENT_NAME` | Python worker dispatch name (`StarBand` default, or `WolfmanDave`) |
| `LIVEKIT_EGRESS_S3_BUCKET` | Optional S3 bucket for audio-only room egress |
| `LIVEKIT_EGRESS_S3_ACCESS_KEY` | Optional S3 access key for egress (falls back to `AWS_ACCESS_KEY_ID`) |
| `LIVEKIT_EGRESS_S3_SECRET` | Optional S3 secret for egress (falls back to `AWS_SECRET_ACCESS_KEY`) |
| `LIVEKIT_EGRESS_S3_REGION` | Optional S3 region |
| `HEYGEN_STREAMING_AVATAR_ID` | HeyGen Avatar Realtime look id for live face tiles (Studio, planetarium Zed, Mountain High Sage). **Default:** [`data/studio-heygen-face.json`](../data/studio-heygen-face.json) (Zed). Env overrides the catalog when set. |
| `HEYGEN_STREAMING_VOICE_ID` | HeyGen voice for Avatar Realtime text streams. Catalog `voiceId` is used when env is unset. Populate via `npm run create:zed-heygen-avatar`. |
| `STUDIO_LISTEN_PASSWORD` | Listening-room password (default `reel1`) |

## Misc

| Variable | Purpose |
|----------|---------|
| `MUSIC_DIR` | Local music directory |
| `DEFAULT_VOLUME` | Default volume (0–100) |
| `MODE` | Application mode |
| `RENDER_EXTERNAL_URL` | External URL when deployed on Render (Spotify callback, etc.) |

## .env Template

Create `.env` from `.env.example` if present, or add variables as needed. Ensure `.env` is in `.gitignore`.

## Related

- **docs/DATABASE_SETUP.md** – Database setup
- **docs/ENCOMPASS.md** – Encompass auth and API
