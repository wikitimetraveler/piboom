/**
 * Development work by David Lane
 *
 * Thin HTTP layer for allowlisted Enhanced Conditions ICE APIs.
 */
import { encompassEnvStorage } from '../services/encompass-auth.service.js';
import {
  invokeCatalogOperation,
  listCatalog,
} from '../services/encompass-live-api.service.js';

export function encompassEnvMiddleware(req, res, next) {
  const raw = (req.headers['x-encompass-env'] || '').toString().toLowerCase().trim();
  const env = raw === 'retail' ? 'retail' : 'correspondent';
  encompassEnvStorage.run({ env }, () => next());
}

function sendError(res, error, fallback) {
  const status = error.statusCode || error.response?.status || 500;
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const upstream = error.upstream || error.response?.data || null;
  console.error(fallback, error.message, upstream ? { upstream } : '');
  return res.status(safeStatus).json({
    error: fallback,
    details: error.message,
    upstream: upstream
      ? {
          summary: upstream.summary,
          details: upstream.details,
          errors: upstream.errors,
          message: upstream.message,
        }
      : null,
  });
}

export function getCatalogHandler(domain) {
  return function getCatalog(req, res) {
    try {
      return res.json({
        domain,
        operations: listCatalog(domain),
      });
    } catch (error) {
      return sendError(res, error, 'Failed to load live API catalog');
    }
  };
}

export function postInvokeHandler(domain) {
  return async function postInvoke(req, res) {
    try {
      const { operationId, pathParams, query, body } = req.body || {};
      if (!operationId || typeof operationId !== 'string') {
        return res.status(400).json({ error: 'Request body must include operationId' });
      }
      if (pathParams != null && (typeof pathParams !== 'object' || Array.isArray(pathParams))) {
        return res.status(400).json({ error: 'pathParams must be an object' });
      }
      if (query != null && (typeof query !== 'object' || Array.isArray(query))) {
        return res.status(400).json({ error: 'query must be an object' });
      }
      const result = await invokeCatalogOperation(domain, { operationId, pathParams, query, body });
      return res.status(result.status >= 100 && result.status < 600 ? result.status : 502).json(result);
    } catch (error) {
      return sendError(res, error, 'Failed to invoke Encompass live API');
    }
  };
}

/**
 * REST convenience wrapper around a catalog operation.
 * @param {'conditions'} domain
 * @param {string} operationId
 * @param {Record<string, string>} [paramMap] route param → ICE path param
 */
export function restPatchByAction(domain, actionMap, paramMap = {}) {
  return async function handlePatchByAction(req, res) {
    const action = String(req.query?.action || 'update').trim();
    const operationId = actionMap[action];
    if (!operationId) {
      return res.status(400).json({
        error: `Unknown action "${action}". Use one of: ${Object.keys(actionMap).join(', ')}`,
      });
    }
    return restHandler(domain, operationId, paramMap)(req, res);
  };
}

export function restHandler(domain, operationId, paramMap = {}) {
  return async function handleRest(req, res) {
    try {
      const pathParams = {};
      Object.entries(paramMap).forEach(([routeKey, iceKey]) => {
        if (req.params[routeKey] != null) pathParams[iceKey] = req.params[routeKey];
      });
      const result = await invokeCatalogOperation(domain, {
        operationId,
        pathParams,
        query: req.query,
        body: req.body,
      });
      const status = result.status >= 100 && result.status < 600 ? result.status : 502;
      if (result.data === undefined || result.data === null || result.data === '') {
        return res.status(status).json({ ok: result.ok, status, operationId, icePath: result.icePath });
      }
      return res.status(status).json(result.data);
    } catch (error) {
      return sendError(res, error, 'Failed to call Encompass live API');
    }
  };
}
