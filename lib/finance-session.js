/**
 * Development work by David Lane
 */
/** Finance HTML gate cookie (pairs with requireFinanceSession in server.js). */
export const FINANCE_SESSION_COOKIE = 'dc_finance_session';
export const FINANCE_SESSION_VALUE = '1';
export const FINANCE_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

/**
 * Static assets under /finance/ that may load without a session cookie.
 * Public hazard pages (disasters-unified) fetch .geojson/.topojson for the hazard lens;
 * without these, Express redirects to HTML login and fetch().json() blows up.
 */
export const FINANCE_PUBLIC_FILE =
  /\.(js|mjs|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|map|json|geojson|topojson|txt|xml|kml|mp4|webm|wasm)$/i;

/**
 * Finance HTML pages open without login (disaster suite only).
 * Keep client mirrors in sync: menu-config.js, finance-auth-guard.js,
 * tool-search-index.js, ice-landing-shell.js.
 */
export const FINANCE_PUBLIC_PAGES = new Set([
  '/finance/disasters-unified.html',
  '/finance/disasters-webcams.html',
  '/finance/disasters-encompass-map.html',
]);

/** True when GET/HEAD of this path must present a finance session cookie. */
export function financePathNeedsSession(urlPath) {
  if (urlPath === '/finance' || urlPath === '/finance/') return true;
  if (!urlPath.startsWith('/finance/')) return false;
  if (FINANCE_PUBLIC_PAGES.has(urlPath)) return false;
  return !FINANCE_PUBLIC_FILE.test(urlPath);
}

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
