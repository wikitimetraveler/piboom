/**
 * Throttled Wikipedia / Wikidata HTTP for Music Research (honor 429 + Retry-After).
 */
import axios from 'axios';

export const WIKIMEDIA_USER_AGENT =
  process.env.WIKIMEDIA_USER_AGENT ||
  'DevConnectLabsMusicResearch/1.0 (https://github.com/wikitimetraveler/devconnect-labs; piBoom music-research)';

const WIKIMEDIA_MIN_INTERVAL_MS = 600;
const WIKIMEDIA_CACHE_TTL_MS = 60 * 60 * 1000;
const WIKIMEDIA_CACHE_MAX = 200;

let wikimediaNextSlot = 0;
const wikimediaCache = new Map();
const wikimediaCacheOrder = [];

export class WikimediaRateLimitError extends Error {
  constructor(message = 'Wikimedia rate limit exceeded') {
    super(message);
    this.name = 'WikimediaRateLimitError';
    this.rateLimited = true;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function wikimediaThrottle() {
  const now = Date.now();
  const wait = Math.max(0, wikimediaNextSlot - now);
  if (wait > 0) await sleep(wait);
}

function wikimediaBumpSchedule() {
  wikimediaNextSlot = Math.max(Date.now(), wikimediaNextSlot) + WIKIMEDIA_MIN_INTERVAL_MS;
}

function parseRetryAfterMs(response) {
  const ra = response?.headers?.['retry-after'];
  if (ra == null || ra === '') return null;
  const n = Number(String(ra).trim());
  return Number.isFinite(n) ? Math.min(Math.max(n * 1000, 500), 120_000) : null;
}

function buildCacheKey(url, params) {
  if (!params || typeof params !== 'object' || !Object.keys(params).length) {
    return url;
  }
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join('&');
  return `${url}?${sorted}`;
}

function getCached(key) {
  const entry = wikimediaCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    wikimediaCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  if (wikimediaCache.has(key)) {
    const idx = wikimediaCacheOrder.indexOf(key);
    if (idx >= 0) wikimediaCacheOrder.splice(idx, 1);
  }
  wikimediaCache.set(key, { data, expiresAt: Date.now() + WIKIMEDIA_CACHE_TTL_MS });
  wikimediaCacheOrder.push(key);
  while (wikimediaCacheOrder.length > WIKIMEDIA_CACHE_MAX) {
    const oldest = wikimediaCacheOrder.shift();
    if (oldest) wikimediaCache.delete(oldest);
  }
}

/** Clear cache between tests. */
export function clearWikimediaCacheForTests() {
  wikimediaCache.clear();
  wikimediaCacheOrder.length = 0;
  wikimediaNextSlot = 0;
}

/**
 * GET a Wikimedia URL (Wikipedia / Wikidata REST) with throttle, cache, and 429 retries.
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export async function wikimediaApiGet(url, options = {}) {
  const maxAttempts = options.maxAttempts ?? 5;
  const cacheKey = buildCacheKey(url, options.params);
  let attempt = 0;
  let lastErr;

  while (attempt < maxAttempts) {
    attempt += 1;
    await wikimediaThrottle();

    const cached = getCached(cacheKey);
    if (cached !== null) {
      wikimediaBumpSchedule();
      return { data: cached, status: 200, statusText: 'OK', headers: {}, config: {} };
    }

    try {
      const response = await axios.get(url, {
        params: options.params,
        headers: {
          Accept: 'application/json',
          'User-Agent': WIKIMEDIA_USER_AGENT,
          ...options.headers
        },
        validateStatus: () => true
      });

      if (response.status === 429) {
        const backoff = parseRetryAfterMs(response) ?? Math.min(2000 * attempt, 30_000);
        console.warn(
          `Wikimedia rate limit (429); waiting ${backoff}ms before retry ${attempt}/${maxAttempts}`
        );
        await sleep(backoff);
        wikimediaNextSlot = Date.now() + WIKIMEDIA_MIN_INTERVAL_MS;
        lastErr = new WikimediaRateLimitError('Wikimedia 429');
        lastErr.response = response;
        continue;
      }

      if (response.status >= 400) {
        const err = new Error(`Wikimedia HTTP ${response.status}`);
        err.response = response;
        wikimediaBumpSchedule();
        throw err;
      }

      setCached(cacheKey, response.data);
      wikimediaBumpSchedule();
      return response;
    } catch (e) {
      lastErr = e;
      const st = e.response?.status;
      if (st === 429 && attempt < maxAttempts) {
        const backoff = parseRetryAfterMs(e.response) ?? Math.min(2000 * attempt, 30_000);
        await sleep(backoff);
        wikimediaNextSlot = Date.now() + WIKIMEDIA_MIN_INTERVAL_MS;
        continue;
      }
      wikimediaBumpSchedule();
      throw e;
    }
  }

  if (lastErr instanceof WikimediaRateLimitError) {
    throw lastErr;
  }
  throw new WikimediaRateLimitError('Wikimedia: exceeded retries');
}

/** @deprecated Use wikimediaApiGet */
export const wikidataApiGet = wikimediaApiGet;
