/**
 * Crew Log — trip codes, GPS cleanup, run/lift matching, and day stats for a ski crew.
 * Pure logic only; Postgres lives in ski-log-store.service.js.
 * Development work by David Lane
 */
import { createHash, randomBytes } from 'node:crypto';
import { interpolateDem, loadDem, SKI_DEM_SPECS } from './ski-dem.service.js';
import { getTrails, haversineM } from './ski-trails.service.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MEMBER_COLORS = ['#7ec8e3', '#f2a65a', '#5dbe8a', '#e86a92', '#b48cf2', '#f4d35e', '#4fd1c5', '#ff7b54'];
export const SKI_TZ = 'America/Los_Angeles';
export const MAX_ACCURACY_M = 50;
export const MAX_SPEED_MPS = 40;
export const MAX_MEMBERS = 24;

const RUN_SNAP_M = 40;
const LIFT_SNAP_M = 45;
/** Elevation reversal (ft) that flips a descent into a climb, or back. */
const TURN_FT = 80;
const MIN_SEGMENT_FT = 120;
const GAP_SPLIT_MS = 15 * 60 * 1000;
const CHECKIN_DEDUPE_MS = 20 * 60 * 1000;
const M_TO_FT = 3.28084;
const MPS_TO_MPH = 2.23694;

// ── Trip identity ──────────────────────────────────────────────────────────

export function generateTripCode(bytes = randomBytes(6)) {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

export function normalizeTripCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 6 || [...s].some((ch) => !CODE_ALPHABET.includes(ch))) return null;
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

export function generateMemberToken() {
  return randomBytes(24).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

export function sanitizeDisplayName(raw) {
  const name = String(raw || '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
  return name || null;
}

export function sanitizeTripName(raw) {
  const name = String(raw || '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return name || null;
}

export function memberColor(index) {
  return MEMBER_COLORS[Math.abs(index) % MEMBER_COLORS.length];
}

/** Fixed-window limiter keyed by caller (IP) — trip codes are guessable without one. */
export function createRateLimiter({ windowMs = 10 * 60 * 1000, max = 20 } = {}) {
  const hits = new Map();
  return function allow(key, now = Date.now()) {
    const k = String(key || 'anon');
    const cur = hits.get(k);
    if (!cur || now - cur.start >= windowMs) {
      hits.set(k, { start: now, count: 1 });
      if (hits.size > 5000) {
        for (const [hk, hv] of hits) if (now - hv.start >= windowMs) hits.delete(hk);
      }
      return true;
    }
    cur.count++;
    return cur.count <= max;
  };
}

// ── Days (resort local time) ───────────────────────────────────────────────

export function isIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function tzOffsetMs(ms, tz = SKI_TZ) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

export function localDay(ms, tz = SKI_TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(ms)
  );
}

/** [start, end) epoch ms of a resort-local calendar day. */
export function dayBounds(date, tz = SKI_TZ) {
  const [y, m, d] = date.split('-').map(Number);
  const startGuess = Date.UTC(y, m - 1, d);
  const endGuess = Date.UTC(y, m - 1, d + 1);
  return { start: startGuess - tzOffsetMs(startGuess, tz), end: endGuess - tzOffsetMs(endGuess, tz) };
}

// ── GPS cleanup ────────────────────────────────────────────────────────────

const finiteOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Validate, sort, de-duplicate, and drop low-accuracy fixes and teleports. */
export function cleanPoints(raw = [], { maxAccuracyM = MAX_ACCURACY_M, now = Date.now() } = {}) {
  const pts = [];
  for (const p of Array.isArray(raw) ? raw : []) {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    const ts = Number(p?.ts);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(ts)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || ts < 946_684_800_000 || ts > now + 86_400_000) continue;
    const acc = finiteOrNull(p.acc);
    if (acc != null && (acc < 0 || acc > maxAccuracyM)) continue;
    const speed = finiteOrNull(p.speed);
    pts.push({
      ts: Math.round(ts),
      lat,
      lng,
      alt: finiteOrNull(p.alt),
      acc,
      speed: speed != null && speed >= 0 && speed <= MAX_SPEED_MPS ? speed : null,
    });
  }
  pts.sort((a, b) => a.ts - b.ts);
  const out = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev) {
      if (p.ts === prev.ts) continue;
      const dt = (p.ts - prev.ts) / 1000;
      if (dt < 120 && haversineM([prev.lat, prev.lng], [p.lat, p.lng]) / dt > MAX_SPEED_MPS) continue;
    }
    out.push(p);
  }
  return out;
}

