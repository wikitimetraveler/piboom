/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Persist forward-geocode results for Lane genealogy (/api/genealogy/geocode-address).
 * Keyed by normalized resolved query string — avoids repeating Mapbox/Nominatim on every site load.
 */

import { getPool } from './database.service.js';

const MAX_QUERY_KEY_CHARS = 2048;

/**
 * Canonical cache key — must match whatever is sent to geocode APIs after resolveGenealogyGeocodeQuery.
 */
export function normalizeGenealogyGeocodeCacheKey(resolvedQuery) {
  if (!resolvedQuery || typeof resolvedQuery !== 'string') return '';
  const t = resolvedQuery.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return '';
  return t.length > MAX_QUERY_KEY_CHARS ? t.slice(0, MAX_QUERY_KEY_CHARS) : t;
}

/**
 * @returns {Promise<{latitude:number,longitude:number,display_name:string|null,source:string}|{is_miss:true}|null>}
 */
export async function getGenealogyForwardGeocodeFromCache(cacheKey) {
  if (!cacheKey) return null;
  const pool = getPool();
  if (!pool) return null;
  try {
    const { rows } = await pool.query(
      `SELECT latitude, longitude, display_name, source, is_miss
       FROM genealogy_forward_geocode_cache
       WHERE query_key = $1
       LIMIT 1`,
      [cacheKey]
    );
    const row = rows[0];
    if (!row) return null;
    if (row.is_miss) return { is_miss: true };
    const lat = row.latitude != null ? parseFloat(row.latitude) : NaN;
    const lng = row.longitude != null ? parseFloat(row.longitude) : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return {
      latitude: lat,
      longitude: lng,
      display_name: row.display_name,
      source: row.source || 'postgres-cache'
    };
  } catch {
    return null;
  }
}

export async function upsertGenealogyForwardGeocodeHit(cacheKey, { latitude, longitude, display_name = null, source = 'forward-geocode' }) {
  if (!cacheKey) return;
  const pool = getPool();
  if (!pool) return;
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;
  try {
    await pool.query(
      `INSERT INTO genealogy_forward_geocode_cache (query_key, latitude, longitude, display_name, source, is_miss, updated_at)
       VALUES ($1, $2, $3, $4, $5, FALSE, NOW())
       ON CONFLICT (query_key) DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         display_name = EXCLUDED.display_name,
         source = EXCLUDED.source,
         is_miss = FALSE,
         updated_at = NOW()`,
      [cacheKey, lat, lng, display_name, String(source)]
    );
  } catch {
    /* optional cache — ignore failures */
  }
}

/** Remember failed lookups so we do not hammer Mapbox on every load. */
export async function upsertGenealogyForwardGeocodeMiss(cacheKey) {
  if (!cacheKey) return;
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO genealogy_forward_geocode_cache (query_key, latitude, longitude, display_name, source, is_miss, updated_at)
       VALUES ($1, NULL, NULL, NULL, 'miss', TRUE, NOW())
       ON CONFLICT (query_key) DO UPDATE SET
         is_miss = TRUE,
         updated_at = NOW()`,
      [cacheKey]
    );
  } catch {
    /* optional */
  }
}
