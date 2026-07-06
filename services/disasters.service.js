/**
 * Disasters Service
 * 
 * @file       disasters.service.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 * 
 * @description
 * Service module for managing disaster data from multiple sources (NOAA, NASA, FEMA).
 * Handles schema initialization, data aggregation, and county-level disaster tracking
 * with FIPS code lookups. Provides unified disaster data with a 90-day rolling window
 * for recent disaster tracking.
 * 
 * Features:
 * - Unified disasters table schema initialization
 * - Multi-source disaster data integration (NOAA, NASA, FEMA)
 * - County FIPS code lookups and geocoding
 * - 90-day rolling window for recent disasters
 * - Disaster risk assessment and aggregation
 * - Geographic disaster data queries
 * 
 * Data Sources:
 * - NOAA (National Oceanic and Atmospheric Administration)
 * - NASA disaster data feeds
 * - FEMA disaster declarations
 * 
 * Schema:
 * - Unified disasters table with standardized fields
 * - County FIPS code references
 * - Timestamp-based filtering (90-day window)
 * - Geographic coordinates for mapping
 * 
 * Technical Implementation:
 * - PostgreSQL database integration
 * - County-level FIPS code lookups
 * - Optional JSON reference file for county data
 * - Reverse geocoding integration
 * - Database connection pooling
 * 
 * Integration:
 * - Requires database.service.js for connection pooling
 * - Integrates with disaster-risk.service.js for geocoding
 * - File system access for county reference data
 * 
 * @dependencies
 * - database.service.js (getPool)
 * - disaster-risk.service.js (reverseGeocodeCountyState)
 * - fs (file system)
 * - path (path utilities)
 * 
 * ==============================================================================
 */

import { getPool, ensureTableGeomColumn } from './database.service.js';
import { reverseGeocodeCountyState } from './disaster-risk.service.js';
import { geocodeCountyStateWithCache, reverseGeocodeWithCache } from './geocoding-cache.service.js';
import fs from 'fs';
import path from 'path';

/** Rolling window for ingest, UI, prune, and impact graph (keep in sync everywhere). */
export const DISASTER_ROLLING_WINDOW_DAYS = 90;

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS disasters (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  county_fips CHAR(5) NOT NULL,
  county_name TEXT,
  state_abbr VARCHAR(3),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  severity TEXT,
  title TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  source_id TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT disasters_uniq UNIQUE (county_fips, source, source_id, start_time)
);
`;

const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_disasters_start_time ON disasters (start_time DESC);
CREATE INDEX IF NOT EXISTS idx_disasters_state ON disasters (state_abbr);
CREATE INDEX IF NOT EXISTS idx_disasters_fips ON disasters (county_fips);
`;

const CREATE_FIRE_CAMERAS_SQL = `
CREATE TABLE IF NOT EXISTS fire_cameras (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'alertcalifornia',
  source_id TEXT NOT NULL,
  name TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  county_name TEXT,
  county_fips CHAR(5),
  state_abbr VARCHAR(3) DEFAULT 'CA',
  camera_url TEXT,
  network_url TEXT,
  image_url TEXT,
  status TEXT,
  hazard_types JSONB DEFAULT '[]'::jsonb,
  media_type TEXT,
  refresh_minutes INT,
  last_image_at TIMESTAMPTZ,
  raw JSONB,
  geocoded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, source_id)
);
`;

const FIRE_CAMERAS_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_fire_cameras_state ON fire_cameras (state_abbr);
CREATE INDEX IF NOT EXISTS idx_fire_cameras_county ON fire_cameras (county_name);
CREATE INDEX IF NOT EXISTS idx_fire_cameras_source ON fire_cameras (source);
CREATE INDEX IF NOT EXISTS idx_fire_cameras_source_state ON fire_cameras (source, state_abbr);
CREATE INDEX IF NOT EXISTS idx_fire_cameras_hazard_types ON fire_cameras USING GIN (hazard_types);
`;

const FIRE_CAMERAS_MIGRATION_SQL = `
ALTER TABLE fire_cameras ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'alertcalifornia';
ALTER TABLE fire_cameras ADD COLUMN IF NOT EXISTS hazard_types JSONB DEFAULT '[]'::jsonb;
ALTER TABLE fire_cameras ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE fire_cameras ADD COLUMN IF NOT EXISTS refresh_minutes INT;
ALTER TABLE fire_cameras ADD COLUMN IF NOT EXISTS last_image_at TIMESTAMPTZ;
UPDATE fire_cameras SET source = 'alertcalifornia' WHERE source IS NULL OR TRIM(source) = '';
UPDATE fire_cameras SET hazard_types = '["fire"]'::jsonb
  WHERE hazard_types IS NULL OR hazard_types = '[]'::jsonb;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fire_cameras_source_id_key'
  ) THEN
    ALTER TABLE fire_cameras DROP CONSTRAINT fire_cameras_source_id_key;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS fire_cameras_source_source_id_key ON fire_cameras (source, source_id);
`;

/** Max reverse-geocode calls per camera ingest run (fixed mount locations, once only). */
const MAX_CAMERA_GEOCODES_PER_RUN = 50;
const MAX_BACKFILL_GEOCODES = parseInt(process.env.DISASTER_GEOCODE_BACKFILL_LIMIT || '80', 10) || 80;

/**
 * Initialize fire_cameras schema (idempotent).
 */
export async function initFireCamerasSchema() {
  const pool = getPool();
  if (!pool) {
    console.warn('⚠️  Database pool not initialized; fire_cameras schema not created');
    return;
  }
  await pool.query(CREATE_FIRE_CAMERAS_SQL);
  await pool.query(FIRE_CAMERAS_MIGRATION_SQL);
  await pool.query(FIRE_CAMERAS_INDEXES_SQL);
  try {
    await ensureTableGeomColumn('fire_cameras', 'lat', 'lng', 'idx_fire_cameras_geom');
  } catch (geomErr) {
    console.warn(`⚠️ fire_cameras geom column skipped: ${geomErr.message}`);
  }
}

/**
 * Initialize disasters schema (idempotent).
 */
export async function initDisastersSchema() {
  const pool = getPool();
  if (!pool) {
    console.warn('⚠️  Database pool not initialized; disasters schema not created');
    return;
  }
  try {
    await pool.query('BEGIN');
    await pool.query(CREATE_TABLE_SQL);
    await pool.query(INDEXES_SQL);
    await initFireCamerasSchema();
    
    // Migrate existing state_abbr column from CHAR(2) to VARCHAR(3) for Canadian provinces
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'disasters' AND column_name = 'state_abbr'
            AND character_maximum_length = 2
          ) THEN
            ALTER TABLE disasters ALTER COLUMN state_abbr TYPE VARCHAR(3);
            RAISE NOTICE 'Migrated state_abbr column to VARCHAR(3)';
          END IF;
        END $$;
      `);
    } catch (migrateErr) {
      // Migration might fail if column doesn't exist or already migrated - that's OK
      console.log('📝 State abbreviation migration:', migrateErr.message);
    }
    
    await pool.query('COMMIT');
    console.log('✅ Disasters schema ensured');
    try {
      await ensureTableGeomColumn('disasters', 'lat', 'lng', 'idx_disasters_geom');
    } catch (geomErr) {
      console.warn(`⚠️ disasters geom column skipped: ${geomErr.message}`);
    }
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('❌ Failed to initialize disasters schema:', err.message);
    throw err;
  }
}

/** Prune disasters older than 90 days */
export async function pruneOldDisasters() {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `DELETE FROM disasters WHERE start_time < NOW() - INTERVAL '${DISASTER_ROLLING_WINDOW_DAYS} days'`
    );
  } catch (e) {
    console.warn('⚠️  pruneOldDisasters failed:', e.message);
  }
}

/**
 * Forward-geocode disasters missing lat/lng but with county + state.
 * Runs after ingest/refresh — not on routine grid reads.
 */