// ── Area index (runs + lifts in local meters) ──────────────────────────────

export function demIdForPoint(lat, lng, specs = SKI_DEM_SPECS) {
  const hit = specs.find((s) => lat >= s.south && lat <= s.north && lng >= s.west && lng <= s.east);
  return hit ? hit.id : null;
}

function makeProjector(lat0) {
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110_540;
  return (lat, lng) => [lng * kx, lat * ky];
}

function projectFeature(kind, ref, coords, proj) {
  const xy = coords.map(([lat, lng]) => proj(lat, lng));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of xy) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { kind, ref, xy, bbox: { minX, minY, maxX, maxY } };
}

/** Runs, lifts, and DEM for one ski area, projected for fast nearest-line lookups. */
export function buildAreaIndex({ demId, dem, runs = [], lifts = [] }) {
  const lat0 = dem ? (dem.south + dem.north) / 2 : 35;
  const proj = makeProjector(lat0);
  const features = [];
  for (const run of runs) {
    for (const path of run.paths || []) {
      if (path?.length >= 2) features.push(projectFeature('run', run, path, proj));
    }
  }
  for (const lift of lifts) {
    if (lift.coords?.length >= 2) features.push(projectFeature('lift', lift, lift.coords, proj));
  }
  return { demId, dem, proj, features, runs, lifts };
}

const indexCache = new Map();

export function getAreaIndex(demId) {
  if (!demId) return null;
  if (!indexCache.has(demId)) {
    const trails = getTrails(demId);
    const dem = loadDem(demId);
    indexCache.set(demId, trails && dem ? buildAreaIndex({ demId, dem, runs: trails.runs, lifts: trails.lifts }) : null);
  }
  return indexCache.get(demId);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const ex = ax + t * dx - px;
  const ey = ay + t * dy - py;
  return Math.sqrt(ex * ex + ey * ey);
}

function featureDistance(f, x, y, maxM) {
  const b = f.bbox;
  if (x < b.minX - maxM || x > b.maxX + maxM || y < b.minY - maxM || y > b.maxY + maxM) return Infinity;
  let best = Infinity;
  for (let i = 1; i < f.xy.length; i++) {
    const d = distToSegment(x, y, f.xy[i - 1][0], f.xy[i - 1][1], f.xy[i][0], f.xy[i][1]);
    if (d < best) best = d;
  }
  return best;
}

/** Closest run or lift line to a point, within maxM meters. */
export function nearestFeature(index, lat, lng, kind, maxM) {
  const [x, y] = index.proj(lat, lng);
  let best = null;
  let bestD = maxM;
  for (const f of index.features) {
    if (f.kind !== kind) continue;
    const d = featureDistance(f, x, y, bestD);
    if (d <= bestD) {
      bestD = d;
      best = f.ref;
    }
  }
  return best ? { ref: best, distanceM: bestD } : null;
}

// ── Track → lift rides and runs ────────────────────────────────────────────

export function tierOf(difficulty) {
  switch (String(difficulty || '').toLowerCase()) {
    case 'novice':
    case 'easy':
      return 'green';
    case 'intermediate':
      return 'blue';
    case 'advanced':
      return 'black';
    case 'expert':
    case 'freeride':
      return 'double';
    default:
      return 'unrated';
  }
}

function runSummary(run) {
  return {
    id: run.id,
    name: run.name || null,
    difficulty: run.difficulty,
    tier: tierOf(run.difficulty),
    resort: run.resort,
    verticalFt: run.verticalFt ?? null,
    avgPitchDeg: run.avgPitchDeg ?? null,
    maxPitchDeg: run.maxPitchDeg ?? null,
    aspect: run.aspect ?? null,
  };
}

