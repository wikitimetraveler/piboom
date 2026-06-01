/**
 * Development work by David Lane
 */
import { getPool } from '../services/database.service.js';
import {
  initDisastersSchema,
  upsertDisasters,
  normalizeFemaV2ToUnified,
  ingestFema,
  ingestFirmsNrt,
  ingestUsgsQuakes,
  ingestNwsCap,
  ingestNhc,
  ingestCaFireCameras
} from '../services/disasters.service.js';
import {
  ingestHazardWebcams,
  getHazardWebcamById,
  getHazardWebcamStats,
  resolveUsgsNimsLatestImage,
  resolveUsgsVolcanoLatestImage,
  resolveFaaWeatherCamLatestImage,
} from '../services/hazard-webcam-ingest.service.js';
import { geocodeCountyStateWithCache } from '../services/geocoding-cache.service.js';
import { geocodeAddressFree } from '../services/free-geocoding.service.js';
import { refreshDisasterImpactGraphFromCurrentData } from '../services/disaster-impact-graph.service.js';
import {
  resolveCamerasNearPoint,
  resolveDisastersNearPoint,
  resolveLoansNearPoint
} from '../services/disaster-spatial.service.js';

// Ensure schema on startup (best-effort)
initDisastersSchema().catch(() => {});

/** US state FIPS codes (first 2 digits of county_fips) */
const US_STATE_FIPS = ['01','02','04','05','06','08','09','10','11','12','13','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','44','45','46','47','48','49','50','51','53','54','55','56','60','66','69','72','78'];
/** US state abbreviations - for records with county_fips=00000 (FIPS lookup failed) */
const US_STATE_ABBR = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','PEN','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','AS','GU','MP','PR','VI'];

