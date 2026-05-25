/**
 * Development work by David Lane
 */
/**
 * Client-side U.S. era context for Lane Memorial (general history only — not family evidence).
 * Pure date logic + dataset loaders for browser and tests.
 */

export const US_PRESIDENCY_START = '1789-04-30T00:00:00.000Z';

/**
 * @param {string|number|null|undefined} birthYear
 * @param {string|number|null|undefined} deathYear
 * @returns {Date | null} Approximate mid-life, or null if no usable year.
 */
export function getLifeMidDate(birthYear, deathYear) {
  const b = parseInt(birthYear, 10);
  const d = parseInt(deathYear, 10);
  const bOk = Number.isFinite(b);
  const dOk = Number.isFinite(d);
  if (!bOk && !dOk) return null;
  if (bOk && dOk) {
    const t0 = Date.UTC(b, 5, 15);
    const t1 = Date.UTC(d, 5, 15);
    if (t1 < t0) return new Date(t0);
    return new Date((t0 + t1) / 2);
  }
  if (bOk) return new Date(Date.UTC(b, 5, 15));
  return new Date(Date.UTC(d, 5, 15));
}

/**
 * @param {string} iso
 * @returns {number}
 */
function toMs(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

/**
 * @typedef {{ name: string, start: string, end: string, party?: string }} PresidentTerm
 * @param {PresidentTerm[]} terms
 * @param {Date} mid
 * @returns {{ term: PresidentTerm, mode: 'overlap'|'closest' } | { term: null, mode: 'before'|'unavailable' }}
 */
export function pickPresidentForMidDate(terms, mid) {
  if (!terms || !terms.length || !mid) return { term: null, mode: 'unavailable' };
  const tMid = mid.getTime();
  const tStart = toMs(US_PRESIDENCY_START);
  if (tMid < tStart) {
    return { term: null, mode: 'before' };
  }

  const overlapping = terms.filter((x) => {
    const a = toMs(x.start);
    const b = toMs(x.end);
    return Number.isFinite(a) && Number.isFinite(b) && tMid >= a && tMid <= b;
  });
  if (overlapping.length) {
    overlapping.sort(
      (p, q) => toMs(p.start) - toMs(q.start) || p.name.localeCompare(q.name)
    );
    return { term: overlapping[0], mode: 'overlap' };
  }

  let best = null;
  let bestDist = Infinity;
  for (const x of terms) {
    const a = toMs(x.start);
    const b = toMs(x.end);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const center = (a + b) / 2;
    const dist = Math.abs(tMid - center);
    if (dist < bestDist) {
      bestDist = dist;
      best = x;
    }
  }
  if (best) return { term: best, mode: 'closest' };
  return { term: null, mode: 'unavailable' };
}

/**
 * @typedef {{ id: string, label: string, blurb: string, startYear: number, endYear: number, sourceUrl?: string }} EraFigure
 * @param {EraFigure[]} figures
 * @param {Date} mid
 * @returns {EraFigure | null}
 */
export function pickEraFigureForMidDate(figures, mid) {
  if (!figures || !figures.length || !mid) return null;
  const y = mid.getUTCFullYear();
  const inRange = figures.filter(
    (f) => f.startYear != null && f.endYear != null && f.startYear <= y && y <= f.endYear
  );
  if (!inRange.length) return null;
  inRange.sort(
    (a, b) => a.endYear - a.startYear - (b.endYear - b.startYear) || a.label.localeCompare(b.label)
  );
  return inRange[0];
}

/**
 * @param {string} iso
 * @returns {string}
 */
export function formatTermRange(isoStart, isoEnd) {
  try {
    const a = new Date(isoStart);
    const b = new Date(isoEnd);
    const fmt = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
    return `${fmt.format(a)} – ${fmt.format(b)}`;
  } catch {
    return `${isoStart} – ${isoEnd}`;
  }
}

let datasetsCache = null;

/**
 * @returns {Promise<{ terms: { name: string, start: string, end: string }[], figures: { id: string, label: string, blurb: string, startYear: number, endYear: number, sourceUrl?: string }[] }>}
 */
export async function loadEraDatasets() {
  if (datasetsCache) return datasetsCache;
  const [a, b] = await Promise.all([
    fetch('/family/data/us-presidents-terms.json').then((r) => r.json()),
    fetch('/family/data/era-figures.json').then((r) => r.json())
  ]);
  const terms = Array.isArray(a.terms) ? a.terms : [];
  const figures = Array.isArray(b.figures) ? b.figures : [];
  datasetsCache = { terms, figures };
  return datasetsCache;
}