function liftSummary(lift) {
  return { id: lift.id, name: lift.name || null, type: lift.type, resort: lift.resort };
}

export function thinPath(points, max = 80) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

function smoothElevations(samples, half = 2) {
  return samples.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(samples.length - 1, i + half); j++) {
      sum += samples[j].z;
      n++;
    }
    return sum / n;
  });
}

/** Indices where the track turns from climbing to descending or back (zigzag with hysteresis). */
export function turningPoints(zs, turnFt = TURN_FT) {
  const n = zs.length;
  if (n < 2) return n ? [0] : [];
  const turns = [0];
  let dir = 0;
  let cand = 0;
  let hi = 0;
  let lo = 0;
  for (let i = 1; i < n; i++) {
    const z = zs[i];
    if (dir === 0) {
      if (z > zs[hi]) hi = i;
      if (z < zs[lo]) lo = i;
      if (zs[hi] - zs[lo] >= turnFt) {
        dir = hi > lo ? 1 : -1;
        const start = dir === 1 ? lo : hi;
        if (start > 0) turns.push(start);
        cand = i;
      }
    } else if (dir === 1) {
      if (z >= zs[cand]) cand = i;
      else if (zs[cand] - z >= turnFt) {
        turns.push(cand);
        dir = -1;
        cand = i;
      }
    } else if (z <= zs[cand]) cand = i;
    else if (z - zs[cand] >= turnFt) {
      turns.push(cand);
      dir = 1;
      cand = i;
    }
  }
  if (dir !== 0 && cand > turns[turns.length - 1]) turns.push(cand);
  return turns;
}

function legDistanceM(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversineM([pts[i - 1].lat, pts[i - 1].lng], [pts[i].lat, pts[i].lng]);
  return d;
}

function legTopSpeedMps(pts) {
  let top = 0;
  for (const p of pts) if (p.speed != null) top = Math.max(top, p.speed);
  for (let i = 2; i < pts.length; i++) {
    const dt = (pts[i].ts - pts[i - 2].ts) / 1000;
    if (dt < 4) continue;
    const v =
      (haversineM([pts[i - 2].lat, pts[i - 2].lng], [pts[i - 1].lat, pts[i - 1].lng]) +
        haversineM([pts[i - 1].lat, pts[i - 1].lng], [pts[i].lat, pts[i].lng])) /
      dt;
    if (v <= MAX_SPEED_MPS) top = Math.max(top, v);
  }
  return top;
}

function labelLeg(pts, kind, index) {
  const counts = new Map();
  const order = [];
  let matched = 0;
  for (const p of pts) {
    const hit = nearestFeature(index, p.lat, p.lng, kind, kind === 'lift' ? LIFT_SNAP_M : RUN_SNAP_M);
    if (!hit) continue;
    matched++;
    const id = hit.ref.id;
    if (!counts.has(id)) {
      counts.set(id, 0);
      order.push(hit.ref);
    }
    counts.set(id, counts.get(id) + 1);
  }
  const share = pts.length ? matched / pts.length : 0;
  if (!matched) return { primary: null, sequence: [], share };
  let primary = order[0];
  for (const ref of order) if (counts.get(ref.id) > counts.get(primary.id)) primary = ref;
  const floor = Math.max(2, matched * 0.15);
  const sequence = order.filter((ref) => counts.get(ref.id) >= floor);
  return { primary, sequence: sequence.length ? sequence : [primary], share };
}

