# Configuration & Environment

Central reference for environment variables used by piBoom. **Never commit secrets.** Use `.env` locally and configure secrets in your deployment provider (e.g. Render).

## Required (Core)

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default 3000) |
| `NODE_ENV` | `development` or `production` |
| `DATABASE_URL` | PostgreSQL connection string (LangChain memory, disasters, loan pipeline) |
| `OPENAI_API_KEY` | OpenAI API key (Encompass Assistant, Screen Test, Loan Pipeline AI, etc.) |

## Encompass / ICE

| Variable | Purpose |
|----------|---------|
| `ENCOMPASS_CLIENT_ID` | Encompass API client ID |
| `ENCOMPASS_CLIENT_SECRET` | Encompass API client secret |
| `ENCOMPASS_USERNAME` | `user.id@encompass:tebexxxxxxx` |
| `ENCOMPASS_PASSWORD` | Encompass password |
| `ENCOMPASS_AUTH_URL` | OAuth token URL (default: `https://api.elliemae.com/oauth2/v1/token`) |
| `ENCOMPASS_API_BASE` | API base URL (default: `https://api.elliemae.com/encompass/v1`) |
| `ENCOMPASS_WEBHOOK_SIGNING_KEY` | Webhook signature verification |

## Geocoding & Maps

| Variable | Purpose |
|----------|---------|
| `GOOGLE_API_KEY` | Google Maps API (geocoding, places, maps) |
| `MAP_KEY` | Alternative map/geocoding key (e.g. Mapbox) |

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
- **docs/DOCKER_DEPLOYMENT.md** – Deployment
- **docs/ENCOMPASS.md** – Encompass auth and API
