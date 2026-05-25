/**
 * Development work by David Lane
 */
/** Finance HTML gate cookie (pairs with requireFinanceSession in server.js). */
export const FINANCE_SESSION_COOKIE = 'dc_finance_session';
export const FINANCE_SESSION_VALUE = '1';
export const FINANCE_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export function financeSessionSetCookieHeader() {
  return `${FINANCE_SESSION_COOKIE}=${FINANCE_SESSION_VALUE}; Path=/; Max-Age=${FINANCE_SESSION_MAX_AGE_SEC}; SameSite=Lax`;
}

export function financeSessionClearCookieHeader() {
  return `${FINANCE_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readCookieHeader(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    if (k !== name) continue;
    return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function hasFinanceSession(req) {
  return readCookieHeader(req, FINANCE_SESSION_COOKIE) === FINANCE_SESSION_VALUE;
}
