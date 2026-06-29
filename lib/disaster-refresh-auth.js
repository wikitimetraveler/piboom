const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function getBearerToken(req) {
  const auth = String(req.headers.authorization || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
}

export function getDisasterRefreshRequestIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (forwardedFor || req.ip || '').replace(/^::ffff:/, '');
}

export function isLocalDisasterRefreshRequest(req) {
  return LOCALHOST_IPS.has(getDisasterRefreshRequestIp(req));
}

/**
 * Gate POST /api/disasters/refresh and /refresh-cameras.
 * Localhost when no token configured; otherwise Bearer or x-disaster-refresh-token.
 */
export function requireDisasterRefreshAccess(req, res, next) {
  const configuredToken = String(process.env.DISASTER_REFRESH_TOKEN || '').trim();
  const providedToken = String(req.headers['x-disaster-refresh-token'] || getBearerToken(req) || '').trim();
  const role = String(req.headers['x-user-role'] || '').toLowerCase().trim();

  if (configuredToken) {
    if (!providedToken || providedToken !== configuredToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized refresh token' });
    }
    if (role && role !== 'admin' && role !== 'ops') {
      return res.status(403).json({ success: false, error: 'Insufficient role for disaster refresh' });
    }
    return next();
  }

  if (!isLocalDisasterRefreshRequest(req)) {
    return res.status(403).json({
      success: false,
      error: 'Refresh endpoints require localhost access or DISASTER_REFRESH_TOKEN',
    });
  }

  return next();
}
