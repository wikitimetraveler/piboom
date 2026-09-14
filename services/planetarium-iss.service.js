/**
 * ISS position + pass predictions via Celestrak TLE + satellite.js.
 * Falls back to Open Notify pass list when TLE is unavailable.
 * Development work by David Lane
 */
import * as satellite from 'satellite.js';

const OPEN_NOTIFY_ISS = 'https://api.open-notify.org/iss-pass.json';
const CELESTRAK_TLE =
  process.env.ISS_TLE_URL ||
  'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

let _tleCache = { lines: null, fetchedAt: 0 };
const TLE_TTL_MS = 6 * 60 * 60 * 1000;

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

function validateCoords(lat, lon) {
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
  return { latitude, longitude };
}

export async function fetchIssTle(fetchImpl = globalThis.fetch) {
  const now = Date.now();
  if (_tleCache.lines && now - _tleCache.fetchedAt < TLE_TTL_MS) {
    return _tleCache.lines;
  }
  if (typeof fetchImpl !== 'function') {
    const err = new Error('fetch unavailable');
    err.code = 'FETCH_UNAVAILABLE';
    throw err;
  }
  const res = await fetchImpl(CELESTRAK_TLE, { headers: { Accept: 'text/plain' } });
  if (!res.ok) {
    const err = new Error(`ISS TLE HTTP ${res.status}`);
    err.code = 'ISS_TLE_UPSTREAM';
    throw err;
  }
  const text = await res.text();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Expect name + line1 + line2 (or just two lines)
  let l1;
  let l2;
  if (lines.length >= 3 && lines[1].startsWith('1 ') && lines[2].startsWith('2 ')) {
    l1 = lines[1];
    l2 = lines[2];
  } else if (lines.length >= 2 && lines[0].startsWith('1 ') && lines[1].startsWith('2 ')) {
    l1 = lines[0];
    l2 = lines[1];
  } else {
    const err = new Error('ISS TLE parse failed');
    err.code = 'ISS_TLE_PARSE';
    throw err;
  }
  _tleCache = { lines: [l1, l2], fetchedAt: now };
  return _tleCache.lines;
}

/** Clear TLE cache (tests). */
export function clearIssTleCache() {
  _tleCache = { lines: null, fetchedAt: 0 };
}

export function lookAnglesFromTle(tleLines, date, lat, lon) {
  const satrec = satellite.twoline2satrec(tleLines[0], tleLines[1]);
  const when = date instanceof Date ? date : new Date(date);
  const pv = satellite.propagate(satrec, when);
  if (!pv || !pv.position || pv.position === false) return null;
  const gmst = satellite.gstime(when);
  const positionEcf = satellite.eciToEcf(pv.position, gmst);
  const observerGd = {
    longitude: Number(lon) * DEG,
    latitude: Number(lat) * DEG,
    height: 0,
  };
  const look = satellite.ecfToLookAngles(observerGd, positionEcf);
  return {
    alt: look.elevation * RAD,
    az: ((look.azimuth * RAD) % 360 + 360) % 360,
    rangeKm: look.rangeSat,
    date: when.toISOString(),
  };
}

/** Geodetic sub-satellite point from TLE (lat/lon degrees, height km). */
export function geodeticFromTle(tleLines, date = new Date()) {
  const satrec = satellite.twoline2satrec(tleLines[0], tleLines[1]);
  const when = date instanceof Date ? date : new Date(date);
  const pv = satellite.propagate(satrec, when);
  if (!pv || !pv.position || pv.position === false) return null;
  const gmst = satellite.gstime(when);
  const gd = satellite.eciToGeodetic(pv.position, gmst);
  const lonDeg = gd.longitude * RAD;
  return {
    lat: gd.latitude * RAD,
    lon: ((lonDeg + 540) % 360) - 180,
    altKm: gd.height,
    date: when.toISOString(),
  };
}

export async function fetchIssNow(fetchImpl = globalThis.fetch, at) {
  const tle = await fetchIssTle(fetchImpl);
  const when = at ? new Date(at) : new Date();
  const geo = geodeticFromTle(tle, when);
  if (!geo) {
    const err = new Error('ISS position unavailable');
    err.code = 'ISS_POSITION';
    throw err;
  }
  return { ...geo, source: 'celestrak-tle' };
}

/**
 * Sample the next `hours` for passes where elevation exceeds minElev deg.
 */
export function predictPassesFromTle(tleLines, lat, lon, fromDate, hours = 48, minElev = 10) {
  const start = fromDate instanceof Date ? fromDate.getTime() : new Date(fromDate).getTime();
  const end = start + hours * 3600 * 1000;
  const stepMs = 30 * 1000;
  const passes = [];
  let inPass = null;

  for (let t = start; t <= end; t += stepMs) {
    const look = lookAnglesFromTle(tleLines, new Date(t), lat, lon);
    if (!look) continue;
    if (look.alt >= minElev) {
      if (!inPass) {
        inPass = {
          riseTime: Math.floor(t / 1000),
          maxElev: look.alt,
          peakAz: look.az,
        };
      } else if (look.alt > inPass.maxElev) {
        inPass.maxElev = look.alt;
        inPass.peakAz = look.az;
      }
    } else if (inPass) {
      const duration = Math.floor(t / 1000) - inPass.riseTime;
      if (duration >= 60) {
        passes.push(
          normalizePass({
            risetime: inPass.riseTime,
            duration,
            maxElev: inPass.maxElev,
          })
        );
      }
      inPass = null;
      if (passes.length >= 8) break;
    }
  }
  return passes.filter(Boolean);
}

async function fetchOpenNotifyPasses(lat, lon, fetchImpl) {
  const url = `${OPEN_NOTIFY_ISS}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(`ISS API HTTP ${res.status}`);
    err.code = 'ISS_UPSTREAM';
    throw err;
  }
  const data = await res.json();
  return (Array.isArray(data?.response) ? data.response : Array.isArray(data?.passes) ? data.passes : [])
    .map(normalizePass)
    .filter(Boolean)
    .sort((a, b) => a.riseTime - b.riseTime);
}

export async function fetchIssPasses(lat, lon, fetchImpl = globalThis.fetch, opts = {}) {
  const { latitude, longitude } = validateCoords(lat, lon);
  if (typeof fetchImpl !== 'function') {
    const err = new Error('fetch unavailable');
    err.code = 'FETCH_UNAVAILABLE';
    throw err;
  }

  const at = opts.at ? new Date(opts.at) : new Date();
  let position = null;
  let passes = [];
  let source = 'celestrak-tle';

  try {
    const tle = await fetchIssTle(fetchImpl);
    position = lookAnglesFromTle(tle, at, latitude, longitude);
    passes = predictPassesFromTle(tle, latitude, longitude, at, 48, 10);
  } catch (_) {
    source = 'open-notify.org';
    passes = await fetchOpenNotifyPasses(latitude, longitude, fetchImpl);
  }

  return {
    lat: latitude,
    lon: longitude,
    at: at.toISOString(),
    position,
    count: passes.length,
    passes,
    source,
  };
}

export default {
  fetchIssPasses,
  fetchIssTle,
  fetchIssNow,
  lookAnglesFromTle,
  geodeticFromTle,
  predictPassesFromTle,
  normalizePass,
  clearIssTleCache,
};
