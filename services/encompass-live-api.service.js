/**
 * Development work by David Lane
 *
 * Allowlisted proxy to ICE Developer Connect for Enhanced Conditions.
 * Callers pick a catalog operation; this service never accepts an arbitrary URL.
 */
import axios from 'axios';
import { clearEncompassTokenCache, ensureEncompassToken } from './encompass-auth.service.js';
import { CATALOGS, findOperation, getCatalog } from './encompass-live-api.catalog.js';

const API_BASE_URL = process.env.ENCOMPASS_API_BASE || 'https://concept.api.elliemae.com/encompass/v1';
const API_SERVER = API_BASE_URL.replace(/\/encompass\/v\d+\/?$/i, '');
const ENCOMPASS_AXIOS_TIMEOUT_MS = Number(process.env.ENCOMPASS_AXIOS_TIMEOUT_MS || 120000);
const ALLOWED_PREFIXES = ['/encompass/v3/', '/secondary/v1/', '/webhook/v1/'];

export { CATALOGS, findOperation, getCatalog };

export function getApiServer() {
  return API_SERVER;
}

export function listCatalog(domain) {
  const catalog = getCatalog(domain);
  if (!catalog) {
    const err = new Error(`Unknown live API domain: ${domain}`);
    err.statusCode = 404;
    throw err;
  }
  return catalog.map((op) => ({
    id: op.id,
    group: op.group,
    name: op.name,
    action: op.action,
    method: op.method,
    path: op.path,
    pathParams: op.pathParams || [],
    queryKeys: op.queryKeys || [],
    defaultQuery: op.defaultQuery || {},
    sampleBody: op.sampleBody,
    notes: op.notes || '',
    destructive: Boolean(op.destructive),
    idParam: op.idParam || null,
  }));
}

export function assertSafePathParam(name, value) {
  const s = String(value ?? '').trim();
  if (!s) {
    const err = new Error(`Missing path parameter: ${name}`);
    err.statusCode = 400;
    throw err;
  }
  if (s.length > 200 || /[\/\\?#\s]/.test(s) || s.includes('..')) {
    const err = new Error(`Invalid path parameter: ${name}`);
    err.statusCode = 400;
    throw err;
  }
  return s;
}

export function substitutePath(template, pathParams = {}) {
  const params = pathParams && typeof pathParams === 'object' ? pathParams : {};
  const used = new Set();
  const icePath = String(template).replace(/\{([^}]+)\}/g, (_, name) => {
    used.add(name);
    return encodeURIComponent(assertSafePathParam(name, params[name]));
  });
  if (icePath.includes('{') || icePath.includes('}')) {
    const err = new Error('Unresolved path parameter in ICE path');
    err.statusCode = 400;
    throw err;
  }
  if (!ALLOWED_PREFIXES.some((prefix) => icePath.startsWith(prefix))) {
    const err = new Error('ICE path is not in the allowlist');
    err.statusCode = 400;
    throw err;
  }
  return { icePath, usedParams: [...used] };
}

export function pickQuery(operation, query = {}) {
  const allowed = new Set(operation.queryKeys || []);
  const merged = { ...(operation.defaultQuery || {}) };
  const incoming = query && typeof query === 'object' ? query : {};
  Object.entries(incoming).forEach(([key, value]) => {
    if (!allowed.has(key)) return;
    if (value == null || value === '') return;
    merged[key] = String(value);
  });
  return merged;
}

export function buildUpstreamUrl(icePath, query = {}) {
  const url = new URL(icePath, `${API_SERVER}/`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value == null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function wrapUpstreamError(error, label) {
  const status = error.statusCode || error.response?.status || 502;
  const data = error.upstream || error.response?.data;
  const detail =
    (typeof data === 'string' && data) ||
    data?.details ||
    data?.message ||
    data?.error ||
    error.message;
  const err = new Error(`${label}: ${detail}`);
  err.statusCode = status >= 400 && status < 600 ? status : 502;
  err.upstream = data;
  return err;
}

export async function encompassJsonRequest(config) {
  const token = await ensureEncompassToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(config.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  const requestConfig = {
    ...config,
    headers,
    timeout: config.timeout != null ? config.timeout : ENCOMPASS_AXIOS_TIMEOUT_MS,
    validateStatus: () => true,
  };

  let response;
  try {
    response = await axios(requestConfig);
  } catch (error) {
    throw wrapUpstreamError(error, 'Encompass request failed');
  }

  if (response.status === 401) {
    clearEncompassTokenCache();
    const refreshed = await ensureEncompassToken();
    requestConfig.headers = { ...headers, Authorization: `Bearer ${refreshed}` };
    try {
      response = await axios(requestConfig);
    } catch (error) {
      throw wrapUpstreamError(error, 'Encompass request failed');
    }
  }

  return {
    status: response.status,
    data: response.data,
    headers: response.headers,
  };
}

/**
 * @param {'conditions'} domain
 * @param {{ operationId: string, pathParams?: object, query?: object, body?: unknown }} payload
 * @param {{ request?: Function }} [deps]
 */
export async function invokeCatalogOperation(domain, payload = {}, deps = {}) {
  const operationId = String(payload.operationId || '').trim();
  if (!operationId) {
    const err = new Error('operationId is required');
    err.statusCode = 400;
    throw err;
  }

  const operation = findOperation(domain, operationId);
  if (!operation) {
    const err = new Error(`Unknown operation: ${operationId}`);
    err.statusCode = 404;
    throw err;
  }

  const { icePath } = substitutePath(operation.path, payload.pathParams);
  const query = pickQuery(operation, payload.query);
  const url = buildUpstreamUrl(icePath, query);
  const method = operation.method.toLowerCase();
  const request = deps.request || encompassJsonRequest;

  const config = { method, url };
  if (method !== 'get' && method !== 'head' && payload.body !== undefined) {
    config.data = payload.body;
  }

  let result;
  try {
    result = await request(config);
  } catch (error) {
    throw wrapUpstreamError(error, `ICE ${operation.method} ${icePath}`);
  }

  return {
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    operationId: operation.id,
    method: operation.method,
    icePath,
    query,
    data: result.data,
    location: result.headers?.location || result.headers?.Location || null,
  };
}

export default {
  listCatalog,
  invokeCatalogOperation,
  findOperation,
  getCatalog,
  assertSafePathParam,
  substitutePath,
  pickQuery,
  buildUpstreamUrl,
};