export async function backfillDisasterGeocodes(options = {}) {
  const pool = getPool();
  if (!pool) return { geocoded: 0, candidates: 0, skipped: 'no_pool' };

  const limit = Number.isFinite(options.limit) ? options.limit : MAX_BACKFILL_GEOCODES;
  const { rows } = await pool.query(
    `SELECT DISTINCT
       LOWER(REPLACE(COALESCE(county_name,''), ' County', '')) AS county_key,
       UPPER(TRIM(COALESCE(state_abbr,''))) AS state_abbr,
       county_name
     FROM disasters
     WHERE (lat IS NULL OR lng IS NULL)
       AND TRIM(COALESCE(county_name,'')) <> ''
       AND TRIM(COALESCE(state_abbr,'')) <> ''
     LIMIT $1`,
    [limit]
  );

  let geocoded = 0;
  for (const row of rows) {
    const county = String(row.county_name || '').replace(/\s*County$/i, '').trim();
    const state = String(row.state_abbr || '').trim().toUpperCase();
    if (!county || !state) continue;
    try {
      const coords = await geocodeCountyStateWithCache(county, state);
      if (coords?.latitude != null && coords?.longitude != null) {
        await pool.query(
          `UPDATE disasters SET lat = $1, lng = $2
           WHERE LOWER(REPLACE(COALESCE(county_name,''), ' County', '')) = $3
             AND UPPER(TRIM(COALESCE(state_abbr,''))) = $4
             AND (lat IS NULL OR lng IS NULL)`,
          [coords.latitude, coords.longitude, county.toLowerCase(), state]
        );
        geocoded += 1;
        if (!coords.cached) {
          await new Promise((resolve) => setTimeout(resolve, 1100));
        }
      }
    } catch (e) {
      console.warn(`⚠️  Backfill geocode failed for ${county}, ${state}:`, e.message);
    }
  }

  if (geocoded > 0) {
    console.log(`📍 Backfilled geocodes for ${geocoded} county/state group(s)`);
  }
  return { geocoded, candidates: rows.length };
}

/**
 * Optional FIPS lookup support (lazy-loaded to avoid blocking startup)
 */
let fipsCache = null;

export async function loadFipsReference() {
  if (fipsCache) return fipsCache;
  try {
    const filePath = path.resolve(process.cwd(), 'data', 'fips-counties.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      fipsCache = JSON.parse(raw);
    } else {
      console.warn('⚠️  fips-counties.json not found at data/fips-counties.json; proceeding without FIPS reference');
      fipsCache = [];
    }
    return fipsCache;
  } catch (e) {
    console.warn('⚠️  Failed to load fips-counties.json:', e.message);
    fipsCache = [];
    return fipsCache;
  }
}

export function lookupCountyByFips(countyFips) {
  if (!fipsCache || fipsCache.length === 0) return null;
  return fipsCache.find(r => r.county_fips === countyFips) || null;
}

function mapCountyToFips(countyName, stateAbbr) {
  if (!fipsCache || !countyName || !stateAbbr) return null;
  const norm = String(countyName).toLowerCase().replace(/\s+county$/i, '').trim();
  const rec = fipsCache.find(r => r.state_abbr === stateAbbr && r.county_name.toLowerCase() === norm);
  return rec ? rec.county_fips : null;
}

/**
 * Calculate distance between two lat/lng points in kilometers (Haversine formula)
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) {
    return null; // Return null if coordinates are missing
  }
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const KM_PER_MILE = 1.60934;
const MI_PER_KM = 0.621371;

/**
 * Keep fire cameras within radius of a center point (Haversine).
 * @param {Array} cameras
 * @param {number} nearLat
 * @param {number} nearLng
 * @param {number} radiusMiles
 * @returns {Array}
 */
export function filterFireCamerasByDistance(cameras, nearLat, nearLng, radiusMiles) {
  const radiusKm = radiusMiles * KM_PER_MILE;
  const centerLat = parseFloat(nearLat);
  const centerLng = parseFloat(nearLng);
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
    return [];
  }
  return cameras.filter((cam) => {
    const lat = parseFloat(cam.lat);
    const lng = parseFloat(cam.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return false;
    }
    const km = calculateDistance(centerLat, centerLng, lat, lng);
    return km !== null && km <= radiusKm;
  });
}

/**
 * Attach distance_km / distance_miles and sort nearest-first.
 * @param {Array} cameras
 * @param {number} nearLat
 * @param {number} nearLng
 * @returns {Array}
 */
export function sortCamerasByDistance(cameras, nearLat, nearLng) {
  const centerLat = parseFloat(nearLat);
  const centerLng = parseFloat(nearLng);
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
    return cameras;
  }
  return cameras
    .map((cam) => {
      const lat = parseFloat(cam.lat);
      const lng = parseFloat(cam.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { ...cam, distance_km: null, distance_miles: null };
      }
      const distance_km = calculateDistance(centerLat, centerLng, lat, lng);
      const distance_miles = distance_km != null
        ? Math.round(distance_km * MI_PER_KM * 10) / 10
        : null;
      return {
        ...cam,
        distance_km: distance_km != null ? Math.round(distance_km * 10) / 10 : null,
        distance_miles
      };
    })
    .sort((a, b) => {
      if (a.distance_km == null) return 1;
      if (b.distance_km == null) return -1;
      return a.distance_km - b.distance_km;
    });
}

export default {
  initDisastersSchema,
  loadFipsReference,
  lookupCountyByFips,
  upsertDisasters,
  normalizeFemaV2ToUnified,
  ingestFema,
  ingestFirmsNrt,
  ingestUsgsQuakes,
  ingestNwsCap,
  ingestNhc,
  ingestCaFireCameras,
  initFireCamerasSchema,
  upsertFireCameras,
  cleanupLegacyCameraDisasters,
};

/**
 * Upsert a batch of disasters into the unified table.
 * Records must include: source, event_type, county_fips, county_name, state_abbr, start_time
 */
