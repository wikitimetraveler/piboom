/**
 * Hurricane Tracker Service
 *
 * Live NOAA/NHC + replay storms, county impact prediction (CPA / wind swath),
 * and public announcement timeline (Governor SoE → FEMA EM → FEMA DR).
 * Governor State of Emergency timing varies by state — modeled explicitly.
 *
 * @file services/hurricane-tracker.service.js
 * @author David Lane
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from './database.service.js';
import { normalizeSpreadsheetPropertyRow, buildLenderRequirementsForProperty } from './disaster-spreadsheet.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPLAY_PATH = path.resolve(__dirname, '../data/hurricane-replay-storms.json');
const FIPS_PATH = path.resolve(__dirname, '../data/fips-counties.json');

const NM_TO_MI = 1.15078;
const EARTH_RADIUS_MI = 3958.8;

/** Planning estimates only — not official FEMA or gubernatorial commitments. */
export const DECLARATION_DISCLAIMER =
  'Predicted Governor SoE, FEMA EM, and FEMA DR windows are ops planning estimates calibrated to historical lags. Timing varies by state and is not an official announcement schedule.';

/**
 * Per-state governor State of Emergency lag relative to landfall (hours).
 * Negative = before landfall. States differ in how early they declare.
 */
export const GOVERNOR_SOE_LAG_HOURS = Object.freeze({
  FL: { early: -72, typical: -48, late: -24 },
  TX: { early: -60, typical: -36, late: -18 },
  LA: { early: -72, typical: -48, late: -24 },
  MS: { early: -48, typical: -36, late: -18 },
  AL: { early: -48, typical: -36, late: -18 },
  GA: { early: -48, typical: -36, late: -12 },
  SC: { early: -48, typical: -36, late: -18 },
  NC: { early: -48, typical: -36, late: -18 },
  VA: { early: -36, typical: -24, late: -12 },
  NY: { early: -48, typical: -36, late: -18 },
  NJ: { early: -48, typical: -36, late: -18 },
  MD: { early: -36, typical: -24, late: -12 },
  DE: { early: -36, typical: -24, late: -12 },
  MA: { early: -36, typical: -24, late: -12 },
  CT: { early: -36, typical: -24, late: -12 },
  RI: { early: -36, typical: -24, late: -12 },
  NH: { early: -36, typical: -24, late: -12 },
  ME: { early: -36, typical: -24, late: -12 },
  DEFAULT: { early: -48, typical: -36, late: -18 },
});

/** Inland / secondary states often declare later after cascading inland impacts. */
export const GOVERNOR_INLAND_SOE_LAG_HOURS = Object.freeze({
  TN: { early: -12, typical: 12, late: 36 },
  KY: { early: -12, typical: 18, late: 48 },
  WV: { early: 0, typical: 24, late: 48 },
  OH: { early: 0, typical: 24, late: 48 },
  IN: { early: 0, typical: 24, late: 48 },
  PA: { early: -12, typical: 12, late: 36 },
  DEFAULT_INLAND: { early: 0, typical: 24, late: 48 },
});

const COASTAL_PRIMARY = new Set([
  'FL', 'TX', 'LA', 'MS', 'AL', 'GA', 'SC', 'NC', 'VA',
  'NY', 'NJ', 'MD', 'DE', 'MA', 'CT', 'RI', 'NH', 'ME',
]);

let replayCache = null;
let fipsCache = null;

export function loadReplayCatalog() {
  if (replayCache) return replayCache;
  try {
    const raw = fs.readFileSync(REPLAY_PATH, 'utf8');
    replayCache = JSON.parse(raw);
  } catch (e) {
    console.warn('⚠️ hurricane-replay-storms.json missing or invalid:', e.message);
    replayCache = { storms: [], disclaimer: DECLARATION_DISCLAIMER };
  }
  return replayCache;
}

export function loadFipsCounties() {
  if (fipsCache) return fipsCache;
  try {
    const raw = fs.readFileSync(FIPS_PATH, 'utf8');
    fipsCache = JSON.parse(raw);
  } catch (e) {
    fipsCache = [];
  }
  return fipsCache;
}

export function haversineMiles(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null || !Number.isFinite(Number(v)))) {
    return null;
  }
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Point-in-polygon: ring is [[lng,lat], ...] */
export function pointInPolygon(lng, lat, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Closest point of approach of a lat/lng to a track polyline.
 * @returns {{ distanceMiles: number, tauH: number, nearest: object|null }}
 */
export function closestPointOnTrack(lat, lng, track = []) {
  if (!Array.isArray(track) || track.length === 0) {
    return { distanceMiles: null, tauH: null, nearest: null };
  }
  let best = { distanceMiles: Infinity, tauH: track[0].tauH, nearest: track[0] };
  for (const pt of track) {
    const d = haversineMiles(lat, lng, pt.lat, pt.lng);
    if (d != null && d < best.distanceMiles) {
      best = { distanceMiles: d, tauH: pt.tauH, nearest: pt };
    }
  }
  return best;
}

/**
 * Classify county impact tier from CPA distance and wind radii (nm → mi).
 */
export function classifyWindSwathTier(cpaMiles, windRadiiNm = {}, inCone = false) {
  const r64 = (windRadiiNm.kt64 || 0) * NM_TO_MI;
  const r50 = (windRadiiNm.kt50 || 0) * NM_TO_MI;
  const r34 = (windRadiiNm.kt34 || 0) * NM_TO_MI;
  const d = cpaMiles;

  if (d == null || !Number.isFinite(d)) {
    return { tier: 'unknown', tierLabel: 'Unknown', rank: 99 };
  }
  if ((r64 > 0 && d <= r64) || d <= 35) {
    return { tier: 'core_64kt', tierLabel: 'Core / 64kt Hurricane Swath', rank: 1 };
  }
  if ((r50 > 0 && d <= r50) || d <= 70) {
    return { tier: 'swath_50kt', tierLabel: '50kt Storm Swath', rank: 2 };
  }
  if ((r34 > 0 && d <= r34) || inCone) {
    return { tier: 'ts_34kt', tierLabel: '34kt Tropical Storm / Cone Interior', rank: 3 };
  }
  if (d <= 125) {
    return { tier: 'fringe', tierLabel: 'Cone Watch Fringe', rank: 4 };
  }
  return { tier: 'outside', tierLabel: 'Outside Path', rank: 5 };
}

export function addHours(iso, hours) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + hours * 3600 * 1000).toISOString();
}

