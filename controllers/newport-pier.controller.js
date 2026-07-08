/**
 * Development work by David Lane
 */
import {
  canEditNewportPier,
  loadNewportPierCatalog,
  saveNewportPierStop
} from '../services/newport-pier.service.js';
import { compositeStopVideo } from '../lib/newport-pier-composite.js';

function handleError(res, e) {
  const code = e.code;
  if (code === 'STOP_NOT_FOUND' || code === 'INVALID_PAYLOAD' || code === 'INVALID_URL') {
    return res.status(400).json({ success: false, error: e.message });
  }
  if (code === 'NO_AVATAR_SOURCE' || code === 'NO_WALK_VIDEO') {
    return res.status(400).json({ success: false, error: e.message });
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
    const { stopId, clipUrl, avatarImageUrl, durationSec } = req.body || {};
    const result = await compositeStopVideo({ stopId, clipUrl, avatarImageUrl, durationSec });
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
