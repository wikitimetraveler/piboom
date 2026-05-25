/**
 * Live Music Pilgrimage Atlas — read model (v1: Grateful Dead).
 */
import { getPool } from './database.service.js';

export const ATLAS_ARTIST = {
  slug: 'grateful-dead',
  name: 'Grateful Dead',
};

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/** @param {string|object|null|undefined} setlistRaw */
export function parseSetlistPreview(setlistRaw) {
  try {
    const sets = typeof setlistRaw === 'string' ? JSON.parse(setlistRaw) : setlistRaw;
    if (!Array.isArray(sets)) return '';
    const songs = [];
    for (const set of sets) {
      if (set?.song && Array.isArray(set.song)) {
        for (const song of set.song) {
          if (song?.name) songs.push(song.name);
        }
      }
    }
    return songs.slice(0, 10).join(' · ');
  } catch {
    return '';
  }
}

/** @param {Array<{ lat?: number|null, lng?: number|null }>} stops */
export function buildMapBounds(stops) {
  const mapped = stops.filter((s) => s.lat != null && s.lng != null);
  if (!mapped.length) return null;
  let north = mapped[0].lat;
  let south = mapped[0].lat;
  let east = mapped[0].lng;
  let west = mapped[0].lng;
  for (const s of mapped) {
    north = Math.max(north, s.lat);
    south = Math.min(south, s.lat);
    east = Math.max(east, s.lng);
    west = Math.min(west, s.lng);
  }
  return { north, south, east, west };
}

