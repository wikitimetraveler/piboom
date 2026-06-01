/**
 * PostGIS spatial queries for disasters, hazard webcams, and loans.
 * Falls back to Haversine when PostGIS is unavailable.
 */
import { getPool, isPostgisAvailable } from './database.service.js';
import {
  calculateDistance,
  filterFireCamerasByDistance,
  sortCamerasByDistance,
  DISASTER_ROLLING_WINDOW_DAYS
} from './disasters.service.js';

export const METERS_PER_MILE = 1609.34;
const MI_PER_KM = 0.621371;

const LOAN_SELECT_LITE_COLS = `
        id, loan_number, borrower_name, property_address, city, state, county, zip_code,
        latitude, longitude, loan_amount, loan_type, milestone,
        disaster_risk_score, disaster_declaration_count,
        flood_zone, flood_zone_type, dfirm_id, base_flood_elevation, last_flood_zone_check,
        last_risk_analysis, created_at, updated_at`;

function normalizeCountyNameLocal(name) {
  return String(name || '').replace(/\s*\(County\)$/i, '').trim();
}

export function milesToMeters(miles) {
  return miles * METERS_PER_MILE;
}

function attachDistanceMiles(row, distanceMeters) {
  const distance_km = distanceMeters != null ? Math.round((distanceMeters / 1000) * 10) / 10 : null;
  const distance_miles = distanceMeters != null
    ? Math.round((distanceMeters / METERS_PER_MILE) * 10) / 10
    : null;
  return { ...row, distance_meters: distanceMeters, distance_km, distance_miles };
}

function buildCameraFilterClauses(filters = {}, startIdx = 4) {
  const clauses = [];
  const values = [];
  let idx = startIdx;

  if (filters.state) {
    values.push(String(filters.state).trim().toUpperCase());
    clauses.push(`UPPER(TRIM(COALESCE(state_abbr,''))) = $${idx++}`);
  }
  if (filters.county) {
    values.push(`%${String(filters.county).trim()}%`);
    clauses.push(`county_name ILIKE $${idx++}`);
  }
  if (filters.source) {
    values.push(String(filters.source).trim().toLowerCase());
    clauses.push(`LOWER(TRIM(source)) = $${idx++}`);
  }
  if (filters.hazard) {
    values.push(JSON.stringify([String(filters.hazard).trim().toLowerCase()]));
    clauses.push(`hazard_types @> $${idx++}::jsonb`);
  }
  if (filters.mediaType) {
    values.push(String(filters.mediaType).trim().toLowerCase());
    clauses.push(`LOWER(TRIM(COALESCE(media_type,''))) = $${idx++}`);
  }

  return { clauses, values, nextIdx: idx };
}

function buildLoanFilterClauses(filters = {}, startIdx = 4) {
  const clauses = [];
  const values = [];
  let idx = startIdx;

  if (filters.milestone) {
    values.push(filters.milestone);
    clauses.push(`milestone = $${idx++}`);
  }
  if (filters.state) {
    values.push(filters.state);
    clauses.push(`state = $${idx++}`);
  }
  if (filters.county) {
    const normalizedCounty = normalizeCountyNameLocal(filters.county);
    if (normalizedCounty) {
      values.push(`%${normalizedCounty}%`);
      clauses.push(`county ILIKE $${idx++}`);
    }
  }
  if (filters.riskLevel) {
    switch (filters.riskLevel) {
      case 'low':
        clauses.push('disaster_risk_score BETWEEN 0 AND 2');
        break;
      case 'medium':
        clauses.push('disaster_risk_score BETWEEN 3 AND 5');
        break;
      case 'high':
        clauses.push('disaster_risk_score >= 6');
        break;
      default:
        break;
    }
  }

  return { clauses, values, nextIdx: idx };
}

/**
 * Find fire cameras within radius of a point (PostGIS). Returns null when PostGIS unavailable.
 * @returns {Promise<{ rows: Array, total: number }|null>}
 */
