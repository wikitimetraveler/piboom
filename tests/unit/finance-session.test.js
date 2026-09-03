/**
 * Development work by David Lane
 */
import {
  FINANCE_SESSION_COOKIE,
  FINANCE_SESSION_VALUE,
  financePathNeedsSession,
  financeSessionClearCookieHeader,
  financeSessionSetCookieHeader,
  hasFinanceSession,
  readCookieHeader,
} from '../../lib/finance-session.js';

describe('finance-session', () => {
  test('hasFinanceSession accepts valid cookie header', () => {
    expect(
      hasFinanceSession({
        headers: { cookie: `${FINANCE_SESSION_COOKIE}=${FINANCE_SESSION_VALUE}` },
      })
    ).toBe(true);
  });

  test('hasFinanceSession rejects missing or wrong cookie', () => {
    expect(hasFinanceSession({ headers: {} })).toBe(false);
    expect(
      hasFinanceSession({ headers: { cookie: `${FINANCE_SESSION_COOKIE}=0` } })
    ).toBe(false);
  });

  test('readCookieHeader parses encoded values', () => {
    expect(
      readCookieHeader({ headers: { cookie: 'foo=bar; dc_finance_session=1' } }, 'dc_finance_session')
    ).toBe('1');
  });

  test('cookie header builders include Path and SameSite', () => {
    expect(financeSessionSetCookieHeader()).toMatch(/dc_finance_session=1/);
    expect(financeSessionSetCookieHeader()).toMatch(/Max-Age=/);
    expect(financeSessionClearCookieHeader()).toMatch(/Max-Age=0/);
  });

  test('financePathNeedsSession allows public disaster suite and hazard geo assets', () => {
    expect(financePathNeedsSession('/finance/disasters-unified.html')).toBe(false);
    expect(financePathNeedsSession('/finance/disasters-webcams.html')).toBe(false);
    expect(financePathNeedsSession('/finance/disasters-encompass-map.html')).toBe(false);
    expect(financePathNeedsSession('/finance/assets/geo/us-states.geojson')).toBe(false);
    expect(financePathNeedsSession('/finance/assets/geo/us-states.topojson')).toBe(false);
    expect(financePathNeedsSession('/finance/assets/geo/counties/CA.geojson')).toBe(false);
    expect(financePathNeedsSession('/finance/assets/video/unified-disasters-reel.mp4')).toBe(false);
    expect(financePathNeedsSession('/finance/js/disasters-unified/geo-data.js')).toBe(false);
  });

  test('financePathNeedsSession gates Worksheets hub, calculators, and Encompass HTML', () => {
    expect(financePathNeedsSession('/finance')).toBe(true);
    expect(financePathNeedsSession('/finance/')).toBe(true);
    expect(financePathNeedsSession('/finance/index.html')).toBe(true);
    expect(financePathNeedsSession('/finance/fha-streamline-calculator.html')).toBe(true);
    expect(financePathNeedsSession('/finance/dti-calculator.html')).toBe(true);
    expect(financePathNeedsSession('/finance/va-irrrl-calculator.html')).toBe(true);
    expect(financePathNeedsSession('/finance/encompass-hub.html')).toBe(true);
    expect(financePathNeedsSession('/finance/unit-tests.html')).toBe(true);
  });
});