export async function upsertDisasters(batch) {
  if (!Array.isArray(batch) || batch.length === 0) return { inserted: 0, skipped: 0 };
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const CHUNK_SIZE = 200;
  let inserted = 0;
  let skipped = 0;

  function normalizeStateAbbr(stateValue) {
    if (!stateValue) return null;
    const stateStr = String(stateValue).trim().toUpperCase();
    if (!stateStr) return null;
    return stateStr.length <= 3 ? stateStr : stateStr.substring(0, 3);
  }

  for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
    const chunk = batch.slice(i, i + CHUNK_SIZE);
    if (!chunk.length) continue;
    try {
      const values = [];
      const tuples = chunk.map((d, idx) => {
        const base = idx * 13;
        values.push(
          d.source,
          d.event_type,
          d.county_fips,
          d.county_name || null,
          normalizeStateAbbr(d.state_abbr),
          d.start_time,
          d.end_time || null,
          d.severity || null,
          d.title || null,
          d.lat || null,
          d.lng || null,
          d.source_id || null,
          d.raw || null
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13})`;
      });
      const text = `
        INSERT INTO disasters (
          source, event_type, county_fips, county_name, state_abbr,
          start_time, end_time, severity, title, lat, lng, source_id, raw
        ) VALUES ${tuples.join(',')}
        ON CONFLICT (county_fips, source, source_id, start_time) DO NOTHING
        RETURNING id
      `;
      const res = await pool.query(text, values);
      const chunkInserted = res.rowCount || 0;
      inserted += chunkInserted;
      skipped += chunk.length - chunkInserted;
    } catch (e) {
      console.warn('⚠️  Upsert disaster chunk failed, marking as skipped:', e.message);
      skipped += chunk.length;
    }
  }

  console.log(`📊 upsertDisasters: ${inserted} inserted, ${skipped} skipped from ${batch.length} records`);
  return { inserted, skipped };
}

/**
 * Upsert fixed hazard webcam mounts into fire_cameras (not disasters).
 */
export async function upsertHazardWebcams(batch) {
  if (!Array.isArray(batch) || batch.length === 0) return { upserted: 0 };
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const CHUNK_SIZE = 100;
  let upserted = 0;
  const COLS = 18;

  for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
    const chunk = batch.slice(i, i + CHUNK_SIZE);
    if (!chunk.length) continue;
    try {
      const values = [];
      const tuples = chunk.map((c, idx) => {
        const base = idx * COLS;
        const hazardTypes = Array.isArray(c.hazard_types)
          ? JSON.stringify(c.hazard_types)
          : (c.hazard_types ? JSON.stringify(c.hazard_types) : '[]');
        values.push(
          c.source || 'alertcalifornia',
          c.source_id,
          c.name || null,
          c.lat,
          c.lng,
          c.county_name || null,
          c.county_fips || null,
          c.state_abbr || null,
          c.camera_url || null,
          c.network_url || null,
          c.image_url || null,
          c.status || null,
          hazardTypes,
          c.media_type || null,
          c.refresh_minutes != null ? c.refresh_minutes : null,
          c.last_image_at || null,
          c.raw || null,
          c.geocoded_at || null
        );
        const p = (n) => `$${base + n}`;
        return `(${p(1)},${p(2)},${p(3)},${p(4)},${p(5)},${p(6)},${p(7)},${p(8)},${p(9)},${p(10)},${p(11)},${p(12)},${p(13)}::jsonb,${p(14)},${p(15)},${p(16)},${p(17)},${p(18)},NOW())`;
      });
      const text = `
        INSERT INTO fire_cameras (
          source, source_id, name, lat, lng, county_name, county_fips, state_abbr,
          camera_url, network_url, image_url, status, hazard_types, media_type,
          refresh_minutes, last_image_at, raw, geocoded_at, updated_at
        ) VALUES ${tuples.join(',')}
        ON CONFLICT (source, source_id) DO UPDATE SET
          name = EXCLUDED.name,
          lat = COALESCE(EXCLUDED.lat, fire_cameras.lat),
          lng = COALESCE(EXCLUDED.lng, fire_cameras.lng),
          county_name = COALESCE(EXCLUDED.county_name, fire_cameras.county_name),
          county_fips = COALESCE(EXCLUDED.county_fips, fire_cameras.county_fips),
          state_abbr = COALESCE(EXCLUDED.state_abbr, fire_cameras.state_abbr),
          camera_url = COALESCE(EXCLUDED.camera_url, fire_cameras.camera_url),
          network_url = COALESCE(EXCLUDED.network_url, fire_cameras.network_url),
          image_url = COALESCE(EXCLUDED.image_url, fire_cameras.image_url),
          status = COALESCE(EXCLUDED.status, fire_cameras.status),
          hazard_types = COALESCE(EXCLUDED.hazard_types, fire_cameras.hazard_types),
          media_type = COALESCE(EXCLUDED.media_type, fire_cameras.media_type),
          refresh_minutes = COALESCE(EXCLUDED.refresh_minutes, fire_cameras.refresh_minutes),
          last_image_at = COALESCE(EXCLUDED.last_image_at, fire_cameras.last_image_at),
          raw = COALESCE(EXCLUDED.raw, fire_cameras.raw),
          geocoded_at = COALESCE(fire_cameras.geocoded_at, EXCLUDED.geocoded_at),
          updated_at = NOW()
      `;
      const res = await pool.query(text, values);
      upserted += res.rowCount || chunk.length;
    } catch (e) {
      console.warn('⚠️  Upsert fire_cameras chunk failed:', e.message);
    }
  }

  console.log(`📹 upsertHazardWebcams: ${upserted} rows from ${batch.length} cameras`);
  return { upserted };
}

/** @deprecated use upsertHazardWebcams */
export async function upsertFireCameras(batch) {
  const normalized = batch.map((c) => ({
    ...c,
    source: c.source || 'alertcalifornia',
    hazard_types: c.hazard_types || ['fire'],
    media_type: c.media_type || 'live_stream',
  }));
  return upsertHazardWebcams(normalized);
}

/** Remove legacy camera rows mistakenly stored in disasters. */
export async function cleanupLegacyCameraDisasters() {
  const pool = getPool();
  if (!pool) return 0;
  try {
    const res = await pool.query(`
      DELETE FROM disasters
      WHERE source = 'alertcalifornia' AND event_type = 'camera'
    `);
    const deleted = res.rowCount || 0;
    if (deleted > 0) {
      console.log(`📹 Removed ${deleted} legacy alertcalifornia camera rows from disasters`);
    }
    return deleted;
  } catch (e) {
    console.warn('⚠️  cleanupLegacyCameraDisasters failed:', e.message);
    return 0;
  }
}

/**
 * FEMA v2 normalizer → unified schema records
 * Input: FEMA objects with state, county, incidentBeginDate, etc.
 */
export function normalizeFemaV2ToUnified(disasters) {
  if (!Array.isArray(disasters)) return [];
  return disasters.map(item => {
    // county_fips may be unknown here; caller should enrich if available
    return {
      source: 'fema',
      event_type: (item.incidentType || 'disaster').toLowerCase(),
      county_fips: item.county_fips || null,
      county_name: item.county || null,
      state_abbr: item.state || null,
      start_time: item.incidentBeginDate || item.declarationDate || new Date().toISOString(),
      end_time: item.incidentEndDate || null,
      severity: null,
      title: item.declarationTitle || item.title || null,
      lat: item.latitude || null,
      lng: item.longitude || null,
      source_id: String(item.disasterNumber || item.declarationTitle || ''),
      raw: item,
    };
  }).filter(r => r.county_fips || (r.county_name && r.state_abbr));
}

/** Build 5-digit county FIPS from FEMA declaration fields. */
export function resolveFemaCountyFips(item, countyName, stateAbbr) {
  const stateFips = String(item?.fipsStateCode ?? '').trim().padStart(2, '0');
  const countyPart = String(item?.fipsCountyCode ?? '').trim().padStart(3, '0');
  if (stateFips && countyPart && stateFips !== '00' && countyPart !== '000') {
    return `${stateFips}${countyPart}`;
  }
  return mapCountyToFips(countyName, stateAbbr) || null;
}

/** Normalize one FEMA DisasterDeclarationsSummaries row for upsert. */
export function resolveFemaDeclarationFields(item) {
  let county = null;
  if (item?.designatedArea) {
    county = String(item.designatedArea)
      .replace(/\s*\((County|Municipio|Municipality|Parish|Borough|Census Area|Island|Islands)\)$/i, '')
      .trim();
  }

  const state = item?.state ? String(item.state).trim().toUpperCase() : null;
  const fips = resolveFemaCountyFips(item, county, state);

  let lat = null;
  let lng = null;
  if (item?.latitude != null && item?.longitude != null) {
    const parsedLat = parseFloat(item.latitude);
    const parsedLng = parseFloat(item.longitude);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      lat = parsedLat;
      lng = parsedLng;
    }
  }

  const sourceId = String(item?.id || item?.disasterNumber || item?.declarationTitle || '').trim();
  if (!sourceId) return null;

  return {
    source: 'fema',
    event_type: (item.incidentType || 'disaster').toLowerCase(),
    county_fips: fips || '00000',
    county_name: county,
    state_abbr: state,
    start_time: item.incidentBeginDate || item.declarationDate || new Date().toISOString(),
    end_time: item.incidentEndDate || null,
    severity: null,
    title: item.declarationTitle || item.title || 'FEMA Disaster',
    lat,
    lng,
    source_id: sourceId,
    raw: item,
  };
}

/** VIIRS CSV uses single-letter confidence (l/n/h); GeoJSON may use 0–100 or words. */
export function normalizeFirmsConfidence(raw) {
  const c = String(raw ?? '').toLowerCase().trim();
  if (/^\d+$/.test(c)) {
    const n = parseInt(c, 10);
    if (n >= 80) return 'high';
    if (n >= 50) return 'nominal';
    return 'low';
  }
  const letterMap = { l: 'low', n: 'nominal', h: 'high' };
  return letterMap[c] || c;
}

const FIRMS_CONFIDENCE_RANK = { low: 0, nominal: 1, high: 2 };

/** Read FIRMS quality thresholds from env (combined pulls use these). */
export function getFirmsQualityThresholds() {
  const minConfidence = String(process.env.FIRMS_MIN_CONFIDENCE || 'high').toLowerCase().trim();
  return {
    minConfidence,
    minConfidenceRank: FIRMS_CONFIDENCE_RANK[minConfidence] ?? FIRMS_CONFIDENCE_RANK.high,
    minBrightness: parseInt(process.env.FIRMS_MIN_BRIGHTNESS || '330', 10) || 330,
    minFrp: parseFloat(process.env.FIRMS_MIN_FRP || '4') || 4,
    clusterRadiusKm: parseFloat(process.env.FIRMS_CLUSTER_RADIUS_KM || '5') || 5,
    minClusterSize: parseInt(process.env.FIRMS_MIN_CLUSTER_SIZE || '2', 10) || 2,
    highBrightness: parseInt(process.env.FIRMS_HIGH_BRIGHTNESS || '350', 10) || 350,
    highFrp: parseFloat(process.env.FIRMS_HIGH_FRP || '8') || 8,
  };
}

/** Normalize FIRMS feature/CSV properties for quality scoring. */
export function parseFirmsDetectionProps(props = {}) {
  const brightnessRaw = props.bright_ti4 ?? props.brightness ?? props.bright_ti5;
  const brightness = brightnessRaw != null && brightnessRaw !== '' ? parseFloat(brightnessRaw) : null;
  const frpRaw = props.frp ?? props.FRP;
  const frp = frpRaw != null && frpRaw !== '' ? parseFloat(frpRaw) : null;
  return {
    brightness: Number.isFinite(brightness) ? brightness : null,
    frp: Number.isFinite(frp) ? frp : null,
    confidence: normalizeFirmsConfidence(props.confidence),
    daynight: String(props.daynight ?? props.day_night ?? '').trim().toUpperCase(),
    type: String(props.type ?? '').trim().toLowerCase(),
  };
}

/** Stage 1: confidence must meet threshold (default high). */
export function passesFirmsConfidenceGate(confidence, thresholds = getFirmsQualityThresholds()) {
  const rank = FIRMS_CONFIDENCE_RANK[confidence] ?? -1;
  return rank >= thresholds.minConfidenceRank;
}

/** Stage 2: thermal signal — brightness or fire radiative power. */
export function passesFirmsThermalGate(detection, thresholds = getFirmsQualityThresholds()) {
  const { brightness, frp } = detection;
  const brightOk = brightness != null && brightness >= thresholds.minBrightness;
  const frpOk = frp != null && frp >= thresholds.minFrp;
  return brightOk || frpOk;
}

/**
 * Stage 3: likely actual fire — clustered hotspots OR strong solo detection.
 * Filters isolated low-confidence thermal noise (e.g. industrial heat).
 */
export function isLikelyActualFirmsFire(detection, clusterSize, thresholds = getFirmsQualityThresholds()) {
  if (!passesFirmsConfidenceGate(detection.confidence, thresholds)) return false;
  if (!passesFirmsThermalGate(detection, thresholds)) return false;

  const inCluster = clusterSize >= thresholds.minClusterSize;
  const strongSolo =
    (detection.brightness != null && detection.brightness >= thresholds.highBrightness)
    || (detection.frp != null && detection.frp >= thresholds.highFrp);

  return inCluster || strongSolo;
}

/** NASA FIRMS (active fires) - VIIRS NRT GeoJSON **/
export async function ingestFirmsNrt() {
  // Get MAP_KEY (FIRMS-specific) or fallback to NASA_API_KEY
  // MAP_KEY is the FIRMS-specific authentication key
  let apiKey = process.env.MAP_KEY || process.env.FIRMS_MAP_KEY || process.env.NASA_API_KEY || process.env.NASA_FIRMS_API_KEY || process.env.FIRMS_API_KEY;
  if (apiKey) {
    apiKey = apiKey.trim().replace(/^["']|["']$/g, ''); // Remove surrounding quotes
  }
  
  // NASA FIRMS API - Correct format: /api/area/csv/{API_KEY}/{source}/{bbox}/{days}
  // API key goes in the URL path, not as query parameter!
  // Bounding box: west, south, east, north (USA: -125.0,24.396308,-66.93457,49.384358)
  let url;
  let useAuth = false;
  
  if (apiKey) {
    // Authenticated CSV endpoint (USA bounding box, last 2 days)
    // Format: /api/area/csv/{API_KEY}/VIIRS_SNPP_NRT/{bbox}/{days}
    const bbox = '-125.0,24.396308,-66.93457,49.384358'; // USA bounds
    url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/${bbox}/2`;
    useAuth = true;
    console.log(`🔥 FIRMS: Using authenticated CSV endpoint with API key`);
  } else {
    // Fallback: Try GeoJSON public feed (may be rate-limited)
    url = 'https://firms.modaps.eosdis.nasa.gov/api/country/v3/viirs/USA/1';
    console.log('🔥 FIRMS: Using public GeoJSON feed (no API key found)');
  }
  
  let geo;
  try {
    const resp = await fetch(url);
    const contentType = resp.headers.get('content-type') || '';
    
    if (!resp.ok) {
      const text = await resp.text();
      console.warn(`FIRMS fetch failed: HTTP ${resp.status} - ${text.substring(0, 200)}`);
      return { inserted: 0, skipped: 0 };
    }
    
    // Check for "Invalid MAP_KEY" error - key may need FIRMS registration
    const text = await resp.text();
    if (text.includes('Invalid MAP_KEY') || text.includes('Invalid API')) {
      console.warn(`⚠️  FIRMS API key rejected. Key may need FIRMS-specific registration at earthdata.nasa.gov`);
      console.warn(`   Falling back to public feed (if available)`);
      // Try public GeoJSON feed as fallback
      try {
        const fallbackUrl = 'https://firms.modaps.eosdis.nasa.gov/api/country/v3/viirs/USA/1';
        const fallbackResp = await fetch(fallbackUrl);
        if (fallbackResp.ok) {
          const fallbackContentType = fallbackResp.headers.get('content-type') || '';
          if (fallbackContentType.includes('json')) {
            geo = await fallbackResp.json();
            console.log(`✅ Using public FIRMS GeoJSON feed`);
          } else {
            return { inserted: 0, skipped: 0 };
          }
        } else {
          return { inserted: 0, skipped: 0 };
        }
      } catch (e) {
        return { inserted: 0, skipped: 0 };
      }
    } else if (useAuth && (contentType.includes('csv') || contentType.includes('text/plain'))) {
      // Parse CSV response
      const csvText = text;
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) {
        console.log('🔥 FIRMS: No fire data found');
        return { inserted: 0, skipped: 0 };
      }
      
      // Parse CSV header
      const headers = lines[0].split(',').map(h => h.trim());
      const latIdx = headers.indexOf('latitude');
      const lngIdx = headers.indexOf('longitude');
      const dateIdx = headers.indexOf('acq_date');
      const timeIdx = headers.indexOf('acq_time');
      // VIIRS CSV uses bright_ti4; MODIS uses brightness
      const brightIdx = headers.indexOf('bright_ti4') >= 0 ? headers.indexOf('bright_ti4') : headers.indexOf('brightness');
      const confIdx = headers.indexOf('confidence');
      const frpIdx = headers.indexOf('frp');
      const daynightIdx = headers.indexOf('daynight');
      
      // Convert CSV to GeoJSON-like structure
      geo = {
        type: 'FeatureCollection',
        features: []
      };
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const lat = parseFloat(values[latIdx]);
        const lng = parseFloat(values[lngIdx]);
        if (isNaN(lat) || isNaN(lng)) continue;
        
        geo.features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          properties: {
            acq_date: values[dateIdx]?.trim() || '',
            acq_time: values[timeIdx]?.trim() || '',
            brightness: values[brightIdx] ? parseFloat(values[brightIdx]) : null,
            bright_ti4: values[brightIdx] ? parseFloat(values[brightIdx]) : null,
            confidence: values[confIdx] ? values[confIdx].trim() : '',
            frp: frpIdx >= 0 && values[frpIdx] ? parseFloat(values[frpIdx]) : null,
            daynight: daynightIdx >= 0 ? values[daynightIdx]?.trim() : '',
            id: `${lat},${lng},${values[dateIdx] || Date.now()}`
          }
        });
      }
      
      console.log(`🔥 FIRMS: Parsed ${geo.features.length} fire detections from CSV`);
    } else if (contentType.includes('json')) {
      geo = await resp.json();
    } else {
      const text = await resp.text();
      console.warn(`FIRMS returned unexpected format: ${contentType} - ${text.substring(0, 200)}`);
      return { inserted: 0, skipped: 0 };
    }
  } catch (e) {
    console.warn('FIRMS fetch failed:', e.message);
    return { inserted: 0, skipped: 0, fetched: 0, prepared: 0, error: e.message };
  }
  const feats = (geo && geo.features) ? geo.features : [];

  const thresholds = getFirmsQualityThresholds();

  const significantFires = [];
  let filteredByConfidence = 0;
  let filteredBySignal = 0;

  for (const f of feats) {
    const props = f.properties || {};
    const coords = (f.geometry && f.geometry.coordinates) || [];
    const lat = coords[1];
    const lng = coords[0];

    if (!lat || !lng) continue;

    const detection = parseFirmsDetectionProps(props);
    if (!passesFirmsConfidenceGate(detection.confidence, thresholds)) {
      filteredByConfidence++;
      continue;
    }
    if (!passesFirmsThermalGate(detection, thresholds)) {
      filteredBySignal++;
      continue;
    }

    let start = new Date().toISOString();
    if (props.acq_date) {
      const dateStr = props.acq_date.trim();
      const timeStr = (props.acq_time || '0000').toString().padStart(4, '0');
      const hour = timeStr.slice(0, 2);
      const minute = timeStr.slice(2, 4);
      try {
        start = new Date(`${dateStr}T${hour}:${minute}:00Z`).toISOString();
      } catch (e) {
        start = new Date().toISOString();
      }
    }

    significantFires.push({
      lat,
      lng,
      detection,
      start,
      props,
      coords: [lng, lat],
    });
  }

  console.log(`🔥 FIRMS: Filtered ${feats.length} detections:`);
  console.log(`   - ${filteredByConfidence} filtered by confidence`);
  console.log(`   - ${filteredBySignal} filtered by weak thermal/FRP signal`);
  console.log(`   - ${significantFires.length} candidate fire detections remaining`);

  const clusters = new Map();
  const fireToCluster = new Map();
  const CLUSTER_RADIUS_KM = thresholds.clusterRadiusKm;

  for (let i = 0; i < significantFires.length; i++) {
    const fire1 = significantFires[i];
    let assignedCluster = null;

    for (const [clusterId, clusterFires] of clusters.entries()) {
      const clusterCenter = clusterFires[0];
      const distance = calculateDistance(
        fire1.lat, fire1.lng,
        clusterCenter.lat, clusterCenter.lng,
      );

      if (distance <= CLUSTER_RADIUS_KM) {
        assignedCluster = clusterId;
        break;
      }
    }

    if (assignedCluster) {
      clusters.get(assignedCluster).push(fire1);
      fireToCluster.set(i, assignedCluster);
    } else {
      const newClusterId = `cluster_${i}`;
      clusters.set(newClusterId, [fire1]);
      fireToCluster.set(i, newClusterId);
    }
  }

  const finalFires = [];
  let filteredByLikelyFire = 0;

  for (let i = 0; i < significantFires.length; i++) {
    const fire = significantFires[i];
    const clusterId = fireToCluster.get(i);
    const clusterSize = clusters.get(clusterId)?.length || 0;

    if (isLikelyActualFirmsFire(fire.detection, clusterSize, thresholds)) {
      finalFires.push(fire);
    } else {
      filteredByLikelyFire++;
    }
  }

  console.log(`🔥 FIRMS: Likely-fire gate:`);
  console.log(`   - ${clusters.size} fire clusters identified`);
  console.log(`   - ${filteredByLikelyFire} filtered (unlikely isolated noise)`);
  console.log(`   - ${finalFires.length} likely fires ready for ingestion`);
  
  // Third pass: Geocode and prepare records
  // Limit: 500 with Mapbox (was 100 for Nominatim 1 req/sec). Override via FIRMS_GEOCODE_LIMIT env.
  const MAX_GEOCODING_CALLS = parseInt(process.env.FIRMS_GEOCODE_LIMIT || '500', 10) || 500;
  const batch = [];
  let geocodeFailures = 0;
  let noFipsCount = 0;
  let geocodingCalls = 0;
  
  await loadFipsReference();
  
  for (const fire of finalFires) {
    const { lat, lng, detection, start, props } = fire;
    const { brightness, confidence, frp } = detection;
    let county = null, state = null, fips = null;
    
    // Only geocode if we haven't exceeded the limit (prevents runaway costs)
    if (lat && lng && geocodingCalls < MAX_GEOCODING_CALLS) {
      try {
        const rev = await reverseGeocodeCountyState(lat, lng);
        county = rev.county; 
        state = rev.state;
        fips = mapCountyToFips(county, state);
        geocodingCalls++;
        
        // Rate limiting: 100ms with Mapbox, 1.1s with Nominatim fallback
        const delayMs = (process.env.MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_API_KEY) ? 100 : 1100;
        if (geocodingCalls < MAX_GEOCODING_CALLS) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (e) {
        geocodeFailures++;
      }
    } else if (geocodingCalls >= MAX_GEOCODING_CALLS) {
      // Skip geocoding for remaining fires if we've hit the limit
      console.log(`⚠️  FIRMS: Reached geocoding limit (${MAX_GEOCODING_CALLS}), skipping remaining geocoding calls`);
    }
    
    const rec = {
      source: 'firms',
      event_type: 'wildfire',
      county_fips: fips || '00000',
      county_name: county,
      state_abbr: state,
      start_time: start,
      end_time: null,
      severity: `${confidence}${brightness != null ? ` (${brightness}K)` : ''}${frp != null ? ` FRP ${frp}MW` : ''}`.trim(),
      title: `Wildfire${brightness != null ? ` (${brightness}K)` : frp != null ? ` (FRP ${frp}MW)` : ''}`.trim(),
      lat, lng,
      source_id: String(props.id || `${lat},${lng},${start}`),
      raw: props
    };
    
    if (rec.county_fips || (lat && lng)) {
      batch.push(rec);
    } else {
      noFipsCount++;
    }
  }
  
  if (geocodeFailures > 0) {
    console.log(`⚠️  FIRMS: ${geocodeFailures} geocoding failures (using lat/lng fallback)`);
  }
  if (noFipsCount > 0) {
    console.log(`⚠️  FIRMS: ${noFipsCount} records skipped (no coordinates)`);
  }
  
  console.log(`🔥 FIRMS: Prepared ${batch.length} records for database insertion`);
  const result = await upsertDisasters(batch);
  const summary = {
    ...result,
    fetched: feats.length,
    prepared: batch.length,
    likelyFire: finalFires.length,
    filtered: {
      confidence: filteredByConfidence,
      weakSignal: filteredBySignal,
      unlikelyFire: filteredByLikelyFire,
    },
  };
  console.log(`🔥 FIRMS: Inserted ${summary.inserted}, skipped ${summary.skipped}, fetched ${summary.fetched}, likely ${summary.likelyFire}`);
  return summary;
}

