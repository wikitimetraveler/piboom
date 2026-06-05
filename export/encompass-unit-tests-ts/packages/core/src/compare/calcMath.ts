/**
 * Unit-test slice from piBoom calcEngineLibrary.js (parseUnitTestDateMs, approxEqual).
 */

function toNumber(value: unknown, invalidValue = NaN): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : invalidValue;
  if (value === null || value === undefined) return invalidValue;
  const raw = String(value).trim();
  if (!raw) return invalidValue;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : invalidValue;
}

export function parseUnitTestDateMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const m = Number(slash[1]);
    const d = Number(slash[2]);
    const y = Number(slash[3]);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt.setHours(0, 0, 0, 0);
  }
  const isoDay = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) {
    const dt = new Date(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]));
    return Number.isNaN(dt.getTime()) ? null : dt.setHours(0, 0, 0, 0);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
}

export function approxEqual(
  actual: unknown,
  expected: unknown,
  opts: { epsilon?: number } = {}
): boolean {
  const epsilon = opts.epsilon ?? 0.005;
  const a = toNumber(actual, NaN);
  const b = toNumber(expected, NaN);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= epsilon;
}
