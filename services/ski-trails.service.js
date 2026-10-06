/**
 * Ski runs + lifts (OpenStreetMap) draped on the ski-area DEMs.
 * DEM → per-run vertical, pitch, and facing → run finder + Ridge context.
 * Development work by David Lane
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aspectName, interpolateDem, loadDem, slopeAspectAt, SKI_DEM_SPECS } from './ski-dem.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data/ski');

export const LIFT_TYPES = [
  'chair_lift',
  'gondola',
  'cable_car',
  'mixed_lift',
  'drag_lift',
  't-bar',
  'j-bar',
  'platter',
  'rope_tow',
  'magic_carpet',
];

/** North American trail rating for OSM piste:difficulty. */
export const DIFFICULTY = {
  novice: { rank: 0, label: 'Beginner', symbol: 'green-circle' },
  easy: { rank: 1, label: 'Easier', symbol: 'green-circle' },
  intermediate: { rank: 2, label: 'More difficult', symbol: 'blue-square' },
  advanced: { rank: 3, label: 'Most difficult', symbol: 'black-diamond' },
  expert: { rank: 4, label: 'Experts only', symbol: 'double-black' },
  freeride: { rank: 4, label: 'Freeride', symbol: 'double-black' },
  unknown: { rank: 2, label: 'Unrated', symbol: 'unrated' },
};

const SAMPLE_M = 25;
const PITCH_WINDOW_M = 100;
const M_TO_FT = 3.28084;

export function normalizeDifficulty(tag) {
  const key = String(tag || '').trim().toLowerCase();
  return DIFFICULTY[key] ? key : 'unknown';
}

export function haversineM(a, b) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function areaContains(area, lat, lng) {
  if (area.ring) return pointInRing(lat, lng, area.ring);
  const b = area.bounds;
  return lat >= b.minlat && lat <= b.maxlat && lng >= b.minlon && lng <= b.maxlon;
}

/** Resort polygon first (landuse=winter_sports), nearest resort pin as fallback. */
export function assignResort(lat, lng, resorts = [], areas = []) {
  const hit = areas.find((a) => areaContains(a, lat, lng));
  if (hit) return hit.resort;
  let best = null;
  let bestD = Infinity;
  for (const r of resorts) {
    const d = haversineM([lat, lng], [r.lat, r.lng]);
    if (d < bestD) {
      bestD = d;
      best = r.id;
    }
  }
  return best;
}

function resortForAreaName(name, resorts) {
  const n = String(name || '').toLowerCase();
  if (!n) return null;
  const match = resorts.find((r) => n.includes(r.name.toLowerCase()));
  return match ? match.id : null;
}

const round5 = (v) => Math.round(v * 1e5) / 1e5;

function wayCoords(el) {
  return (el.geometry || [])
    .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .map((p) => [round5(p.lat), round5(p.lon)]);
}

/** Overpass elements → { runs, lifts }. Same-name runs merge into one multi-path run. */
export function normalizeOsmTrails(elements = [], resorts = []) {
  const areas = [];
  for (const el of elements) {
    if (el.tags?.landuse !== 'winter_sports') continue;
    const resort = resortForAreaName(el.tags.name, resorts);
    if (!resort) continue;
    if (el.type === 'way') {
      const ring = wayCoords(el);
      if (ring.length >= 4) areas.push({ resort, ring });
    } else if (el.bounds) {
      areas.push({ resort, bounds: el.bounds });
    }
  }

  const groups = new Map();
  const lifts = [];
  for (const el of elements) {
    if (el.type !== 'way' || !el.tags) continue;
    const coords = wayCoords(el);
    if (coords.length < 2) continue;
    const mid = coords[Math.floor(coords.length / 2)];
    const resort = assignResort(mid[0], mid[1], resorts, areas);

    if (el.tags['piste:type'] === 'downhill') {
      const closed =
        coords.length > 3 &&
        coords[0][0] === coords[coords.length - 1][0] &&
        coords[0][1] === coords[coords.length - 1][1];
      if (closed && el.tags.area === 'yes') continue;
      const name = el.tags.name || el.tags['piste:name'] || null;
      const difficulty = normalizeDifficulty(el.tags['piste:difficulty']);
      const key = name ? `${resort}|${name.toLowerCase()}|${difficulty}` : `osm-${el.id}`;
      const existing = groups.get(key);
      if (existing) {
        existing.paths.push(coords);
        continue;
      }
      groups.set(key, {
        id: `run-${el.id}`,
        name,
        difficulty,
        grooming: el.tags['piste:grooming'] || null,
        resort,
        paths: [coords],
      });
    } else if (LIFT_TYPES.includes(el.tags.aerialway)) {
      lifts.push({
        id: `lift-${el.id}`,
        name: el.tags.name || null,
        type: el.tags.aerialway,
        occupancy: Number(el.tags['aerialway:occupancy']) || null,
        resort,
        coords,
      });
    }
  }
  return { runs: [...groups.values()], lifts };
}

