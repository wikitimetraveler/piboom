/**
 * Development work by David Lane
 */
import { getPool } from './database.service.js';

const DEFAULT_CLIENT_ID = 'default';

function normalizeClientId(clientId) {
  const id = String(clientId || DEFAULT_CLIENT_ID).trim();
  return id || DEFAULT_CLIENT_ID;
}

/**
 * @param {string} [clientId]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getLearnHints(clientId) {
  const pool = getPool();
  const cid = normalizeClientId(clientId);
  if (!pool) return {};

  const result = await pool.query(
    `SELECT hints FROM unit_test_learn_hints WHERE client_id = $1`,
    [cid],
  );
  if (!result.rows.length) return {};
  const hints = result.rows[0].hints;
  return hints && typeof hints === 'object' ? hints : {};
}

/**
 * @param {string} [clientId]
 * @param {Record<string, unknown>} hints
 */
export async function saveLearnHints(clientId, hints) {
  const pool = getPool();
  const cid = normalizeClientId(clientId);
  if (!pool) {
    throw new Error('Database not available');
  }
  const payload = hints && typeof hints === 'object' ? hints : {};
  await pool.query(
    `INSERT INTO unit_test_learn_hints (client_id, hints, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (client_id)
     DO UPDATE SET hints = EXCLUDED.hints, updated_at = CURRENT_TIMESTAMP`,
    [cid, JSON.stringify(payload)],
  );
  return payload;
}
