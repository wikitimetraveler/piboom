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

export default {
  postVerifyWatchTogether,
  getWatchTogetherGoogleApiKey,
  getWatchTogetherHealth,
  getWatchTogetherState,
  postWatchTogetherIntent,
  postWatchTogetherLivekitToken,
};