/** Resample a polyline every ~SAMPLE_M meters with DEM heights (ft). */
function samplePath(dem, coords) {
  const pts = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const segM = haversineM(a, b);
    const steps = Math.max(1, Math.ceil(segM / SAMPLE_M));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  pts.push(coords[coords.length - 1]);
  return pts
    .map(([lat, lng]) => ({ lat, lng, z: interpolateDem(dem, lat, lng) }))
    .filter((p) => p.z != null);
}

function withDistance(samples) {
  let d = 0;
  return samples.map((p, i) => {
    if (i > 0) d += haversineM([samples[i - 1].lat, samples[i - 1].lng], [p.lat, p.lng]);
    return { ...p, dM: d };
  });
}

function cellOf(dem, lat, lng) {
  const row = Math.round(((lat - dem.south) / (dem.north - dem.south)) * (dem.rows - 1));
  const col = Math.round(((lng - dem.west) / (dem.east - dem.west)) * (dem.cols - 1));
  return { row, col };
}

function maxWindowPitch(samples) {
  let max = 0;
  let j = 0;
  for (let i = 0; i < samples.length; i++) {
    if (j < i) j = i;
    while (j < samples.length - 1 && samples[j].dM - samples[i].dM < PITCH_WINDOW_M) j++;
    const run = samples[j].dM - samples[i].dM;
    if (run < PITCH_WINDOW_M * 0.6) break;
    const rise = Math.abs(samples[i].z - samples[j].z) / M_TO_FT;
    max = Math.max(max, (Math.atan(rise / run) * 180) / Math.PI);
  }
  return max;
}

/** Vertical, length, along-run pitch, and slope-weighted facing for one run. */
export function runStats(run, dem) {
  const legs = [];
  for (const coords of run.paths || []) {
    if (!coords || coords.length < 2) continue;
    let samples = samplePath(dem, coords);
    if (samples.length < 2) continue;
    if (samples[0].z < samples[samples.length - 1].z) samples = samples.reverse();
    legs.push(withDistance(samples));
  }
  if (!legs.length) return null;
  legs.sort((a, b) => b[0].z - a[0].z);

  let lengthM = 0;
  let top = -Infinity;
  let bottom = Infinity;
  let maxPitch = 0;
  let sx = 0;
  let sy = 0;
  const profile = [];
  for (const leg of legs) {
    const offset = lengthM;
    for (const p of leg) {
      top = Math.max(top, p.z);
      bottom = Math.min(bottom, p.z);
      profile.push([Math.round((offset + p.dM) * M_TO_FT), Math.round(p.z)]);
      const { row, col } = cellOf(dem, p.lat, p.lng);
      const sa = slopeAspectAt(dem, row, col);
      const rad = (sa.aspectDeg * Math.PI) / 180;
      sx += Math.sin(rad) * sa.slopeDeg;
      sy += Math.cos(rad) * sa.slopeDeg;
    }
    lengthM += leg[leg.length - 1].dM;
    maxPitch = Math.max(maxPitch, maxWindowPitch(leg));
  }

  const verticalFt = Math.max(0, top - bottom);
  const avgPitch = lengthM > 0 ? (Math.atan(verticalFt / M_TO_FT / lengthM) * 180) / Math.PI : 0;
  let aspectDeg = (Math.atan2(sx, sy) * 180) / Math.PI;
  if (aspectDeg < 0) aspectDeg += 360;
  const step = Math.max(1, Math.ceil(profile.length / 60));
  const thin = profile.filter((_, i) => i % step === 0 || i === profile.length - 1);

  return {
    lengthFt: Math.round(lengthM * M_TO_FT),
    verticalFt: Math.round(verticalFt),
    topFt: Math.round(top),
    bottomFt: Math.round(bottom),
    avgPitchDeg: Number(avgPitch.toFixed(1)),
    maxPitchDeg: Number(Math.max(maxPitch, avgPitch).toFixed(1)),
    aspectDeg: Math.round(aspectDeg),
    aspect: aspectName(aspectDeg),
    profile: thin,
  };
}