/** One continuous chunk of GPS inside one ski area → lift rides and runs. */
export function segmentTrack(points, index, { memberId = null } = {}) {
  const samples = [];
  for (const p of points) {
    const demZ = index?.dem ? interpolateDem(index.dem, p.lat, p.lng) : null;
    const z = demZ ?? (p.alt != null ? p.alt * M_TO_FT : null);
    if (z != null) samples.push({ ...p, z });
  }
  if (samples.length < 3) return [];
  const zs = smoothElevations(samples);
  const turns = turningPoints(zs);
  const segments = [];
  for (let t = 1; t < turns.length; t++) {
    const a = turns[t - 1];
    const b = turns[t];
    const dz = zs[b] - zs[a];
    if (Math.abs(dz) < MIN_SEGMENT_FT) continue;
    const leg = samples.slice(a, b + 1);
    const kind = dz > 0 ? 'lift' : 'run';
    const label = index ? labelLeg(leg, kind, index) : { primary: null, sequence: [], share: 0 };
    const seg = {
      kind,
      source: 'gps',
      memberId,
      demId: index?.demId || null,
      startTs: leg[0].ts,
      endTs: leg[leg.length - 1].ts,
      durationS: Math.round((leg[leg.length - 1].ts - leg[0].ts) / 1000),
      verticalFt: Math.round(Math.abs(dz)),
      distanceM: Math.round(legDistanceM(leg)),
      topSpeedMph: kind === 'run' ? Number((legTopSpeedMps(leg) * MPS_TO_MPH).toFixed(1)) : null,
      matchedShare: Number(label.share.toFixed(2)),
      path: thinPath(leg).map((p) => [Number(p.lat.toFixed(5)), Number(p.lng.toFixed(5))]),
      run: null,
      runs: [],
      lift: null,
      offPiste: false,
    };
    if (kind === 'run') {
      seg.offPiste = label.share < 0.3;
      if (label.primary && !seg.offPiste) {
        seg.run = runSummary(label.primary);
        seg.runs = label.sequence.map(runSummary);
      }
    } else if (label.primary && label.share >= 0.3) {
      seg.lift = liftSummary(label.primary);
    }
    seg.resort = seg.run?.resort || seg.lift?.resort || null;
    segments.push(seg);
  }
  return segments;
}

/** Split a member's day at long gaps and ski-area changes, then segment each chunk. */
export function segmentMemberDay(points, { memberId = null, indexFor = getAreaIndex } = {}) {
  const chunks = [];
  let cur = null;
  for (const p of points) {
    const demId = demIdForPoint(p.lat, p.lng);
    const prev = cur?.points[cur.points.length - 1];
    if (!cur || cur.demId !== demId || p.ts - prev.ts > GAP_SPLIT_MS) {
      cur = { demId, points: [] };
      chunks.push(cur);
    }
    cur.points.push(p);
  }
  const out = [];
  for (const chunk of chunks) {
    if (!chunk.demId) continue;
    out.push(...segmentTrack(chunk.points, indexFor(chunk.demId), { memberId }));
  }
  return out;
}

// ── Check-ins ──────────────────────────────────────────────────────────────

/** Nearest runs to a tap, closest first, for "which run are you on?" confirmation. */
export function snapCandidates(index, lat, lng, { limit = 3, maxM = 200 } = {}) {
  if (!index) return [];
  const [x, y] = index.proj(lat, lng);
  const best = new Map();
  for (const f of index.features) {
    if (f.kind !== 'run') continue;
    const d = featureDistance(f, x, y, maxM);
    if (d > maxM) continue;
    const prev = best.get(f.ref.id);
    if (!prev || d < prev.distanceM) best.set(f.ref.id, { run: f.ref, distanceM: d });
  }
  return [...best.values()]
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit)
    .map(({ run, distanceM }) => ({ ...runSummary(run), distanceM: Math.round(distanceM) }));
}

function findRun(index, runId) {
  return index?.runs.find((r) => r.id === runId) || null;
}

export function checkinSegment(checkin, index) {
  const run = findRun(index, checkin.runId);
  if (!run) return null;
  const path = (run.paths || [])[0] || [];
  return {
    kind: 'run',
    source: 'checkin',
    memberId: checkin.memberId ?? null,
    demId: index.demId,
    startTs: checkin.ts,
    endTs: checkin.ts,
    durationS: 0,
    verticalFt: run.verticalFt ?? 0,
    distanceM: Math.round((run.lengthFt ?? 0) / M_TO_FT),
    topSpeedMph: null,
    matchedShare: 1,
    path: thinPath(path),
    run: runSummary(run),
    runs: [runSummary(run)],
    lift: null,
    offPiste: false,
    resort: run.resort,
  };
}