export function getGovernorSoeLag(stateAbbr, impactTier = 'core_64kt') {
  const st = String(stateAbbr || '').toUpperCase();
  const inlandTier = impactTier === 'ts_34kt' || impactTier === 'fringe' || impactTier === 'swath_50kt';
  if (!COASTAL_PRIMARY.has(st) || inlandTier) {
    return (
      GOVERNOR_INLAND_SOE_LAG_HOURS[st] ||
      GOVERNOR_INLAND_SOE_LAG_HOURS.DEFAULT_INLAND
    );
  }
  return GOVERNOR_SOE_LAG_HOURS[st] || GOVERNOR_SOE_LAG_HOURS.DEFAULT;
}

/**
 * Predict Governor SoE → FEMA EM → PDA → FEMA DR announcement windows for a county.
 */
export function predictDeclarationTimeline({
  landfallAt,
  category = 1,
  impactTier = 'core_64kt',
  stateAbbr,
  windArrival34At = null,
}) {
  if (!landfallAt) {
    return {
      disclaimer: DECLARATION_DISCLAIMER,
      governorSoe: null,
      femaEm: null,
      pda: null,
      femaDr: null,
      mortgageOps: null,
    };
  }

  const soeLag = getGovernorSoeLag(stateAbbr, impactTier);
  const cat = Number(category) || 1;
  const isCore = impactTier === 'core_64kt';
  const isSecondary = impactTier === 'swath_50kt' || impactTier === 'ts_34kt';

  let drStartDays;
  let drEndDays;
  let likelyPrograms = 'PA Only';
  if (isCore && cat >= 3) {
    drStartDays = 2;
    drEndDays = 5;
    likelyPrograms = 'IA + PA';
  } else if (isCore && cat >= 1) {
    drStartDays = 4;
    drEndDays = 8;
    likelyPrograms = 'IA + PA (possible)';
  } else if (isSecondary) {
    drStartDays = 7;
    drEndDays = 14;
    likelyPrograms = 'PA (county amendment)';
  } else {
    drStartDays = 10;
    drEndDays = 21;
    likelyPrograms = 'Unlikely / watch';
  }

  const governorSoe = {
    agency: 'Governor',
    type: 'State of Emergency',
    state: String(stateAbbr || '').toUpperCase(),
    note: `Governor SoE timing varies by state (${stateAbbr || 'n/a'}): coastal states often declare 24–72h pre-landfall; inland states often after cascading impacts.`,
    windowStart: addHours(landfallAt, soeLag.early),
    windowTypical: addHours(landfallAt, soeLag.typical),
    windowEnd: addHours(landfallAt, soeLag.late),
    lagHours: soeLag,
  };

  return {
    disclaimer: DECLARATION_DISCLAIMER,
    nwsWatch: {
      type: 'NWS Hurricane/Tropical Watch',
      windowTypical: addHours(landfallAt, -48),
    },
    nwsWarning: {
      type: 'NWS Hurricane/Tropical Warning',
      windowTypical: addHours(landfallAt, -36),
    },
    governorSoe,
    femaEm: {
      agency: 'FEMA',
      type: 'Emergency Declaration (EM)',
      note: 'Pre-landfall Category B protective measures — often after or near Governor SoE',
      windowStart: addHours(landfallAt, -24),
      windowEnd: addHours(landfallAt, -12),
    },
    pda: {
      type: 'Joint Preliminary Damage Assessment',
      windowStart: addHours(landfallAt, 24),
      windowEnd: addHours(landfallAt, 72),
    },
    femaDr: {
      agency: 'FEMA',
      type: 'Major Disaster Declaration (DR)',
      note: 'Public announcement of IA/PA — counties often added via amendments',
      windowStart: addHours(landfallAt, drStartDays * 24),
      windowEnd: addHours(landfallAt, drEndDays * 24),
      likelyPrograms,
    },
    mortgageOps: {
      closingHoldStart: windArrival34At || addHours(landfallAt, -36),
      reinspectionWindowStart: addHours(landfallAt, 24),
      reinspectionWindowEnd: addHours(landfallAt, 14 * 24),
      actions: [
        'Closing Hold',
        isCore ? 'Interior/Exterior Re-Inspection' : 'Exterior Drive-by / Photo Cert',
        'Flood Insurance Check',
        `Watch Governor SoE (${stateAbbr || 'state'}) then FEMA EM/DR`,
      ],
    },
  };
}

