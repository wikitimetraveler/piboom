/**
 * Mortgage demo / lending footprint — states we do not originate in.
 * Development work by David Lane
 */

/** State abbreviations outside the lending footprint (no loans). */
export const EXCLUDED_LENDER_STATE_ABBR = Object.freeze(['AK']);

/** Matching state FIPS prefixes (county_fips LEFT 2). Alaska = 02. */
export const EXCLUDED_LENDER_STATE_FIPS = Object.freeze(['02']);

export function normalizeStateAbbr(value) {
  return String(value || '').trim().toUpperCase();
}

export function isExcludedLenderState(abbr) {
  return EXCLUDED_LENDER_STATE_ABBR.includes(normalizeStateAbbr(abbr));
}

/**
 * SQL fragment excluding out-of-footprint states by abbr and/or county FIPS.
 * @param {{ stateCol?: string, fipsCol?: string|null }} [opts]
 */
export function sqlExcludeLenderStates(opts = {}) {
  const stateCol = opts.stateCol || 'state_abbr';
  const fipsCol = opts.fipsCol === undefined ? 'county_fips' : opts.fipsCol;
  const abbrList = EXCLUDED_LENDER_STATE_ABBR.map((a) => `'${a}'`).join(',');
  const parts = [`UPPER(TRIM(COALESCE(${stateCol},''))) NOT IN (${abbrList})`];
  if (fipsCol) {
    const fipsList = EXCLUDED_LENDER_STATE_FIPS.map((f) => `'${f}'`).join(',');
    parts.push(`LEFT(COALESCE(${fipsCol},''), 2) NOT IN (${fipsList})`);
  }
  return `(${parts.join(' AND ')})`;
}
