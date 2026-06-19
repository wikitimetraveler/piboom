#!/usr/bin/env node
/**
 * DevConnect Labs — US Disaster Daily Briefing MCP (stdio).
 *
 * Fetches live public feeds (FEMA, NWS, USGS, NHC, FIRMS) and consolidates
 * a daily awareness briefing. Optionally proxies to a running Express app.
 *
 * Env:
 *   MCP_HUB_BASE_URL — if set, prefer GET /api/disasters/daily-briefing from the hub
 *   MAP_KEY / NASA_API_KEY — optional NASA FIRMS key for wildfire detections
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod';
import { buildDailyBriefing, collectLiveDisasterAwareness } from '../../services/disaster-daily-briefing.service.js';
import { crawlDisasterWeb } from '../../services/disaster-web-crawler.service.js';

const BASE = (process.env.MCP_HUB_BASE_URL || '').replace(/\/$/, '');

async function hubFetch(path) {
  const url = `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'DevConnectLabs-DisasterBriefingMCP/1.0' },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.details || data?.error || text || res.statusText;
    throw new Error(`Hub ${res.status}: ${msg}`);
  }
  return data;
}

function textResult(obj) {
  const text = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  return { content: [{ type: 'text', text }] };
}

async function getBriefing(options = {}) {
  if (BASE) {
    const params = new URLSearchParams();
    if (options.days != null) params.set('days', String(options.days));
    if (options.minMagnitude != null) params.set('minMagnitude', String(options.minMagnitude));
    if (options.includeFirms === false) params.set('includeFirms', 'false');
    if (options.includeWebCrawl) params.set('includeWebCrawl', 'true');
    const qs = params.toString();
    const payload = await hubFetch(`/api/disasters/daily-briefing${qs ? `?${qs}` : ''}`);
    return payload?.data ?? payload;
  }
  return buildDailyBriefing(options);
}

const mcpServer = new McpServer({
  name: 'devconnect-disaster-briefing',
  version: '1.0.0',
});

mcpServer.registerTool(
  'us_disaster_daily_briefing',
  {
    description:
      'Consolidated US disaster awareness daily briefing from FEMA, NWS, USGS, NHC, and FIRMS. Returns markdown plus structured highlights.',
    inputSchema: z.object({
      days: z.number().int().min(1).max(30).optional().describe('FEMA lookback window in days (default 7)'),
      minMagnitude: z.number().min(0).max(10).optional().describe('Minimum USGS earthquake magnitude (default 2.5)'),
      includeFirms: z.boolean().optional().describe('Include NASA FIRMS wildfire detections (default true)'),
      includeWebCrawl: z.boolean().optional().describe('Include allowlisted RSS/Atom web crawl headlines (default false)'),
      format: z.enum(['markdown', 'json', 'both']).optional().describe('Response format (default both)'),
    }),
  },
  async ({ days, minMagnitude, includeFirms, includeWebCrawl, format = 'both' }) => {
    const data = await getBriefing({ days, minMagnitude, includeFirms, includeWebCrawl });
    if (format === 'markdown') return textResult(data.briefingMarkdown || '');
    if (format === 'json') {
      const { briefingMarkdown, ...rest } = data;
      return textResult(rest);
    }
    return textResult({
      briefingMarkdown: data.briefingMarkdown,
      generatedAt: data.generatedAt,
      summary: data.summary,
      highlights: data.highlights,
    });
  },
);

mcpServer.registerTool(
  'us_disaster_sources_live',
  {
    description:
      'Fetch live US disaster source payloads without markdown narrative. Useful for drilling into NWS, FEMA, USGS, NHC, or FIRMS items.',
    inputSchema: z.object({
      days: z.number().int().min(1).max(30).optional(),
      minMagnitude: z.number().min(0).max(10).optional(),
      includeFirms: z.boolean().optional(),
      source: z
        .enum(['all', 'nws', 'nhc', 'usgs', 'fema', 'firms'])
        .optional()
        .describe('Filter to one source (default all)'),
      limit: z.number().int().min(1).max(100).optional().describe('Max items per source (default 25)'),
    }),
  },
  async ({ days, minMagnitude, includeFirms, source = 'all', limit = 25 }) => {
    const data = await collectLiveDisasterAwareness({ days, minMagnitude, includeFirms });
    const slice = (items) => (Array.isArray(items) ? items.slice(0, limit) : []);

    if (source === 'all') {
      const trimmed = Object.fromEntries(
        Object.entries(data.sources).map(([key, items]) => [key, slice(items)]),
      );
      return textResult({ generatedAt: data.generatedAt, summary: data.summary, sources: trimmed });
    }

    return textResult({
      generatedAt: data.generatedAt,
      source,
      count: data.sources[source]?.length || 0,
      items: slice(data.sources[source] || []),
      status: data.summary.sourceStatus.find((s) => s.source === source) || null,
    });
  },
);

mcpServer.registerTool(
  'us_disaster_web_crawl',
  {
    description:
      'Crawl allowlisted disaster web feeds (RSS/Atom from .gov sources; optional newspaper RSS if configured in data/disaster-crawl-feeds.json). No paywall HTML scraping.',
    inputSchema: z.object({
      maxAgeHours: z.number().int().min(1).max(168).optional().describe('Max article age in hours (default 72)'),
      feedIds: z.array(z.string()).optional().describe('Optional subset of feed ids from disaster-crawl-feeds.json'),
      includeGdelt: z.boolean().optional().describe('Include GDELT DOC US disaster news (default true; 5s rate limit)'),
      limit: z.number().int().min(1).max(100).optional().describe('Max items returned (default 30)'),
    }),
  },
  async ({ maxAgeHours, feedIds, includeGdelt, limit = 30 }) => {
    const data = await crawlDisasterWeb({ maxAgeHours, feedIds, includeGdelt });
    return textResult({
      generatedAt: data.generatedAt,
      policy: data.policy,
      summary: data.summary,
      items: data.items.slice(0, limit),
    });
  },
);

mcpServer.registerTool(
  'us_disaster_refresh_and_brief',
  {
    description:
      'Refresh stored disaster data in the DevConnect hub (POST /api/disasters/refresh) then return the daily briefing. Requires MCP_HUB_BASE_URL and disaster refresh access on the server.',
    inputSchema: z.object({
      days: z.number().int().min(1).max(30).optional(),
      skipFema: z.boolean().optional().describe('Skip FEMA ingest on refresh'),
    }),
  },
  async ({ days, skipFema }) => {
    if (!BASE) {
      throw new Error('MCP_HUB_BASE_URL is required for refresh_and_brief (e.g. http://localhost:3000)');
    }
    const refreshQs = skipFema ? '?skipFema=1' : '';
    const refreshRes = await fetch(`${BASE}/api/disasters/refresh${refreshQs}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DevConnectLabs-DisasterBriefingMCP/1.0',
        ...(process.env.DISASTER_REFRESH_TOKEN
          ? { Authorization: `Bearer ${process.env.DISASTER_REFRESH_TOKEN}` }
          : {}),
      },
    });
    const refreshText = await refreshRes.text();
    let refreshData;
    try {
      refreshData = refreshText ? JSON.parse(refreshText) : null;
    } catch {
      refreshData = { raw: refreshText };
    }
    if (!refreshRes.ok) {
      throw new Error(`Refresh failed ${refreshRes.status}: ${refreshData?.error || refreshText}`);
    }

    const briefing = await getBriefing({ days });
    return textResult({ refresh: refreshData, briefing });
  },
);

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