/** Approximate county centroids for Gulf/Atlantic demo footprint (extend via DB loans). */
const COUNTY_CENTROIDS = [
  { county_fips: '12057', county_name: 'Hillsborough', state_abbr: 'FL', lat: 27.99, lng: -82.3 },
  { county_fips: '12103', county_name: 'Pinellas', state_abbr: 'FL', lat: 27.9, lng: -82.7 },
  { county_fips: '12081', county_name: 'Manatee', state_abbr: 'FL', lat: 27.48, lng: -82.35 },
  { county_fips: '12115', county_name: 'Sarasota', state_abbr: 'FL', lat: 27.2, lng: -82.45 },
  { county_fips: '12015', county_name: 'Charlotte', state_abbr: 'FL', lat: 26.9, lng: -81.95 },
  { county_fips: '12071', county_name: 'Lee', state_abbr: 'FL', lat: 26.55, lng: -81.85 },
  { county_fips: '12021', county_name: 'Collier', state_abbr: 'FL', lat: 26.1, lng: -81.7 },
  { county_fips: '12086', county_name: 'Miami-Dade', state_abbr: 'FL', lat: 25.6, lng: -80.5 },
  { county_fips: '12011', county_name: 'Broward', state_abbr: 'FL', lat: 26.15, lng: -80.3 },
  { county_fips: '12099', county_name: 'Palm Beach', state_abbr: 'FL', lat: 26.65, lng: -80.2 },
  { county_fips: '12009', county_name: 'Brevard', state_abbr: 'FL', lat: 28.3, lng: -80.7 },
  { county_fips: '12095', county_name: 'Orange', state_abbr: 'FL', lat: 28.5, lng: -81.35 },
  { county_fips: '12105', county_name: 'Polk', state_abbr: 'FL', lat: 27.95, lng: -81.7 },
  { county_fips: '12053', county_name: 'Hernando', state_abbr: 'FL', lat: 28.55, lng: -82.45 },
  { county_fips: '12101', county_name: 'Pasco', state_abbr: 'FL', lat: 28.3, lng: -82.45 },
  { county_fips: '12017', county_name: 'Citrus', state_abbr: 'FL', lat: 28.85, lng: -82.45 },
  { county_fips: '12083', county_name: 'Marion', state_abbr: 'FL', lat: 29.2, lng: -82.15 },
  { county_fips: '12001', county_name: 'Alachua', state_abbr: 'FL', lat: 29.65, lng: -82.35 },
  { county_fips: '12023', county_name: 'Columbia', state_abbr: 'FL', lat: 30.2, lng: -82.6 },
  { county_fips: '12113', county_name: 'Santa Rosa', state_abbr: 'FL', lat: 30.7, lng: -87.0 },
  { county_fips: '12033', county_name: 'Escambia', state_abbr: 'FL', lat: 30.6, lng: -87.3 },
  { county_fips: '12005', county_name: 'Bay', state_abbr: 'FL', lat: 30.2, lng: -85.6 },
  { county_fips: '12123', county_name: 'Taylor', state_abbr: 'FL', lat: 30.05, lng: -83.6 },
  { county_fips: '12037', county_name: 'Franklin', state_abbr: 'FL', lat: 29.8, lng: -84.8 },
  { county_fips: '12045', county_name: 'Gulf', state_abbr: 'FL', lat: 29.95, lng: -85.25 },
  { county_fips: '48201', county_name: 'Harris', state_abbr: 'TX', lat: 29.8, lng: -95.4 },
  { county_fips: '48039', county_name: 'Brazoria', state_abbr: 'TX', lat: 29.15, lng: -95.45 },
  { county_fips: '48167', county_name: 'Galveston', state_abbr: 'TX', lat: 29.3, lng: -94.85 },
  { county_fips: '48321', county_name: 'Matagorda', state_abbr: 'TX', lat: 28.8, lng: -96.0 },
  { county_fips: '48007', county_name: 'Aransas', state_abbr: 'TX', lat: 28.1, lng: -96.95 },
  { county_fips: '48061', county_name: 'Cameron', state_abbr: 'TX', lat: 26.1, lng: -97.5 },
  { county_fips: '22071', county_name: 'Orleans', state_abbr: 'LA', lat: 29.95, lng: -90.07 },
  { county_fips: '22051', county_name: 'Jefferson', state_abbr: 'LA', lat: 29.7, lng: -90.1 },
  { county_fips: '22103', county_name: 'St. Tammany', state_abbr: 'LA', lat: 30.4, lng: -89.95 },
  { county_fips: '22033', county_name: 'East Baton Rouge', state_abbr: 'LA', lat: 30.45, lng: -91.15 },
  { county_fips: '22075', county_name: 'Plaquemines', state_abbr: 'LA', lat: 29.35, lng: -89.7 },
  { county_fips: '22087', county_name: 'St. Bernard', state_abbr: 'LA', lat: 29.85, lng: -89.85 },
  { county_fips: '22057', county_name: 'Lafourche', state_abbr: 'LA', lat: 29.55, lng: -90.45 },
  { county_fips: '22109', county_name: 'Terrebonne', state_abbr: 'LA', lat: 29.4, lng: -90.75 },
  { county_fips: '28047', county_name: 'Harrison', state_abbr: 'MS', lat: 30.4, lng: -89.05 },
  { county_fips: '28045', county_name: 'Hancock', state_abbr: 'MS', lat: 30.4, lng: -89.45 },
  { county_fips: '28059', county_name: 'Jackson', state_abbr: 'MS', lat: 30.45, lng: -88.65 },
  { county_fips: '01097', county_name: 'Mobile', state_abbr: 'AL', lat: 30.7, lng: -88.1 },
  { county_fips: '01003', county_name: 'Baldwin', state_abbr: 'AL', lat: 30.6, lng: -87.75 },
  { county_fips: '13051', county_name: 'Chatham', state_abbr: 'GA', lat: 32.0, lng: -81.1 },
  { county_fips: '13127', county_name: 'Glynn', state_abbr: 'GA', lat: 31.2, lng: -81.5 },
  { county_fips: '13029', county_name: 'Bryan', state_abbr: 'GA', lat: 32.0, lng: -81.45 },
  { county_fips: '45019', county_name: 'Charleston', state_abbr: 'SC', lat: 32.8, lng: -79.95 },
  { county_fips: '45013', county_name: 'Beaufort', state_abbr: 'SC', lat: 32.35, lng: -80.7 },
  { county_fips: '45043', county_name: 'Georgetown', state_abbr: 'SC', lat: 33.4, lng: -79.3 },
  { county_fips: '45051', county_name: 'Horry', state_abbr: 'SC', lat: 33.9, lng: -79.0 },
  { county_fips: '37129', county_name: 'New Hanover', state_abbr: 'NC', lat: 34.2, lng: -77.9 },
  { county_fips: '37019', county_name: 'Brunswick', state_abbr: 'NC', lat: 34.0, lng: -78.2 },
  { county_fips: '37031', county_name: 'Carteret', state_abbr: 'NC', lat: 34.8, lng: -76.7 },
  { county_fips: '37141', county_name: 'Pender', state_abbr: 'NC', lat: 34.5, lng: -77.85 },
  { county_fips: '47037', county_name: 'Davidson', state_abbr: 'TN', lat: 36.15, lng: -86.8 },
  { county_fips: '47065', county_name: 'Hamilton', state_abbr: 'TN', lat: 35.05, lng: -85.25 },
  { county_fips: '47093', county_name: 'Knox', state_abbr: 'TN', lat: 35.95, lng: -83.95 },
  { county_fips: '37021', county_name: 'Buncombe', state_abbr: 'NC', lat: 35.6, lng: -82.55 },
  { county_fips: '37119', county_name: 'Mecklenburg', state_abbr: 'NC', lat: 35.25, lng: -80.85 },
];

