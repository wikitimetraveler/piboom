/**
 * Development work by David Lane
 */
/**
 * HeyGen v3 API service — avatar video generation.
 * Docs: https://developers.heygen.com (v3; v1/v2 sunset Oct 31, 2026).
 * Requires HEYGEN_API_KEY in the environment.
 */

const HEYGEN_BASE = 'https://api.heygen.com';

function getApiKey() {
  const key = (process.env.HEYGEN_API_KEY || '').trim();
  if (!key) {
    const err = new Error('HEYGEN_API_KEY is not configured');
    err.code = 'HEYGEN_NOT_CONFIGURED';
    throw err;
  }
  return key;
}

export function heygenConfigured() {
  return Boolean((process.env.HEYGEN_API_KEY || '').trim());
}

async function heygenRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${HEYGEN_BASE}${path}`, {
    method,
    headers: {
      'X-Api-Key': getApiKey(),
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      json?.error?.message || json?.message || `HeyGen API ${method} ${path} failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.details = json;
    throw err;
  }
  return json?.data ?? json;
}

/** Cursor-paginated list helper (v3: { data: [...], has_more, next_token }). */
async function listAll(path, { maxPages = 1 } = {}) {
  const items = [];
  let nextToken = null;
  let pages = 0;
  do {
    const qs = nextToken ? `${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(nextToken)}` : '';
    const res = await fetch(`${HEYGEN_BASE}${path}${qs}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': getApiKey(),
        'Content-Type': 'application/json'
      }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        json?.error?.message || json?.message || `HeyGen API GET ${path} failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      err.details = json;
      throw err;
    }
    const data = json?.data;
    const page = Array.isArray(data)
      ? data
      : data?.avatars || data?.voices || data?.items || [];
    items.push(...page);
    pages += 1;
    nextToken = json?.has_more && pages < maxPages ? json?.next_token : null;
  } while (nextToken);
  return items;
}

/** Avatar looks (outfit/pose IDs used as avatar_id in POST /v3/videos). */
export async function listAvatars() {
  return listAll('/v3/avatars/looks?limit=50', { maxPages: 1 });
}

export async function listVoices() {
  return listAll('/v3/voices?limit=100', { maxPages: 2 });
}

/**
 * Create an avatar video from a script.
 * @param {object} opts
 * @param {string} opts.avatarId - HeyGen avatar ID (video avatar or photo avatar look ID)
 * @param {string} opts.script - Text the avatar speaks
 * @param {string} [opts.voiceId] - Optional; omit to use the avatar's default voice
 * @param {string} [opts.title]
 * @param {string} [opts.resolution] - e.g. '1080p' (default)
 * @param {string} [opts.aspectRatio] - e.g. '16:9' | '9:16' | 'auto' (default)
 * @param {string} [opts.callbackUrl] - Optional webhook for completion
 * @returns {Promise<{ video_id: string }>}
 */
export async function createAvatarVideo({
  avatarId,
  script,
  voiceId,
  title,
  resolution = '1080p',
  aspectRatio = 'auto',
  callbackUrl
}) {
  if (!avatarId) throw new Error('avatarId is required');
  if (!script || !script.trim()) throw new Error('script is required');
  const body = {
    type: 'avatar',
    avatar_id: avatarId,
    script: script.trim(),
    resolution,
    aspect_ratio: aspectRatio
  };
  if (voiceId) body.voice_id = voiceId;
  if (title) body.title = title;
  if (callbackUrl) body.callback_url = callbackUrl;
  return heygenRequest('/v3/videos', { method: 'POST', body });
}

/**
 * Get status/details for a generated video.
 * Status values: pending | waiting | processing | completed | failed.
 */
export async function getVideoStatus(videoId) {
  if (!videoId) throw new Error('videoId is required');
  return heygenRequest(`/v3/videos/${encodeURIComponent(videoId)}`);
}

/**
 * Poll until a video completes or fails.
 * @param {string} videoId
 * @param {object} [opts]
 * @param {number} [opts.intervalMs=5000]
 * @param {number} [opts.timeoutMs=600000] - 10 min default
 */
export async function waitForVideo(videoId, { intervalMs = 5000, timeoutMs = 600000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const data = await getVideoStatus(videoId);
    const status = data?.status;
    if (status === 'completed' || status === 'failed') return data;
    if (Date.now() > deadline) {
      const err = new Error(`Timed out waiting for HeyGen video ${videoId} (last status: ${status})`);
      err.code = 'HEYGEN_POLL_TIMEOUT';
      throw err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
