/**
 * Ski Cams: official resort cam links plus fire, summit, and road cams near each resort
 * from the hazard webcam catalog (fire_cameras).
 * Development work by David Lane
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCamerasNearPoint } from './disaster-spatial.service.js';
import { calculateDistance } from './disasters.service.js';
import { loadDestinations } from './ski-topo.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAMS_FILE = path.join(__dirname, '..', 'data', 'ski', 'resort-cams.json');

const KM_PER_MILE = 1.60934;
export const ON_MOUNTAIN_MI = 3;
export const NEARBY_MI = 20;
export const ROAD_MI = 35;
const GROUP_CAP = 12;
const ROAD_CAMS_PER_ROUTE = 4;

const SOURCE_LABELS = {
  alertcalifornia: 'ALERTCalifornia',
  alertwest: 'ALERTWest',
  ucsd_hpwren: 'HPWREN',
  caltrans_cwwp2: 'Caltrans',
  faa_weathercam: 'FAA WeatherCam',
  usgs_nims: 'USGS',
};

/** "CA-2" -> "SR-2", "I-5 / CA-91" -> ["I-5", "SR-91"]; CA-210 is signed I-210 on the Caltrans feed. */
export function normalizeHighways(list = []) {
  const out = new Set();
  for (const entry of list) {
    for (const part of String(entry || '').split('/')) {
      const m = part.trim().toUpperCase().match(/^(CA|SR|US|I)-?\s*(\d+)$/);
      if (!m) continue;
      const kind = m[1] === 'CA' ? 'SR' : m[1];
      out.add(`${kind}-${m[2]}`);
      if (kind === 'SR' && m[2] === '210') out.add('I-210');
    }
  }
  return [...out];
}

function milesBetween(a, b) {
  const km = calculateDistance(a.lat, a.lng, b.lat, b.lng);
  return km == null ? null : km / KM_PER_MILE;
}

export function toSkiCam(row, dest) {
  const point = { lat: Number(row.lat), lng: Number(row.lng) };
  const base = milesBetween(point, dest);
  const summit = milesBetween(point, { lat: dest.summitLat ?? dest.lat, lng: dest.summitLng ?? dest.lng });
  const distances = [base, summit].filter((n) => n != null);
  const distanceMi = distances.length ? Math.round(Math.min(...distances) * 10) / 10 : null;
  return {
    id: row.id,
    name: row.name || 'Camera',
    source: row.source,
    sourceLabel: SOURCE_LABELS[row.source] || row.source,
    lat: point.lat,
    lng: point.lng,
    distanceMi,
    imageUrl: row.image_url || null,
    pageUrl: row.camera_url || row.network_url || null,
    route: row.raw?.route || null,
    refreshMinutes: row.refresh_minutes ?? null,
    mediaType: row.media_type || null,
  };
}

/** Split catalog rows into on-the-mountain, nearby peaks, and the roads in. */
export function groupSkiCams(dest, rows = []) {
  const cams = rows.map((row) => toSkiCam(row, dest)).filter((c) => c.distanceMi != null && c.imageUrl);
  const byDistance = (a, b) => a.distanceMi - b.distanceMi;
  const chain = normalizeHighways(dest.chainHighways);
  const routes = normalizeHighways([...(dest.chainHighways || []), ...(dest.highways || [])]);

  const mountainCams = cams.filter((c) => c.source !== 'caltrans_cwwp2');
  const mountain = mountainCams.filter((c) => c.distanceMi <= ON_MOUNTAIN_MI).sort(byDistance);
  const nearby = mountainCams
    .filter((c) => c.distanceMi > ON_MOUNTAIN_MI && c.distanceMi <= NEARBY_MI)
    .sort(byDistance)
    .slice(0, GROUP_CAP);

  const roadRank = (c) => (chain.includes(c.route) ? 0 : 1);
  const perRoute = {};
  const roads = cams
    .filter((c) => c.source === 'caltrans_cwwp2' && c.distanceMi <= ROAD_MI && routes.includes(c.route))
    .sort((a, b) => roadRank(a) - roadRank(b) || byDistance(a, b))
    .filter((c) => (perRoute[c.route] = (perRoute[c.route] || 0) + 1) <= ROAD_CAMS_PER_ROUTE)
    .slice(0, GROUP_CAP);

  return { mountain: mountain.slice(0, GROUP_CAP), nearby, roads };
}

export async function loadResortCamLinks() {
  try {
    return JSON.parse(await readFile(CAMS_FILE, 'utf8'));
  } catch (_) {
    return { regional: [], resorts: {} };
  }
}

export async function getSkiCams(destId, { findCams = resolveCamerasNearPoint } = {}) {
  const catalog = await loadDestinations();
  const dest = (catalog.destinations || []).find((d) => d.id === destId);
  if (!dest) return null;
  const links = await loadResortCamLinks();
  let groups = { mountain: [], nearby: [], roads: [] };
  let note = '';
  try {
    const { rows } = await findCams({ lat: dest.lat, lng: dest.lng, radiusMiles: ROAD_MI, limit: 500 });
    groups = groupSkiCams(dest, rows);
  } catch (error) {
    note = 'Live cam catalog unavailable right now. Official resort cam links still work.';
  }
  return {
    resort: {
      id: dest.id,
      name: dest.name,
      area: dest.area,
      baseFt: dest.baseFt,
      summitFt: dest.summitFt,
      chainHighways: dest.chainHighways || [],
    },
    official: links.resorts?.[dest.id] || [],
    regional: links.regional || [],
    ...groups,
    note,
    fetchedAt: new Date().toISOString(),
  };
}

export default { getSkiCams, groupSkiCams, normalizeHighways, loadResortCamLinks };
