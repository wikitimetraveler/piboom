/**
 * Ported from piBoom public/shared/unit-tests-utils.js
 */
import type { CompareMode, CompareOptions } from '../types/compare.js';
import { approxEqual, parseUnitTestDateMs } from './calcMath.js';

export function extractFieldId(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  const match = str.match(/\[([^\]]+)\]/);
  if (!match) return null;
  let id = match[1].trim();
  id = id.replace(/^[@#]+/, '');
  return id || null;
}

export function hasFieldId(value: unknown): boolean {
  return extractFieldId(value) !== null;
}

export function extractFieldIdsFromTarget(value: unknown): string[] {
  if (!value) return [];
  const str = String(value).trim();
  const matches = [...str.matchAll(/\[([^\]]+)\]/g)];
  return matches.map((m) => m[1].trim().replace(/^[@#]+/, '')).filter(Boolean);
}

export function getRawFieldIdFromTarget(target: unknown): string | null {
  if (!target) return null;
  const match = String(target).trim().match(/\[([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

export function isBlankForTest(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  const s = String(val).trim().toLowerCase();
  return s === '' || s === 'null' || s === 'undefined' || s === 'nothing';
}

export function coerce(value: unknown): unknown {
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

export function getFieldPath(value: unknown): string | null {
  const extracted = extractFieldId(value);
  if (extracted) return extracted;
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str || null;
}

export function sanitizeDescriptionText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/\[(?=[^\]\s]*[A-Za-z0-9])[^\]\s]+\]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;:.!?])/g, '$1')
    .trim();
}

export function formatDescriptionFromMeta(
  meta?: { description?: string; dataType?: string; type?: string },
  existingDesc = ''
): string {
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

export const COMPARE_MODES: CompareMode[] = [
  'equals',
  'approx',
  'date',
  'contains',
  'regex',
  'gt',
  'gte',
  'lt',
  'lte',
  'not',
];

export function normalizeCompareMode(raw: unknown): CompareMode {
  if (!raw) return 'equals';
  const cleaned = String(raw).toLowerCase().trim();
  if (['=', 'eq', 'equals', 'equal'].includes(cleaned)) return 'equals';
  if (['approx', 'approximately', '~'].includes(cleaned)) return 'approx';
  if (['date', 'dates'].includes(cleaned)) return 'date';
  if (['contains', 'include', 'includes'].includes(cleaned)) return 'contains';
  if (['regex', 'matches', 'match'].includes(cleaned)) return 'regex';
  if (['gt', '>'].includes(cleaned)) return 'gt';
  if (['gte', '>='].includes(cleaned)) return 'gte';
  if (['lt', '<'].includes(cleaned)) return 'lt';
  if (['lte', '<='].includes(cleaned)) return 'lte';
  if (['not', 'neq', '!='].includes(cleaned)) return 'not';
  if ((COMPARE_MODES as string[]).includes(cleaned)) return cleaned as CompareMode;
  return 'equals';
}

export function getCompareModeFromRow(row?: Record<string, unknown>): CompareMode {
  if (!row || typeof row !== 'object') return 'equals';
  const keys = Object.keys(row);
  const find = (names: string[]): CompareMode | null => {
    for (const name of names) {
      const hit = keys.find((k) => String(k).toLowerCase().trim() === name);
      if (hit && row[hit] != null && String(row[hit]).trim() !== '') {
        return normalizeCompareMode(row[hit]);
      }
    }
    return null;
  };
  return (
    find(['comparemode', 'compare mode', 'compare_mode']) ||
    find(['operator', 'op', 'comparison']) ||
    'equals'
  );
}

function legacyEqualsMatch(actual: unknown, expected: unknown): boolean {
  const expectedStr = expected === null || expected === undefined ? '' : String(expected).trim();
  const actualStr = actual === null || actual === undefined ? '' : String(actual).trim();
  const expectedBlank = isBlankForTest(expectedStr);
  const actualBlank = isBlankForTest(actualStr);
  if (expectedBlank && actualBlank) return true;
  if (expectedStr === actualStr) return true;
  const numExpected = Number(expectedStr);
  const numActual = Number(actualStr);
  const bothNumeric =
    actualStr !== '' &&
    expectedStr !== '' &&
    !Number.isNaN(numExpected) &&
    !Number.isNaN(numActual);
  if (bothNumeric && numExpected === numActual) return true;
  if (expectedStr.toLowerCase() === actualStr.toLowerCase()) return true;
  return false;
}

export function compareValues(
  actual: unknown,
  expected: unknown,
  mode: CompareMode | string = 'equals',
  opts: CompareOptions = {}
): boolean {
  const m = normalizeCompareMode(mode);

  if (m === 'equals') {
    return legacyEqualsMatch(actual, expected);
  }

  const actualStr = actual === null || actual === undefined ? '' : String(actual).trim();
  const expectedStr = expected === null || expected === undefined ? '' : String(expected).trim();

  if (m === 'contains') {
    return actualStr.toLowerCase().includes(expectedStr.toLowerCase());
  }

  if (m === 'regex') {
    if (!expectedStr) return false;
    try {
      return new RegExp(expectedStr).test(actualStr);
    } catch {
      return false;
    }
  }

  if (m === 'date') {
    const aMs = parseUnitTestDateMs(actual);
    const eMs = parseUnitTestDateMs(expected);
    if (aMs == null && eMs == null) return isBlankForTest(actual) && isBlankForTest(expected);
    return aMs != null && eMs != null && aMs === eMs;
  }

  if (m === 'approx') {
    return approxEqual(actual, expected, opts);
  }

  const numActual = Number(coerce(actual));
  const numExpected = Number(coerce(expected));
  if (Number.isNaN(numActual) || Number.isNaN(numExpected)) {
    if (m === 'not') return actualStr !== expectedStr;
    return false;
  }
  switch (m) {
    case 'gt':
      return numActual > numExpected;
    case 'gte':
      return numActual >= numExpected;
    case 'lt':
      return numActual < numExpected;
    case 'lte':
      return numActual <= numExpected;
    case 'not':
      return numActual !== numExpected;
    default:
      return legacyEqualsMatch(actual, expected);
  }
}
