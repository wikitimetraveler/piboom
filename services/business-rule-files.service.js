/**
 * Development work by David Lane
 */
import crypto from 'crypto';
import { getPool } from './database.service.js';

/** @typedef {'encompass_br_xml'|'tool8_field_matrix_json'|'encompass_br_vb_snippet'} BrSourceFormat */

/**
 * Unique field ids from [bracket] references (VB / XML text).
 * @param {string} text
 * @returns {string[]}
 */
export function extractBracketFieldIds(text) {
  if (!text || typeof text !== 'string') return [];
  const set = new Set();
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1].trim();
    if (id) set.add(id);
  }
  return [...set].sort();
}

/**
 * @param {string} bodyText
 * @returns {boolean}
 */
function looksLikeJsonArray(bodyText) {
  const t = bodyText.trim();
  return t.startsWith('[');
}

/**
 * Validate Tool 8 JSON shape (minimal).
 * @param {string} bodyText
 * @returns {{ ok: boolean, fieldIds: string[], error?: string }}
 */
export function validateTool8FieldMatrixJson(bodyText) {
  try {
    const data = JSON.parse(bodyText);
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, fieldIds: [], error: 'Expected non-empty JSON array' };
    }
    const ids = new Set();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || typeof row !== 'object') {
        return { ok: false, fieldIds: [], error: 'Invalid row ' + (i + 1) };
      }
      const raw = row.FieldID != null ? row.FieldID : row.fieldID != null ? row.fieldID : row.fieldId;
      if (raw == null || String(raw).trim() === '') {
        return { ok: false, fieldIds: [], error: 'Row ' + (i + 1) + ' missing FieldID' };
      }
      let inner = String(raw).trim();
      if (inner.startsWith('[') && inner.endsWith(']')) inner = inner.slice(1, -1).trim();
      if (!inner) return { ok: false, fieldIds: [], error: 'Row ' + (i + 1) + ' empty FieldID' };
      ids.add(inner);
    }
    return { ok: true, fieldIds: [...ids].sort() };
  } catch (e) {
    return { ok: false, fieldIds: [], error: e.message || 'Invalid JSON' };
  }
}

/**
 * Infer format from filename and content.
 * @param {Buffer} buffer
 * @param {string} [originalName]
 * @returns {BrSourceFormat}
 */
export function detectBrRuleFormat(buffer, originalName = '') {
  const name = (originalName || '').toLowerCase();
  const text = buffer.toString('utf8');
  if (name.endsWith('.json') || (looksLikeJsonArray(text) && !text.includes('<Rule'))) {
    return 'tool8_field_matrix_json';
  }
  if (name.endsWith('.xml') || text.includes('<Rule') || text.includes('<?xml')) {
    return 'encompass_br_xml';
  }
  if (looksLikeJsonArray(text)) {
    return 'tool8_field_matrix_json';
  }
  return 'encompass_br_xml';
}

/**
 * @param {string} bodyText
 * @param {BrSourceFormat} sourceFormat
 * @returns {string[]}
 */
export function fieldIdsForBrBody(bodyText, sourceFormat) {
  if (sourceFormat === 'tool8_field_matrix_json') {
    const v = validateTool8FieldMatrixJson(bodyText);
    return v.ok ? v.fieldIds : [];
  }
  return extractBracketFieldIds(bodyText);
}

/**
 * Best-effort display name from XML Rule element.
 * @param {string} xmlText
 * @returns {string}
 */
function displayNameFromXml(xmlText) {
  const m = xmlText.match(/<Rule[^>]*\bName="([^"]*)"/i);
  return m ? m[1].trim() : '';
}

/**
 * Save BR / Tool 8 payload to Postgres.
 * @param {Buffer|string} body - raw file buffer or UTF-8 string
 * @param {string} originalName
 * @param {BrSourceFormat} [sourceFormat] - optional override
 */
export async function saveBrRuleFile(body, originalName, sourceFormat) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  const bodyText = buffer.toString('utf8');
  const format = sourceFormat || detectBrRuleFormat(buffer, originalName);

  if (format === 'tool8_field_matrix_json') {
    const v = validateTool8FieldMatrixJson(bodyText);
    if (!v.ok) throw new Error(v.error || 'Invalid Tool 8 JSON');
  }

  const fieldIds = fieldIdsForBrBody(bodyText, format);
  let displayName = originalName || 'Business rule';
  if (format === 'encompass_br_xml') {
    const fromXml = displayNameFromXml(bodyText);
    if (fromXml) displayName = fromXml;
  } else if (format === 'tool8_field_matrix_json') {
    displayName = (originalName && originalName.replace(/\.json$/i, '')) || 'Tool 8 field matrix';
  } else if (format === 'encompass_br_vb_snippet') {
    displayName = (originalName || 'VB condition').replace(/\.txt$/i, '') || 'VB condition';
  }

  const fileName = crypto.randomUUID() + (format === 'tool8_field_matrix_json' ? '.json' : '.xml');

  const pool = getPool();
  if (!pool) throw new Error('Database not available');

  const result = await pool.query(
    `INSERT INTO br_rule_files (file_name, original_name, source_format, display_name, field_ids, body_text)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [fileName, originalName || fileName, format, displayName, JSON.stringify(fieldIds), bodyText],
  );

  return result.rows[0];
}

/**
 * @returns {Promise<object[]>}
 */
export async function listBrRuleFiles() {
  const pool = getPool();
  if (!pool) return [];

  const result = await pool.query(
    `SELECT id, file_name, original_name, source_format, display_name, field_ids, uploaded_at,
            LENGTH(body_text) AS body_length
     FROM br_rule_files
     ORDER BY uploaded_at DESC`,
  );
  return result.rows;
}

/**
 * @param {number} id
 * @returns {Promise<object|null>}
 */
export async function getBrRuleFile(id) {
  const pool = getPool();
  if (!pool) throw new Error('Database not available');

  const result = await pool.query(
    `SELECT id, file_name, original_name, source_format, display_name, field_ids, body_text, uploaded_at
     FROM br_rule_files WHERE id = $1`,
    [id],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

/**
 * @param {string} fieldId
 * @returns {Promise<object[]>}
 */
export async function searchBrRulesByFieldId(fieldId) {
  const pool = getPool();
  if (!pool) return [];

  const result = await pool.query(
    `SELECT id, file_name, original_name, source_format, display_name, field_ids, uploaded_at,
            LENGTH(body_text) AS body_length
     FROM br_rule_files
     WHERE field_ids ? $1
     ORDER BY uploaded_at DESC`,
    [String(fieldId).trim()],
  );
  return result.rows;
}

/**
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function deleteBrRuleFile(id) {
  const pool = getPool();
  if (!pool) throw new Error('Database not available');

  const result = await pool.query(`DELETE FROM br_rule_files WHERE id = $1`, [id]);
  return result.rowCount > 0;
}