/** USGS Earthquakes GeoJSON (past day) **/
export async function ingestUsgsQuakes() {
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
  let geo;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`USGS API error: ${resp.status} ${resp.statusText}`);
    }
    geo = await resp.json();
  } catch (e) {
    console.warn('USGS fetch failed:', e.message);
    return { inserted: 0, skipped: 0 };
  }
  const feats = (geo && geo.features) ? geo.features : [];
  console.log(`🌍 USGS: Fetched ${feats.length} earthquakes`);
  const batch = [];
  const MAX_GEOCODING_CALLS = 50; // Limit for earthquakes (usually fewer)
  let geocodingCalls = 0;
  
  for (const f of feats) {
    const props = f.properties || {};
    const coords = (f.geometry && f.geometry.coordinates) || [];
    const lng = coords[0];
    const lat = coords[1];
    const start = props.time ? new Date(props.time).toISOString() : new Date().toISOString();
    let county = null, state = null, fips = null;
    
    // Only geocode if under limit (prevents excessive API calls)
    if (lat && lng && geocodingCalls < MAX_GEOCODING_CALLS) {
      try {
        const rev = await reverseGeocodeCountyState(lat, lng);
        county = rev.county; state = rev.state;
        geocodingCalls++;
        
        // Rate limiting: Wait 1.1 seconds between calls (Nominatim: 1 req/sec)
        if (geocodingCalls < MAX_GEOCODING_CALLS) {
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
      } catch (e) {
        // Skip on error
      }
    }
    
    await loadFipsReference();
    fips = mapCountyToFips(county, state);
    // Use '00000' when geocoding fails but we have coordinates (e.g. offshore quakes) so it appears on map
    if (!fips && lat && lng) fips = '00000';
    const rec = {
      source: 'usgs',
      event_type: 'earthquake',
      county_fips: fips,
      county_name: county,
      state_abbr: state,
      start_time: start,
      end_time: null,
      severity: props.mag != null ? String(props.mag) : null,
      title: props.title || 'Earthquake',
      lat, lng,
      source_id: String(props.code || props.ids || start),
      raw: props
    };
    if (rec.county_fips) batch.push(rec);
  }
  console.log(`🌍 USGS: Prepared ${batch.length} records for database insertion`);
  return upsertDisasters(batch);
}