/** Check-ins become runs unless GPS already logged that run around the same time. */
export function mergeCheckins(gpsSegments, checkins, indexFor = getAreaIndex) {
  const out = [...gpsSegments];
  for (const c of checkins) {
    const dup = gpsSegments.some(
      (s) =>
        s.kind === 'run' &&
        s.runs.some((r) => r.id === c.runId) &&
        c.ts >= s.startTs - CHECKIN_DEDUPE_MS &&
        c.ts <= s.endTs + CHECKIN_DEDUPE_MS
    );
    if (dup) continue;
    const seg = checkinSegment(c, indexFor(c.demId));
    if (seg) out.push(seg);
  }
  return out.sort((a, b) => a.startTs - b.startTs);
}

// ── Track import (Slopes / Strava / Apple Watch GPX, Garmin TCX) ───────────

export const MAX_IMPORT_POINTS = 100_000;

function xmlAttr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return m ? m[1] : null;
}

function xmlTag(body, name) {
  const m = body.match(new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>\\s*([^<]*?)\\s*</(?:[\\w-]+:)?${name}>`, 'i'));
  return m ? m[1] : null;
}

function parseGpx(xml) {
  const out = [];
  const re = /<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
  for (const m of xml.matchAll(re)) {
    const body = m[3] || '';
    out.push({
      ts: Date.parse(xmlTag(body, 'time') || ''),
      lat: Number(xmlAttr(m[2], 'lat')),
      lng: Number(xmlAttr(m[2], 'lon')),
      alt: finiteOrNull(xmlTag(body, 'ele')),
      acc: finiteOrNull(xmlTag(body, 'hAcc')),
      speed: finiteOrNull(xmlTag(body, 'speed')),
    });
  }
  return out;
}

function parseTcx(xml) {
  const out = [];
  for (const m of xml.matchAll(/<Trackpoint>([\s\S]*?)<\/Trackpoint>/gi)) {
    const body = m[1];
    out.push({
      ts: Date.parse(xmlTag(body, 'Time') || ''),
      lat: Number(xmlTag(body, 'LatitudeDegrees')),
      lng: Number(xmlTag(body, 'LongitudeDegrees')),
      alt: finiteOrNull(xmlTag(body, 'AltitudeMeters')),
      acc: null,
      speed: finiteOrNull(xmlTag(body, 'Speed')),
    });
  }
  return out;
}

/** GPX or TCX text → raw points (not yet cleaned). Throws a guest-facing message on bad input. */
export function parseTrackFile(text) {
  const xml = String(text || '');
  let raw;
  if (/<TrainingCenterDatabase\b/i.test(xml)) raw = parseTcx(xml);
  else if (/<gpx\b/i.test(xml)) raw = parseGpx(xml);
  else throw new Error('That file is not a GPX or TCX track. Export GPX from Slopes, Strava, or your watch app.');
  if (!raw.length) throw new Error('No track points in that file.');
  const timed = raw.filter((p) => Number.isFinite(p.ts));
  if (!timed.length) throw new Error('That track has no timestamps, so runs cannot be timed. Export the original activity GPX.');
  if (timed.length > MAX_IMPORT_POINTS) {
    throw new Error(`That track is huge (${timed.length.toLocaleString()} points). Import one day at a time.`);
  }
  return timed;
}

/** Drop imported points within `windowMs` of a point already logged live for the same rider. */
export function dropCoveredPoints(imported, existingTs = [], windowMs = 30_000) {
  if (!existingTs.length) return imported;
  const ts = [...existingTs].sort((a, b) => a - b);
  const near = (t) => {
    let lo = 0;
    let hi = ts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ts[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    const d1 = Math.abs(ts[lo] - t);
    const d0 = lo > 0 ? Math.abs(ts[lo - 1] - t) : Infinity;
    return Math.min(d0, d1) <= windowMs;
  };
  return imported.filter((p) => !near(p.ts));
}

/** Resort-local days covered by a list of points, oldest first. */
export function daysCovered(points) {
  return [...new Set(points.map((p) => localDay(p.ts)))].sort();
}

// ── Photos ─────────────────────────────────────────────────────────────────

export const MAX_TRIP_PHOTOS = 300;
const PHOTO_TRACK_WINDOW_MS = 10 * 60 * 1000;
const PHOTO_DEVICE_WINDOW_MS = 2 * 60 * 1000;
const PHOTO_RUN_SNAP_M = 60;

const validLatLng = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/** Where to pin a photo: its own GPS, the rider's track at that moment, the phone's fix right now, or nothing. */
export function placePhoto({ ts, exifLat, exifLng, deviceLat, deviceLng, deviceTs }, memberPoints = []) {
  if (validLatLng(exifLat, exifLng)) return { lat: exifLat, lng: exifLng, source: 'exif' };
  if (memberPoints.length && Number.isFinite(ts)) {
    let before = null;
    let after = null;
    for (const p of memberPoints) {
      if (p.ts <= ts) before = p;
      else {
        after = p;
        break;
      }
    }
    if (before && after && after.ts - before.ts <= PHOTO_TRACK_WINDOW_MS) {
      const t = (ts - before.ts) / (after.ts - before.ts || 1);
      return {
        lat: before.lat + (after.lat - before.lat) * t,
        lng: before.lng + (after.lng - before.lng) * t,
        source: 'track',
      };
    }
    const nearest = [before, after]
      .filter(Boolean)
      .sort((a, b) => Math.abs(a.ts - ts) - Math.abs(b.ts - ts))[0];
    if (nearest && Math.abs(nearest.ts - ts) <= PHOTO_TRACK_WINDOW_MS) {
      return { lat: nearest.lat, lng: nearest.lng, source: 'track' };
    }
  }
  if (validLatLng(deviceLat, deviceLng) && (!Number.isFinite(deviceTs) || Math.abs(deviceTs - ts) <= PHOTO_DEVICE_WINDOW_MS)) {
    return { lat: deviceLat, lng: deviceLng, source: 'device' };
  }
  return { lat: null, lng: null, source: null };
}

/** Name the run a pinned photo sits on, or place an unpinned photo on the run the rider picked. */
export function photoRun({ lat, lng, runId }, indexFor = getAreaIndex) {
  if (validLatLng(lat, lng)) {
    const demId = demIdForPoint(lat, lng);
    const index = demId ? indexFor(demId) : null;
    const hit = index ? nearestFeature(index, lat, lng, 'run', PHOTO_RUN_SNAP_M) : null;
    return { demId, runId: hit?.ref.id || null, runName: hit?.ref.name || null, lat, lng, placed: false };
  }
  if (runId) {
    for (const spec of SKI_DEM_SPECS) {
      const index = indexFor(spec.id);
      const run = index?.runs.find((r) => r.id === runId);
      if (!run) continue;
      const path = run.paths[0] || [];
      const mid = path[Math.floor(path.length / 2)];
      if (!mid) break;
      return { demId: spec.id, runId: run.id, runName: run.name || null, lat: mid[0], lng: mid[1], placed: true };
    }
  }
  return { demId: null, runId: null, runName: null, lat: null, lng: null, placed: false };
}

// ── Stats ──────────────────────────────────────────────────────────────────

export function dayStats(segments = []) {
  const runs = segments.filter((s) => s.kind === 'run');
  const lifts = segments.filter((s) => s.kind === 'lift');
  const byDifficulty = { green: 0, blue: 0, black: 0, double: 0, unrated: 0 };
  let longest = null;
  let steepest = null;
  for (const r of runs) {
    byDifficulty[r.run ? r.run.tier : 'unrated']++;
    if (!longest || r.verticalFt > longest.verticalFt) longest = r;
    if (r.run?.maxPitchDeg != null && (!steepest || r.run.maxPitchDeg > steepest.run.maxPitchDeg)) steepest = r;
  }
  const topSpeed = runs.reduce((m, r) => Math.max(m, r.topSpeedMph || 0), 0);
  const name = (s) => s?.run?.name || (s?.offPiste ? 'Off-piste' : 'Unnamed run');
  const first = segments[0];
  const last = segments[segments.length - 1];
  return {
    runs: runs.length,
    verticalFt: runs.reduce((s, r) => s + r.verticalFt, 0),
    distanceMi: Number((runs.reduce((s, r) => s + r.distanceM, 0) / 1609.344).toFixed(1)),
    topSpeedMph: topSpeed ? Number(topSpeed.toFixed(1)) : null,
    liftRides: lifts.length,
    byDifficulty,
    longestRun: longest ? { name: name(longest), verticalFt: longest.verticalFt, runId: longest.run?.id || null } : null,
    steepestRun: steepest
      ? { name: name(steepest), maxPitchDeg: steepest.run.maxPitchDeg, runId: steepest.run.id, tier: steepest.run.tier }
      : null,
    firstTs: first?.startTs ?? null,
    lastTs: last?.endTs ?? null,
  };
}

/** Everything the Today view, maps, and recap need for one trip day. */
export function buildTripDay({ trip, members = [], points = [], checkins = [], photos = [], date, indexFor = getAreaIndex }) {
  const pointsBy = new Map();
  for (const p of points) {
    if (!pointsBy.has(p.memberId)) pointsBy.set(p.memberId, []);
    pointsBy.get(p.memberId).push(p);
  }
  const areas = new Set();
  const crewSegments = [];
  const out = members.map((m) => {
    const pts = cleanPoints(pointsBy.get(m.id) || []);
    const gps = segmentMemberDay(pts, { memberId: m.id, indexFor });
    const mine = checkins.filter((c) => c.memberId === m.id).map((c) => ({ ...c, memberId: m.id }));
    const segments = mergeCheckins(gps, mine, indexFor);
    for (const s of segments) if (s.demId) areas.add(s.demId);
    for (const p of pts) {
      const id = demIdForPoint(p.lat, p.lng);
      if (id) areas.add(id);
    }
    crewSegments.push(...segments);
    return {
      id: m.id,
      name: m.name,
      color: m.color,
      stats: dayStats(segments),
      segments,
      track: thinPath(pts, 600).map((p) => [Number(p.lat.toFixed(5)), Number(p.lng.toFixed(5)), p.ts]),
      lastFix: pts.length ? pts[pts.length - 1] : null,
    };
  });
  crewSegments.sort((a, b) => a.startTs - b.startTs);
  return {
    date,
    trip: { code: trip.code, name: trip.name, resortId: trip.resortId },
    areas: [...areas],
    members: out,
    leaderboard: out
      .map((m) => ({ id: m.id, name: m.name, color: m.color, runs: m.stats.runs, verticalFt: m.stats.verticalFt }))
      .sort((a, b) => b.verticalFt - a.verticalFt || b.runs - a.runs),
    crew: dayStats(crewSegments),
    photos,
  };
}

const xml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

/** KML colors are aabbggrr. */
export function kmlColor(hexColor, alpha = 'ff') {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hexColor || ''));
  const rgb = m ? m[1].toLowerCase() : 'ffffff';
  return `${alpha}${rgb.slice(4, 6)}${rgb.slice(2, 4)}${rgb.slice(0, 2)}`;
}

function kmlTime(ts) {
  return new Date(ts).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Google Earth export of one trip day: a folder per rider with their track and run-by-run
 * placemarks, plus photo pins. `photoUrl(id, thumb)` must return absolute URLs.
 */
export function buildDayKml(day, { photoUrl } = {}) {
  const fmtFt = (n) => `${Math.round(n || 0).toLocaleString('en-US')} ft`;
  const styles = day.members
    .map(
      (m) => `<Style id="m${m.id}"><LineStyle><color>${kmlColor(m.color)}</color><width>4</width></LineStyle>` +
        `<IconStyle><color>${kmlColor(m.color)}</color></IconStyle></Style>` +
        `<Style id="r${m.id}"><LineStyle><color>${kmlColor(m.color, 'cc')}</color><width>6</width></LineStyle></Style>`
    )
    .join('');
  const coords = (pts) => pts.map(([lat, lng]) => `${lng},${lat},0`).join(' ');
  const folders = day.members
    .filter((m) => m.track.length > 1 || m.segments.length)
    .map((m) => {
      const track =
        m.track.length > 1
          ? `<Placemark><name>${xml(m.name)} — track</name><styleUrl>#m${m.id}</styleUrl>` +
            `<TimeSpan><begin>${kmlTime(m.track[0][2])}</begin><end>${kmlTime(m.track[m.track.length - 1][2])}</end></TimeSpan>` +
            `<LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>${coords(m.track)}</coordinates></LineString></Placemark>`
          : '';
      const runs = m.segments
        .filter((s) => s.kind === 'run' && s.path?.length > 1)
        .map((s, i) => {
          const title = s.run?.name || (s.offPiste ? 'Off-piste' : `Run ${i + 1}`);
          const desc = `${fmtFt(s.verticalFt)} down${s.topSpeedMph ? ` · top ${Math.round(s.topSpeedMph)} mph` : ''}`;
          return (
            `<Placemark><name>${xml(title)}</name><description>${xml(desc)}</description><styleUrl>#r${m.id}</styleUrl>` +
            `<TimeSpan><begin>${kmlTime(s.startTs)}</begin><end>${kmlTime(s.endTs)}</end></TimeSpan>` +
            `<LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>${coords(s.path)}</coordinates></LineString></Placemark>`
          );
        })
        .join('');
      const stats = `${m.stats.runs} runs · ${fmtFt(m.stats.verticalFt)} vertical`;
      return `<Folder><name>${xml(m.name)}</name><description>${xml(stats)}</description>${track}${runs}</Folder>`;
    })
    .join('');
  const who = new Map(day.members.map((m) => [m.id, m]));
  const photos = (day.photos || [])
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => {
      const by = who.get(p.memberId);
      const img = photoUrl ? `<img src="${xml(photoUrl(p.id, false))}" width="480"/>` : '';
      const text = [p.caption, by?.name, p.runName].filter(Boolean).map(xml).join(' · ');
      return (
        `<Placemark><name>${xml(p.caption || `Photo — ${by?.name || 'crew'}`)}</name>` +
        `<description><![CDATA[${img}<p>${text}</p>]]></description>` +
        `<TimeStamp><when>${kmlTime(p.ts)}</when></TimeStamp>${by ? `<styleUrl>#m${by.id}</styleUrl>` : ''}` +
        `<Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>`
      );
    })
    .join('');
  const name = `${day.trip.name} — ${day.date}`;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(name)}</name>` +
    `<description>${xml(`${day.crew.runs} runs · ${fmtFt(day.crew.verticalFt)} vertical as a crew`)}</description>` +
    styles +
    folders +
    (photos ? `<Folder><name>Photos</name>${photos}</Folder>` : '') +
    `</Document></kml>\n`
  );
}

export default {
  MEMBER_COLORS,
  SKI_TZ,
  generateTripCode,
  normalizeTripCode,
  generateMemberToken,
  hashToken,
  sanitizeDisplayName,
  sanitizeTripName,
  memberColor,
  createRateLimiter,
  isIsoDate,
  localDay,
  dayBounds,
  cleanPoints,
  demIdForPoint,
  buildAreaIndex,
  getAreaIndex,
  nearestFeature,
  tierOf,
  thinPath,
  turningPoints,
  segmentTrack,
  segmentMemberDay,
  snapCandidates,
  checkinSegment,
  mergeCheckins,
  parseTrackFile,
  dropCoveredPoints,
  daysCovered,
  placePhoto,
  photoRun,
  dayStats,
  buildTripDay,
  kmlColor,
  buildDayKml,
};
