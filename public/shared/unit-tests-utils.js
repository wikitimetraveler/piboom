/**
 * Development work by David Lane
 */
/**
 * Shared utilities for unit test parsing and comparison.
 * Used by unit-tests.js (browser) and run-finance-unit-tests.js (Node).
 */

/**
 * Extract field ID from bracket notation (e.g., "[LOCKRATE.2866]" -> "LOCKRATE.2866").
 * Strips leading "@" (date typecast) and "#" (number typecast) so API calls use the base field ID.
 * @param {*} value - e.g. "[353]", "[@748]", "[#4002#1]"
 * @returns {string|null} - extracted ID or null if no bracket match
 */
export function extractFieldId(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  const match = str.match(/\[([^\]]+)\]/);
  if (!match) return null;
  let id = match[1].trim();
  id = id.replace(/^[@#]+/, '');
  return id || null;
}

/**
 * Check if a value contains a field ID in brackets.
 */
export function hasFieldId(value) {
  return extractFieldId(value) !== null;
}

/**
 * Extract all field IDs from a Target cell (e.g. "[CX.TYPE] and [353]" -> ["CX.TYPE", "353"]).
 * Strips @ and # prefix. Returns empty array if none.
 */
export function extractFieldIdsFromTarget(value) {
  if (!value) return [];
  const str = String(value).trim();
  const matches = [...str.matchAll(/\[([^\]]+)\]/g)];
  return matches.map((m) => m[1].trim().replace(/^[@#]+/, '')).filter(Boolean);
}

/**
 * Get raw field ID from Target (with @ or # prefix) for type inference.
 * e.g. "[@748]" -> "@748", "[748]" -> "748"
 */
export function getRawFieldIdFromTarget(target) {
  if (!target) return null;
  const match = String(target).trim().match(/\[([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

/**
 * In unit tests, "null", "NULL", "Nothing" in compare/set columns mean blank/empty.
 */
export function isBlankForTest(val) {
  if (val === null || val === undefined) return true;
  const s = String(val).trim().toLowerCase();
  return s === '' || s === 'null' || s === 'undefined' || s === 'nothing';
}

/**
 * Coerce Excel/string value for comparison. Normalizes "null"/"nothing" to empty string.
 */
export function coerce(value) {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined) return value;
  const trimmed = String(value).trim();
  if (trimmed === '') return '';
  if (trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'nothing') return '';
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && trimmed.match(/^-?\d+(\.\d+)?$/)) {
    return asNumber;
  }
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  return trimmed;
}

/**
 * Get field path for API lookup. Extracts from brackets or returns trimmed string.
 * Use when the source may be "[353]" or a plain path like "Fields.353".
 */
export function getFieldPath(value) {
  const extracted = extractFieldId(value);
  if (extracted) return extracted;
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str || null;
}

/** Strip bracketed field ids from API/UI description text (Target column keeps [FIELD]). */
export function sanitizeDescriptionText(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/\[(?=[^\]\s]*[A-Za-z0-9])[^\]\s]+\]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;:.!?])/g, '$1')
    .trim();
}

/**
 * Description column: human label + optional type — no [FIELD] (see Target column).
 * @param {{ description?: string, dataType?: string, type?: string }} [meta]
 * @param {string} [existingDesc]
 */
export function formatDescriptionFromMeta(meta, existingDesc = '') {
  const apiDesc = sanitizeDescriptionText(meta?.description || '');
  const dt = String(meta?.dataType || meta?.type || '').trim();
  if (apiDesc) {
    const typeSuffix = dt && !/^string$/i.test(dt) ? ` — ${dt}` : '';
    return `${apiDesc}${typeSuffix}`.trim();
  }
  if (meta && dt && !/^string$/i.test(dt)) {
    const base = sanitizeDescriptionText(existingDesc || '');
    if (base && !base.includes(`(${dt})`) && !base.includes(` — ${dt}`)) {
      return `${base} (${dt})`.trim();
    }
  }
  return sanitizeDescriptionText(existingDesc || '');
}

/** localStorage key: `{ correspondent?: string, retail?: string }` */
export const UNIT_TEST_LOAN_GUID_BY_ENV_KEY = 'unitTestsLoanGuidByEnv';

/** Pre-filled loan GUID on Worksheets unit test page when none is stored yet. */
export const DEFAULT_UNIT_TEST_LOAN_GUID_BY_ENV = {
  correspondent: '6368dcda-7d71-466e-81af-7e3ed2ca5090',
  retail: 'f31324f5-a9a7-4f99-841e-42988a073634'
};

/** True when Description should be refreshed from Encompass metadata. */
export function descriptionNeedsMetadataRefresh(desc) {
  const d = String(desc || '').trim();
  if (!d) return true;
  if (/^field$/i.test(d)) return true;
  if (/^field\s+/i.test(d)) return true;
  if (/\[[^\]]+\]/.test(d)) return true;
  return false;
}
