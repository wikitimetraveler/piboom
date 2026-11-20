# US Disaster Daily Briefing MCP

stdio MCP server that scours live US disaster feeds and consolidates a **daily briefing** for Cursor agents.

## Sources

| Source | Feed |
|--------|------|
| FEMA | Disaster declarations (configurable lookback, default 7 days) |
| NWS | Active CAP weather alerts |
| NHC | Hurricane / tropical alerts (filtered from NWS) |
| USGS | Past-day earthquakes (US coordinates, default mag ≥ 2.5) |
| FIRMS | NASA VIIRS wildfire detections (public feed, or `MAP_KEY` / `NASA_API_KEY`) |

## Tools

| Tool | Purpose |
|------|---------|
| `us_disaster_daily_briefing` | Full markdown + structured highlights |
| `us_disaster_sources_live` | Raw per-source payloads for drill-down |
| `us_disaster_refresh_and_brief` | Hub refresh + briefing (needs running Express app) |

## Run locally

```bash
npm run mcp:disaster-briefing
```

Optional — proxy through the Express API instead of live fetches in-process:

```bash
# terminal 1
npm run dev

# terminal 2 — MCP uses hub endpoint when set
set MCP_HUB_BASE_URL=http://localhost:3000
npm run mcp:disaster-briefing
```

## Cursor MCP config

This repo ships a workspace MCP config at [`.cursor/mcp.json`](../../.cursor/mcp.json) that registers both:

| Server | Script | Needs `npm run dev`? |
|--------|--------|----------------------|
| `disaster-briefing` | `mcp/disaster-briefing/server.mjs` | No (live feeds in-process). Set `MCP_HUB_BASE_URL` only for `us_disaster_refresh_and_brief`. |
| `devconnect-encompass` | `mcp/devconnect-encompass/server.mjs` | Yes — proxies to `http://localhost:3000` |

After opening the project, check **Cursor Settings → Tools & MCP** for green status (refresh if needed). Then ask the agent in natural language, for example:

- “Run the US disaster daily briefing for the last 7 days”
- “Check Encompass Hub status and list the first 10 loans in the pipeline”

Committed config (no secrets; optional FIRMS key can be added under `env` if you have one):

```json
{
  "mcpServers": {
    "disaster-briefing": {
      "command": "node",
      "args": ["mcp/disaster-briefing/server.mjs"]
    },
    "devconnect-encompass": {
      "command": "node",
      "args": ["mcp/devconnect-encompass/server.mjs"],
      "env": {
        "MCP_HUB_BASE_URL": "http://localhost:3000",
        "MCP_ENCOMPASS_ENV": "correspondent"
      }
    }
  }
}
```

Optional — add `"MAP_KEY": "your-nasa-firms-key"` under `disaster-briefing.env` for authenticated FIRMS. These MCP processes run locally via Cursor stdio only; they do not add Render cost.

## HTTP API (same briefing)

```
GET /api/disasters/daily-briefing
GET /api/disasters/daily-briefing?days=7&minMagnitude=3&includeFirms=true
```

Returns `{ success, data: { briefingMarkdown, highlights, summary, sources, ... } }`.
