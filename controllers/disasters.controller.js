import { getPool } from '../services/database.service.js';
import { initDisastersSchema, upsertDisasters, normalizeFemaV2ToUnified, ingestFema, ingestFirmsNrt, ingestUsgsQuakes, ingestNwsCap, ingestNhc, ingestCaFireCameras } from '../services/disasters.service.js';
import { geocodeCountyStateWithCache } from '../services/geocoding-cache.service.js';
import { refreshDisasterImpactGraphFromCurrentData } from '../services/disaster-impact-graph.service.js';

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
    console.log('📹 Manual camera feed refresh requested');
    const result = await ingestCaFireCameras();
    res.json({ 
      success: true, 
      message: 'Camera feed refreshed', 
      data: result,
      warning: 'Camera feed creates many records. Use sparingly for review purposes only.'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to refresh camera feed', details: e.message });
  }
}

export async function listCameras(req, res) {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const pool = getPool();
    if (!pool) throw new Error('Database not initialized');
    
    // Get camera records
    const camerasResult = await pool.query(`
      SELECT 
        id, source, event_type, county_name, state_abbr,
        start_time, title, lat, lng, source_id, raw
      FROM disasters
      WHERE source = 'alertcalifornia' AND event_type = 'camera'
      ORDER BY start_time DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);
    
    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM disasters
      WHERE source = 'alertcalifornia' AND event_type = 'camera'
    `);
    
    res.json({ 
      success: true, 
      data: { 
        cameras: camerasResult.rows, 
        count: camerasResult.rows.length,
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      } 
    });
  } catch (e) {
    console.error('❌ Error listing cameras:', e);
    res.status(500).json({ success: false, error: 'Failed to list cameras', details: e.message });
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

export default {
  listDisasters,
  refreshDisasters,
  refreshCameras,
  listCameras,
  statsDisasters,
  exportCsv,
};