/** @param {object} query */
export function normalizeAtlasQuery(query = {}) {
  const year = query.year ? parseInt(String(query.year), 10) : null;
  const month = query.month ? parseInt(String(query.month), 10) : null;
  const day = query.day ? parseInt(String(query.day), 10) : null;
  const limitRaw = parseInt(String(query.limit || DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offsetRaw = parseInt(String(query.offset || 0), 10);
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

  const mode = ['tour', 'city', 'on_this_date'].includes(String(query.mode || '').toLowerCase())
    ? String(query.mode).toLowerCase()
    : 'tour';

  return {
    year: Number.isFinite(year) ? year : null,
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : null,
    day: Number.isFinite(day) && day >= 1 && day <= 31 ? day : null,
    city: String(query.city || '').trim() || null,
    state: String(query.state || '').trim() || null,
    venue: String(query.venue || '').trim() || null,
    mode,
    limit,
    offset,
    showId: query.showId ? parseInt(String(query.showId), 10) : null,
  };
}

/** @param {object} row DB row */
export function formatStopRow(row, routeOrder = null, personal = null) {
  const lat = row.latitude != null ? parseFloat(row.latitude) : null;
  const lng = row.longitude != null ? parseFloat(row.longitude) : null;
  return {
    id: row.id,
    showDate: row.show_date,
    venueName: row.venue_name,
    city: row.city,
    state: row.state,
    country: row.country,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    setlistPreview: parseSetlistPreview(row.setlist),
    recordingAvailable: !!row.recording_available,
    archiveIdentifier: row.archive_identifier || null,
    notes: row.notes || null,
    routeOrder,
    personal: personal || {
      favorite: false,
      wishlist: false,
      visited: false,
      notes: null,
    },
    enrichments: {
      youtubeSearch: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        `Grateful Dead ${row.venue_name || ''} ${row.show_date || ''}`.trim()
      )}`,
      timeMachineUrl: row.show_date
        ? `/music/music-time-machine.html?date=${String(row.show_date).slice(0, 10)}`
        : null,
    },
  };
}

function buildWhereClause(filters) {
  const clauses = [];
  const params = [];
  let idx = 1;

  if (filters.year) {
    clauses.push(`EXTRACT(YEAR FROM show_date) = $${idx++}`);
    params.push(filters.year);
  }
  if (filters.month) {
    clauses.push(`EXTRACT(MONTH FROM show_date) = $${idx++}`);
    params.push(filters.month);
  }
  if (filters.day) {
    clauses.push(`EXTRACT(DAY FROM show_date) = $${idx++}`);
    params.push(filters.day);
  }
  if (filters.city) {
    clauses.push(`city ILIKE $${idx++}`);
    params.push(`%${filters.city}%`);
  }
  if (filters.state) {
    clauses.push(`state ILIKE $${idx++}`);
    params.push(`%${filters.state}%`);
  }
  if (filters.venue) {
    clauses.push(`venue_name ILIKE $${idx++}`);
    params.push(`%${filters.venue}%`);
  }
  if (filters.showId) {
    clauses.push(`id = $${idx++}`);
    params.push(filters.showId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params, nextIdx: idx };
}

/** @param {string|null} clientId */
async function loadPersonalMap(clientId) {
  if (!clientId) return new Map();
  const pool = getPool();
  if (!pool) return new Map();

  const res = await pool.query(
    `SELECT show_id, bookmark_type, notes
     FROM music_pilgrimage_bookmarks
     WHERE client_id = $1::uuid AND show_id IS NOT NULL`,
    [clientId]
  );

  const byShow = new Map();
  for (const row of res.rows) {
    const existing = byShow.get(row.show_id) || {
      favorite: false,
      wishlist: false,
      visited: false,
      notes: null,
    };
    if (row.bookmark_type === 'favorite') existing.favorite = true;
    if (row.bookmark_type === 'wishlist') existing.wishlist = true;
    if (row.bookmark_type === 'visited') existing.visited = true;
    if (row.notes) existing.notes = row.notes;
    byShow.set(row.show_id, existing);
  }
  return byShow;
}

function personalForShow(personalMap, showId) {
  return (
    personalMap.get(showId) || {
      favorite: false,
      wishlist: false,
      visited: false,
      notes: null,
    }
  );
}

export async function getAtlasOverview() {
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const [totals, dateRange, topVenues, showsByYear, mappedCount] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS total FROM grateful_dead_shows'),
    pool.query(`
      SELECT MIN(show_date) AS first_show, MAX(show_date) AS last_show
      FROM grateful_dead_shows
    `),
    pool.query(`
      SELECT venue_name, city, state, COUNT(*)::int AS show_count,
             MAX(latitude) AS latitude, MAX(longitude) AS longitude
      FROM grateful_dead_shows
      GROUP BY venue_name, city, state
      ORDER BY show_count DESC
      LIMIT 12
    `),
    pool.query(`
      SELECT EXTRACT(YEAR FROM show_date)::int AS year, COUNT(*)::int AS show_count
      FROM grateful_dead_shows
      GROUP BY EXTRACT(YEAR FROM show_date)
      ORDER BY year
    `),
    pool.query(`
      SELECT COUNT(*)::int AS mapped
      FROM grateful_dead_shows
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `),
  ]);

  return {
    artist: ATLAS_ARTIST,
    totalShows: totals.rows[0]?.total || 0,
    mappedShows: mappedCount.rows[0]?.mapped || 0,
    dateRange: dateRange.rows[0] || {},
    topVenues: topVenues.rows.map((v) => ({
      venueName: v.venue_name,
      city: v.city,
      state: v.state,
      showCount: v.show_count,
      lat: v.latitude != null ? parseFloat(v.latitude) : null,
      lng: v.longitude != null ? parseFloat(v.longitude) : null,
    })),
    showsByYear: showsByYear.rows,
  };
}

/**
 * Combined atlas payload: filters, stops, venues summary, map bounds.
 * @param {object} query
 * @param {{ clientId?: string|null }} opts
 */
export async function getAtlasPayload(query = {}, opts = {}) {
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const filters = normalizeAtlasQuery(query);
  const { where, params, nextIdx } = buildWhereClause(filters);

  const countSql = `SELECT COUNT(*)::int AS total FROM grateful_dead_shows ${where}`;
  const countRes = await pool.query(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  const orderBy =
    filters.mode === 'city'
      ? 'venue_name ASC, show_date ASC'
      : 'show_date ASC, venue_name ASC';

  const listSql = `
    SELECT *
    FROM grateful_dead_shows
    ${where}
    ORDER BY ${orderBy}
    LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
  `;
  const listRes = await pool.query(listSql, [...params, filters.limit, filters.offset]);

  const personalMap = await loadPersonalMap(opts.clientId || null);
  const stops = listRes.rows.map((row, i) =>
    formatStopRow(row, filters.offset + i + 1, personalForShow(personalMap, row.id))
  );

  const venueMap = new Map();
  for (const stop of stops) {
    const key = `${stop.venueName}|${stop.city}|${stop.state}`;
    if (!venueMap.has(key)) {
      venueMap.set(key, {
        venueName: stop.venueName,
        city: stop.city,
        state: stop.state,
        showCount: 0,
        lat: stop.lat,
        lng: stop.lng,
        firstShow: stop.showDate,
        lastShow: stop.showDate,
      });
    }
    const v = venueMap.get(key);
    v.showCount += 1;
    if (stop.showDate < v.firstShow) v.firstShow = stop.showDate;
    if (stop.showDate > v.lastShow) v.lastShow = stop.showDate;
  }

  return {
    success: true,
    artist: ATLAS_ARTIST,
    mode: filters.mode,
    filters,
    stats: {
      total,
      returned: stops.length,
      mappedStops: stops.filter((s) => s.lat != null && s.lng != null).length,
    },
    stops,
    venues: Array.from(venueMap.values()).sort((a, b) => b.showCount - a.showCount),
    mapBounds: buildMapBounds(stops),
    pagination: {
      limit: filters.limit,
      offset: filters.offset,
      total,
      hasMore: filters.offset + stops.length < total,
    },
  };
}

export async function getStopDetail(showId, clientId = null) {
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const id = parseInt(String(showId), 10);
  if (!Number.isFinite(id)) throw new Error('Invalid show id');

  const res = await pool.query('SELECT * FROM grateful_dead_shows WHERE id = $1', [id]);
  if (!res.rows.length) return null;

  const personalMap = await loadPersonalMap(clientId);
  const row = res.rows[0];
  const stop = formatStopRow(row, null, personalForShow(personalMap, row.id));

  let setlist = [];
  try {
    setlist = typeof row.setlist === 'string' ? JSON.parse(row.setlist) : row.setlist || [];
  } catch {
    setlist = [];
  }

  const nearbyRes = await pool.query(
    `
    SELECT id, show_date, venue_name, city, state, latitude, longitude
    FROM grateful_dead_shows
    WHERE city = $1 AND state = $2 AND id != $3
    ORDER BY show_date DESC
    LIMIT 8
    `,
    [row.city, row.state, id]
  );

  return {
    ...stop,
    setlist,
    nearbyStops: nearbyRes.rows.map((r, i) => formatStopRow(r, i + 1)),
  };
}

export async function getVenueIndex(query = {}) {
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  const state = String(query.state || '').trim();
  const params = [];
  let where = '';
  if (state) {
    where = 'WHERE state ILIKE $1';
    params.push(`%${state}%`);
  }

  const res = await pool.query(
    `
    SELECT venue_name, city, state,
           COUNT(*)::int AS show_count,
           MIN(show_date) AS first_show,
           MAX(show_date) AS last_show,
           MAX(latitude) AS latitude,
           MAX(longitude) AS longitude
    FROM grateful_dead_shows
    ${where}
    GROUP BY venue_name, city, state
    ORDER BY show_count DESC, venue_name ASC
    LIMIT 100
    `,
    params
  );

  return res.rows.map((v) => ({
    venueName: v.venue_name,
    city: v.city,
    state: v.state,
    showCount: v.show_count,
    firstShow: v.first_show,
    lastShow: v.last_show,
    lat: v.latitude != null ? parseFloat(v.latitude) : null,
    lng: v.longitude != null ? parseFloat(v.longitude) : null,
  }));
}
