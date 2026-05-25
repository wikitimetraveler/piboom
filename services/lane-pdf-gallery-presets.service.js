/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { randomUUID } from 'crypto';
import { getPool } from './database.service.js';
import { isValidClientId } from './lane-pdf-gallery-hides.service.js';

export const PRESETS_MAX_COUNT = 10;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPresetId(raw) {
  return typeof raw === 'string' && UUID_RE.test(raw.trim());
}

/** PDF page filter: empty or integer ≥ 1 */
export function sanitizeFilterPage(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (!s) return '';
  const p = parseInt(s, 10);
  if (Number.isNaN(p) || p < 1) return '';
  return String(p);
}

/**
 * @returns {{ filterPage: string, filterCandidateIds: string, showServerDenied: boolean }}
 */
export function normalizePresetConfig(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  return {
    filterPage: sanitizeFilterPage(c.filterPage != null ? c.filterPage : ''),
    filterCandidateIds:
      typeof c.filterCandidateIds === 'string' ? c.filterCandidateIds.trim().slice(0, 500) : '',
    showServerDenied:
      typeof c.showServerDenied === 'boolean'
        ? c.showServerDenied
        : typeof c.showHidden === 'boolean'
          ? c.showHidden
          : true
  };
}

function normalizeLabel(raw) {
  const s = typeof raw === 'string' ? raw.trim().slice(0, 80) : '';
  return s;
}

function rowToPreset(row) {
  const cfg = row.config && typeof row.config === 'object' ? normalizePresetConfig(row.config) : normalizePresetConfig({});
  return {
    id: String(row.id),
    label: String(row.label),
    savedAt: row.saved_at ? new Date(row.saved_at).toISOString() : new Date().toISOString(),
    config: cfg
  };
}

export async function listFilterPresets(clientId) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  const pool = getPool();
  const res = await pool.query(
    `SELECT id, label, config, saved_at FROM lane_pdf_gallery_filter_preset
     WHERE client_id = $1::uuid ORDER BY lower(label)`,
    [clientId]
  );
  return res.rows.map(rowToPreset);
}

export async function upsertFilterPreset(clientId, labelRaw, configRaw) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  const label = normalizeLabel(labelRaw);
  if (!label) throw new Error('label is required');
  const config = normalizePresetConfig(configRaw);
  const pool = getPool();

  const existing = await pool.query(
    `SELECT id FROM lane_pdf_gallery_filter_preset WHERE client_id = $1::uuid AND lower(label) = lower($2)`,
    [clientId, label]
  );

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    await pool.query(
      `UPDATE lane_pdf_gallery_filter_preset SET config = $3::jsonb, saved_at = CURRENT_TIMESTAMP WHERE id = $1::uuid AND client_id = $2::uuid`,
      [id, clientId, JSON.stringify(config)]
    );
    const list = await listFilterPresets(clientId);
    const saved = list.find((p) => p.id === String(id));
    return { presets: list, saved };
  }

  const cnt = await pool.query(
    `SELECT COUNT(*)::int AS c FROM lane_pdf_gallery_filter_preset WHERE client_id = $1::uuid`,
    [clientId]
  );
  if (Number(cnt.rows[0]?.c || 0) >= PRESETS_MAX_COUNT) {
    throw new Error(`You can save at most ${PRESETS_MAX_COUNT} views. Delete one first, or save under an existing name to overwrite.`);
  }

  const id = randomUUID();
  await pool.query(
    `INSERT INTO lane_pdf_gallery_filter_preset (id, client_id, label, config) VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)`,
    [id, clientId, label, JSON.stringify(config)]
  );
  const list = await listFilterPresets(clientId);
  const saved = list.find((p) => p.id === id);
  return { presets: list, saved };
}

export async function deleteFilterPreset(clientId, presetId) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  if (!isValidPresetId(presetId)) throw new Error('Invalid presetId');
  const pool = getPool();
  await pool.query(
    `DELETE FROM lane_pdf_gallery_filter_preset WHERE client_id = $1::uuid AND id = $2::uuid`,
    [clientId, presetId.trim()]
  );
  return listFilterPresets(clientId);
}

/**
 * Merge imported presets by label (case-insensitive cap).
 */
export async function mergeImportFilterPresets(clientId, incoming) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  if (!Array.isArray(incoming)) throw new Error('presets must be an array');

  const pool = getPool();
  const normalized = [];
  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') continue;
    const lab = normalizeLabel(raw.label);
    if (!lab) continue;
    normalized.push({ label: lab, config: normalizePresetConfig(raw.config && typeof raw.config === 'object' ? raw.config : raw) });
  }

  for (const item of normalized) {
    const existing = await pool.query(
      `SELECT id FROM lane_pdf_gallery_filter_preset WHERE client_id = $1::uuid AND lower(label) = lower($2)`,
      [clientId, item.label]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE lane_pdf_gallery_filter_preset SET config = $3::jsonb, saved_at = CURRENT_TIMESTAMP WHERE id = $1::uuid AND client_id = $2::uuid`,
        [existing.rows[0].id, clientId, JSON.stringify(item.config)]
      );
    } else {
      const cnt = await pool.query(
        `SELECT COUNT(*)::int AS c FROM lane_pdf_gallery_filter_preset WHERE client_id = $1::uuid`,
        [clientId]
      );
      if (Number(cnt.rows[0]?.c || 0) >= PRESETS_MAX_COUNT) {
        throw new Error(`Preset list full (${PRESETS_MAX_COUNT}). Delete some before importing.`);
      }
      const id = randomUUID();
      await pool.query(
        `INSERT INTO lane_pdf_gallery_filter_preset (id, client_id, label, config) VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)`,
        [id, clientId, item.label, JSON.stringify(item.config)]
      );
    }
  }

  return listFilterPresets(clientId);
}