/** Bottom → top orientation, horizontal length, and rise for one lift. */
export function liftStats(lift, dem) {
  const coords = lift.coords || [];
  if (coords.length < 2) return null;
  const a = coords[0];
  const b = coords[coords.length - 1];
  const za = interpolateDem(dem, a[0], a[1]);
  const zb = interpolateDem(dem, b[0], b[1]);
  if (za == null || zb == null) return null;
  let lengthM = 0;
  for (let i = 1; i < coords.length; i++) lengthM += haversineM(coords[i - 1], coords[i]);
  return {
    lengthFt: Math.round(lengthM * M_TO_FT),
    riseFt: Math.round(Math.abs(zb - za)),
    bottomFt: Math.round(Math.min(za, zb)),
    topFt: Math.round(Math.max(za, zb)),
    uphillReversed: za > zb,
  };
}

export function loadTrails(demId) {
  const file = path.join(DATA_DIR, `${demId}-trails.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Enrich runs + lifts with DEM stats. Inputs are plain objects so tests can pass synthetic DEMs. */
export function enrichTrails(trails, dem) {
  const runs = (trails.runs || [])
    .map((run) => {
      const stats = runStats(run, dem);
      return stats ? { ...run, ...DIFFICULTY[run.difficulty], ...stats } : null;
    })
    .filter(Boolean);
  const lifts = (trails.lifts || [])
    .map((lift) => {
      const stats = liftStats(lift, dem);
      if (!stats) return null;
      const coords = stats.uphillReversed ? [...lift.coords].reverse() : lift.coords;
      const { uphillReversed, ...rest } = stats;
      return { ...lift, coords, ...rest };
    })
    .filter(Boolean);
  return { ...trails, runs, lifts };
}

const cache = new Map();

export function clearTrailsCache() {
  cache.clear();
}

export function getTrails(demId, { resort } = {}) {
  if (!SKI_DEM_SPECS.some((s) => s.id === demId)) return null;
  if (!cache.has(demId)) {
    const trails = loadTrails(demId);
    if (!trails) return null;
    cache.set(demId, enrichTrails(trails, loadDem(demId)));
  }
  const all = cache.get(demId);
  if (!resort) return all;
  return {
    ...all,
    runs: all.runs.filter((r) => r.resort === resort),
    lifts: all.lifts.filter((l) => l.resort === resort),
  };
}

const ASPECT_ALIASES = {
  north: ['N', 'NE', 'NW'],
  east: ['E', 'NE', 'SE'],
  south: ['S', 'SE', 'SW'],
  west: ['W', 'NW', 'SW'],
};

/** Run finder: difficulty, pitch band, facing, minimum vertical. Sorted by vertical. */
export function findRuns(runs = [], { resort, difficulty, minPitch, maxPitch, facing, minVerticalFt } = {}) {
  const diffs = [].concat(difficulty || []).filter(Boolean);
  const faces = facing ? ASPECT_ALIASES[String(facing).toLowerCase()] || [String(facing).toUpperCase()] : null;
  return runs
    .filter((r) => !resort || r.resort === resort)
    .filter((r) => !diffs.length || diffs.includes(r.difficulty))
    .filter((r) => minPitch == null || r.avgPitchDeg >= minPitch)
    .filter((r) => maxPitch == null || r.avgPitchDeg <= maxPitch)
    .filter((r) => !faces || faces.includes(r.aspect))
    .filter((r) => minVerticalFt == null || r.verticalFt >= minVerticalFt)
    .sort((a, b) => b.verticalFt - a.verticalFt);
}

/** Compact run table for Ridge's system prompt. */
export function runCatalogSnippet(runs = [], resortNames = {}, limit = 120) {
  return runs
    .filter((r) => r.name)
    .sort((a, b) => b.verticalFt - a.verticalFt)
    .slice(0, limit)
    .map(
      (r) =>
        `- ${r.name} (${resortNames[r.resort] || r.resort}; ${r.label}): ${r.verticalFt} ft vertical, ` +
        `${r.lengthFt} ft long, avg ${r.avgPitchDeg}°, max ${r.maxPitchDeg}°, faces ${r.aspect}, ` +
        `${r.topFt}→${r.bottomFt} ft`
    )
    .join('\n');
}

export default {
  LIFT_TYPES,
  DIFFICULTY,
  normalizeDifficulty,
  haversineM,
  assignResort,
  normalizeOsmTrails,
  runStats,
  liftStats,
  loadTrails,
  enrichTrails,
  clearTrailsCache,
  getTrails,
  findRuns,
  runCatalogSnippet,
};
