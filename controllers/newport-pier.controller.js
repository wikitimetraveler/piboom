/**
 * Development work by David Lane
 */
import {
  canEditNewportPier,
  loadNewportPierCatalog,
  saveNewportPierStop
} from '../services/newport-pier.service.js';
import {
  getReelRenderStatus,
  startReelRenderAsync
} from '../services/newport-pier-reel.service.js';
import { compositeStopVideo, cacheClipForStop } from '../lib/newport-pier-composite.js';

function handleError(res, e) {
  const code = e.code;
  if (code === 'STOP_NOT_FOUND' || code === 'INVALID_PAYLOAD' || code === 'INVALID_URL') {
    return res.status(400).json({ success: false, error: e.message });
  }
  if (code === 'NO_AVATAR_SOURCE' || code === 'NO_WALK_VIDEO' || code === 'CLIP_DOWNLOAD_FAILED') {
    return res.status(400).json({ success: false, error: e.message });
  }
  if (code === 'CLIP_NOT_FOUND') {
    return res.status(404).json({ success: false, error: e.message });
  }
  if (code === 'RENDER_IN_PROGRESS') {
    return res.status(409).json({ success: false, error: e.message });
  }
  if (code === 'RENDER_FAILED' || code === 'NO_RENDER_OUTPUT' || code === 'TTS_FAILED') {
    return res.status(500).json({ success: false, error: e.message, code });
  }
  if (code === 'COMPOSITE_FAILED') {
    return res.status(500).json({ success: false, error: e.message });
  }
  if (code === 'ENOENT') {
    return res.status(404).json({ success: false, error: 'Catalog file not found' });
  }
  res.status(500).json({ success: false, error: e.message || 'Newport Pier save failed' });
}

export async function getNewportPierCatalog(req, res) {
  try {
    const catalog = await loadNewportPierCatalog();
    res.json({ success: true, catalog });
  } catch (e) {
    handleError(res, e);
  }
}

export async function postNewportPierStopSave(req, res) {
  if (!canEditNewportPier(req)) {
    return res.status(403).json({
      success: false,
      error: 'Server save disabled in production (set NEWPORT_PIER_EDIT_KEY or use development mode)'
    });
  }
  try {
    const { stopId, heygenScript, clipUrl, heygenVideoUrl, heygenVideoAlphaUrl, avatar } = req.body || {};
    const result = await saveNewportPierStop({
      stopId,
      heygenScript,
      clipUrl,
      heygenVideoUrl,
      heygenVideoAlphaUrl,
      avatar
    });
    res.json({
      success: true,
      stop: result.stop,
      avatar: result.catalog.avatar,
      message: `Saved stop "${result.stop.label}" to data/newport-pier-fish.json`
    });
  } catch (e) {
    handleError(res, e);
  }
}

export async function postNewportPierStopExport(req, res) {
  if (!canEditNewportPier(req)) {
    return res.status(403).json({
      success: false,
      error: 'Server export disabled in production (set NEWPORT_PIER_EDIT_KEY or use development mode)'
    });
  }
  try {
    const { stopId, clipUrl, avatarImageUrl, videoId, durationSec } = req.body || {};
    const result = await compositeStopVideo({ stopId, clipUrl, avatarImageUrl, videoId, durationSec });
    res.json({
      success: true,
      videoUrl: result.videoUrl,
      stop: result.stop,
      message: `Baked avatar onto pier walk → ${result.videoUrl}`
    });
  } catch (e) {
    handleError(res, e);
  }
}

export async function postNewportPierStopCacheClip(req, res) {
  if (!canEditNewportPier(req)) {
    return res.status(403).json({
      success: false,
      error: 'Server save disabled in production (set NEWPORT_PIER_EDIT_KEY or use development mode)'
    });
  }
  try {
    const { stopId, clipUrl, videoId } = req.body || {};
    if (!stopId) {
      return res.status(400).json({ success: false, error: 'stopId is required' });
    }
    const result = await cacheClipForStop({ stopId, clipUrl, videoId });
    res.json({
      success: true,
      localClipUrl: result.localClipUrl,
      stop: result.stop,
      cached: result.cached,
      message: result.cached
        ? `Cached clip → ${result.localClipUrl}`
        : `Clip already on disk → ${result.localClipUrl}`
    });
  } catch (e) {
    handleError(res, e);
  }
}

/** Local HyperFrame reel (Google TTS + HyperFrames CLI). No HeyGen API. */
export async function postNewportPierReelRender(req, res) {
  if (!canEditNewportPier(req)) {
    return res.status(403).json({
      success: false,
      error:
        'HyperFrame reel render disabled in production (set NEWPORT_PIER_EDIT_KEY or use development mode)'
    });
  }
  try {
    const skipNarration = !!req.body?.skipNarration;
    const job = startReelRenderAsync({ skipNarration });
    res.json({
      success: true,
      ...job,
      message:
        'Local HyperFrame render started (no HeyGen API). Poll GET /api/newport-pier/reel/render/status.'
    });
  } catch (e) {
    handleError(res, e);
  }
}

export function getNewportPierReelRenderStatus(req, res) {
  res.json({ success: true, ...getReelRenderStatus() });
}