export async function findCamerasNearPoint({
  lat,
  lng,
  radiusMiles,
  limit = 1000,
  offset = 0,
  filters = {}
}) {
  if (!(await isPostgisAvailable())) return null;

  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const meters = milesToMeters(radiusMiles);
  const pointSql = `ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography`;
  const baseWhere = [`geom IS NOT NULL`, `ST_DWithin(geom, ${pointSql}, $3)`];
  const { clauses, values: filterValues, nextIdx } = buildCameraFilterClauses(filters, 4);
  const whereParts = baseWhere.concat(clauses);
  const values = [lng, lat, meters, ...filterValues];

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM fire_cameras WHERE ${whereParts.join(' AND ')}`,
    values
  );
  const total = countResult.rows[0]?.total || 0;

  const limitIdx = nextIdx;
  const offsetIdx = nextIdx + 1;
  const selectSql = `
    SELECT
      id, source, source_id, name, county_name, state_abbr, lat, lng,
      camera_url, network_url, image_url, status, media_type, refresh_minutes,
      hazard_types, last_image_at, raw, updated_at,
      ST_Distance(geom, ${pointSql}) AS distance_meters
    FROM fire_cameras
    WHERE ${whereParts.join(' AND ')}
    ORDER BY geom <-> ${pointSql}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await pool.query(selectSql, values.concat([limit, offset]));
  return {
    total,
    rows: rows.map((row) => {
      const { distance_meters: dm, ...rest } = row;
      return attachDistanceMiles(rest, dm != null ? Number(dm) : null);
    })
  };
}

/**
 * Haversine fallback for cameras — fetch candidates then filter in JS.
 */
export async function findCamerasNearPointFallback({
  lat,
  lng,
  radiusMiles,
  limit = 1000,
  offset = 0,
  filters = {}
}) {
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const { clauses, values } = buildCameraFilterClauses(filters, 1);
  clauses.push('lat IS NOT NULL AND lng IS NOT NULL');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT
      id, source, source_id, name, county_name, state_abbr, lat, lng,
      camera_url, network_url, image_url, status, media_type, refresh_minutes,
      hazard_types, last_image_at, raw, updated_at
    FROM fire_cameras
    ${where}
    ORDER BY name ASC NULLS LAST
    LIMIT 5000`,
    values
  );

  let cameras = filterFireCamerasByDistance(rows, lat, lng, radiusMiles);
  const total = cameras.length;
  cameras = sortCamerasByDistance(cameras, lat, lng);
  cameras = cameras.slice(offset, offset + limit);
  return { total, rows: cameras };
}

/**
 * Find disasters within radius (PostGIS). Returns null when PostGIS unavailable.
 */
export async function findDisastersNearPoint({
  lat,
  lng,
  radiusMiles,
  limit = 100,
  offset = 0,
  rollingDays = DISASTER_ROLLING_WINDOW_DAYS
}) {
  if (!(await isPostgisAvailable())) return null;

  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const meters = milesToMeters(radiusMiles);
  const pointSql = `ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography`;
  const whereParts = [
    'geom IS NOT NULL',
    `ST_DWithin(geom, ${pointSql}, $3)`,
    `start_time >= NOW() - INTERVAL '${Number(rollingDays)} days'`,
    `event_type <> 'camera'`
  ];
  const values = [lng, lat, meters];

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM disasters WHERE ${whereParts.join(' AND ')}`,
    values
  );
  const total = countResult.rows[0]?.total || 0;

  const selectSql = `
    SELECT
      id, source, event_type, county_fips, county_name, state_abbr,
      start_time, end_time, severity, title, lat, lng, source_id, raw, created_at,
      ST_Distance(geom, ${pointSql}) AS distance_meters
    FROM disasters
    WHERE ${whereParts.join(' AND ')}
    ORDER BY geom <-> ${pointSql}
    LIMIT $4 OFFSET $5
  `;

  const { rows } = await pool.query(selectSql, values.concat([limit, offset]));
  return {
    total,
    rows: rows.map((row) => {
      const { distance_meters: dm, ...rest } = row;
      return attachDistanceMiles(rest, dm != null ? Number(dm) : null);
    })
  };
}

async function findDisastersNearPointFallback({ lat, lng, radiusMiles, limit = 100, offset = 0 }) {
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const { rows } = await pool.query(
    `SELECT
      id, source, event_type, county_fips, county_name, state_abbr,
      start_time, end_time, severity, title, lat, lng, source_id, raw, created_at
    FROM disasters
    WHERE lat IS NOT NULL AND lng IS NOT NULL
      AND start_time >= NOW() - INTERVAL '${DISASTER_ROLLING_WINDOW_DAYS} days'
      AND event_type <> 'camera'
    ORDER BY start_time DESC
    LIMIT 5000`
  );

  const radiusKm = radiusMiles * 1.60934;
  let filtered = rows.filter((row) => {
    const km = calculateDistance(lat, lng, parseFloat(row.lat), parseFloat(row.lng));
    return km != null && km <= radiusKm;
  });
  filtered = filtered
    .map((row) => {
      const km = calculateDistance(lat, lng, parseFloat(row.lat), parseFloat(row.lng));
      return attachDistanceMiles(row, km != null ? km * 1000 : null);
    })
    .sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0));

  const total = filtered.length;
  return { total, rows: filtered.slice(offset, offset + limit) };
}

