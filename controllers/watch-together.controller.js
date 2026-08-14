/**
 * Development work by David Lane
 */
import { verifyWatchTogetherAccess } from '../lib/watch-together-auth.js';
import { getGoogleBrowserApiKey } from '../lib/google-api-key.js';
import {
  getWatchTogetherSnapshot,
  getWatchTogetherStatus,
  handleWatchIntent,
  mintWatchTogetherLivekitToken,
  startWatchTogetherAudioEgress,
  stopWatchTogetherAudioEgress,
  searchWatchTogetherYouTube,
  MAX_VIEWERS,
} from '../services/watch-together.service.js';

export async function postVerifyWatchTogether(req, res) {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const result = verifyWatchTogetherAccess(code);
    if (!result.valid) {
      return res.status(401).json({ valid: false });
    }
    return res.json({ valid: true });
  } catch (e) {
    console.error('verify-watch-together:', e.message);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
}

/** Same browser key already used for YouTube Data API + Maps across the app. */
export async function getWatchTogetherGoogleApiKey(req, res) {
  try {
    const apiKey = getGoogleBrowserApiKey();
    return res.json({ apiKey: apiKey || null });
  } catch (e) {
    console.error('watch-together google-api-key:', e.message);
    return res.status(500).json({ apiKey: null, error: 'Failed to get Google API key' });
  }
}

export async function getWatchTogetherHealth(_req, res) {
  res.json(getWatchTogetherStatus());
}

export async function getWatchTogetherState(req, res) {
  const code = typeof req.query?.code === 'string' ? req.query.code : '';
  if (!verifyWatchTogetherAccess(code).valid) {
    return res.status(401).json({ ok: false, error: 'invalid-code' });
  }
  res.json({ ok: true, ...getWatchTogetherSnapshot() });
}

export async function postWatchTogetherIntent(req, res) {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!verifyWatchTogetherAccess(code).valid) {
      return res.status(401).json({ ok: false, error: 'invalid-code' });
    }
    const result = handleWatchIntent(req.body, {
      name: req.body?.name,
      id: req.body?.identity,
      userId: req.body?.userId,
    });
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.reason || 'bad-intent' });
    }
    return res.json({ ok: true, ...result });
  } catch (e) {
    console.error('watch-together intent:', e.message);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

export async function postWatchTogetherLivekitToken(req, res) {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!verifyWatchTogetherAccess(code).valid) {
      return res.status(401).json({ ok: false, error: 'invalid-code' });
    }
    const minted = await mintWatchTogetherLivekitToken({
      identity: req.body?.identity,
      name: req.body?.name,
      userId: req.body?.userId,
    });
    return res.json({ ok: true, livekitConfigured: true, ...minted });
  } catch (error) {
    if (error.code === 'THEATER_FULL') {
      return res.status(409).json({
        ok: false,
        error: 'theater-full',
        max: MAX_VIEWERS,
      });
    }
    const status = error.code === 'LIVEKIT_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({
      ok: false,
      error: error.code || error.message,
      livekitConfigured: false,
    });
  }
}

export async function postWatchTogetherYoutubeSearch(req, res) {
  try {
    const result = await searchWatchTogetherYouTube(req.body?.query);
    if (!result.ok && result.reason === 'empty') {
      return res.status(400).json({ ok: false, error: 'empty' });
    }
    if (!result.ok && result.reason === 'no-key') {
      return res.status(503).json({ ok: false, error: 'no-key' });
    }
    if (!result.ok) {
      return res.status(502).json({ ok: false, error: result.reason || 'search-failed' });
    }
    return res.json({ ok: true, query: result.query, videos: result.videos });
  } catch (e) {
    console.error('watch-together youtube-search:', e.message);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

export async function postWatchTogetherAudioEgress(req, res) {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!verifyWatchTogetherAccess(code).valid) {
      return res.status(401).json({ ok: false, error: 'invalid-code' });
    }
    const started = await startWatchTogetherAudioEgress();
    return res.json({ ok: true, ...started });
  } catch (error) {
    const status = error.code === 'LIVEKIT_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ ok: false, error: error.code || error.message });
  }
}

export async function postWatchTogetherAudioEgressStop(req, res) {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!verifyWatchTogetherAccess(code).valid) {
      return res.status(401).json({ ok: false, error: 'invalid-code' });
    }
    const stopped = await stopWatchTogetherAudioEgress(req.body?.egressId);
    return res.json({ ok: true, ...stopped });
  } catch (error) {
    const status = error.code === 'LIVEKIT_NOT_CONFIGURED' ? 503 : 400;
    return res.status(status).json({ ok: false, error: error.code || error.message });
  }
}

export default {
  postVerifyWatchTogether,
  getWatchTogetherGoogleApiKey,
  getWatchTogetherHealth,
  getWatchTogetherState,
  postWatchTogetherIntent,
  postWatchTogetherLivekitToken,
  postWatchTogetherYoutubeSearch,
  postWatchTogetherAudioEgress,
  postWatchTogetherAudioEgressStop,
};
