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
