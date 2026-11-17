/**
 * Development work by David Lane
 */
import {
  EXCLUDED_LENDER_STATE_ABBR,
  EXCLUDED_LENDER_STATE_FIPS,
  isExcludedLenderState,
  sqlExcludeLenderStates,
} from '../../lib/lender-footprint.js';

describe('lender footprint', () => {
  test('excludes Alaska from the lending footprint', () => {
    expect(EXCLUDED_LENDER_STATE_ABBR).toContain('AK');
    expect(EXCLUDED_LENDER_STATE_FIPS).toContain('02');
    expect(isExcludedLenderState('ak')).toBe(true);
    expect(isExcludedLenderState('AK')).toBe(true);
    expect(isExcludedLenderState('CA')).toBe(false);
  });

  test('sqlExcludeLenderStates covers state abbr and optional FIPS', () => {
    const withFips = sqlExcludeLenderStates();
    expect(withFips).toMatch(/NOT IN \('AK'\)/);
    expect(withFips).toMatch(/NOT IN \('02'\)/);
    expect(withFips).toMatch(/state_abbr/);
    expect(withFips).toMatch(/county_fips/);

    const loansOnly = sqlExcludeLenderStates({ stateCol: 'state', fipsCol: null });
    expect(loansOnly).toMatch(/NOT IN \('AK'\)/);
    expect(loansOnly).not.toMatch(/county_fips/);
  });
});
