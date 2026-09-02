/**
 * EPA AirNow API proxy — lat/long and zip observations + forecasts.
 * @see https://docs.airnowapi.org/webservices
 * Development work by David Lane
 */
const AIRNOW_BASE = 'https://www.airnowapi.org/';

export const ENDPOINTS = {
  forecastLatLong: 'aq/forecast/latLong/',
  observationZipCurrent: 'aq/observation/zipCode/current/',
  observationLatLongCurrent: 'aq/observation/latLong/current/',
  observationZipHistorical: 'aq/observation/zipCode/historical/',
  observationLatLongHistorical: 'aq/observation/latLong/historical/',
};

export function getAirNowApiKey() {
  return String(process.env.AIRNOW_API_KEY || '').trim();
}

export function isAirNowConfigured() {
  return getAirNowApiKey().length > 0;
}

export function parseLatitude(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < -90 || n > 90) {
    const err = new Error('Invalid latitude');
    err.code = 'INVALID_LAT';
    throw err;
  }
  return n;
}

export function parseLongitude(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < -180 || n > 180) {
    const err = new Error('Invalid longitude');
    err.code = 'INVALID_LON';
    throw err;
  }
  return n;
}

export function parseZipCode(value) {
  const zip = String(value || '').trim();
  if (!/^\d{5}(-\d{4})?$/.test(zip)) {
    const err = new Error('Invalid zip code');
    err.code = 'INVALID_ZIP';
    throw err;
  }
  return zip.slice(0, 5);
}

export function parseOptionalDate(value) {
  if (value == null || value === '') return undefined;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const err = new Error('Invalid date — use YYYY-MM-DD');
    err.code = 'INVALID_DATE';
    throw err;
  }
  return s;
}

export function parseDistance(value, fallback = 25) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 250) {
    const err = new Error('Invalid distance — use 1–250 miles');
    err.code = 'INVALID_DISTANCE';
    throw err;
  }
  return Math.round(n);
}

function rowAqi(row) {
  const n = Number(row?.AQI ?? row?.aqi ?? row?.nowcastAQI ?? row?.NowCastAQI);
  return Number.isFinite(n) ? n : 0;
}

function rowCategory(row) {
  return (
    row?.Category?.Name ??
    row?.category?.name ??
    row?.CategoryName ??
    row?.categoryName ??
    ''
  );
}

function rowParameter(row) {
  return row?.ParameterName ?? row?.parameterName ?? row?.pollutant ?? 'Unknown';
}

function rowReportingArea(row) {
  return row?.ReportingArea ?? row?.reportingArea ?? row?.area ?? null;
}

/** Collapse pollutant rows to a single headline AQI for UI chips. */
export function summarizeObservations(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let headline = null;
  const pollutants = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const aqi = rowAqi(row);
    const entry = {
      parameter: rowParameter(row),
      aqi,
      category: rowCategory(row),
    };
    pollutants.push(entry);
    if (!headline || aqi >= headline.aqi) {
      headline = {
        aqi,
        category: entry.category,
        parameter: entry.parameter,
        reportingArea: rowReportingArea(row),
        stateCode: row?.StateCode ?? row?.stateCode ?? null,
        dateObserved: row?.DateObserved ?? row?.dateObserved ?? null,
        hourObserved: row?.HourObserved ?? row?.hourObserved ?? null,
      };
    }
  }
  return { ...headline, pollutants };
}

