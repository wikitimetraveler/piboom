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

Add to **Cursor Settings → MCP** (or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "disaster-briefing": {
      "command": "node",
      "args": ["mcp/disaster-briefing/server.mjs"],
      "cwd": "C:/projects/piBoom",
      "env": {
        "MAP_KEY": "your-nasa-firms-key-optional"
      }
    }
  }
}
```

## HTTP API (same briefing)

```
GET /api/disasters/daily-briefing
GET /api/disasters/daily-briefing?days=7&minMagnitude=3&includeFirms=true
```

Returns `{ success, data: { briefingMarkdown, highlights, summary, sources, ... } }`.
