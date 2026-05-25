/**
 * Development work by David Lane
 */
import {
  FINANCE_SESSION_COOKIE,
  FINANCE_SESSION_VALUE,
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
});
