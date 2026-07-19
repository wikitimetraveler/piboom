/**
 * Development work by David Lane
 *
 * Access gate for the Encompass docs scrape endpoint
 * (POST /api/encompass-assistant/scrape).
 *
 * Mirrors lib/disaster-refresh-auth.js: allow localhost when no token is
 * configured, otherwise require a matching token (and an admin/ops role when
 * a role header is present).
 */
const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function getBearerToken(req) {
  const auth = String(req.headers.authorization || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
}

export function getEncompassDocsRefreshRequestIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (forwardedFor || req.ip || '').replace(/^::ffff:/, '');
}

export function isLocalEncompassDocsRefreshRequest(req) {
  return LOCALHOST_IPS.has(getEncompassDocsRefreshRequestIp(req));
}

/**
 * Gate POST /api/encompass-assistant/scrape.
 * Localhost when no token configured; otherwise Bearer or
 * x-encompass-docs-scrape-token, optionally scoped to admin/ops role.
 */
export function requireEncompassDocsScrapeAccess(req, res, next) {
  const configuredToken = String(process.env.ENCOMPASS_DOCS_SCRAPE_TOKEN || '').trim();
  const providedToken = String(
    req.headers['x-encompass-docs-scrape-token'] || getBearerToken(req) || ''
  ).trim();
  const role = String(req.headers['x-user-role'] || '').toLowerCase().trim();

  if (configuredToken) {
    if (!providedToken || providedToken !== configuredToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized scrape token' });
    }
    if (role && role !== 'admin' && role !== 'ops') {
      return res.status(403).json({ success: false, error: 'Insufficient role for docs scrape' });
    }
    return next();
  }

  if (!isLocalEncompassDocsRefreshRequest(req)) {
    return res.status(403).json({
      success: false,
      error: 'Scrape endpoint requires localhost access or ENCOMPASS_DOCS_SCRAPE_TOKEN',
    });
  }

  return next();
}
