/**
 * Ski Topo brief: NWS + Open-Meteo, go/no-go, drive notes.
 * Development work by David Lane
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGoogleServerApiKey } from '../lib/google-api-key.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data/ski');
const NWS_UA = 'DevConnectLabs-SkiTopo/1.0 (ski-desk)';
export const CHAIN_ELEV_FT = 4500;

const SCENIC_KINDS = new Set(['viewpoint', 'town', 'food', 'lake']);

let catalogCache = null;

export async function loadDestinations() {
  if (catalogCache?.destinations) return catalogCache.destinations;
  const raw = JSON.parse(await readFile(path.join(DATA_DIR, 'destinations.json'), 'utf8'));
  catalogCache = { ...(catalogCache || {}), destinations: raw };
  return raw;
}

export async function loadOnTheWaySeed() {
  const raw = JSON.parse(await readFile(path.join(DATA_DIR, 'on-the-way.json'), 'utf8'));
  return Array.isArray(raw.stops) ? raw.stops : [];
}

export async function loadRoutes() {
  return JSON.parse(await readFile(path.join(DATA_DIR, 'routes.json'), 'utf8'));
}

export function normalizeKind(kind) {
  return String(kind || '').trim().toLowerCase();
}

export function filterStops(stops, { route, kind } = {}) {
  const list = Array.isArray(stops) ? stops : [];
  const wantRoute = route ? String(route) : '';
  const wantKind = kind ? normalizeKind(kind) : '';
  return list.filter((stop) => {
    const stopRoute = stop.route || '';
    if (wantRoute && stopRoute !== wantRoute && stopRoute !== 'both') return false;
    if (!wantKind || wantKind === 'all') return true;
    if (wantKind === 'scenic') return SCENIC_KINDS.has(normalizeKind(stop.kind));
    return normalizeKind(stop.kind) === wantKind;
  });
}

export function stopKey(stop) {
  if (stop.placeId) return `place:${stop.placeId}`;
  const name = String(stop.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const town = String(stop.town || '').toLowerCase().trim();
  return `${name}|${town}`;
}

export function mergeStops(seed = [], live = []) {
  const out = [];
  const seen = new Set();
  for (const stop of [...seed, ...live]) {
    const key = stopKey(stop);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(stop);
  }
  return out;
}

export function scoreGoNoGo({
  freezeLevelFt = null,
  resortBaseFt = null,
  alerts = [],
  precipIn = 0,
} = {}) {
  const events = (alerts || []).map((a) =>
    `${a.event || ''} ${a.severity || ''} ${a.headline || ''}`.toLowerCase()
  );
  const hasWarning = events.some((t) =>
    /(blizzard|ice storm|winter storm warning|avalanche warning)/.test(t)
  );
  if (hasWarning) return 'no-go';

  const hasAdvisory = events.some((t) =>
    /(winter weather|wind chill|freeze warning|winter storm advisory)/.test(t)
  );
  const freeze = freezeLevelFt == null ? null : Number(freezeLevelFt);
  const base = resortBaseFt == null ? null : Number(resortBaseFt);
  const wet = Number(precipIn) > 0.05;

  if (freeze == null && !events.length) return 'caution';
  if (hasAdvisory) return 'caution';
  if (freeze != null && base != null && freeze <= base && wet) return 'caution';
  if (freeze != null && freeze <= CHAIN_ELEV_FT && wet) return 'caution';
  return 'go';
}

export function chainsLikely({ freezeLevelFt = null, alerts = [] } = {}) {
  const events = (alerts || []).map((a) => `${a.event || ''}`.toLowerCase());
  if (events.some((t) => /winter|blizzard|ice|snow/.test(t))) return true;
  if (freezeLevelFt != null && Number(freezeLevelFt) <= CHAIN_ELEV_FT) return true;
  return false;
}

function nwsHeaders() {
  return { 'User-Agent': NWS_UA, Accept: 'application/geo+json, application/json' };
}

async function fetchJson(url, headers, fetchFn = fetch) {
  const res = await fetchFn(url, { headers });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

export async function fetchOpenMeteo(lat, lng, fetchFn = fetch) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,snowfall,snow_depth,precipitation` +
    `&hourly=freezing_level_height` +
    `&temperature_unit=fahrenheit&precipitation_unit=inch&forecast_days=1`;
  const data = await fetchJson(url, { 'User-Agent': NWS_UA }, fetchFn);
  const current = data.current || {};
  const hourly = data.hourly || {};
  const freezeM = Array.isArray(hourly.freezing_level_height)
    ? hourly.freezing_level_height.find((v) => v != null)
    : null;
  return {
    tempF: current.temperature_2m ?? null,
    precipIn: current.precipitation ?? 0,
    snowfallIn: current.snowfall ?? 0,
    snowDepthIn: current.snow_depth ?? null,
    freezeLevelFt: freezeM == null ? null : Math.round(Number(freezeM) * 3.28084),
  };
}

export async function fetchNwsAlerts(lat, lng, fetchFn = fetch) {
  const url = `https://api.weather.gov/alerts/active?point=${lat},${lng}`;
  try {
    const data = await fetchJson(url, nwsHeaders(), fetchFn);
    return (data.features || []).map((f) => ({
      event: f.properties?.event || 'Alert',
      severity: f.properties?.severity || '',
      headline: f.properties?.headline || f.properties?.event || '',
    }));
  } catch (_) {
    return [];
  }
}

export async function fetchNwsForecast(lat, lng, fetchFn = fetch) {
  try {
    const points = await fetchJson(
      `https://api.weather.gov/points/${lat},${lng}`,
      nwsHeaders(),
      fetchFn
    );
    const forecastUrl = points.properties?.forecast;
    if (!forecastUrl) return null;
    const forecast = await fetchJson(forecastUrl, nwsHeaders(), fetchFn);
    const period = forecast.properties?.periods?.[0];
    if (!period) return null;
    return {
      name: period.name,
      shortForecast: period.shortForecast,
      detailedForecast: period.detailedForecast,
      temperature: period.temperature,
      temperatureUnit: period.temperatureUnit,
    };
  } catch (_) {
    return null;
  }
}

export async function fetchDriveMinutes(origin, dest, fetchFn = fetch) {
  const key = getGoogleServerApiKey();
  if (!key) return null;
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${origin.lat},${origin.lng}&destinations=${dest.lat},${dest.lng}` +
    `&units=imperial&key=${encodeURIComponent(key)}`;
  try {
    const data = await fetchJson(url, {}, fetchFn);
    const minutes = data.rows?.[0]?.elements?.[0]?.duration?.value;
    if (minutes == null) return null;
    return Math.round(Number(minutes) / 60);
  } catch (_) {
    return null;
  }
}

export async function buildDestinationBrief(dest, home, fetchFn = fetch) {
  let weather = {};
  let alerts = [];
  let forecast = null;
  let driveMin = dest.typicalDriveMin;
  let driveSource = 'typical';

  try {
    weather = await fetchOpenMeteo(dest.lat, dest.lng, fetchFn);
  } catch (_) {
    weather = {};
  }
  alerts = await fetchNwsAlerts(dest.lat, dest.lng, fetchFn);
  forecast = await fetchNwsForecast(dest.lat, dest.lng, fetchFn);
  const liveDrive = await fetchDriveMinutes(home, dest, fetchFn);
  if (liveDrive != null) {
    driveMin = liveDrive;
    driveSource = 'distance-matrix';
  }

  const score = scoreGoNoGo({
    freezeLevelFt: weather.freezeLevelFt,
    resortBaseFt: dest.baseFt,
    alerts,
    precipIn: weather.precipIn,
  });
  const chains = chainsLikely({ freezeLevelFt: weather.freezeLevelFt, alerts });

  return {
    id: dest.id,
    name: dest.name,
    area: dest.area,
    route: dest.route,
    dem: dest.dem,
    lat: dest.lat,
    lng: dest.lng,
    baseFt: dest.baseFt,
    summitFt: dest.summitFt,
    verticalFt: dest.summitFt - dest.baseFt,
    highways: dest.highways,
    chainHighways: dest.chainHighways,
    mapsDest: dest.mapsDest,
    typicalDriveMin: dest.typicalDriveMin,
    driveMin,
    driveSource,
    weather,
    forecast,
    alerts,
    score,
    chainsLikely: chains,
  };
}

export async function getBrief({ fetchFn = fetch } = {}) {
  const catalog = await loadDestinations();
  const home = catalog.home;
  const destinations = [];
  for (const dest of catalog.destinations || []) {
    destinations.push(await buildDestinationBrief(dest, home, fetchFn));
  }
  return {
    home,
    disclaimer: catalog.disclaimer,
    fetchedAt: new Date().toISOString(),
    destinations,
  };
}

export default {
  loadDestinations,
  loadOnTheWaySeed,
  loadRoutes,
  filterStops,
  mergeStops,
  stopKey,
  scoreGoNoGo,
  chainsLikely,
  getBrief,
  buildDestinationBrief,
  CHAIN_ELEV_FT,
};
