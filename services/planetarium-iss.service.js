/**
 * ISS pass predictions via Open Notify API (proxied for CORS + test mocks).
 * Development work by David Lane
 */
const OPEN_NOTIFY_ISS = 'https://api.open-notify.org/iss-pass.json';

export function normalizePass(raw) {
  const rise = Number(raw.risetime || raw.riseTime);
  const duration = Number(raw.duration);
  const maxElev = Number(raw.maxElev ?? raw.maxElevation ?? raw.max_alt);
  if (!Number.isFinite(rise) || !Number.isFinite(duration)) return null;
  return {
    riseTime: rise,
    duration,
    maxElev: Number.isFinite(maxElev) ? maxElev : null,
    start: new Date(rise * 1000).toISOString(),
    end: new Date((rise + duration) * 1000).toISOString(),
  };
}

export async function fetchIssPasses(lat, lon, fetchImpl = globalThis.fetch) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const err = new Error('lat and lon are required');
    err.code = 'INVALID_COORDS';
    throw err;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    const err = new Error('lat/lon out of range');
    err.code = 'INVALID_COORDS';
    throw err;
  }
  if (typeof fetchImpl !== 'function') {
    const err = new Error('fetch unavailable');
    err.code = 'FETCH_UNAVAILABLE';
    throw err;
  }

  const url = `${OPEN_NOTIFY_ISS}?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(`ISS API HTTP ${res.status}`);
    err.code = 'ISS_UPSTREAM';
    throw err;
  }
  const data = await res.json();
  const passes = (Array.isArray(data?.response) ? data.response : Array.isArray(data?.passes) ? data.passes : [])
    .map(normalizePass)
    .filter(Boolean)
    .sort((a, b) => a.riseTime - b.riseTime);
  return {
    lat: latitude,
    lon: longitude,
    count: passes.length,
    passes,
    source: 'open-notify.org',
  };
}

export default { fetchIssPasses, normalizePass };
