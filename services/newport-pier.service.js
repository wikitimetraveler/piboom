/**
 * Newport Beach Pier — catalog read/write for data/newport-pier-fish.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const NEWPORT_PIER_DATA_PATH = path.join(__dirname, '../data/newport-pier-fish.json');

export function validateClipUrl(url) {
  if (url == null || url === '') return null;
  const s = String(url).trim();
  if (!s) return null;
  if (s.startsWith('/')) return s;
  if (/^https:\/\//i.test(s)) return s;
  const err = new Error('Clip URL must be https or a site path starting with /');
  err.code = 'INVALID_URL';
  throw err;
}

export function clipFieldsFromUrl(url) {
  const validated = validateClipUrl(url);
  if (!validated) return { heygenVideoUrl: null, heygenVideoAlphaUrl: null };
  if (/\.webm(\?|$)/i.test(validated)) {
    return { heygenVideoUrl: null, heygenVideoAlphaUrl: validated };
  }
  return { heygenVideoUrl: validated, heygenVideoAlphaUrl: null };
}

/**
 * Merge avatar + stop fields into catalog (mutates catalog).
 */
export function mergeStopSave(
  catalog,
  { stopId, heygenScript, heygenVideoUrl, heygenVideoAlphaUrl, avatar }
) {
  const stop = catalog.stops?.find((s) => s.id === stopId);
  if (!stop) {
    const err = new Error(`Unknown stop: ${stopId}`);
    err.code = 'STOP_NOT_FOUND';
    throw err;
  }
  if (heygenScript != null) stop.heygenScript = String(heygenScript).trim();
  if (heygenVideoUrl !== undefined) {
    stop.heygenVideoUrl = heygenVideoUrl || null;
    if (heygenVideoUrl) stop.heygenVideoAlphaUrl = null;
  }
  if (heygenVideoAlphaUrl !== undefined) {
    stop.heygenVideoAlphaUrl = heygenVideoAlphaUrl || null;
    if (heygenVideoAlphaUrl) stop.heygenVideoUrl = null;
  }
  if (avatar && typeof avatar === 'object') {
    catalog.avatar = { ...(catalog.avatar || {}), ...avatar };
  }
  return { catalog, stop };
}

export async function loadNewportPierCatalog(dataPath = NEWPORT_PIER_DATA_PATH) {
  const raw = await readFile(dataPath, 'utf8');
  return JSON.parse(raw);
}

export async function saveNewportPierStop(payload, { dataPath = NEWPORT_PIER_DATA_PATH } = {}) {
  const stopId = payload?.stopId;
  if (!stopId) {
    const err = new Error('stopId is required');
    err.code = 'INVALID_PAYLOAD';
    throw err;
  }
  const catalog = await loadNewportPierCatalog(dataPath);
  let heygenVideoUrl = payload.heygenVideoUrl;
  let heygenVideoAlphaUrl = payload.heygenVideoAlphaUrl;
  if (payload.clipUrl != null) {
    const fields = clipFieldsFromUrl(payload.clipUrl);
    heygenVideoUrl = fields.heygenVideoUrl;
    heygenVideoAlphaUrl = fields.heygenVideoAlphaUrl;
  }
  const avatar = payload.avatar
    ? {
        ...(payload.avatar.avatarId ? { avatarId: String(payload.avatar.avatarId).trim() } : {}),
        ...(payload.avatar.voiceId != null ? { voiceId: String(payload.avatar.voiceId).trim() } : {}),
        ...(payload.avatar.label ? { label: String(payload.avatar.label).trim() } : {}),
        ...(payload.avatar.pipMode ? { pipMode: payload.avatar.pipMode } : {}),
        ...(payload.avatar.pipStyle ? { pipStyle: payload.avatar.pipStyle } : {})
      }
    : null;
  const result = mergeStopSave(catalog, {
    stopId,
    heygenScript: payload.heygenScript,
    heygenVideoUrl,
    heygenVideoAlphaUrl,
    avatar: avatar && Object.keys(avatar).length ? avatar : null
  });
  await writeFile(dataPath, `${JSON.stringify(result.catalog, null, 2)}\n`, 'utf8');
  return result;
}

export function canEditNewportPier(req) {
  if (process.env.NODE_ENV !== 'production') return true;
  const key = (process.env.NEWPORT_PIER_EDIT_KEY || '').trim();
  if (!key) return false;
  return req.get('x-newport-pier-key') === key;
}
