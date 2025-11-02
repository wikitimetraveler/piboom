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
 * with FIPS code lookups. Provides unified disaster data with a 30-day rolling window
 * for recent disaster tracking.
 * 
 * Features:
 * - Unified disasters table schema initialization
 * - Multi-source disaster data integration (NOAA, NASA, FEMA)
 * - County FIPS code lookups and geocoding
 * - 30-day rolling window for recent disasters
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
 * - Timestamp-based filtering (30-day window)
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

import { getPool } from './database.service.js';
import { reverseGeocodeCountyState } from './disaster-risk.service.js';
import fs from 'fs';
import path from 'path';

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
    RETURNING id
  `;

  let inserted = 0, skipped = 0;
  const batchSize = batch.length;
  
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
  
  if (batchSize > 0) {
    console.log(`📊 upsertDisasters: ${inserted} inserted, ${skipped} skipped from ${batchSize} records`);
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
      const brightIdx = headers.indexOf('brightness');
      const confIdx = headers.indexOf('confidence');
      
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
            confidence: values[confIdx] ? values[confIdx].trim() : '',
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
    return { inserted: 0, skipped: 0 };
  }
  const feats = (geo && geo.features) ? geo.features : [];
  const batch = [];
  let geocodeFailures = 0;
  let noFipsCount = 0;
  
  for (const f of feats) {
    const props = f.properties || {};
    const coords = (f.geometry && f.geometry.coordinates) || [];
    const lat = coords[1];
    const lng = coords[0];
    let county = null, state = null, fips = null;
    
    if (lat && lng) {
      try {
        const rev = await reverseGeocodeCountyState(lat, lng);
        county = rev.county; 
        state = rev.state;
        await loadFipsReference();
        fips = mapCountyToFips(county, state);
      } catch (e) {
        geocodeFailures++;
        // Continue anyway - we'll try to use lat/lng only
      }
    }
    
    // Parse date/time from FIRMS CSV format (acq_date: YYYY-MM-DD, acq_time: HHMM)
    let start = new Date().toISOString();
    if (props.acq_date) {
      const dateStr = props.acq_date.trim();
      const timeStr = (props.acq_time || '0000').toString().padStart(4, '0');
      const hour = timeStr.slice(0, 2);
      const minute = timeStr.slice(2, 4);
      try {
        start = new Date(`${dateStr}T${hour}:${minute}:00Z`).toISOString();
      } catch (e) {
        // Fallback if date parsing fails
        start = new Date().toISOString();
      }
    }
    
    const rec = {
      source: 'firms',
      event_type: 'wildfire',
      county_fips: fips || '00000', // Use placeholder if no FIPS
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
    
    // Allow records without FIPS if we have lat/lng (they can be filtered/geocoded later)
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
  console.log(`🔥 FIRMS: Inserted ${result.inserted}, skipped ${result.skipped}`);
  return result;
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




