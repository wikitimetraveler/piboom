/**
 * Development work by David Lane
 */
import {
  heygenConfigured,
  listAvatars,
  listVoices,
  createAvatarVideo,
  getVideoStatus
} from '../services/heygen.service.js';
import {
  getSchemaWalkthrough,
  getSchemaDemoShort,
  getDisasterBriefingPayload
} from '../services/disaster-heygen.service.js';

function handleHeygenError(res, e, fallback) {
  if (e.code === 'HEYGEN_NOT_CONFIGURED') {
    return res.status(503).json({ success: false, error: 'HeyGen is not configured (set HEYGEN_API_KEY)' });
  }
  const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
  res.status(status).json({ success: false, error: e.message || fallback });
}

export function getHeygenHealth(req, res) {
  res.json({ success: true, configured: heygenConfigured() });
}

export async function getHeygenAvatars(req, res) {
  try {
    res.json({ success: true, avatars: await listAvatars() });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to list avatars');
  }
}

export async function getHeygenVoices(req, res) {
  try {
    res.json({ success: true, voices: await listVoices() });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to list voices');
  }
}

export async function postHeygenVideo(req, res) {
  try {
    const { avatarId, script, voiceId, title, resolution, aspectRatio, callbackUrl } = req.body || {};
    if (!avatarId || !script) {
      return res.status(400).json({ success: false, error: 'avatarId and script are required' });
    }
    const data = await createAvatarVideo({ avatarId, script, voiceId, title, resolution, aspectRatio, callbackUrl });
    res.json({ success: true, videoId: data?.video_id, data });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to create video');
  }
}

export async function getHeygenVideoStatus(req, res) {
  try {
    const data = await getVideoStatus(req.params.videoId);
    res.json({ success: true, status: data?.status, videoUrl: data?.video_url || null, data });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to fetch video status');
  }
}

/** Pre-written Unified Disasters schema walkthrough script (see docs/UNIFIED_DISASTERS_DB_SCHEMA_VIDEO_SCRIPT.md). */
export function getHeygenSchemaScript(req, res) {
  res.json({ success: true, ...getSchemaWalkthrough() });
}

/** ~25s shirt / booth popup script for Unified Disasters. */
export function getHeygenDemoScript(req, res) {
  res.json({ success: true, ...getSchemaDemoShort() });
}

/**
 * Preview or render a spoken briefing for a selected disaster row.
 * POST body: { disaster, loanCount?, cameraCount?, radiusMiles?, avatarId?, voiceId?, render?: boolean }
 * When render is true and avatarId is set, starts HeyGen video generation.
 */
export async function postHeygenDisasterBriefing(req, res) {
  try {
    const { disaster, loanCount, cameraCount, radiusMiles, avatarId, voiceId, render, aspectRatio } =
      req.body || {};
    if (!disaster || typeof disaster !== 'object') {
      return res.status(400).json({ success: false, error: 'disaster object is required' });
    }
    const payload = getDisasterBriefingPayload(disaster, { loanCount, cameraCount, radiusMiles });
    if (!render) {
      return res.json({ success: true, preview: true, ...payload });
    }
    if (!avatarId) {
      return res.status(400).json({ success: false, error: 'avatarId is required when render is true' });
    }
    const data = await createAvatarVideo({
      avatarId,
      voiceId,
      script: payload.script,
      title: payload.title,
      aspectRatio: aspectRatio || payload.aspectRatio
    });
    res.json({ success: true, preview: false, videoId: data?.video_id, ...payload, data });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to create disaster briefing video');
  }
}
