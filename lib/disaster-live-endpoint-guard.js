/**
 * In-memory cache + per-IP rate limits for live disaster briefing/crawl endpoints.
 */

const ENDPOINT_CONFIG = {
  'daily-briefing': { maxPerWindow: 12, windowMs: 60_000, cacheTtlMs: 10 * 60_000 },
  'web-crawl': { maxPerWindow: 8, windowMs: 60_000, cacheTtlMs: 10 * 60_000 },
};

const responseCache = new Map();
const rateBuckets = new Map();

export function getRequestIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (forwarded || req.ip || 'unknown').replace(/^::ffff:/, '');
}

export function buildDisasterLiveCacheKey(endpoint, params = {}) {
  const parts = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`);
  return `${endpoint}?${parts.join('&')}`;
}

export function checkDisasterLiveRateLimit(ip, endpoint) {
  const cfg = ENDPOINT_CONFIG[endpoint];
  if (!cfg) return { ok: true };

  const bucketKey = `${ip}:${endpoint}`;
  const now = Date.now();
  let bucket = rateBuckets.get(bucketKey);

  if (!bucket || now - bucket.windowStart >= cfg.windowMs) {
    bucket = { windowStart: now, count: 0 };
  }

  bucket.count += 1;
  rateBuckets.set(bucketKey, bucket);

  if (bucket.count > cfg.maxPerWindow) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((bucket.windowStart + cfg.windowMs - now) / 1000)
    );
    return { ok: false, retryAfterSec };
  }

  return { ok: true };
}

export function getDisasterLiveCache(endpoint, cacheKey) {
  const cfg = ENDPOINT_CONFIG[endpoint];
  if (!cfg) return null;

  const fullKey = `${endpoint}:${cacheKey}`;
  const entry = responseCache.get(fullKey);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    responseCache.delete(fullKey);
    return null;
  }

  return entry.data;
}

export function setDisasterLiveCache(endpoint, cacheKey, data) {
  const cfg = ENDPOINT_CONFIG[endpoint];
  if (!cfg) return;

  const fullKey = `${endpoint}:${cacheKey}`;
  responseCache.set(fullKey, {
    data,
    expiresAt: Date.now() + cfg.cacheTtlMs,
  });
}

/** @internal test helper */
export function resetDisasterLiveEndpointGuard() {
  responseCache.clear();
  rateBuckets.clear();
}