export function listCountyCentroids() {
  return COUNTY_CENTROIDS.slice();
}

/**
 * Predict impacted counties for a storm advisory.
 */
export function predictImpactedCounties(storm, advisory, options = {}) {
  const counties = options.counties || listCountyCentroids();
  const landfallAt = storm?.landfall?.at || advisory?.issuedAt;
  const category = storm?.category ?? advisory?.track?.find((t) => t.tauH === 0)?.category ?? 1;
  const track = advisory?.track || [];
  const cone = advisory?.conePolygon || [];
  const windRadii = advisory?.windRadiiNm || {};
  const issuedAt = advisory?.issuedAt || new Date().toISOString();

  const results = [];
  for (const c of counties) {
    const cpa = closestPointOnTrack(c.lat, c.lng, track);
    if (cpa.distanceMiles == null) continue;
    const inCone = pointInPolygon(c.lng, c.lat, cone);
    const swath = classifyWindSwathTier(cpa.distanceMiles, windRadii, inCone);
    if (swath.tier === 'outside' || swath.tier === 'unknown') continue;

    const windArrival34At =
      cpa.tauH != null ? addHours(issuedAt, cpa.tauH) : addHours(landfallAt, -24);
    const windArrival64At =
      swath.tier === 'core_64kt'
        ? addHours(issuedAt, Math.max(0, (cpa.tauH || 0) - 6))
        : null;

    const timeline = predictDeclarationTimeline({
      landfallAt,
      category,
      impactTier: swath.tier,
      stateAbbr: c.state_abbr,
      windArrival34At,
    });

    results.push({
      county_fips: c.county_fips,
      county_name: c.county_name,
      state_abbr: c.state_abbr,
      lat: c.lat,
      lng: c.lng,
      cpaMiles: Math.round(cpa.distanceMiles * 10) / 10,
      cpaTauH: cpa.tauH,
      inCone,
      impactTier: swath.tier,
      impactTierLabel: swath.tierLabel,
      impactRank: swath.rank,
      windArrival34At,
      windArrival64At,
      declarationTimeline: timeline,
      governorSoe: timeline.governorSoe,
      processorAction: timeline.mortgageOps?.actions || [],
    });
  }

  results.sort((a, b) => {
    if (a.impactRank !== b.impactRank) return a.impactRank - b.impactRank;
    return (a.cpaMiles || 999) - (b.cpaMiles || 999);
  });
  return results;
}

/**
 * Summarize governor SoE announcements by state (varies state-to-state).
 */
export function summarizeGovernorAnnouncementsByState(impactedCounties = []) {
  const byState = new Map();
  for (const c of impactedCounties) {
    const st = c.state_abbr;
    if (!st) continue;
    if (!byState.has(st)) {
      byState.set(st, {
        state_abbr: st,
        coastalPrimary: COASTAL_PRIMARY.has(st),
        counties: [],
        earliestSoeStart: null,
        typicalSoe: null,
        latestSoeEnd: null,
        note: null,
      });
    }
    const bucket = byState.get(st);
    bucket.counties.push({
      county_name: c.county_name,
      impactTier: c.impactTier,
      cpaMiles: c.cpaMiles,
    });
    const soe = c.governorSoe || c.declarationTimeline?.governorSoe;
    if (soe) {
      bucket.note = soe.note;
      if (!bucket.earliestSoeStart || (soe.windowStart && soe.windowStart < bucket.earliestSoeStart)) {
        bucket.earliestSoeStart = soe.windowStart;
      }
      if (!bucket.typicalSoe || (soe.windowTypical && soe.windowTypical < bucket.typicalSoe)) {
        bucket.typicalSoe = soe.windowTypical;
      }
      if (!bucket.latestSoeEnd || (soe.windowEnd && soe.windowEnd > bucket.latestSoeEnd)) {
        bucket.latestSoeEnd = soe.windowEnd;
      }
    }
  }
  return Array.from(byState.values()).sort((a, b) =>
    String(a.earliestSoeStart || '').localeCompare(String(b.earliestSoeStart || ''))
  );
}

