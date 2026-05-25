/**
 * Personal bookmarks and saved routes for Music Pilgrimage Atlas.
 */
import { getPool } from './database.service.js';

export const CLIENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const BOOKMARK_TYPES = ['favorite', 'wishlist', 'visited'];

export function isValidClientId(value) {
  return typeof value === 'string' && CLIENT_ID_RE.test(value.trim());
}

export function normalizeBookmarkType(value) {
  const t = String(value || '').trim().toLowerCase();
  return BOOKMARK_TYPES.includes(t) ? t : null;
}

export function normalizeRouteLabel(value) {
  const label = String(value || '').trim();
  if (!label) return null;
  return label.slice(0, 120);
}

export function normalizeRouteConfig(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const allowed = ['year', 'month', 'day', 'city', 'state', 'venue', 'mode'];
  const out = {};
  for (const key of allowed) {
    if (raw[key] != null && raw[key] !== '') out[key] = raw[key];
  }
  return out;
}

export async function initMusicPilgrimageSchema() {
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS music_pilgrimage_bookmarks (
      id SERIAL PRIMARY KEY,
      client_id UUID NOT NULL,
      show_id INTEGER REFERENCES grateful_dead_shows(id) ON DELETE CASCADE,
      venue_name VARCHAR(255),
      city VARCHAR(255),
      state VARCHAR(100),
      bookmark_type VARCHAR(20) NOT NULL CHECK (bookmark_type IN ('favorite', 'wishlist', 'visited')),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CHECK (
        show_id IS NOT NULL
        OR (venue_name IS NOT NULL AND city IS NOT NULL)
      )
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_bookmarks_show_unique
    ON music_pilgrimage_bookmarks (client_id, show_id, bookmark_type)
    WHERE show_id IS NOT NULL
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_bookmarks_venue_unique
    ON music_pilgrimage_bookmarks (client_id, venue_name, city, state, bookmark_type)
    WHERE show_id IS NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mp_bookmarks_client ON music_pilgrimage_bookmarks(client_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS music_pilgrimage_saved_routes (
      id SERIAL PRIMARY KEY,
      client_id UUID NOT NULL,
      label VARCHAR(120) NOT NULL,
      filter_config JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mp_routes_client ON music_pilgrimage_saved_routes(client_id)
  `);
}

export async function listBookmarks(clientId) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  await initMusicPilgrimageSchema();
  const pool = getPool();

  const res = await pool.query(
    `
    SELECT b.*,
           g.show_date, g.venue_name AS show_venue_name, g.city AS show_city, g.state AS show_state
    FROM music_pilgrimage_bookmarks b
    LEFT JOIN grateful_dead_shows g ON g.id = b.show_id
    WHERE b.client_id = $1::uuid
    ORDER BY b.updated_at DESC
    `,
    [clientId.trim()]
  );

  return res.rows.map((row) => ({
    id: row.id,
    bookmarkType: row.bookmark_type,
    showId: row.show_id,
    venueName: row.show_id ? row.show_venue_name : row.venue_name,
    city: row.show_id ? row.show_city : row.city,
    state: row.show_id ? row.show_state : row.state,
    showDate: row.show_date || null,
    notes: row.notes || null,
    updatedAt: row.updated_at,
  }));
}

export async function upsertBookmark(clientId, payload = {}) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  const bookmarkType = normalizeBookmarkType(payload.bookmarkType);
  if (!bookmarkType) throw new Error('Invalid bookmarkType');

  await initMusicPilgrimageSchema();
  const pool = getPool();

  const showId = payload.showId ? parseInt(String(payload.showId), 10) : null;
  const venueName = String(payload.venueName || '').trim() || null;
  const city = String(payload.city || '').trim() || null;
  const state = String(payload.state || '').trim() || null;
  const notes = payload.notes != null ? String(payload.notes).slice(0, 2000) : null;

  if (showId) {
    const res = await pool.query(
      `
      INSERT INTO music_pilgrimage_bookmarks (client_id, show_id, bookmark_type, notes)
      VALUES ($1::uuid, $2, $3, $4)
      ON CONFLICT (client_id, show_id, bookmark_type) WHERE show_id IS NOT NULL
      DO UPDATE SET notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [clientId.trim(), showId, bookmarkType, notes]
    );
    return res.rows[0];
  }

  if (!venueName || !city) throw new Error('venueName and city required for venue bookmark');

  const res = await pool.query(
    `
    INSERT INTO music_pilgrimage_bookmarks
      (client_id, venue_name, city, state, bookmark_type, notes)
    VALUES ($1::uuid, $2, $3, $4, $5, $6)
    ON CONFLICT (client_id, venue_name, city, state, bookmark_type) WHERE show_id IS NULL
    DO UPDATE SET notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [clientId.trim(), venueName, city, state, bookmarkType, notes]
  );
  return res.rows[0];
}

export async function deleteBookmark(clientId, bookmarkId) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  const id = parseInt(String(bookmarkId), 10);
  if (!Number.isFinite(id)) throw new Error('Invalid bookmark id');

  await initMusicPilgrimageSchema();
  const pool = getPool();
  const res = await pool.query(
    `DELETE FROM music_pilgrimage_bookmarks WHERE id = $1 AND client_id = $2::uuid RETURNING id`,
    [id, clientId.trim()]
  );
  return res.rows[0] || null;
}

export async function listSavedRoutes(clientId) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  await initMusicPilgrimageSchema();
  const pool = getPool();

  const res = await pool.query(
    `SELECT id, label, filter_config, created_at, updated_at
     FROM music_pilgrimage_saved_routes
     WHERE client_id = $1::uuid
     ORDER BY updated_at DESC`,
    [clientId.trim()]
  );

  return res.rows.map((row) => ({
    id: row.id,
    label: row.label,
    filterConfig: row.filter_config || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveRoute(clientId, labelRaw, configRaw) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  const label = normalizeRouteLabel(labelRaw);
  if (!label) throw new Error('Route label is required');

  await initMusicPilgrimageSchema();
  const pool = getPool();
  const filterConfig = normalizeRouteConfig(configRaw);

  const res = await pool.query(
    `
    INSERT INTO music_pilgrimage_saved_routes (client_id, label, filter_config)
    VALUES ($1::uuid, $2, $3::jsonb)
    RETURNING *
    `,
    [clientId.trim(), label, JSON.stringify(filterConfig)]
  );
  return {
    id: res.rows[0].id,
    label: res.rows[0].label,
    filterConfig: res.rows[0].filter_config,
  };
}

export async function deleteSavedRoute(clientId, routeId) {
  if (!isValidClientId(clientId)) throw new Error('Invalid clientId');
  const id = parseInt(String(routeId), 10);
  if (!Number.isFinite(id)) throw new Error('Invalid route id');

  await initMusicPilgrimageSchema();
  const pool = getPool();
  const res = await pool.query(
    `DELETE FROM music_pilgrimage_saved_routes WHERE id = $1 AND client_id = $2::uuid RETURNING id`,
    [id, clientId.trim()]
  );
  return res.rows[0] || null;
}
