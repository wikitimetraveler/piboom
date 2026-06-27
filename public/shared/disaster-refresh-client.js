/**
 * Client helpers for POST /api/disasters/refresh and /refresh-cameras.
 * Hosted servers require DISASTER_REFRESH_TOKEN; localhost works without it.
 */
const STORAGE_KEY = 'disasterRefreshToken';
const URL_PARAM = 'disasterRefreshToken';

export function captureDisasterRefreshTokenFromUrl() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const token = String(params.get(URL_PARAM) || '').trim();
  if (!token) return;
  sessionStorage.setItem(STORAGE_KEY, token);
  params.delete(URL_PARAM);
  const next = params.toString();
  const url = window.location.pathname + (next ? `?${next}` : '') + window.location.hash;
  window.history.replaceState({}, '', url);
}

export function getDisasterRefreshToken() {
  if (typeof sessionStorage === 'undefined') return '';
  return String(sessionStorage.getItem(STORAGE_KEY) || '').trim();
}

export function setDisasterRefreshToken(token) {
  if (typeof sessionStorage === 'undefined') return;
  const trimmed = String(token || '').trim();
  if (trimmed) sessionStorage.setItem(STORAGE_KEY, trimmed);
  else sessionStorage.removeItem(STORAGE_KEY);
}

export function getDisasterRefreshHeaders() {
  const headers = { Accept: 'application/json' };
  const token = getDisasterRefreshToken();
  if (token) headers['x-disaster-refresh-token'] = token;
  return headers;
}

export async function promptForDisasterRefreshToken() {
  if (typeof window === 'undefined') return null;
  const existing = getDisasterRefreshToken();
  const entered = window.prompt(
    'Pull live hazard APIs into Postgres. Enter DISASTER_REFRESH_TOKEN (required on hosted servers, optional on localhost):',
    existing,
  );
  if (entered === null) return null;
  const trimmed = String(entered).trim();
  if (trimmed) setDisasterRefreshToken(trimmed);
  return trimmed || null;
}

/**
 * POST a disaster refresh endpoint; prompts for token once on 401/403.
 * @returns {{ resp: Response, json: object }}
 */
export async function postDisasterRefresh(path, { searchParams, retryOnAuth = true } = {}) {
  const qs = searchParams?.toString?.() || '';
  const url = qs ? `${path}?${qs}` : path;

  let resp = await fetch(url, {
    method: 'POST',
    headers: getDisasterRefreshHeaders(),
  });

  if (retryOnAuth && (resp.status === 401 || resp.status === 403)) {
    const token = await promptForDisasterRefreshToken();
    if (token) {
      resp = await fetch(url, {
        method: 'POST',
        headers: getDisasterRefreshHeaders(),
      });
    }
  }

  let json;
  try {
    json = await resp.json();
  } catch {
    json = { success: false, error: `HTTP ${resp.status}` };
  }

  return { resp, json };
}