export function listReplayStormSummaries() {
  const catalog = loadReplayCatalog();
  return (catalog.storms || []).map((s) => ({
    id: s.id,
    name: s.name,
    basin: s.basin,
    year: s.year,
    category: s.category,
    maxWindKt: s.maxWindKt,
    status: s.status,
    synthetic: Boolean(s.synthetic),
    landfall: s.landfall,
    advisoryCount: (s.advisories || []).length,
    source: 'replay',
  }));
}

export function getReplayStorm(stormId) {
  const catalog = loadReplayCatalog();
  return (catalog.storms || []).find((s) => s.id === stormId) || null;
}

export function getAdvisory(storm, advisoryIndex = 0) {
  const advisories = storm?.advisories || [];
  if (!advisories.length) return null;
  const idx = Math.max(0, Math.min(Number(advisoryIndex) || 0, advisories.length - 1));
  return advisories[idx];
}

/**
 * Fetch live NHC CurrentStorms (best-effort). Returns [] when quiet / unreachable.
 */
export async function fetchLiveNhcStorms() {
  const urls = [
    'https://www.nhc.noaa.gov/CurrentStorms.json',
    'https://www.nhc.noaa.gov/gis/forecast/archive/CurrentStorms.json',
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'DevConnectLabs-HurricaneTracker/1.0' },
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const active = data?.activeStorms || data?.storms || data?.features || [];
      if (!Array.isArray(active) || active.length === 0) return [];
      return active.map((s, i) => normalizeLiveStorm(s, i)).filter(Boolean);
    } catch (e) {
      console.warn('⚠️ NHC live fetch failed:', e.message);
    }
  }
  return [];
}

function normalizeLiveStorm(raw, index = 0) {
  if (!raw) return null;
  const props = raw.properties || raw;
  const name = props.name || props.Name || props.stormName || `Live Storm ${index + 1}`;
  const id = String(props.id || props.stormID || props.ATCFid || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const wind = Number(props.intensity || props.windSpeed || props.maxWind || 0) || 0;
  const category = saffirSimpsonCategory(wind);
  const lat = parseFloat(props.lat ?? props.latitude ?? raw.geometry?.coordinates?.[1]);
  const lng = parseFloat(props.lon ?? props.lng ?? props.longitude ?? raw.geometry?.coordinates?.[0]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      id: `live-${id}`,
      name,
      basin: props.basin || 'AL',
      year: new Date().getFullYear(),
      category,
      maxWindKt: wind,
      status: props.classification || props.status || 'Tropical Cyclone',
      source: 'live',
      landfall: null,
      advisories: [],
      raw: props,
    };
  }
  const issuedAt = props.publicAdvisory?.time || props.lastUpdate || new Date().toISOString();
  const track = [
    { tauH: 0, lat, lng, windKt: wind, category },
    { tauH: 12, lat: lat + 1.2, lng: lng + 0.8, windKt: wind, category },
    { tauH: 24, lat: lat + 2.4, lng: lng + 1.5, windKt: Math.max(35, wind - 10), category: saffirSimpsonCategory(Math.max(35, wind - 10)) },
    { tauH: 36, lat: lat + 3.5, lng: lng + 2.0, windKt: Math.max(30, wind - 20), category: saffirSimpsonCategory(Math.max(30, wind - 20)) },
    { tauH: 48, lat: lat + 4.5, lng: lng + 2.5, windKt: Math.max(30, wind - 30), category: 0 },
    { tauH: 72, lat: lat + 6.0, lng: lng + 3.5, windKt: 35, category: 0 },
    { tauH: 96, lat: lat + 7.5, lng: lng + 4.5, windKt: 30, category: 0 },
    { tauH: 120, lat: lat + 9.0, lng: lng + 5.5, windKt: 25, category: 0 },
  ];
  const conePad = 3.5;
  const conePolygon = [
    [lng - conePad, lat - 1],
    [lng + conePad * 0.5, lat - 0.5],
    [lng + conePad, lat + 4],
    [lng + conePad * 0.3, lat + 8],
    [lng - conePad * 0.5, lat + 9],
    [lng - conePad * 1.2, lat + 5],
    [lng - conePad, lat - 1],
  ];
  return {
    id: `live-${id}`,
    name,
    basin: props.basin || 'AL',
    year: new Date().getFullYear(),
    category,
    maxWindKt: wind,
    status: props.classification || props.status || 'Tropical Cyclone',
    source: 'live',
    landfall: {
      name: 'Forecast landfall (estimate)',
      lat: track[3].lat,
      lng: track[3].lng,
      at: addHours(issuedAt, 36),
    },
    advisories: [
      {
        index: 0,
        label: 'Current',
        issuedAt,
        center: { lat, lng },
        track,
        windRadiiNm: {
          kt34: wind >= 34 ? 140 : 0,
          kt50: wind >= 50 ? 80 : 0,
          kt64: wind >= 64 ? 40 : 0,
        },
        conePolygon,
      },
    ],
    raw: props,
  };
}

export function saffirSimpsonCategory(windKt) {
  const w = Number(windKt) || 0;
  if (w >= 157) return 5;
  if (w >= 130) return 4;
  if (w >= 111) return 3;
  if (w >= 96) return 2;
  if (w >= 64) return 1;
  return 0;
}