export async function airnowFetch(path, params = {}) {
  const apiKey = getAirNowApiKey();
  if (!apiKey) {
    const err = new Error('AirNow API key not configured (AIRNOW_API_KEY)');
    err.code = 'AIRNOW_NOT_CONFIGURED';
    throw err;
  }
  const qs = new URLSearchParams({
    format: 'application/json',
    API_KEY: apiKey,
  });
  Object.entries(params).forEach(([key, val]) => {
    if (val != null && val !== '') qs.set(key, String(val));
  });
  const url = `${AIRNOW_BASE}${path}?${qs.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'DevConnectLabs/1.0' },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    const err = new Error('AirNow returned non-JSON response');
    err.code = 'AIRNOW_BAD_RESPONSE';
    err.status = res.status;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(
      typeof data === 'object' && data?.message ? data.message : `AirNow HTTP ${res.status}`
    );
    err.code = 'AIRNOW_HTTP_ERROR';
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export async function getCurrentObservationByLatLong({ lat, lon, distance }) {
  const latitude = parseLatitude(lat);
  const longitude = parseLongitude(lon);
  const miles = parseDistance(distance);
  const raw = await airnowFetch(ENDPOINTS.observationLatLongCurrent, {
    latitude,
    longitude,
    distance: miles,
  });
  return {
    ok: true,
    source: 'airnow',
    endpoint: ENDPOINTS.observationLatLongCurrent,
    latitude,
    longitude,
    distance: miles,
    summary: summarizeObservations(raw),
    observations: raw,
  };
}

export async function getCurrentObservationByZip({ zipCode, distance }) {
  const zip = parseZipCode(zipCode);
  const miles = parseDistance(distance);
  const raw = await airnowFetch(ENDPOINTS.observationZipCurrent, {
    zipCode: zip,
    distance: miles,
  });
  return {
    ok: true,
    source: 'airnow',
    endpoint: ENDPOINTS.observationZipCurrent,
    zipCode: zip,
    distance: miles,
    summary: summarizeObservations(raw),
    observations: raw,
  };
}

export async function getHistoricalObservationByLatLong({ lat, lon, date, distance }) {
  const latitude = parseLatitude(lat);
  const longitude = parseLongitude(lon);
  const miles = parseDistance(distance);
  const params = { latitude, longitude, distance: miles };
  const day = parseOptionalDate(date);
  if (day) params.date = day;
  const raw = await airnowFetch(ENDPOINTS.observationLatLongHistorical, params);
  return {
    ok: true,
    source: 'airnow',
    endpoint: ENDPOINTS.observationLatLongHistorical,
    latitude,
    longitude,
    date: day || null,
    distance: miles,
    summary: summarizeObservations(raw),
    observations: raw,
  };
}

export async function getHistoricalObservationByZip({ zipCode, date, distance }) {
  const zip = parseZipCode(zipCode);
  const miles = parseDistance(distance);
  const params = { zipCode: zip, distance: miles };
  const day = parseOptionalDate(date);
  if (day) params.date = day;
  const raw = await airnowFetch(ENDPOINTS.observationZipHistorical, params);
  return {
    ok: true,
    source: 'airnow',
    endpoint: ENDPOINTS.observationZipHistorical,
    zipCode: zip,
    date: day || null,
    distance: miles,
    summary: summarizeObservations(raw),
    observations: raw,
  };
}

export async function getForecastByLatLong({ lat, lon, date }) {
  const latitude = parseLatitude(lat);
  const longitude = parseLongitude(lon);
  const params = { latitude, longitude };
  const day = parseOptionalDate(date);
  if (day) params.date = day;
  const raw = await airnowFetch(ENDPOINTS.forecastLatLong, params);
  const rows = Array.isArray(raw) ? raw : raw?.forecasts || raw?.Forecasts || [];
  return {
    ok: true,
    source: 'airnow',
    endpoint: ENDPOINTS.forecastLatLong,
    latitude,
    longitude,
    date: day || null,
    forecasts: rows,
    summary: summarizeObservations(rows),
  };
}

export function getAirNowStatus() {
  return {
    configured: isAirNowConfigured(),
    baseUrl: AIRNOW_BASE,
    endpoints: ENDPOINTS,
  };
}

export default {
  ENDPOINTS,
  getAirNowApiKey,
  isAirNowConfigured,
  parseLatitude,
  parseLongitude,
  parseZipCode,
  summarizeObservations,
  getCurrentObservationByLatLong,
  getCurrentObservationByZip,
  getHistoricalObservationByLatLong,
  getHistoricalObservationByZip,
  getForecastByLatLong,
  getAirNowStatus,
};