/**
 * Resolve disasters near point (PostGIS or Haversine fallback).
 */
export async function resolveDisastersNearPoint(opts) {
  const postgis = await findDisastersNearPoint(opts);
  if (postgis) return postgis;
  return findDisastersNearPointFallback(opts);
}

/**
 * Find loans within radius (PostGIS). Returns null when PostGIS unavailable.
 */
export async function findLoansNearPoint({
  lat,
  lng,
  radiusMiles,
  limit = 500,
  offset = 0,
  filters = {},
  lite = true
}) {
  if (!(await isPostgisAvailable())) return null;

  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const meters = milesToMeters(radiusMiles);
  const pointSql = `ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography`;
  const baseWhere = [`geom IS NOT NULL`, `ST_DWithin(geom, ${pointSql}, $3)`];
  const { clauses, values: filterValues, nextIdx } = buildLoanFilterClauses(filters, 4);
  const whereParts = baseWhere.concat(clauses);
  const values = [lng, lat, meters, ...filterValues];
  const selectCols = lite ? LOAN_SELECT_LITE_COLS : '*';

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM loans WHERE ${whereParts.join(' AND ')}`,
    values
  );
  const total = countResult.rows[0]?.total || 0;

  const limitIdx = nextIdx;
  const offsetIdx = nextIdx + 1;
  const selectSql = `
    SELECT ${selectCols},
      ST_Distance(geom, ${pointSql}) AS distance_meters
    FROM loans
    WHERE ${whereParts.join(' AND ')}
    ORDER BY geom <-> ${pointSql}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await pool.query(selectSql, values.concat([limit, offset]));
  return {
    total,
    rows: rows.map((row) => {
      const { distance_meters: dm, ...rest } = row;
      return attachDistanceMiles(rest, dm != null ? Number(dm) : null);
    })
  };
}

async function findLoansNearPointFallback({
  lat,
  lng,
  radiusMiles,
  limit = 500,
  offset = 0,
  filters = {},
  lite = true
}) {
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const { clauses, values } = buildLoanFilterClauses(filters, 1);
  clauses.push('latitude IS NOT NULL AND longitude IS NOT NULL');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const selectCols = lite ? LOAN_SELECT_LITE_COLS : '*';

  const { rows } = await pool.query(
    `SELECT ${selectCols} FROM loans ${where} ORDER BY created_at DESC LIMIT 5000`,
    values
  );

  const radiusKm = radiusMiles * 1.60934;
  let filtered = rows.filter((loan) => {
    const loanLat = parseFloat(loan.latitude);
    const loanLng = parseFloat(loan.longitude);
    if (!Number.isFinite(loanLat) || !Number.isFinite(loanLng)) return false;
    const km = calculateDistance(lat, lng, loanLat, loanLng);
    return km != null && km <= radiusKm;
  });
  filtered = filtered
    .map((loan) => {
      const km = calculateDistance(lat, lng, parseFloat(loan.latitude), parseFloat(loan.longitude));
      return attachDistanceMiles(loan, km != null ? km * 1000 : null);
    })
    .sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0));

  const total = filtered.length;
  return { total, rows: filtered.slice(offset, offset + limit) };
}

/**
 * Resolve loans near point (PostGIS or Haversine fallback).
 */
export async function resolveLoansNearPoint(opts) {
  const postgis = await findLoansNearPoint(opts);
  if (postgis) return postgis;
  return findLoansNearPointFallback(opts);
}

/**
 * Resolve cameras near point (PostGIS or Haversine fallback).
 */
export async function resolveCamerasNearPoint(opts) {
  const postgis = await findCamerasNearPoint(opts);
  if (postgis) return postgis;
  return findCamerasNearPointFallback(opts);
}

export default {
  METERS_PER_MILE,
  milesToMeters,
  findCamerasNearPoint,
  findCamerasNearPointFallback,
  findDisastersNearPoint,
  findLoansNearPoint,
  resolveCamerasNearPoint,
  resolveDisastersNearPoint,
  resolveLoansNearPoint
};
