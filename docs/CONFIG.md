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

## Music & Media

| Variable | Purpose |
|----------|---------|
| `SPOTIFY_CLIENT_ID` | Spotify OAuth client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify OAuth client secret |
| `SPOTIFY_REDIRECT_URI` | OAuth callback URL |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Google Cloud credentials JSON |
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project ID |
| `SHAZAM_API_KEY` | Shazam/RapidAPI song identification |
| `SETLISTFM_API_KEY` | Setlist.fm API |

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
