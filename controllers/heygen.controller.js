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