/**
 * List active storms: live when available, plus replay catalog.
 */
export async function listActiveHurricanes(options = {}) {
  const mode = String(options.mode || 'auto').toLowerCase();
  const replay = listReplayStormSummaries();
  let live = [];
  if (mode === 'live' || mode === 'auto') {
    live = await fetchLiveNhcStorms();
  }
  const useReplay =
    mode === 'replay' || (mode === 'auto' && live.length === 0);

  return {
    mode: live.length > 0 && mode !== 'replay' ? 'live' : useReplay ? 'replay' : mode,
    disclaimer: DECLARATION_DISCLAIMER,
    liveStorms: live.map((s) => ({
      id: s.id,
      name: s.name,
      basin: s.basin,
      year: s.year,
      category: s.category,
      maxWindKt: s.maxWindKt,
      status: s.status,
      source: 'live',
      landfall: s.landfall,
      advisoryCount: (s.advisories || []).length,
    })),
    replayStorms: replay,
    defaultStormId:
      live[0]?.id ||
      replay.find((s) => s.id === 'milton-2024')?.id ||
      replay[0]?.id ||
      null,
  };
}

export async function resolveStorm(stormId, mode = 'auto') {
  if (stormId) {
    const replay = getReplayStorm(stormId);
    if (replay) return { ...replay, source: 'replay' };
    if (String(stormId).startsWith('live-') || mode === 'live' || mode === 'auto') {
      const live = await fetchLiveNhcStorms();
      const found = live.find((s) => s.id === stormId);
      if (found) return found;
    }
  }
  const active = await listActiveHurricanes({ mode });
  if (active.liveStorms.length > 0 && mode !== 'replay') {
    const live = await fetchLiveNhcStorms();
    return live[0] || getReplayStorm(active.defaultStormId);
  }
  return getReplayStorm(active.defaultStormId);
}

/**
 * Full prediction payload for UI / API.
 */
export async function predictHurricaneImpact(options = {}) {
  const mode = String(options.mode || 'auto').toLowerCase();
  const advisoryIndex = Number.isFinite(Number(options.advisoryIndex))
    ? Number(options.advisoryIndex)
    : 0;

  const storm = await resolveStorm(options.stormId, mode);
  if (!storm) {
    return {
      success: false,
      error: 'No storm available',
      disclaimer: DECLARATION_DISCLAIMER,
    };
  }

  const advisory = getAdvisory(storm, advisoryIndex) || storm.advisories?.[0];
  if (!advisory) {
    return {
      success: false,
      error: 'No advisory for storm',
      storm: { id: storm.id, name: storm.name },
      disclaimer: DECLARATION_DISCLAIMER,
    };
  }

  const counties = predictImpactedCounties(storm, advisory);
  const governorByState = summarizeGovernorAnnouncementsByState(counties);

  const loans = await matchLoansInPath(counties, advisory);
  const cameras = await matchCoastalCameras(counties, advisory);

  const nextAnnouncement = pickNextPublicAnnouncement(governorByState, counties);

  return {
    success: true,
    disclaimer: DECLARATION_DISCLAIMER,
    mode: storm.source || 'replay',
    storm: {
      id: storm.id,
      name: storm.name,
      basin: storm.basin,
      year: storm.year,
      category: storm.category,
      maxWindKt: storm.maxWindKt,
      status: storm.status,
      synthetic: Boolean(storm.synthetic),
      landfall: storm.landfall,
      source: storm.source || 'replay',
    },
    advisory: {
      index: advisory.index,
      label: advisory.label,
      issuedAt: advisory.issuedAt,
      center: advisory.center,
      track: advisory.track,
      windRadiiNm: advisory.windRadiiNm,
      conePolygon: advisory.conePolygon,
    },
    advisories: (storm.advisories || []).map((a) => ({
      index: a.index,
      label: a.label,
      issuedAt: a.issuedAt,
    })),
    impactedCounties: counties,
    governorAnnouncementsByState: governorByState,
    nextPublicAnnouncement: nextAnnouncement,
    loansInPath: loans,
    coastalCameras: cameras,
    kpis: {
      category: storm.category,
      maxWindKt: storm.maxWindKt,
      impactedCountyCount: counties.length,
      loansInCone: loans.count,
      loansUpb: loans.totalUpb,
      nextAnnouncement: nextAnnouncement,
    },
  };
}

function pickNextPublicAnnouncement(governorByState, counties) {
  const now = Date.now();
  const candidates = [];
  for (const g of governorByState) {
    if (g.typicalSoe) {
      candidates.push({
        type: 'Governor SoE',
        state: g.state_abbr,
        at: g.typicalSoe,
        label: `${g.state_abbr} Governor State of Emergency`,
      });
    }
  }
  for (const c of counties.slice(0, 20)) {
    const em = c.declarationTimeline?.femaEm;
    const dr = c.declarationTimeline?.femaDr;
    if (em?.windowStart) {
      candidates.push({
        type: 'FEMA EM',
        state: c.state_abbr,
        at: em.windowStart,
        label: `FEMA EM window · ${c.county_name}, ${c.state_abbr}`,
      });
    }
    if (dr?.windowStart && c.impactRank <= 2) {
      candidates.push({
        type: 'FEMA DR',
        state: c.state_abbr,
        at: dr.windowStart,
        label: `FEMA DR public announcement · ${c.county_name}, ${c.state_abbr}`,
      });
    }
  }
  candidates.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const upcoming = candidates.find((c) => new Date(c.at).getTime() >= now - 86400000) || candidates[0];
  return upcoming || null;
}