/** NOAA/NWS CAP Alerts (US) **/
export async function ingestNwsCap(options = {}) {
  const { source = 'nws', eventFilter = null } = options;
  const url = 'https://api.weather.gov/alerts/active?status=actual&message_type=alert';
  let data;
  try {
    const resp = await fetch(url, { headers: { 'Accept': 'application/geo+json', 'User-Agent': 'DevConnectLabs/1.0' } });
    if (!resp.ok) {
      throw new Error(`NWS API error: ${resp.status} ${resp.statusText}`);
    }
    data = await resp.json();
  } catch (e) {
    console.warn('NWS CAP fetch failed:', e.message);
    return { inserted: 0, skipped: 0 };
  }
  const feats = (data && data.features) ? data.features : [];
  console.log(`🌤️  NWS: Fetched ${feats.length} active alerts`);
  const batch = [];
  const coordCache = new Map(); // county|state -> {lat,lng}
  const MAX_GEOCODING_CALLS = 50; // Limit for NWS alerts
  let geocodingCalls = 0;
  
  for (const f of feats) {
    if (eventFilter && !eventFilter(f)) continue;
    const props = f.properties || {};
    // Try to use areaDesc to get county/state; NWS formats: "County, ST" or "County1; County2 Counties, ST"
    let county = null, state = null, fips = null;
    const area = (props.areaDesc || '').trim();
    // Match "Counties, ST" or "County, ST" at end - extract state, then first county from preceding text
    const stateMatch = area.match(/Count(?:y|ies),\s*([A-Z]{2})\s*$/);
    if (stateMatch) {
      state = stateMatch[1];
      const beforeCounties = area.slice(0, area.indexOf(stateMatch[0])).trim();
      county = beforeCounties.split(/[;]/)[0].trim().replace(/\s+Count(?:y|ies)?\s*$/i, '');
    }
    // Fallback: reverse geocode centroid if present (only if needed and under limit)
    let lat = null, lng = null;
    const geom = f.geometry;
    if (geom && geom.coordinates) {
      let ring = geom.coordinates;
      if (geom.type === 'MultiPolygon') ring = ring[0]?.[0] || ring[0];
      else if (geom.type === 'Polygon') ring = ring[0];
      if (ring && ring.length) {
        const sum = ring.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
        lng = sum[0] / ring.length;
        lat = sum[1] / ring.length;
      }
    }
    // Reverse geocode when we have lat/lng but need county/state
    if ((!county || !state) && lat && lng && geocodingCalls < MAX_GEOCODING_CALLS) {
      try {
        const rev = await reverseGeocodeCountyState(lat, lng);
        county = county || rev.county; state = state || rev.state;
        geocodingCalls++;
        
        // Rate limiting: Wait 1.1 seconds between calls (Nominatim: 1 req/sec)
        if (geocodingCalls < MAX_GEOCODING_CALLS) {
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
      } catch (e) {
        // Skip on error
      }
    }
    // Forward geocode when we have county/state but no lat/lng (needed for map display)
    if ((!lat || !lng) && county && state && geocodingCalls < MAX_GEOCODING_CALLS) {
      const cacheKey = `${county}|${state}`;
      let coords = coordCache.get(cacheKey);
      if (!coords) {
        try {
          const res = await geocodeCountyStateWithCache(county, state);
          if (res?.latitude && res?.longitude) {
            coords = { lat: res.latitude, lng: res.longitude };
            coordCache.set(cacheKey, coords);
            geocodingCalls++;
          }
        } catch (e) {
          // Skip on error
        }
      }
      if (coords?.lat && coords?.lng) {
        lat = coords.lat;
        lng = coords.lng;
      }
    }
    await loadFipsReference();
    fips = mapCountyToFips(county, state);
    // Use '00000' when we have coordinates but no county (e.g. marine zones) so alert still appears on map
    if (!fips && (lat || lng)) fips = '00000';
    const start = props.effective || props.onset || props.sent || new Date().toISOString();
    const rec = {
      source,
      event_type: (props.event || 'severe').toLowerCase(),
      county_fips: fips,
      county_name: county || 'Unknown',
      state_abbr: state,
      start_time: start,
      end_time: props.ends || null,
      severity: props.severity || null,
      title: props.headline || props.event || 'Alert',
      lat, lng,
      source_id: String(props.id || props.uuid || start),
      raw: props
    };
    if (rec.county_fips) batch.push(rec);
  }
  console.log(`🌤️  NWS: Prepared ${batch.length} records for database insertion`);
  return upsertDisasters(batch);
}

/** FEMA Disaster Declarations (last 90 days) **/
export async function ingestFema() {
  const baseUrl = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - DISASTER_ROLLING_WINDOW_DAYS);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

  const filter = `incidentBeginDate ge ${ninetyDaysAgoStr}`;
  const url = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$top=1000&$orderby=incidentBeginDate desc`;

  let data;
  try {
    console.log(`🏛️  FEMA: Querying disasters since ${ninetyDaysAgoStr}`);
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DevConnectLabs-Disasters/1.0',
      },
    });

    if (!resp.ok) {
      throw new Error(`FEMA API error: ${resp.status} ${resp.statusText}`);
    }

    data = await resp.json();
  } catch (e) {
    console.warn('⚠️  FEMA fetch failed:', e.message);
    return { inserted: 0, skipped: 0, fetched: 0, prepared: 0, error: e.message };
  }

  const disasters = data.DisasterDeclarationsSummaries || [];
  console.log(`🏛️  FEMA: Retrieved ${disasters.length} disaster declarations`);

  const cutoffDate = new Date(ninetyDaysAgoStr);
  const recentDisasters = disasters.filter((disaster) => {
    if (disaster.incidentBeginDate) {
      return new Date(disaster.incidentBeginDate) >= cutoffDate;
    }
    return false;
  });

  console.log(`🏛️  FEMA: ${recentDisasters.length} disasters within ${DISASTER_ROLLING_WINDOW_DAYS}-day window`);

  const batch = [];
  const coordCache = new Map();
  await loadFipsReference();

  for (const item of recentDisasters) {
    const rec = resolveFemaDeclarationFields(item);
    if (!rec || !(rec.county_fips !== '00000' || (rec.county_name && rec.state_abbr))) continue;

    if ((!rec.lat || !rec.lng) && rec.county_name && rec.state_abbr) {
      const cacheKey = `${rec.county_name}|${rec.state_abbr}`;
      let coords = coordCache.get(cacheKey);
      if (!coords) {
        try {
          coords = await geocodeCountyStateWithCache(rec.county_name, rec.state_abbr);
          if (coords?.latitude && coords?.longitude) {
            coordCache.set(cacheKey, { lat: coords.latitude, lng: coords.longitude });
          }
        } catch (e) {
          // Continue without coords
        }
      }
      if (coords?.lat && coords?.lng) {
        rec.lat = coords.lat;
        rec.lng = coords.lng;
      } else if (coords?.latitude && coords?.longitude) {
        rec.lat = coords.latitude;
        rec.lng = coords.longitude;
      }
    }

    batch.push(rec);
  }

  console.log(`🏛️  FEMA: Prepared ${batch.length} records for database insertion`);
  const result = await upsertDisasters(batch);
  const summary = {
    ...result,
    fetched: recentDisasters.length,
    prepared: batch.length,
  };
  console.log(`🏛️  FEMA: Inserted ${summary.inserted}, skipped ${summary.skipped}, fetched ${summary.fetched}`);
  return summary;
}

/** NHC Active Cyclones — hurricane/tropical alerts from NWS CAP, stored as source nhc. */
export async function ingestNhc() {
  const hurricanePattern = /\b(hurricane|tropical storm|tropical depression|typhoon|cyclone|post-tropical|storm surge)\b/i;
  return ingestNwsCap({
    source: 'nhc',
    eventFilter: (f) => {
      const p = f.properties || {};
      const text = `${p.event || ''} ${p.headline || ''}`;
      return hurricanePattern.test(text);
    },
  });
}

/**
 * California Fire Cameras - ALERTCalifornia/ALERTWest camera network
 * Fetches camera locations and metadata from ALERTCalifornia system
 * Cameras provide real-time wildfire monitoring across California
 */
export async function ingestCaFireCameras() {
  const pool = getPool();
  if (!pool) {
    console.warn('⚠️  Database pool not initialized; skipping CA fire cameras');
    return { inserted: 0, upserted: 0, geocoded: 0 };
  }

  try {
    console.log('📹 Starting CA Fire Cameras ingestion...');
    await loadFipsReference();
    await initFireCamerasSchema();
    
    // ALERTCalifornia cameras are accessible via their API
    // Try multiple endpoints - ALERTCalifornia uses ArcGIS services
    const endpoints = [
      'https://alertcalifornia.org/api/cameras', // Primary endpoint (if available)
      'https://api.alertcalifornia.org/cameras', // Alternative API endpoint
    ];

    let cameraData = null;
    let cameras = [];

    // Try to fetch from ALERTCalifornia API
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'DevConnectLabs-DisasterService/1.0'
          }
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('json')) {
            cameraData = await response.json();
            console.log(`✅ Fetched camera data from ${endpoint}`);
            break;
          }
        }
      } catch (e) {
        console.warn(`⚠️  Failed to fetch from ${endpoint}:`, e.message);
        continue;
      }
    }

    // Use the correct ALERTCalifornia Camera Feed endpoint
    if (!cameraData) {
      try {
        const baseUrl = 'https://services8.arcgis.com/X84q166Srnyl4JMV/ArcGIS/rest/services/ALERTCalifornia_Camera_Feed/FeatureServer/0/query';
        
        // Check for optional ArcGIS API key (some services require it)
        const arcgisApiKey = process.env.ARCGIS_API_KEY || process.env.ESRI_API_KEY || null;
        
        // Try query with geometry first (for mapping)
        const params = new URLSearchParams({
          where: '1=1',
          outFields: '*',
          returnGeometry: 'true',
          f: 'json',
          resultRecordCount: 2000 // Get up to 2000 cameras
        });
        
        // Add API key if provided
        if (arcgisApiKey) {
          params.append('token', arcgisApiKey);
          console.log(`📹 Using ArcGIS API key for authentication`);
        } else {
          console.log(`📹 No ArcGIS API key found - trying public access`);
        }
        
        console.log(`📹 Querying ALERTCalifornia Camera Feed: ${baseUrl}`);
        const response = await fetch(`${baseUrl}?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'DevConnectLabs-DisasterService/1.0'
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // Debug: Log response structure
          console.log(`📹 API Response keys:`, Object.keys(result));
          console.log(`📹 Response has features:`, !!result.features);
          console.log(`📹 Features is array:`, Array.isArray(result.features));
          if (result.features) {
            console.log(`📹 Features count:`, result.features.length);
            if (result.features.length > 0) {
              console.log(`📹 Sample feature keys:`, Object.keys(result.features[0]));
              console.log(`📹 Sample feature:`, JSON.stringify(result.features[0]).substring(0, 500));
            }
          }
          if (result.objectIdFieldName) {
            console.log(`📹 Object ID field:`, result.objectIdFieldName);
          }
          if (result.fields) {
            console.log(`📹 Available fields:`, result.fields.map(f => f.name).join(', '));
          }
          
          if (result.error) {
            console.warn(`⚠️  ALERTCalifornia API error:`, result.error.message || result.error);
            // Try without geometry as fallback
            const paramsNoGeo = new URLSearchParams({
              where: '1=1',
              outFields: '*',
              f: 'json',
              resultRecordCount: 2000
            });
            
            const fallbackResponse = await fetch(`${baseUrl}?${paramsNoGeo.toString()}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'DevConnectLabs-DisasterService/1.0'
              }
            });
            
            if (fallbackResponse.ok) {
              const fallbackResult = await fallbackResponse.json();
              console.log(`📹 Fallback response keys:`, Object.keys(fallbackResult));
              if (fallbackResult.features && Array.isArray(fallbackResult.features)) {
                console.log(`📹 Fallback features count:`, fallbackResult.features.length);
                cameras = parseCameraFeatures(fallbackResult.features, fallbackResult.spatialReference);
                console.log(`✅ Fetched ${cameras.length} cameras (without geometry)`);
              }
            }
          } else if (result.features && Array.isArray(result.features)) {
            // Pass spatial reference to parser for coordinate conversion
            if (result.spatialReference) {
              console.log(`📹 Spatial Reference:`, result.spatialReference);
            }
            cameras = parseCameraFeatures(result.features, result.spatialReference);
            console.log(`✅ Parsed ${cameras.length} cameras from ${result.features.length} features`);
          } else {
            console.warn(`⚠️  Unexpected response format. Keys:`, Object.keys(result));
            console.warn(`⚠️  Full response sample:`, JSON.stringify(result).substring(0, 1000));
          }
        } else {
          const errorText = await response.text().catch(() => '');
          console.warn(`⚠️  ALERTCalifornia API returned ${response.status}: ${errorText.substring(0, 200)}`);
        }
      } catch (apiError) {
        console.warn('⚠️  ALERTCalifornia API error:', apiError.message);
      }
    }

    // Helper function to convert Web Mercator (EPSG:3857) to WGS84 (EPSG:4326)
    function webMercatorToWGS84(x, y) {
      // Web Mercator to WGS84 conversion formula
      const lon = (x / 20037508.34) * 180;
      const lat = (2 * Math.atan(Math.exp(y * Math.PI / 20037508.34)) - Math.PI / 2) * 180 / Math.PI;
      return { longitude: lon, latitude: lat };
    }
    
    // Helper function to detect if coordinates are in Web Mercator projection
    function isWebMercator(x, y) {
      // Web Mercator coordinates are typically very large (millions)
      // Valid lat/lng are between -180 to 180 for lon, -90 to 90 for lat
      return Math.abs(x) > 180 || Math.abs(y) > 90;
    }

    // Helper function to parse camera features
    function parseCameraFeatures(features, spatialReference = null) {
      console.log(`📹 Parsing ${features.length} features...`);
      
      // Check if spatial reference indicates Web Mercator (EPSG:3857 or WKID:3857)
      const isWebMercatorSR = spatialReference && (
        spatialReference.wkid === 3857 || 
        spatialReference.wkid === 102100 || 
        spatialReference.latestWkid === 3857 ||
        spatialReference.latestWkid === 102100
      );
      
      return features.map((feature, idx) => {
        // ArcGIS features can have attributes directly on the feature object, or in feature.attributes
        const props = feature.attributes || feature.properties || feature || {};
        const geometry = feature.geometry || {};
        
        // Handle different geometry formats
        let coords = [];
        if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
          coords = geometry.coordinates;
        } else if (geometry.x !== undefined && geometry.y !== undefined) {
          // ArcGIS point format: {x: lon, y: lat}
          coords = [geometry.x, geometry.y];
        } else if (geometry.longitude !== undefined && geometry.latitude !== undefined) {
          coords = [geometry.longitude, geometry.latitude];
        }
        
        // Convert Web Mercator to WGS84 if needed
        let longitude = coords[0];
        let latitude = coords[1];
        
        if (coords.length >= 2 && (isWebMercatorSR || isWebMercator(coords[0], coords[1]))) {
          const converted = webMercatorToWGS84(coords[0], coords[1]);
          longitude = converted.longitude;
          latitude = converted.latitude;
          if (idx === 0) {
            console.log(`📹 Converted Web Mercator coords [${coords[0]}, ${coords[1]}] to WGS84 [${longitude}, ${latitude}]`);
          }
        }
        
        // Log first feature for debugging
        if (idx === 0) {
          console.log(`📹 Sample feature structure:`, {
            hasAttributes: !!feature.attributes,
            hasProperties: !!feature.properties,
            hasGeometry: !!feature.geometry,
            attributeKeys: feature.attributes ? Object.keys(feature.attributes) : [],
            geometryType: geometry.type || 'unknown',
            spatialReference: spatialReference,
            originalCoords: coords,
            convertedCoords: [longitude, latitude]
          });
        }
        
        const camera = {
          camera_id: props.CAMERA_ID || props.camera_id || props.ID || props.OBJECTID || props.FID || props.CameraID || null,
          name: props.NAME || props.name || props.CAMERA_NAME || props.DISPLAY_NAME || props.CameraName || props.cameraName || 'Unknown Camera',
          location: props.LOCATION || props.location || props.SITE_NAME || props.Location || null,
          county: props.COUNTY || props.county || props.County || null,
          state: 'CA',
          latitude: latitude || props.LATITUDE || props.latitude || props.Latitude || props.Y || null,
          longitude: longitude || props.LONGITUDE || props.longitude || props.Longitude || props.X || null,
          elevation: props.ELEVATION || props.elevation || props.Elevation || null,
          status: props.STATUS || props.status || props.ACTIVE || props.Active || props.isActive || props.isOnline || 'active',
          image_url: props.IMAGE_URL || props.image_url || props.imageURL || null,
          camera_url: props.CAMERA_URL || props.cameraURL || props.CameraURL || null,
          network_url: props.NETWORK_URL || props.networkURL || props.NetworkURL || null,
          site_id: props.SITE_ID || props.siteId || props.SiteID || null,
          metadata: props
        };
        
        return camera;
      }).filter((cam, filterIdx) => {
        // Only include cameras with valid coordinates
        const hasCoords = cam.latitude && cam.longitude && 
                          !isNaN(parseFloat(cam.latitude)) && 
                          !isNaN(parseFloat(cam.longitude)) &&
                          Math.abs(parseFloat(cam.latitude)) <= 90 &&
                          Math.abs(parseFloat(cam.longitude)) <= 180;
        if (!hasCoords && filterIdx === 0) {
          console.log(`📹 First camera missing or invalid coordinates:`, cam);
        }
        return hasCoords;
      });
    }
    
    // Parse camera data from direct API response (if we got data from direct endpoints)
    if (cameraData && cameras.length === 0) {
      if (Array.isArray(cameraData)) {
        cameras = cameraData;
      } else if (cameraData.cameras && Array.isArray(cameraData.cameras)) {
        cameras = cameraData.cameras;
      } else if (cameraData.features && Array.isArray(cameraData.features)) {
        // GeoJSON format
        cameras = cameraData.features.map(f => ({
          ...f.properties,
          latitude: f.geometry?.coordinates?.[1],
          longitude: f.geometry?.coordinates?.[0]
        }));
      }
    }

    if (cameras.length === 0) {
      console.log('📹 No CA fire cameras found (API may be unavailable or format changed)');
      return { inserted: 0, upserted: 0, geocoded: 0 };
    }

    const beforeDedup = cameras.length;
    cameras = dedupeCamerasByLocation(cameras);
    if (beforeDedup !== cameras.length) {
      console.log(`📹 CA Fire Cameras: deduplicated ${beforeDedup} ➜ ${cameras.length} unique cameras`);
    }

    const existingBySourceId = new Map();
    const existingRes = await pool.query(
      `SELECT source_id, county_name, county_fips, geocoded_at
       FROM fire_cameras
       WHERE source = 'alertcalifornia'`
    );
    for (const row of existingRes.rows) {
      existingBySourceId.set(String(row.source_id), row);
    }

    const batch = [];
    let geocodeCount = 0;
    const geocodeTimestamp = () => new Date().toISOString();

    for (const camera of cameras) {
      if (!camera.latitude || !camera.longitude) continue;

      const lat = parseFloat(camera.latitude);
      const lng = parseFloat(camera.longitude);
      const sourceId = String(
        camera.camera_id || camera.name || `camera_${lat}_${lng}`
      );
      const existing = existingBySourceId.get(sourceId);
      const stateAbbr = 'CA';

      let countyName = (camera.county || '').replace(/\s*County$/i, '').trim() || null;
      if (countyName) {
        countyName = countyName
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
      let countyFips = countyName ? mapCountyToFips(countyName, stateAbbr) : null;
      let geocodedAt = null;

      const hasCountyFromFeed = !!(countyName && countyFips);
      const alreadyGeocoded = existing?.geocoded_at != null;
      const hasStoredCounty = !!(
        existing?.county_name &&
        existing?.county_fips &&
        existing.county_fips !== '06000'
      );
      const hasPersistedGeocode = alreadyGeocoded || hasStoredCounty;

      if (hasPersistedGeocode) {
        countyName = existing.county_name || countyName;
        countyFips = existing.county_fips || countyFips;
        geocodedAt = existing.geocoded_at || null;
      } else if (hasCountyFromFeed) {
        geocodedAt = geocodeTimestamp();
      } else if (geocodeCount < MAX_CAMERA_GEOCODES_PER_RUN) {
        try {
          const geo = await reverseGeocodeWithCache(lat, lng);
          if (geo.county) {
            countyName = String(geo.county).replace(/\s*County$/i, '').trim();
            countyFips = mapCountyToFips(countyName, geo.state || stateAbbr);
          }
          geocodedAt = geocodeTimestamp();
          geocodeCount++;
          if (!geo.cached) {
            await new Promise((resolve) => setTimeout(resolve, 1100));
          }
        } catch (e) {
          console.warn(`⚠️  Camera geocode failed for ${sourceId}:`, e.message);
          geocodedAt = geocodeTimestamp();
          geocodeCount++;
        }
      } else if (existing) {
        countyName = existing.county_name || countyName;
        countyFips = existing.county_fips || countyFips;
        geocodedAt = existing.geocoded_at || null;
      }

      batch.push({
        source: 'alertcalifornia',
        source_id: sourceId,
        name: camera.name || 'Fire Camera',
        lat,
        lng,
        county_name: countyName,
        county_fips: countyFips,
        state_abbr: stateAbbr,
        camera_url: camera.camera_url || null,
        network_url: camera.network_url || null,
        image_url: camera.image_url || null,
        status: camera.status || 'active',
        hazard_types: ['fire'],
        media_type: 'live_stream',
        refresh_minutes: 5,
        geocoded_at: geocodedAt,
        raw: {
          ...camera,
          camera_type: 'fire_monitoring',
          network: 'ALERTCalifornia',
          attribution: 'ALERTCalifornia / ALERTWest',
        },
      });
    }

    console.log(`📹 CA Fire Cameras: Prepared ${batch.length} camera records (${geocodeCount} geocoded this run)`);
    const result = await upsertFireCameras(batch);
    const legacyRemoved = await cleanupLegacyCameraDisasters();
    const upserted = result.upserted || 0;
    console.log(`📹 CA Fire Cameras: Upserted ${upserted}, geocoded ${geocodeCount}, legacy removed ${legacyRemoved}`);
    return { inserted: upserted, upserted, geocoded: geocodeCount, legacyRemoved };
  } catch (error) {
    console.error('❌ Error ingesting CA fire cameras:', error.message);
    return { inserted: 0, upserted: 0, geocoded: 0 };
  }
}

/**
 * Deduplicate camera records by camera_id (when present) or by rounded lat/lng.
 * Prefers records with richer metadata (ID, name, county, status, URLs).
 */
function dedupeCamerasByLocation(cameras) {
  if (!Array.isArray(cameras)) return [];
  const bestByKey = new Map();

  const toNumber = (value) => {
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const scoreCamera = (cam) => {
    let score = 0;
    if (cam.camera_id) score += 5;
    if (cam.name && cam.name !== 'Unknown Camera') score += 2;
    if (cam.county && cam.county !== 'Unknown') score += 2;
    if (cam.status) score += 1;
    if (cam.camera_url || cam.image_url) score += 1;
    return score;
  };

  for (const cam of cameras) {
    const lat = toNumber(cam.latitude);
    const lng = toNumber(cam.longitude);
    if (lat === null || lng === null) continue;

    const idKey = cam.camera_id ? `id:${String(cam.camera_id).trim()}` : null;
    const geoKey = `geo:${lat.toFixed(3)}:${lng.toFixed(3)}`;
    const key = idKey || geoKey;
    const currentScore = scoreCamera(cam);

    const existing = bestByKey.get(key);
    if (!existing || currentScore > existing.score) {
      bestByKey.set(key, { ...cam, score: currentScore });
    }
  }

  return Array.from(bestByKey.values()).map(({ score, ...cam }) => cam);
}