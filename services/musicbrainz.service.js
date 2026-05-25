/**
 * Development work by David Lane
 */
/**
 * Central MusicBrainz Web Service client — single User-Agent, JSON, ~1 req/s (queued).
 * @see https://musicbrainz.org/doc/MusicBrainz_API
 */
import axios from 'axios';

export const MUSICBRAINZ_USER_AGENT =
  'DevConnectLabs/1.0 (https://github.com/wikitimetraveler/piboom; music-metadata)';

const BASE_URL = 'https://musicbrainz.org/ws/2';

/** Minimum milliseconds between completed MB requests (policy-friendly). */
const MIN_INTERVAL_MS = 1100;

let queue = Promise.resolve();
let lastCompleteAt = 0;

/**
 * GET path under /ws/2 (e.g. '/artist', '/recording/foo').
 * Params merged with fmt=json unless overridden.
 * Requests are serialized globally so bursts respect ~1 request/second.
 *
 * @param {string} path - Resource path after .../ws/2 (with or without leading slash)
 * @param {Record<string, string|number>} [params]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function mbGet(path, params = {}) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = `${BASE_URL}${normalized}`;
  const mergedParams = { fmt: 'json', ...params };

  const task = queue.then(async () => {
    const elapsed = Date.now() - lastCompleteAt;
    const wait = Math.max(0, MIN_INTERVAL_MS - elapsed);
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    try {
      return await axios.get(url, {
        params: mergedParams,
        headers: {
          'User-Agent': MUSICBRAINZ_USER_AGENT,
          Accept: 'application/json'
        },
        timeout: 45000
      });
    } finally {
      lastCompleteAt = Date.now();
    }
  });

  queue = task.catch(() => {});
  return task;
}