async function matchLoansInPath(counties, advisory) {
  const pool = getPool();
  const empty = { count: 0, totalUpb: 0, loans: [] };
  if (!pool) return empty;

  const stateList = [...new Set(counties.map((c) => c.state_abbr).filter(Boolean))];
  const countyNames = counties.map((c) => c.county_name.toLowerCase());
  if (!stateList.length) return empty;

  try {
    const { rows } = await pool.query(
      `SELECT id, loan_number, borrower_name, property_address, city, state, county, zip_code,
              latitude, longitude, loan_amount, loan_type, milestone,
              disaster_risk_score, flood_zone, flood_zone_type
       FROM loans
       WHERE UPPER(TRIM(state)) = ANY($1::text[])
         AND latitude IS NOT NULL AND longitude IS NOT NULL
       LIMIT 2000`,
      [stateList]
    );

    const countyByKey = new Map(
      counties.map((c) => [`${c.state_abbr}|${c.county_name.toLowerCase()}`, c])
    );
    const cone = advisory?.conePolygon || [];
    const matched = [];
    let totalUpb = 0;

    for (const loan of rows) {
      const st = String(loan.state || '').toUpperCase();
      const cnty = String(loan.county || '')
        .replace(/\s+County$/i, '')
        .trim()
        .toLowerCase();
      const countyHit = countyByKey.get(`${st}|${cnty}`);
      const lat = parseFloat(loan.latitude);
      const lng = parseFloat(loan.longitude);
      const inCone = Number.isFinite(lat) && Number.isFinite(lng) && pointInPolygon(lng, lat, cone);
      if (!countyHit && !inCone) continue;

      const impact = countyHit || {
        impactTier: inCone ? 'ts_34kt' : 'fringe',
        impactTierLabel: inCone ? '34kt / Cone' : 'Fringe',
        cpaMiles: null,
        governorSoe: null,
      };
      const amount = Number(loan.loan_amount) || 0;
      totalUpb += amount;
      matched.push({
        ...loan,
        impactTier: impact.impactTier,
        impactTierLabel: impact.impactTierLabel,
        cpaMiles: impact.cpaMiles,
        governorSoeWindow: impact.governorSoe?.windowTypical || impact.declarationTimeline?.governorSoe?.windowTypical || null,
        inCone,
      });
    }

    matched.sort((a, b) => (Number(b.loan_amount) || 0) - (Number(a.loan_amount) || 0));
    return {
      count: matched.length,
      totalUpb: Math.round(totalUpb),
      loans: matched.slice(0, 500),
    };
  } catch (e) {
    console.warn('⚠️ matchLoansInPath failed:', e.message);
    return empty;
  }
}

async function matchCoastalCameras(counties, advisory) {
  const pool = getPool();
  if (!pool) return [];
  const stateList = [...new Set(counties.map((c) => c.state_abbr).filter(Boolean))];
  if (!stateList.length) return [];
  try {
    const { rows } = await pool.query(
      `SELECT id, source, source_id, name, lat, lng, county_name, state_abbr,
              camera_url, image_url, media_type, hazard_types, status
       FROM fire_cameras
       WHERE UPPER(TRIM(COALESCE(state_abbr,''))) = ANY($1::text[])
         AND (
           hazard_types ?| ARRAY['coastal','storm','weather','flood']
           OR source IN ('webcoos','ucsd_pier','faa_weathercam','dot_511ny','caltrans_cwwp2','ndbc_buoycam','ioos_coastal','nps_webcams','dot_coastal')
         )
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 200`,
      [stateList]
    );
    const cone = advisory?.conePolygon || [];
    return rows
      .map((cam) => {
        const lat = parseFloat(cam.lat);
        const lng = parseFloat(cam.lng);
        const inCone =
          Number.isFinite(lat) && Number.isFinite(lng) && pointInPolygon(lng, lat, cone);
        return { ...cam, inCone };
      })
      .filter((c) => c.inCone || stateList.includes(String(c.state_abbr || '').toUpperCase()))
      .slice(0, 80);
  } catch (e) {
    console.warn('⚠️ matchCoastalCameras failed:', e.message);
    return [];
  }
}

/**
 * Analyze spreadsheet properties against hurricane cone / county path.
 */
export async function analyzeHurricaneSpreadsheet(options = {}) {
  const prediction = await predictHurricaneImpact({
    stormId: options.stormId,
    mode: options.mode || 'auto',
    advisoryIndex: options.advisoryIndex ?? 0,
  });
  if (!prediction.success) return prediction;

  const rawProps = Array.isArray(options.properties) ? options.properties : [];
  const properties = rawProps.map((r, i) => normalizeSpreadsheetPropertyRow(r, i));
  const countyMap = new Map(
    (prediction.impactedCounties || []).map((c) => [
      `${c.state_abbr}|${c.county_name.toLowerCase()}`,
      c,
    ])
  );
  const cone = prediction.advisory?.conePolygon || [];

  const analyzed = properties.map((p) => {
    const key = `${p.state}|${String(p.county || '').toLowerCase()}`;
    const countyHit = countyMap.get(key);
    const inCone =
      p.latitude != null &&
      p.longitude != null &&
      pointInPolygon(p.longitude, p.latitude, cone);
    const matched = [];
    if (countyHit || inCone) {
      matched.push({
        source: 'nhc',
        event_type: 'hurricane',
        title: prediction.storm.name,
        distanceMiles: countyHit?.cpaMiles ?? null,
        impactTier: countyHit?.impactTier || (inCone ? 'ts_34kt' : 'fringe'),
      });
    }
    const triageScore = countyHit
      ? Math.min(15, 10 - (countyHit.impactRank - 1) * 2 + (p.flood_zone?.startsWith('A') || p.flood_zone?.startsWith('V') ? 3 : 0))
      : inCone
        ? 6
        : 0;
    const requirements = buildLenderRequirementsForProperty(p, matched, triageScore);
    return {
      ...p,
      inCone,
      impactTier: countyHit?.impactTier || (inCone ? 'ts_34kt' : null),
      governorSoe: countyHit?.governorSoe || null,
      declarationTimeline: countyHit?.declarationTimeline || null,
      triageScore,
      matchedHazards: matched,
      requirements,
    };
  });

  return {
    success: true,
    disclaimer: DECLARATION_DISCLAIMER,
    storm: prediction.storm,
    advisory: { index: prediction.advisory.index, label: prediction.advisory.label },
    governorAnnouncementsByState: prediction.governorAnnouncementsByState,
    properties: analyzed,
    rollup: {
      total: analyzed.length,
      inPath: analyzed.filter((p) => p.impactTier || p.inCone).length,
      holdClosing: analyzed.filter((p) => p.requirements?.statusCode === 'hold_inspection').length,
    },
  };
}

