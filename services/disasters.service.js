import { getPool } from './database.service.js';
import { reverseGeocodeCountyState } from './disaster-risk.service.js';
import fs from 'fs';
import path from 'path';

/**
 * Disasters Service
 * - Schema initialization for unified disasters table (30-day rolling window)
 * - Utilities for county FIPS lookups (optional JSON reference)
 */

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS disasters (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  county_fips CHAR(5) NOT NULL,
  county_name TEXT,
  state_abbr CHAR(2),
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
    await pool.query('COMMIT');
    console.log('✅ Disasters schema ensured');
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('❌ Failed to initialize disasters schema:', err.message);
    throw err;
  }
}

/** Prune disasters older than 30 days */
export async function pruneOldDisasters() {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(`DELETE FROM disasters WHERE start_time < NOW() - INTERVAL '30 days'`);
  } catch (e) {
    console.warn('⚠️  pruneOldDisasters failed:', e.message);
  }
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

export default {
  initDisastersSchema,
  loadFipsReference,
  lookupCountyByFips,
  upsertDisasters,
  normalizeFemaV2ToUnified,
  ingestFirmsNrt,
  ingestUsgsQuakes,
  ingestNwsCap,
  ingestNhc,
};

/**
 * Upsert a batch of disasters into the unified table.
 * Records must include: source, event_type, county_fips, county_name, state_abbr, start_time
 */
export async function upsertDisasters(batch) {
  if (!Array.isArray(batch) || batch.length === 0) return { inserted: 0, skipped: 0 };
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const text = `
    INSERT INTO disasters (
      source, event_type, county_fips, county_name, state_abbr,
      start_time, end_time, severity, title, lat, lng, source_id, raw
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
    ) ON CONFLICT (county_fips, source, source_id, start_time) DO NOTHING
  `;

  let inserted = 0, skipped = 0;
  for (const d of batch) {
    try {
      const values = [
        d.source,
        d.event_type,
        d.county_fips,
        d.county_name || null,
        d.state_abbr || null,
        d.start_time,
        d.end_time || null,
        d.severity || null,
        d.title || null,
        d.lat || null,
        d.lng || null,
        d.source_id || null,
        d.raw || null,
      ];
      const res = await pool.query(text, values);
      if (res.rowCount > 0) inserted += res.rowCount; else skipped += 1;
    } catch (e) {
      console.warn('⚠️  Upsert disaster skipped:', e.message);
      skipped += 1;
    }
  }
  return { inserted, skipped };
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

/** NASA FIRMS (active fires) - VIIRS NRT GeoJSON **/
export async function ingestFirmsNrt() {
  const url = 'https://firms.modaps.eosdis.nasa.gov/active_fire/viirs/geojson/VNP14IMGTDL_NRT_USA_contiguous_and_Hawaii_24h.json';
  let geo;
  try {
    const resp = await fetch(url);
    geo = await resp.json();
  } catch (e) {
    console.warn('FIRMS fetch failed:', e.message);
    return { inserted: 0, skipped: 0 };
  }
  const feats = (geo && geo.features) ? geo.features : [];
  const batch = [];
  for (const f of feats) {
    const props = f.properties || {};
    const coords = (f.geometry && f.geometry.coordinates) || [];
    const lat = coords[1];
    const lng = coords[0];
    let county = null, state = null, fips = null;
    if (lat && lng) {
      const rev = await reverseGeocodeCountyState(lat, lng);
      county = rev.county; state = rev.state;
      await loadFipsReference();
      fips = mapCountyToFips(county, state);
    }
    const start = props.acq_date ? new Date(`${props.acq_date}T${(props.acq_time||'0000').toString().padStart(4,'0').slice(0,2)}:${(props.acq_time||'0000').toString().padStart(4,'0').slice(2)}:00Z`).toISOString() : new Date().toISOString();
    const rec = {
      source: 'firms',
      event_type: 'wildfire',
      county_fips: fips,
      county_name: county,
      state_abbr: state,
      start_time: start,
      end_time: null,
      severity: String(props.confidence || ''),
      title: `Fire ${props.brightness ? `(${props.brightness})` : ''}`.trim(),
      lat, lng,
      source_id: String(props.id || `${lat},${lng},${start}`),
      raw: props
    };
    if (rec.county_fips) batch.push(rec);
  }
  return upsertDisasters(batch);
}

/** USGS Earthquakes GeoJSON (past day) **/
export async function ingestUsgsQuakes() {
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
  let geo;
  try {
    const resp = await fetch(url);
    geo = await resp.json();
  } catch (e) {
    console.warn('USGS fetch failed:', e.message);
    return { inserted: 0, skipped: 0 };
  }
  const feats = (geo && geo.features) ? geo.features : [];
  const batch = [];
  for (const f of feats) {
    const props = f.properties || {};
    const coords = (f.geometry && f.geometry.coordinates) || [];
    const lng = coords[0];
    const lat = coords[1];
    const start = props.time ? new Date(props.time).toISOString() : new Date().toISOString();
    let county = null, state = null, fips = null;
    if (lat && lng) {
      const rev = await reverseGeocodeCountyState(lat, lng);
      county = rev.county; state = rev.state;
      await loadFipsReference();
      fips = mapCountyToFips(county, state);
    }
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
  return upsertDisasters(batch);
}

/** NOAA/NWS CAP Alerts (US) **/
export async function ingestNwsCap() {
  const url = 'https://api.weather.gov/alerts/active?status=actual&message_type=alert';
  let data;
  try {
    const resp = await fetch(url, { headers: { 'Accept': 'application/geo+json', 'User-Agent': 'piBoom/1.0' } });
    data = await resp.json();
  } catch (e) {
    console.warn('NWS CAP fetch failed:', e.message);
    return { inserted: 0, skipped: 0 };
  }
  const feats = (data && data.features) ? data.features : [];
  const batch = [];
  for (const f of feats) {
    const props = f.properties || {};
    // Try to use areaDesc to get county/state; may include multiple areas
    let county = null, state = null, fips = null;
    const area = props.areaDesc || '';
    const m = area.match(/([A-Za-z .'-]+) County,\s*([A-Z]{2})/);
    if (m) { county = m[1]; state = m[2]; }
    // Fallback: reverse geocode centroid if present
    let lat = null, lng = null;
    if (f.geometry && f.geometry.type === 'Polygon') {
      const coords = f.geometry.coordinates[0];
      if (coords && coords.length) {
        // rough centroid
        const mid = coords[Math.floor(coords.length/2)];
        lng = mid[0]; lat = mid[1];
      }
    }
    if ((!county || !state) && lat && lng) {
      const rev = await reverseGeocodeCountyState(lat, lng);
      county = county || rev.county; state = state || rev.state;
    }
    await loadFipsReference();
    fips = mapCountyToFips(county, state);
    const start = props.effective || props.onset || props.sent || new Date().toISOString();
    const rec = {
      source: 'nws',
      event_type: (props.event || 'severe').toLowerCase(),
      county_fips: fips,
      county_name: county,
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
  return upsertDisasters(batch);
}

/** NHC Active Cyclones (best available JSON proxy) — simple placeholder using NWS CAP hurricane events **/
export async function ingestNhc() {
  // For now, derive from NWS CAP hurricane-related alerts to populate hurricane event_type
  const res = await ingestNwsCap();
  return res;
}




