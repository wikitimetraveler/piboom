/**
 * Disaster Spreadsheet Property Risk Analysis Service
 *
 * @file       disaster-spreadsheet.service.js
 * @author     David Lane
 * @version    1.0.0
 *
 * @description
 * Evaluates a spreadsheet / portfolio tape of mortgage properties against
 * active 90-day multi-source disasters (FEMA, NASA FIRMS, USGS, NOAA/NWS, NHC)
 * and FEMA flood zones, producing per-property risk triage scores, matched
 * hazards, lender underwriting/closing requirements, and portfolio rollups.
 */

import { getPool } from './database.service.js';

const KM_TO_MILES = 0.621371;
const DISASTER_WINDOW_DAYS = 90;

const FLOOD_ZONE_WEIGHTS = Object.freeze({
  VE: 4,
  V: 4,
  AO: 4,
  AE: 4,
  AH: 3,
  A99: 3,
  A: 2,
  D: 0.5,
  X: 0,
});
const FLOOD_ZONE_PREFIX_ORDER = ['A99', 'VE', 'AE', 'AO', 'AH', 'V', 'A'];

export function floodZoneTriageWeight(floodZone, floodZoneType = null) {
  const z = String(floodZone || '').toUpperCase().trim();
  if (!z) return 0;
  if (Object.prototype.hasOwnProperty.call(FLOOD_ZONE_WEIGHTS, z)) {
    if (z === 'X' && floodZoneType && String(floodZoneType).toLowerCase().includes('shaded')) {
      return 1;
    }
    return FLOOD_ZONE_WEIGHTS[z];
  }
  for (const prefix of FLOOD_ZONE_PREFIX_ORDER) {
    if (z.startsWith(prefix)) return FLOOD_ZONE_WEIGHTS[prefix];
  }
  return 0;
}

export function distanceTriageWeight(distanceMiles) {
  if (distanceMiles == null || !Number.isFinite(Number(distanceMiles))) return 0.5;
  const d = Number(distanceMiles);
  if (d <= 10) return 1;
  if (d <= 25) return 0.75;
  if (d <= 50) return 0.5;
  if (d <= 100) return 0.25;
  return 0.1;
}

export function recencyTriageWeight(isoDate, nowMs = Date.now()) {
  if (!isoDate) return 0.5;
  const t = new Date(isoDate).getTime();
  if (!Number.isFinite(t)) return 0.5;
  const ageDays = (nowMs - t) / (86400 * 1000);
  if (ageDays <= 14) return 1;
  if (ageDays <= 30) return 0.75;
  if (ageDays <= 60) return 0.5;
  if (ageDays <= 90) return 0.25;
  return 0.1;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || !Number.isFinite(Number(v)))) {
    return null;
  }
  const R = 6371;
  const toRad = (deg) => (Number(deg) * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLon = toRad(Number(lon2) - Number(lon1));
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const HEADER_ALIASES = {
  loan_number: ['loan_number', 'loannumber', 'loan_id', 'loanid', 'loan_no', 'loanno', 'loan', 'loan #', 'loan#', 'id', 'property_id'],
  borrower_name: ['borrower_name', 'borrower', 'borrowername', 'client', 'applicant', 'name', 'owner'],
  property_address: ['property_address', 'address', 'street_address', 'street', 'propertyaddress', 'subject_property', 'property'],
  city: ['city', 'town', 'municipality'],
  state: ['state', 'state_abbr', 'st', 'province'],
  county: ['county', 'county_name', 'parish', 'borough'],
  zip_code: ['zip_code', 'zip', 'zipcode', 'postal_code', 'postal'],
  loan_amount: ['loan_amount', 'loanamount', 'amount', 'upb', 'balance', 'principal', 'loan_size', 'value'],
  milestone: ['milestone', 'stage', 'status', 'loan_status', 'pipeline_stage'],
  loan_type: ['loan_type', 'loantype', 'program', 'product', 'agency'],
  flood_zone: ['flood_zone', 'floodzone', 'nfhl_zone', 'fema_flood_zone', 'zone'],
  latitude: ['latitude', 'lat', 'y'],
  longitude: ['longitude', 'lng', 'lon', 'long', 'x'],
};

function cleanCounty(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/\s*\(County\)$/i, '')
    .replace(/\s+County$/i, '')
    .replace(/\s+Parish$/i, '')
    .trim();
}

