#!/usr/bin/env node
/**
 * DevConnect Labs — Encompass Hub MCP (stdio).
 * Proxies to a running Express app: npm run dev (default http://localhost:3000).
 *
 * Env:
 *   MCP_HUB_BASE_URL  — base URL (default http://localhost:3000)
 *   MCP_ENCOMPASS_ENV — default X-Encompass-Env: correspondent | retail
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod';

const BASE = (process.env.MCP_HUB_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const DEFAULT_ENV = process.env.MCP_ENCOMPASS_ENV === 'retail' ? 'retail' : 'correspondent';

async function hubFetch(path, { method = 'GET', headers = {}, body } = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const h = {
    Accept: 'application/json',
    'X-Encompass-Env': DEFAULT_ENV,
    ...headers,
  };
  const init = { method, headers: h };
  if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.details || data?.error || data?.message || text || res.statusText;
    throw new Error(`Hub ${res.status}: ${msg}`);
  }
  return data;
}

function textResult(obj) {
  const text = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  return { content: [{ type: 'text', text }] };
}

const mcpServer = new McpServer({
  name: 'devconnect-encompass-hub',
  version: '1.0.0',
});

mcpServer.registerTool(
  'encompass_hub_status',
  {
    description: 'Check Encompass Hub connectivity and OAuth token status (GET /api/encompass-hub/status).',
    inputSchema: z.object({
      encompassEnv: z.enum(['correspondent', 'retail']).optional().describe('Override X-Encompass-Env for this call'),
    }),
  },
  async ({ encompassEnv }) => {
    const env = encompassEnv || DEFAULT_ENV;
    const data = await hubFetch('/api/encompass-hub/status', {
      headers: { 'X-Encompass-Env': env },
    });
    return textResult(data);
  },
);

mcpServer.registerTool(
  'encompass_pipeline_list',
  {
    description: 'List loans from Encompass pipeline (GET /api/encompass-hub/pipeline).',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).optional().describe('Max loans (default 25)'),
      state: z.string().optional(),
      loanFolder: z.string().optional(),
      encompassEnv: z.enum(['correspondent', 'retail']).optional(),
    }),
  },
  async ({ limit, state, loanFolder, encompassEnv }) => {
    const env = encompassEnv || DEFAULT_ENV;
    const params = new URLSearchParams();
    if (limit != null) params.set('limit', String(limit));
    else params.set('limit', '25');
    if (state) params.set('state', state);
    if (loanFolder) params.set('loanFolder', loanFolder);
    const data = await hubFetch(`/api/encompass-hub/pipeline?${params}`, {
      headers: { 'X-Encompass-Env': env },
    });
    return textResult(data);
  },
);

mcpServer.registerTool(
  'encompass_loan_get',
  {
    description: 'Get full loan details from Encompass v1 (GET /api/encompass-hub/loans/{loanGuid}).',
    inputSchema: z.object({
      loanGuid: z.string().min(1).describe('Loan GUID'),
      encompassEnv: z.enum(['correspondent', 'retail']).optional(),
    }),
  },
  async ({ loanGuid, encompassEnv }) => {
    const env = encompassEnv || DEFAULT_ENV;
    const data = await hubFetch(`/api/encompass-hub/loans/${encodeURIComponent(loanGuid)}`, {
      headers: { 'X-Encompass-Env': env },
    });
    return textResult(data);
  },
);

mcpServer.registerTool(
  'encompass_loan_associates_list',
  {
    description:
      'List loan associate slots (Processor, LO, etc.) — GET /api/encompass-hub/loans/{loanGuid}/associates. Use logId from response for assign.',
    inputSchema: z.object({
      loanGuid: z.string().min(1),
      userId: z.string().optional(),
      roleId: z.string().optional(),
      fixedRoleId: z.string().optional(),
      encompassEnv: z.enum(['correspondent', 'retail']).optional(),
    }),
  },
  async ({ loanGuid, userId, roleId, fixedRoleId, encompassEnv }) => {
    const env = encompassEnv || DEFAULT_ENV;
    const q = new URLSearchParams();
    if (userId) q.set('userId', userId);
    if (roleId) q.set('roleId', roleId);
    if (fixedRoleId) q.set('fixedRoleId', fixedRoleId);
    const qs = q.toString();
    const path = `/api/encompass-hub/loans/${encodeURIComponent(loanGuid)}/associates${qs ? `?${qs}` : ''}`;
    const data = await hubFetch(path, { headers: { 'X-Encompass-Env': env } });
    return textResult(data);
  },
);

mcpServer.registerTool(
  'encompass_loan_associate_assign',
  {
    description:
      'Assign a user to a loan associate slot (PUT /api/encompass-hub/loans/{loanGuid}/associates/{logId}). Body: { id: userEntityId }.',
    inputSchema: z.object({
      loanGuid: z.string().min(1),
      logId: z.string().min(1).describe('Slot id from encompass_loan_associates_list'),
      userEntityId: z.string().min(1).describe('Encompass user entity id'),
      encompassEnv: z.enum(['correspondent', 'retail']).optional(),
    }),
  },
  async ({ loanGuid, logId, userEntityId, encompassEnv }) => {
    const env = encompassEnv || DEFAULT_ENV;
    const data = await hubFetch(
      `/api/encompass-hub/loans/${encodeURIComponent(loanGuid)}/associates/${encodeURIComponent(logId)}`,
      {
        method: 'PUT',
        headers: { 'X-Encompass-Env': env },
        body: { id: userEntityId },
      },
    );
    return textResult(data);
  },
);

mcpServer.registerTool(
  'encompass_company_users_search',
  {
    description: 'Search company users for processor picker (GET /api/encompass-hub/users).',
    inputSchema: z.object({
      search: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      encompassEnv: z.enum(['correspondent', 'retail']).optional(),
    }),
  },
  async ({ search, limit, encompassEnv }) => {
    const env = encompassEnv || DEFAULT_ENV;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('limit', String(limit ?? 50));
    const data = await hubFetch(`/api/encompass-hub/users?${params}`, {
      headers: { 'X-Encompass-Env': env },
    });
    return textResult(data);
  },
);

mcpServer.registerTool(
  'encompass_processor_assignment_run',
  {
    description:
      'Run processor assignment engine: rule/AI complexity, capacity, dry-run or apply (POST /api/encompass-hub/processor-assignment/run). Pass `request` as a JSON object matching the API body (dryRun, processors, complexityRules, pipelineFilters, roleConfig, complexityMode, etc.).',
    inputSchema: z.object({
      request: z
        .record(z.string(), z.unknown())
        .describe('Full JSON body for POST /processor-assignment/run'),
      encompassEnv: z.enum(['correspondent', 'retail']).optional(),
    }),
  },
  async ({ request, encompassEnv }) => {
    const env = encompassEnv || DEFAULT_ENV;
    const data = await hubFetch('/api/encompass-hub/processor-assignment/run', {
      method: 'POST',
      headers: { 'X-Encompass-Env': env },
      body: request,
    });
    return textResult(data);
  },
);

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