/** Sample Gulf/Atlantic coastal tape for demos */
export function getSampleHurricaneTape() {
  return [
    { loan_number: 'HN-001', borrower_name: 'Borrower-A', property_address: '100 Gulf Blvd', city: 'Clearwater', state: 'FL', county: 'Pinellas', loan_amount: 425000, milestone: 'Clear to Close', flood_zone: 'AE', latitude: 27.96, longitude: -82.8 },
    { loan_number: 'HN-002', borrower_name: 'Borrower-B', property_address: '220 Beach Dr', city: 'Sarasota', state: 'FL', county: 'Sarasota', loan_amount: 610000, milestone: 'Closing', flood_zone: 'VE', latitude: 27.33, longitude: -82.55 },
    { loan_number: 'HN-003', borrower_name: 'Borrower-C', property_address: '88 Bayshore', city: 'Tampa', state: 'FL', county: 'Hillsborough', loan_amount: 380000, milestone: 'Underwriting', flood_zone: 'X', latitude: 27.94, longitude: -82.46 },
    { loan_number: 'HN-004', borrower_name: 'Borrower-D', property_address: '15 Fort Myers Beach Rd', city: 'Fort Myers Beach', state: 'FL', county: 'Lee', loan_amount: 520000, milestone: 'Clear to Close', flood_zone: 'AE', latitude: 26.45, longitude: -81.95 },
    { loan_number: 'HN-005', borrower_name: 'Borrower-E', property_address: '400 Canal St', city: 'New Orleans', state: 'LA', county: 'Orleans', loan_amount: 295000, milestone: 'Closing', flood_zone: 'AE', latitude: 29.95, longitude: -90.07 },
    { loan_number: 'HN-006', borrower_name: 'Borrower-F', property_address: '12 Seawall Blvd', city: 'Galveston', state: 'TX', county: 'Galveston', loan_amount: 340000, milestone: 'Underwriting', flood_zone: 'VE', latitude: 29.29, longitude: -94.79 },
    { loan_number: 'HN-007', borrower_name: 'Borrower-G', property_address: '77 Matagorda Ave', city: 'Bay City', state: 'TX', county: 'Matagorda', loan_amount: 210000, milestone: 'Processing', flood_zone: 'A', latitude: 28.98, longitude: -95.97 },
    { loan_number: 'HN-008', borrower_name: 'Borrower-H', property_address: '9 Biloxi Shore', city: 'Biloxi', state: 'MS', county: 'Harrison', loan_amount: 275000, milestone: 'Clear to Close', flood_zone: 'AE', latitude: 30.4, longitude: -88.9 },
    { loan_number: 'HN-009', borrower_name: 'Borrower-I', property_address: '55 Mobile Bay Dr', city: 'Mobile', state: 'AL', county: 'Mobile', loan_amount: 310000, milestone: 'Closing', flood_zone: 'X', latitude: 30.69, longitude: -88.04 },
    { loan_number: 'HN-010', borrower_name: 'Borrower-J', property_address: '3 Charleston Harbor', city: 'Charleston', state: 'SC', county: 'Charleston', loan_amount: 480000, milestone: 'Underwriting', flood_zone: 'AE', latitude: 32.78, longitude: -79.93 },
    { loan_number: 'HN-011', borrower_name: 'Borrower-K', property_address: '18 Wilmington Pier', city: 'Wilmington', state: 'NC', county: 'New Hanover', loan_amount: 365000, milestone: 'Clear to Close', flood_zone: 'AE', latitude: 34.21, longitude: -77.89 },
    { loan_number: 'HN-012', borrower_name: 'Borrower-L', property_address: '200 Asheville Ridge', city: 'Asheville', state: 'NC', county: 'Buncombe', loan_amount: 390000, milestone: 'Closing', flood_zone: 'X', latitude: 35.6, longitude: -82.55 },
  ];
}

export default {
  loadReplayCatalog,
  listReplayStormSummaries,
  getReplayStorm,
  listActiveHurricanes,
  predictHurricaneImpact,
  predictImpactedCounties,
  predictDeclarationTimeline,
  summarizeGovernorAnnouncementsByState,
  analyzeHurricaneSpreadsheet,
  getSampleHurricaneTape,
  classifyWindSwathTier,
  closestPointOnTrack,
  haversineMiles,
  pointInPolygon,
  getGovernorSoeLag,
  DECLARATION_DISCLAIMER,
  GOVERNOR_SOE_LAG_HOURS,
};