function parseNumber(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const cleaned = String(val).replace(/[$,%\s,]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize an arbitrary spreadsheet row object using flexible column aliases.
 * @param {Object} rawRow
 * @param {number} index
 * @returns {Object}
 */
export function normalizeSpreadsheetPropertyRow(rawRow = {}, index = 0) {
  const lowered = Object.create(null);
  for (const [k, v] of Object.entries(rawRow || {})) {
    const normKey = String(k || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '_');
    lowered[normKey] = v;
    lowered[String(k || '').trim().toLowerCase()] = v;
  }

  const pick = (field) => {
    const aliases = HEADER_ALIASES[field] || [field];
    for (const alias of aliases) {
      const normAlias = alias.replace(/[\s_-]+/g, '_');
      if (lowered[normAlias] !== undefined && lowered[normAlias] !== null && String(lowered[normAlias]).trim() !== '') {
        return lowered[normAlias];
      }
      if (lowered[alias] !== undefined && lowered[alias] !== null && String(lowered[alias]).trim() !== '') {
        return lowered[alias];
      }
    }
    return '';
  };

  const loanNumber = String(pick('loan_number') || `PROP-${String(index + 1).padStart(3, '0')}`).trim();
  const borrowerName = String(pick('borrower_name') || 'Portfolio Property').trim();
  const propertyAddress = String(pick('property_address') || '').trim();
  const city = String(pick('city') || '').trim();
  const state = String(pick('state') || '').trim().toUpperCase().slice(0, 2);
  const county = cleanCounty(pick('county'));
  const zipCode = String(pick('zip_code') || '').trim();
  const loanAmount = parseNumber(pick('loan_amount')) ?? 0;
  const milestone = String(pick('milestone') || 'Underwriting').trim();
  const loanType = String(pick('loan_type') || 'Conventional').trim();
  const floodZone = String(pick('flood_zone') || '').trim().toUpperCase();
  const latitude = parseNumber(pick('latitude'));
  const longitude = parseNumber(pick('longitude'));

  return {
    rowIndex: index + 1,
    loan_number: loanNumber,
    borrower_name: borrowerName,
    property_address: propertyAddress,
    city,
    state,
    county,
    zip_code: zipCode,
    loan_amount: loanAmount,
    milestone,
    loan_type: loanType,
    flood_zone: floodZone,
    latitude: latitude != null && Math.abs(latitude) <= 90 ? latitude : null,
    longitude: longitude != null && Math.abs(longitude) <= 180 ? longitude : null,
  };
}

/**
 * Determine what a lender needs for a property given its matched disasters & flood zone.
 */
export function buildLenderRequirementsForProperty(property, matchedDisasters = [], triageScore = 0) {
  const femaDisasters = matchedDisasters.filter((d) => String(d.source || '').toLowerCase() === 'fema');
  const firmsFires = matchedDisasters.filter((d) => {
    const s = String(d.source || '').toLowerCase();
    const et = String(d.event_type || '').toLowerCase();
    return s === 'firms' || et.includes('fire') || et.includes('wildfire');
  });
  const hurricanes = matchedDisasters.filter((d) => {
    const s = String(d.source || '').toLowerCase();
    const et = String(d.event_type || '').toLowerCase();
    return s === 'nhc' || et.includes('hurricane') || et.includes('tropical') || et.includes('tornado');
  });
  const quakes = matchedDisasters.filter((d) => {
    const s = String(d.source || '').toLowerCase();
    const et = String(d.event_type || '').toLowerCase();
    return s === 'usgs' || et.includes('earthquake');
  });
  const weatherAlerts = matchedDisasters.filter((d) => String(d.source || '').toLowerCase() === 'nws');

  const fz = String(property?.flood_zone || '').toUpperCase();
  const isHighRiskFloodZone = fz.startsWith('A') || fz.startsWith('V');
  const closeFireOrStorm = matchedDisasters.some(
    (d) =>
      d.distanceMiles != null &&
      d.distanceMiles <= 25 &&
      (String(d.source || '').toLowerCase() === 'firms' ||
        String(d.source || '').toLowerCase() === 'nhc' ||
        /fire|wildfire|hurricane|tornado/i.test(String(d.event_type || '')))
  );

  const checklist = [];
  let statusBadge = 'CLEAR TO PROCEED';
  let statusCode = 'clear';
  let collateralAction = 'Standard appraisal / collateral review';
  let insuranceAction = 'Standard hazard insurance binder check';
  let closingGate = 'No disaster hold — eligible for normal closing';

  if (femaDisasters.length > 0) {
    statusBadge = 'HOLD CLOSING · RE-INSPECTION REQ';
    statusCode = 'hold_inspection';
    collateralAction =
      'Order Post-Disaster Property Inspection (Form 1004D / Exterior & Interior certification per Fannie/Freddie/FHA)';
    insuranceAction =
      'Verify active Hazard & Flood Insurance binder; confirm no carrier moratorium in declared county';
    closingGate =
      'HOLD Clear-to-Close / Funding until post-disaster inspection confirms no structural damage';
    checklist.push(
      'Obtain post-disaster inspection report with dated photos confirming property is free of damage and habitable',
      'Verify hazard insurance policy is active and not subject to a county binding moratorium',
      'Obtain borrower disaster attestation / no-damage recertification prior to disbursement'
    );
  } else if (closeFireOrStorm || firmsFires.length > 0 || hurricanes.length > 0) {
    statusBadge = closeFireOrStorm ? 'HOLD / PERIMETER INSPECT' : 'BINDER & MORATORIUM WATCH';
    statusCode = closeFireOrStorm ? 'hold_inspection' : 'insurance_watch';
    collateralAction = closeFireOrStorm
      ? 'Require drive-by / exterior photo certification confirming property is outside active fire/storm perimeter'
      : 'Monitor active wildfire/tropical perimeter; require exterior check if within 15 miles prior to funding';
    insuranceAction =
      'Confirm HOI / Windstorm binder is bound and active (check carrier zip-code moratoriums)';
    closingGate = closeFireOrStorm
      ? 'Hold funding until perimeter clearance & active insurance binder verified'
      : 'Prior-to-Funding: verify carrier binder remains active through disbursement';
    checklist.push(
      'Check insurance carrier binding moratoriums for property ZIP / county',
      'Verify hazard & wind/fire coverage is bound prior to closing',
      closeFireOrStorm
        ? 'Order exterior condition certification or appraiser update (within 25 mi of active hazard)'
        : 'Monitor nearby hazard feeds before wire release'
    );
  } else if (quakes.length > 0 && triageScore >= 4) {
    statusBadge = 'STRUCTURAL & BINDER CHECK';
    statusCode = 'insurance_watch';
    collateralAction = 'Verify no structural damage reported following recent seismic event';
    insuranceAction = 'Confirm hazard coverage and review earthquake endorsement if applicable';
    closingGate = 'Confirm borrower attestation of no property damage before funding';
    checklist.push(
      'Obtain borrower/agent confirmation of no seismic damage',
      'Verify hazard binder in force'
    );
  } else if (weatherAlerts.length > 0) {
    statusBadge = 'WEATHER ALERT WATCH';
    statusCode = 'advisory';
    collateralAction = 'Standard appraisal; monitor severe weather alert through closing';
    insuranceAction = 'Confirm active hazard insurance binder prior to funding';
    closingGate = 'Proceed with advisory watch on active NOAA/NWS alert';
    checklist.push('Monitor active NOAA/NWS alert expiration prior to loan funding');
  }

  if (isHighRiskFloodZone) {
    if (statusCode === 'clear' || statusCode === 'advisory') {
      statusBadge = 'MANDATORY FLOOD INSURANCE';
      statusCode = 'flood_required';
      closingGate = 'Hold closing until mandatory SFHA Flood Insurance binder is verified';
    }
    insuranceAction = `Mandatory SFHA Flood Insurance required (Zone ${fz}) — verify NFIP or qualifying private flood policy & escrow`;
    checklist.push(
      `Verify Life-of-Loan Flood Zone Determination & mandatory flood insurance binder for Zone ${fz} (min coverage per GSE/FHA rules)`
    );
  }

  if (checklist.length === 0) {
    checklist.push('No active 90-day disaster declarations or proximity hazards — standard underwriting applies');
  }

  return {
    statusBadge,
    statusCode,
    collateralAction,
    insuranceAction,
    closingGate,
    checklist,
  };
}

/**
 * Evaluate a single normalized property against a list of unified disaster rows.
 */
export function evaluatePropertyAgainstDisasters(property, allDisasters = [], options = {}) {
  const radiusMiles = Number.isFinite(Number(options.radiusMiles))
    ? Math.min(500, Math.max(1, Number(options.radiusMiles)))
    : 25;

  const propState = String(property.state || '').toUpperCase();
  const propCounty = cleanCounty(property.county).toLowerCase();
  const hasPropCoords =
    property.latitude != null &&
    property.longitude != null &&
    Number.isFinite(Number(property.latitude)) &&
    Number.isFinite(Number(property.longitude));

  const matched = [];
  const seenKeys = new Set();

  for (const d of allDisasters || []) {
    if (!d) continue;
    const dSource = String(d.source || '').toLowerCase();
    if (dSource === 'alertcalifornia' || d.event_type === 'camera') continue;

    const dState = String(d.state_abbr || d.state || '').trim().toUpperCase();
    const dCounty = cleanCounty(d.county_name || d.county).toLowerCase();
    const dLat = d.lat != null ? Number(d.lat) : (d.latitude != null ? Number(d.latitude) : null);
    const dLng = d.lng != null ? Number(d.lng) : (d.longitude != null ? Number(d.longitude) : null);
    const hasDisasterCoords = Number.isFinite(dLat) && Number.isFinite(dLng);

    let distanceMiles = null;
    if (hasPropCoords && hasDisasterCoords) {
      const distKm = haversineDistanceKm(
        Number(property.latitude),
        Number(property.longitude),
        dLat,
        dLng
      );
      if (distKm != null && Number.isFinite(distKm)) {
        distanceMiles = Math.round(distKm * KM_TO_MILES * 10) / 10;
      }
    }

    const withinRadius = distanceMiles != null && distanceMiles <= radiusMiles;
    const sameCounty =
      propState &&
      dState === propState &&
      propCounty &&
      dCounty &&
      (dCounty === propCounty || dCounty.includes(propCounty) || propCounty.includes(dCounty));
    const statewideFemaMatch =
      propState &&
      dState === propState &&
      !dCounty &&
      dSource === 'fema';

    if (!withinRadius && !sameCounty && !statewideFemaMatch) {
      continue;
    }

    const dedupKey = `${dSource}|${d.source_id || d.title || ''}|${d.start_time || ''}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    matched.push({
      id: d.id,
      source: dSource,
      event_type: d.event_type || 'hazard',
      title: d.title || d.event_type || 'Hazard event',
      county_name: d.county_name || d.county || '',
      state_abbr: dState,
      start_time: d.start_time || null,
      distanceMiles,
      matchType: withinRadius ? 'radius' : 'county',
    });
  }

  matched.sort((a, b) => {
    const da = a.distanceMiles != null ? a.distanceMiles : 9999;
    const db = b.distanceMiles != null ? b.distanceMiles : 9999;
    if (da !== db) return da - db;
    return (new Date(b.start_time || 0).getTime() || 0) - (new Date(a.start_time || 0).getTime() || 0);
  });

  // Compute composite ops triage score (0–15)
  const femaMatches = matched.filter((m) => m.source === 'fema');
  let score = 0;

  // 1. FEMA declaration weight
  for (const f of femaMatches) {
    score += 2.5 * distanceTriageWeight(f.distanceMiles ?? 15) * recencyTriageWeight(f.start_time);
  }
  score = Math.min(score, 8);

  // 2. Live multi-hazard proximity weight (FIRMS, NHC, USGS, NWS)
  const nonFema = matched.filter((m) => m.source !== 'fema');
  const sourceWeights = {
    nhc: 2.5,
    firms: 2.0,
    usgs: 1.75,
    nws: 1.0,
    floodzones: 1.5,
  };
  let liveHazardScore = 0;
  for (const m of nonFema) {
    const sw = sourceWeights[m.source] || 1.0;
    const dw = m.distanceMiles != null ? distanceTriageWeight(m.distanceMiles) : 0.6;
    const rw = recencyTriageWeight(m.start_time);
    liveHazardScore += sw * dw * rw;
  }
  score += Math.min(liveHazardScore, 6);

  // 3. Explicit flood zone weight
  score += floodZoneTriageWeight(property.flood_zone);

  const triageScore = Math.min(Math.round(score * 10) / 10, 15);

  let riskTier = 'Clear';
  if (triageScore >= 10) riskTier = 'Critical';
  else if (triageScore >= 6) riskTier = 'High';
  else if (triageScore >= 3) riskTier = 'Moderate';
  else if (triageScore > 0 || matched.length > 0) riskTier = 'Low';

  const sourceCounts = {
    fema: femaMatches.length,
    firms: matched.filter((m) => m.source === 'firms').length,
    usgs: matched.filter((m) => m.source === 'usgs').length,
    nws: matched.filter((m) => m.source === 'nws').length,
    nhc: matched.filter((m) => m.source === 'nhc').length,
    floodzones: matched.filter((m) => m.source === 'floodzones').length,
  };

  const closestDisaster = matched[0] || null;
  const lenderRequirements = buildLenderRequirementsForProperty(property, matched, triageScore);

  return {
    ...property,
    triageScore,
    riskTier,
    matchedCount: matched.length,
    femaDeclared: femaMatches.length > 0,
    sourceCounts,
    closestDisaster,
    matchedDisasters: matched.slice(0, 12),
    lenderRequirements,
  };
}

/**
 * Analyze a full array of spreadsheet property rows and compute portfolio summary + hotspots.
 * @param {Array<Object>} rawRows
 * @param {Object} [options]
 * @param {Array<Object>} [options.disasters] - Optional preloaded disasters; if omitted, queries Postgres
 * @param {number} [options.radiusMiles=25]
 * @returns {Promise<Object>}
 */
export async function analyzePropertySpreadsheet(rawRows = [], options = {}) {
  const rows = Array.isArray(rawRows) ? rawRows.slice(0, 500) : [];
  const radiusMiles = Number.isFinite(Number(options.radiusMiles))
    ? Math.min(500, Math.max(1, Number(options.radiusMiles)))
    : 25;

  let disasters = Array.isArray(options.disasters) ? options.disasters : null;
  if (!disasters) {
    disasters = [];
    const pool = getPool();
    if (pool) {
      try {
        const sinceIso = new Date(
          Date.now() - DISASTER_WINDOW_DAYS * 24 * 3600 * 1000
        ).toISOString();
        const res = await pool.query(
          `SELECT id, source, event_type, county_name, state_abbr, start_time, end_time, severity, title, lat, lng, source_id
           FROM disasters
           WHERE start_time >= $1
           ORDER BY start_time DESC
           LIMIT 5000`,
          [sinceIso]
        );
        disasters = res.rows || [];
      } catch (err) {
        console.warn('⚠️  Could not query Postgres disasters for spreadsheet analysis:', err.message);
      }
    }
  }

  const normalizedProperties = rows.map((r, i) => normalizeSpreadsheetPropertyRow(r, i));
  const analyzedProperties = normalizedProperties.map((prop) =>
    evaluatePropertyAgainstDisasters(prop, disasters, { radiusMiles })
  );

  // Sort highest risk first
  analyzedProperties.sort(
    (a, b) => b.triageScore - a.triageScore || b.matchedCount - a.matchedCount || a.rowIndex - b.rowIndex
  );

  const summary = {
    totalProperties: analyzedProperties.length,
    totalUpb: 0,
    criticalCount: 0,
    highCount: 0,
    moderateCount: 0,
    lowCount: 0,
    clearCount: 0,
    atRiskCount: 0,
    atRiskUpb: 0,
    femaImpactedCount: 0,
    femaImpactedUpb: 0,
    holdClosingCount: 0,
    holdClosingUpb: 0,
    floodActionCount: 0,
    radiusMiles,
    disastersEvaluated: disasters.length,
  };

  const hotspotMap = new Map();

  for (const p of analyzedProperties) {
    const upb = Number(p.loan_amount) || 0;
    summary.totalUpb += upb;
    if (p.riskTier === 'Critical') summary.criticalCount += 1;
    else if (p.riskTier === 'High') summary.highCount += 1;
    else if (p.riskTier === 'Moderate') summary.moderateCount += 1;
    else if (p.riskTier === 'Low') summary.lowCount += 1;
    else summary.clearCount += 1;

    if (p.riskTier === 'Critical' || p.riskTier === 'High' || p.riskTier === 'Moderate') {
      summary.atRiskCount += 1;
      summary.atRiskUpb += upb;
    }
    if (p.femaDeclared) {
      summary.femaImpactedCount += 1;
      summary.femaImpactedUpb += upb;
    }
    if (p.lenderRequirements?.statusCode === 'hold_inspection') {
      summary.holdClosingCount += 1;
      summary.holdClosingUpb += upb;
    }
    if (
      String(p.flood_zone || '').startsWith('A') ||
      String(p.flood_zone || '').startsWith('V') ||
      p.lenderRequirements?.statusCode === 'flood_required'
    ) {
      summary.floodActionCount += 1;
    }

    const locKey = `${p.county || 'Unspecified'}|${p.state || 'US'}`;
    if (!hotspotMap.has(locKey)) {
      hotspotMap.set(locKey, {
        county: p.county || 'Unspecified',
        state: p.state || '',
        propertyCount: 0,
        totalUpb: 0,
        peakTriageScore: 0,
        femaDeclared: false,
        lenderAction: p.lenderRequirements?.statusBadge || 'CLEAR TO PROCEED',
      });
    }
    const h = hotspotMap.get(locKey);
    h.propertyCount += 1;
    h.totalUpb += upb;
    if (p.triageScore > h.peakTriageScore) {
      h.peakTriageScore = p.triageScore;
      h.lenderAction = p.lenderRequirements?.statusBadge || h.lenderAction;
    }
    if (p.femaDeclared) h.femaDeclared = true;
  }

  const portfolioHotspots = [...hotspotMap.values()].sort(
    (a, b) => b.peakTriageScore - a.peakTriageScore || b.totalUpb - a.totalUpb
  );

  return {
    summary,
    properties: analyzedProperties,
    portfolioHotspots,
    analyzedAt: new Date().toISOString(),
  };
}

export default {
  normalizeSpreadsheetPropertyRow,
  buildLenderRequirementsForProperty,
  evaluatePropertyAgainstDisasters,
  analyzePropertySpreadsheet,
};