export async function listDisasters(req, res) {
  try {
    const { state, county, source, event, since, usOnly } = req.query;
    const pool = getPool();
    if (!pool) throw new Error('Database not initialized');
    const DEFAULT_LIMIT = 1000;
    const MAX_LIMIT = 5000;
    const parsedLimit = parseInt(req.query.limit, 10);
    const parsedOffset = parseInt(req.query.offset, 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;
    const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

    const clauses = [];
    const values = [];
    // Default: US-only (excludes international e.g. USGS Tibet earthquakes)
    // Include: county_fips starts with US state FIPS, OR state_abbr is a US state (relaxed for records with odd county_fips)
    const filterUsOnly = usOnly !== 'false' && usOnly !== '0';
    if (filterUsOnly) {
      const fipsList = US_STATE_FIPS.map(f => `'${f}'`).join(',');
      const abbrList = US_STATE_ABBR.map(a => `'${a}'`).join(',');
      clauses.push(`(LEFT(county_fips, 2) IN (${fipsList}) OR (UPPER(TRIM(COALESCE(state_abbr,''))) IN (${abbrList})))`);
    }
    if (state) { values.push(state); clauses.push(`state_abbr = $${values.length}`); }
    if (county) { values.push(county); clauses.push(`county_name ILIKE $${values.length}`); values[values.length-1] = `%${county}%`; }
    if (source) { 
      // Normalize source to lowercase for case-insensitive matching (FIRMS data stored as 'firms')
      const normalizedSource = String(source).toLowerCase().trim();
      values.push(normalizedSource); 
      clauses.push(`source = $${values.length}`); 
      console.log(`📊 Source filter: "${source}" → normalized to "${normalizedSource}"`);
    }
    if (event) { values.push(event); clauses.push(`event_type = $${values.length}`); }
    if (since) { values.push(since); clauses.push(`start_time >= $${values.length}`); }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countSql = `SELECT COUNT(*)::int AS total FROM disasters ${where}`;
    const countRes = await pool.query(countSql, values);
    const totalCount = countRes.rows[0]?.total || 0;
    const sql = `SELECT * FROM disasters ${where} ORDER BY start_time DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const queryValues = values.concat([limit, offset]);
    console.log('📊 Querying disasters:', sql, 'Values:', queryValues);
    let rows = (await pool.query(sql, queryValues)).rows;

    // Optional: geocode rows missing lat/lng but with county+state
    const doGeocode = req.query.geocode === 'true' || req.query.geocode === '1';
    if (doGeocode && rows.length > 0) {
      const needsGeocode = (r) => {
        const hasCoords = (r.lat != null && r.lng != null && !isNaN(parseFloat(r.lat)) && !isNaN(parseFloat(r.lng)));
        const hasLocation = (r.county_name || '').trim() && (r.state_abbr || '').trim();
        return !hasCoords && hasLocation;
      };
      const toGeocode = rows.filter(needsGeocode);
      const uniqueKeys = new Set();
      const coordCache = new Map();
      const maxGeocodes = 40;
      let geocodeCount = 0;

      for (const r of toGeocode) {
        if (geocodeCount >= maxGeocodes) break;
        const county = (r.county_name || '').replace(/\s*County$/i, '').trim();
        const state = (r.state_abbr || '').trim().toUpperCase();
        if (!county || !state) continue;
        const key = `${county}|${state}`;
        if (uniqueKeys.has(key)) continue;
        uniqueKeys.add(key);

        try {
          const coords = await geocodeCountyStateWithCache(county, state);
          if (coords?.latitude != null && coords?.longitude != null) {
            coordCache.set(key, { lat: coords.latitude, lng: coords.longitude });
            geocodeCount++;
            if (!coords?.cached) {
              await new Promise(resolve => setTimeout(resolve, 1100));
              await pool.query(
                `UPDATE disasters SET lat = $1, lng = $2 WHERE LOWER(REPLACE(COALESCE(county_name,''), ' County', '')) = $3 AND UPPER(TRIM(COALESCE(state_abbr,''))) = $4 AND (lat IS NULL OR lng IS NULL)`,
                [coords.latitude, coords.longitude, county.toLowerCase(), state]
              );
            }
          }
        } catch (e) {
          console.warn(`⚠️  Geocode failed for ${county}, ${state}:`, e.message);
        }
      }

      rows = rows.map(r => {
        if (needsGeocode(r)) {
          const county = (r.county_name || '').replace(/\s*County$/i, '').trim();
          const state = (r.state_abbr || '').trim().toUpperCase();
          const key = `${county}|${state}`;
          const coords = coordCache.get(key);
          if (coords) {
            return { ...r, lat: coords.lat, lng: coords.lng };
          }
        }
        return r;
      });
      if (geocodeCount > 0) {
        console.log(`📍 Geocoded ${geocodeCount} unique county/state locations for map display`);
      }
    }

    // Debug: Show source breakdown for FIRMS debugging
    if (source) {
      const sourceBreakdown = rows.reduce((acc, r) => {
        acc[r.source] = (acc[r.source] || 0) + 1;
        return acc;
      }, {});
      console.log(`📊 Found ${rows.length} disasters (source breakdown:`, sourceBreakdown, ')');
    } else {
      console.log(`📊 Found ${rows.length} disasters in database`);
    }
    res.json({
      success: true,
      data: {
        disasters: rows,
        count: rows.length,
        total: totalCount,
        pagination: {
          limit,
          offset,
          returned: rows.length,
          total: totalCount,
          hasMore: offset + rows.length < totalCount
        }
      }
    });
  } catch (e) {
    console.error('❌ Error listing disasters:', e);
    res.status(500).json({ success: false, error: 'Failed to list disasters', details: e.message });
  }
}

export async function refreshDisasters(req, res) {
  try {
    const { includeCameras, skipFema } = req.query; // Optional: ?includeCameras=true&skipFema=1
    const results = {};
    if (skipFema !== '1' && skipFema !== 'true') {
      results.fema = await ingestFema();
    } else {
      results.fema = { inserted: 0, skipped: 'skipped' };
    }
    results.firms = await ingestFirmsNrt();
    results.usgs = await ingestUsgsQuakes();
    results.nws = await ingestNwsCap();
    results.nhc = await ingestNhc();
    
    // Camera feed only if explicitly requested (manual review)
    if (includeCameras === 'true' || includeCameras === '1') {
      console.log('📹 Camera feed requested for manual review');
      results.cameras = await ingestCaFireCameras();
    }
    
    const graph = await refreshDisasterImpactGraphFromCurrentData();
    res.json({ success: true, message: 'Refreshed disasters', data: { ...results, graph } });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to refresh disasters', details: e.message });
  }
}

export async function refreshCameras(req, res) {
  try {
    const sources = req.query.sources || req.body?.sources || 'all';
    console.log('📹 Manual hazard webcam refresh requested:', sources);
    const result = await ingestHazardWebcams({ sources });
    res.json({
      success: true,
      message: 'Hazard webcam catalog refreshed',
      data: result,
      warning: 'Camera ingest can upsert many records. Use sparingly; not part of daily disaster refresh.',
    });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to refresh camera feed', details: e.message });
  }
}

function mapCameraRow(row) {
  const hazardTypes = row.hazard_types;
  return {
    id: row.id,
    source: row.source || 'alertcalifornia',
    event_type: 'camera',
    source_id: row.source_id,
    title: row.name,
    name: row.name,
    county_name: row.county_name,
    state_abbr: row.state_abbr,
    lat: row.lat,
    lng: row.lng,
    camera_url: row.camera_url,
    network_url: row.network_url,
    image_url: row.image_url,
    media_type: row.media_type,
    refresh_minutes: row.refresh_minutes,
    hazard_types: hazardTypes,
    severity: row.status,
    status: row.status,
    last_image_at: row.last_image_at,
    raw: row.raw,
    start_time: row.updated_at,
    updated_at: row.updated_at,
  };
}

export async function cameraStats(req, res) {
  try {
    const stats = await getHazardWebcamStats();
    res.json({ success: true, data: stats });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to get camera stats', details: e.message });
  }
}

export async function cameraSnapshot(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: 'Invalid camera id' });
    }
    const row = await getHazardWebcamById(id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Camera not found' });
    }

    let imageUrl = row.image_url;
    if (row.source === 'usgs_nims') {
      try {
        const latest = await resolveUsgsNimsLatestImage(row);
        if (latest) imageUrl = latest;
      } catch (e) {
        console.warn('USGS NIMS snapshot failed:', e.message);
      }
    }

    if (row.source === 'usgs_volcano') {
      try {
        const latest = await resolveUsgsVolcanoLatestImage(row);
        if (latest) imageUrl = latest;
      } catch (e) {
        console.warn('USGS volcano snapshot failed:', e.message);
      }
    }

    if (row.source === 'faa_weathercam') {
      try {
        const latest = await resolveFaaWeatherCamLatestImage(row);
        if (latest) imageUrl = latest;
      } catch (e) {
        console.warn('FAA WeatherCam snapshot failed:', e.message);
      }
    }

    if (!imageUrl && row.media_type === 'still_image') {
      return res.status(404).json({ success: false, error: 'No snapshot available for this camera' });
    }

    res.json({
      success: true,
      data: {
        id: row.id,
        source: row.source,
        image_url: imageUrl,
        camera_url: row.camera_url,
        media_type: row.media_type,
        refresh_minutes: row.refresh_minutes,
        attribution: row.raw?.attribution || null,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to get camera snapshot', details: e.message });
  }
}

export async function listCameras(req, res) {
  try {
    const { state, county, limit = 100, offset = 0, nearLat, nearLng, radiusMiles, source, hazard, mediaType } = req.query;
    const pool = getPool();
    if (!pool) throw new Error('Database not initialized');

    const DEFAULT_LIMIT = 1000;
    const MAX_LIMIT = 5000;
    const GEO_DEFAULT_LIMIT = 20;
    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);
    const parsedNearLat = parseFloat(nearLat);
    const parsedNearLng = parseFloat(nearLng);
    const hasGeo = Number.isFinite(parsedNearLat) && Number.isFinite(parsedNearLng);
    let parsedRadius = parseFloat(radiusMiles);
    if (!Number.isFinite(parsedRadius) || parsedRadius < 1) {
      parsedRadius = 50;
    } else if (parsedRadius > 500) {
      parsedRadius = 500;
    }

    const rowLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_LIMIT)
      : (hasGeo ? GEO_DEFAULT_LIMIT : DEFAULT_LIMIT);
    const rowOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

    const clauses = [];
    const values = [];
    if (state) {
      values.push(String(state).trim().toUpperCase());
      clauses.push(`UPPER(TRIM(COALESCE(state_abbr,''))) = $${values.length}`);
    }
    if (county) {
      values.push(`%${String(county).trim()}%`);
      clauses.push(`county_name ILIKE $${values.length}`);
    }
    if (source) {
      values.push(String(source).trim().toLowerCase());
      clauses.push(`LOWER(TRIM(source)) = $${values.length}`);
    }
    if (hazard) {
      values.push(JSON.stringify([String(hazard).trim().toLowerCase()]));
      clauses.push(`hazard_types @> $${values.length}::jsonb`);
    }
    if (mediaType) {
      values.push(String(mediaType).trim().toLowerCase());
      clauses.push(`LOWER(TRIM(COALESCE(media_type,''))) = $${values.length}`);
    }
    if (hasGeo) {
      clauses.push('lat IS NOT NULL AND lng IS NOT NULL');
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    let cameras;
    let total;

    if (hasGeo) {
      const spatial = await resolveCamerasNearPoint({
        lat: parsedNearLat,
        lng: parsedNearLng,
        radiusMiles: parsedRadius,
        limit: rowLimit,
        offset: rowOffset,
        filters: {
          state,
          county,
          source,
          hazard,
          mediaType
        }
      });
      cameras = spatial.rows.map(mapCameraRow);
      total = spatial.total;
    } else {
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM fire_cameras ${where}`,
        values
      );

      const camerasResult = await pool.query(
        `SELECT
          id, source, source_id, name, county_name, state_abbr, lat, lng,
          camera_url, network_url, image_url, status, media_type, refresh_minutes,
          hazard_types, last_image_at, raw, updated_at
        FROM fire_cameras
        ${where}
        ORDER BY name ASC NULLS LAST
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        values.concat([rowLimit, rowOffset])
      );

      cameras = camerasResult.rows.map(mapCameraRow);
      total = countResult.rows[0]?.total || 0;
    }

    res.json({
      success: true,
      data: {
        cameras,
        count: cameras.length,
        total,
        limit: rowLimit,
        offset: rowOffset,
        ...(hasGeo ? {
          nearLat: parsedNearLat,
          nearLng: parsedNearLng,
          radiusMiles: parsedRadius
        } : {})
      }
    });
  } catch (e) {
    console.error('❌ Error listing cameras:', e);
    res.status(500).json({ success: false, error: 'Failed to list cameras', details: e.message });
  }
}

export async function listNear(req, res) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        error: 'Query parameters lat and lng are required numeric values'
      });
    }

    let radiusMiles = parseFloat(req.query.radiusMiles);
    if (!Number.isFinite(radiusMiles) || radiusMiles < 1) {
      radiusMiles = 50;
    } else if (radiusMiles > 500) {
      radiusMiles = 500;
    }

    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 500)
      : 100;

    const typeParam = String(req.query.types || 'disasters,cameras,loans');
    const types = new Set(
      typeParam.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    );

    const payload = {
      lat,
      lng,
      radiusMiles,
      limit,
      disasters: [],
      cameras: [],
      loans: [],
      counts: { disasters: 0, cameras: 0, loans: 0 }
    };

    if (types.has('disasters')) {
      const result = await resolveDisastersNearPoint({ lat, lng, radiusMiles, limit });
      payload.disasters = result.rows;
      payload.counts.disasters = result.total;
    }
    if (types.has('cameras')) {
      const result = await resolveCamerasNearPoint({ lat, lng, radiusMiles, limit });
      payload.cameras = result.rows.map(mapCameraRow);
      payload.counts.cameras = result.total;
    }
    if (types.has('loans')) {
      const result = await resolveLoansNearPoint({ lat, lng, radiusMiles, limit, lite: true });
      payload.loans = result.rows;
      payload.counts.loans = result.total;
    }

    res.json({ success: true, data: payload });
  } catch (e) {
    console.error('❌ Error listing nearby disaster entities:', e);
    res.status(500).json({ success: false, error: 'Failed to list nearby entities', details: e.message });
  }
}

export async function statsDisasters(req, res) {
  try {
    const pool = getPool();
    if (!pool) throw new Error('Database not initialized');
    const bySource = await pool.query(`SELECT source, COUNT(*) as count FROM disasters GROUP BY source ORDER BY count DESC`);
    const byEvent = await pool.query(`SELECT event_type, COUNT(*) as count FROM disasters GROUP BY event_type ORDER BY count DESC`);
    const byState = await pool.query(`SELECT state_abbr, COUNT(*) as count FROM disasters GROUP BY state_abbr ORDER BY count DESC`);
    res.json({ success: true, data: { bySource: bySource.rows, byEvent: byEvent.rows, byState: byState.rows } });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to get stats', details: e.message });
  }
}

export async function exportCsv(req, res) {
  try {
    const pool = getPool();
    if (!pool) throw new Error('Database not initialized');
    const { rows } = await pool.query(`SELECT source,event_type,county_name,state_abbr,start_time,end_time,title,lat,lng FROM disasters ORDER BY start_time DESC LIMIT 5000`);
    const header = 'source,event_type,county_name,state_abbr,start_time,end_time,title,lat,lng\n';
    const csv = rows.map(r => [
      r.source,
      r.event_type,
      (r.county_name||'').replace(/,/g,' '),
      r.state_abbr||'',
      r.start_time ? new Date(r.start_time).toISOString() : '',
      r.end_time ? new Date(r.end_time).toISOString() : '',
      (r.title||'').replace(/,/g,' '),
      r.lat||'',
      r.lng||''
    ].join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="disasters.csv"');
    res.send(header + csv);
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to export CSV', details: e.message });
  }
}

export async function geocodeAddress(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter q is required' });
    }
    const result = await geocodeAddressFree(q);
    const lat = result?.latitude;
    const lng = result?.longitude;
    if (lat == null || lng == null || Number.isNaN(+lat) || Number.isNaN(+lng)) {
      return res.status(404).json({ success: false, error: 'No coordinates found', query: q });
    }
    res.json({
      success: true,
      query: q,
      latitude: +lat,
      longitude: +lng,
      label: result.display_name || q,
    });
  } catch (e) {
    console.error('❌ Disaster geocode error:', e);
    res.status(500).json({ success: false, error: 'Geocoding failed', details: e.message });
  }
}

export default {
  listDisasters,
  refreshDisasters,
  refreshCameras,
  listCameras,
  listNear,
  cameraStats,
  cameraSnapshot,
  statsDisasters,
  exportCsv,
  geocodeAddress,
};


