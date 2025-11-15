import { getPool } from '../services/database.service.js';
import { initDisastersSchema, upsertDisasters, normalizeFemaV2ToUnified, ingestFema, ingestFirmsNrt, ingestUsgsQuakes, ingestNwsCap, ingestNhc, ingestCaFireCameras } from '../services/disasters.service.js';

// Ensure schema on startup (best-effort)
initDisastersSchema().catch(() => {});

export async function listDisasters(req, res) {
  try {
    const { state, county, source, event, since } = req.query;
    const pool = getPool();
    if (!pool) throw new Error('Database not initialized');

    const clauses = [];
    const values = [];
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
    // Remove LIMIT to get all disasters - real-time data from database
    const sql = `SELECT * FROM disasters ${where} ORDER BY start_time DESC`;
    console.log('📊 Querying disasters:', sql, 'Values:', values);
    const { rows } = await pool.query(sql, values);
    
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
    res.json({ success: true, data: { disasters: rows, count: rows.length } });
  } catch (e) {
    console.error('❌ Error listing disasters:', e);
    res.status(500).json({ success: false, error: 'Failed to list disasters', details: e.message });
  }
}

export async function refreshDisasters(req, res) {
  try {
    const results = {};
    results.fema = await ingestFema();
    results.firms = await ingestFirmsNrt();
    results.usgs = await ingestUsgsQuakes();
    results.nws = await ingestNwsCap();
    results.nhc = await ingestNhc();
    results.cameras = await ingestCaFireCameras();
    res.json({ success: true, message: 'Refreshed disasters', data: results });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to refresh disasters', details: e.message });
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
  statsDisasters,
  exportCsv,
};


