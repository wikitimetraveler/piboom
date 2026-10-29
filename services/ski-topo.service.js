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

const SCENIC_KINDS = new Set(['viewpoint', 'town', 'food', 'lake', 'hike', 'history']);

export const WIND_HOLD_MPH = 45;

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
  summitGustMph = null,
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
  if (Number(summitGustMph) >= WIND_HOLD_MPH) return 'caution';
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
  const freeze = Array.isArray(hourly.freezing_level_height)
    ? hourly.freezing_level_height.find((v) => v != null)
    : null;
  // precipitation_unit=inch switches Open-Meteo lengths (freezing level, snow depth) to feet.
  const freezeToFt = data.hourly_units?.freezing_level_height === 'ft' ? 1 : 3.28084;
  const depthUnit = data.current_units?.snow_depth;
  const depthToIn = depthUnit === 'ft' ? 12 : depthUnit === 'm' ? 39.3701 : 1;
  return {
    tempF: current.temperature_2m ?? null,
    precipIn: current.precipitation ?? 0,
    snowfallIn: current.snowfall ?? 0,
    snowDepthIn: current.snow_depth == null ? null : Math.round(Number(current.snow_depth) * depthToIn * 10) / 10,
    freezeLevelFt: freeze == null ? null : Math.round(Number(freeze) * freezeToFt),
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

function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hourStamp(hour) {
  if (hour?.interval?.startTime) return hour.interval.startTime;
  const stamp = hour?.displayDateTime;
  if (!stamp || stamp.year == null) return null;
  const pad = (n) => String(n ?? 0).padStart(2, '0');
  return `${stamp.year}-${pad(stamp.month)}-${pad(stamp.day)}T${pad(stamp.hours)}:${pad(stamp.minutes)}:00Z`;
}

/** One Google Weather current or hourly record, in imperial units. */
export function parseGoogleConditions(data) {
  if (!data || typeof data !== 'object') return null;
  const precip = data.precipitation || {};
  const wind = data.wind || {};
  const snow = precip.snowQpf?.quantity;
  return {
    tempF: finiteOrNull(data.temperature?.degrees),
    snowIn: snow == null ? 0 : finiteOrNull(snow) ?? 0,
    precipProb: finiteOrNull(precip.probability?.percent),
    windMph: finiteOrNull(wind.speed?.value),
    gustMph: finiteOrNull(wind.gust?.value),
    visibilityMi: finiteOrNull(data.visibility?.distance),
    condition: data.weatherCondition?.description?.text || data.weatherCondition?.type || '',
    time: hourStamp(data),
  };
}

export function parseGoogleHours(data) {
  const list = data?.forecastHours || data?.hours || [];
  return list.map((hour) => parseGoogleConditions(hour)).filter(Boolean);
}

export function buildGoogleWeather(basePack, summitPack) {
  if (!basePack && !summitPack) return null;
  const hours = (summitPack || basePack)?.hours || [];
  const summit = (summitPack || basePack)?.current || null;
  const gusts = [summit?.gustMph, ...hours.map((hour) => hour.gustMph)].filter((n) => n != null);
  const summitGustMph = gusts.length ? Math.max(...gusts) : null;
  return {
    source: (summitPack || basePack)?.source || 'google',
    base: basePack?.current || null,
    summit,
    hours,
    windHold: summitGustMph != null && summitGustMph >= WIND_HOLD_MPH,
    summitGustMph,
  };
}

const WMO_CONDITIONS = [
  [0, 'Clear'],
  [3, 'Cloudy'],
  [48, 'Fog'],
  [57, 'Drizzle'],
  [67, 'Rain'],
  [77, 'Snow'],
  [82, 'Rain showers'],
  [86, 'Snow showers'],
  [99, 'Thunderstorm'],
];

export function wmoCondition(code) {
  const n = finiteOrNull(code);
  if (n == null) return '';
  if (n >= 1 && n <= 2) return 'Partly cloudy';
  return (WMO_CONDITIONS.find(([max]) => n <= max) || [])[1] || '';
}

function openMeteoRecord(src, i) {
  const at = (key) => finiteOrNull(i == null ? src[key] : src[key]?.[i]);
  const time = i == null ? src.time : src.time?.[i];
  return {
    tempF: at('temperature_2m'),
    snowIn: at('snowfall') ?? 0,
    precipProb: at('precipitation_probability'),
    windMph: at('wind_speed_10m'),
    gustMph: at('wind_gusts_10m'),
    visibilityMi: null,
    condition: wmoCondition(i == null ? src.weather_code : src.weather_code?.[i]),
    time: time ? `${time}:00Z` : null,
  };
}

/** Parse an Open-Meteo forecast into the same { current, hours } pack as Google Weather. */
export function parseOpenMeteoHourly(data) {
  if (!data || typeof data !== 'object') return null;
  const hourly = data.hourly || {};
  const count = Array.isArray(hourly.time) ? hourly.time.length : 0;
  const hours = Array.from({ length: count }, (_, i) => openMeteoRecord(hourly, i));
  const current = data.current ? openMeteoRecord(data.current) : null;
  if (!current && !hours.length) return null;
  return { source: 'open-meteo', current, hours };
}

/** Keyless hourly summit forecast used when Google Weather has no data. */
export async function fetchOpenMeteoHourly(lat, lng, fetchFn = fetch) {
  const fields = 'temperature_2m,snowfall,precipitation_probability,wind_speed_10m,wind_gusts_10m,weather_code';
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=${fields.replace(',precipitation_probability', '')}&hourly=${fields}` +
    `&temperature_unit=fahrenheit&precipitation_unit=inch&wind_speed_unit=mph` +
    `&timezone=UTC&forecast_hours=24`;
  try {
    return parseOpenMeteoHourly(await fetchJson(url, { 'User-Agent': NWS_UA }, fetchFn));
  } catch (_) {
    return null;
  }
}

export async function fetchGoogleWeather(lat, lng, fetchFn = fetch, apiKey) {
  const key = apiKey === undefined ? getGoogleServerApiKey() : apiKey;
  if (!key) return null;
  const q =
    `location.latitude=${encodeURIComponent(lat)}&location.longitude=${encodeURIComponent(lng)}` +
    `&unitsSystem=IMPERIAL&key=${encodeURIComponent(key)}`;
  try {
    const [currentRes, hoursRes] = await Promise.all([
      fetchFn(`https://weather.googleapis.com/v1/currentConditions:lookup?${q}`),
      fetchFn(`https://weather.googleapis.com/v1/forecast/hours:lookup?${q}&hours=24`),
    ]);
    if (!currentRes?.ok && !hoursRes?.ok) return null;
    const current = currentRes?.ok ? parseGoogleConditions(await currentRes.json()) : null;
    const hours = hoursRes?.ok ? parseGoogleHours(await hoursRes.json()) : [];
    if (!current && !hours.length) return null;
    return { source: 'google', current, hours };
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

  const summitLat = dest.summitLat ?? dest.lat;
  const summitLng = dest.summitLng ?? dest.lng;
  const samePoint = summitLat === dest.lat && summitLng === dest.lng;

  const [openMeteo, nwsAlerts, nwsForecast, liveDrive, googleBase, googleSummit] = await Promise.all([
    fetchOpenMeteo(dest.lat, dest.lng, fetchFn).catch(() => ({})),
    fetchNwsAlerts(dest.lat, dest.lng, fetchFn),
    fetchNwsForecast(dest.lat, dest.lng, fetchFn),
    fetchDriveMinutes(home, dest, fetchFn),
    fetchGoogleWeather(dest.lat, dest.lng, fetchFn),
    samePoint ? Promise.resolve(null) : fetchGoogleWeather(summitLat, summitLng, fetchFn),
  ]);
  weather = openMeteo || {};
  alerts = nwsAlerts;
  forecast = nwsForecast;
  if (liveDrive != null) {
    driveMin = liveDrive;
    driveSource = 'distance-matrix';
  }
  let basePack = googleBase;
  let summitPack = samePoint ? googleBase : googleSummit;
  if (!basePack && !summitPack) {
    const [omBase, omSummit] = await Promise.all([
      fetchOpenMeteoHourly(dest.lat, dest.lng, fetchFn),
      samePoint ? Promise.resolve(null) : fetchOpenMeteoHourly(summitLat, summitLng, fetchFn),
    ]);
    basePack = omBase;
    summitPack = samePoint ? omBase : omSummit;
  }
  const googleWeather = buildGoogleWeather(basePack, summitPack);

  const score = scoreGoNoGo({
    freezeLevelFt: weather.freezeLevelFt,
    resortBaseFt: dest.baseFt,
    alerts,
    precipIn: weather.precipIn,
    summitGustMph: googleWeather?.summitGustMph ?? null,
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
    summitLat,
    summitLng,
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
    googleWeather,
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
  fetchGoogleWeather,
  buildGoogleWeather,
  fetchOpenMeteoHourly,
  parseOpenMeteoHourly,
  getBrief,
  buildDestinationBrief,
  CHAIN_ELEV_FT,
};
