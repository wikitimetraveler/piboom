import { getPool } from './database.service.js';

const VALID_ENV = new Set(['correspondent', 'retail']);

const ALLOWED_KEYS = new Set([
  'processorsJson',
  'rulesJson',
  'roleConfigJson',
  'pipelineLimit',
  'delayMs',
  'complexityMode',
  'complexityAiModel',
  'complexityMaxPoints',
  'allowIneligibleOverride',
  'globalTargetUtilization',
  'capacityWeightingMode',
  'capacityWeightFactor',
  'hardLoanThreshold',
  'hardLoanWeightMultiplier',
]);

/**
 * @param {string} [encompassEnv]
 * @returns {string}
 */
export function normalizeProcessorAssignmentEnv(encompassEnv) {
  const e = `${encompassEnv ?? ''}`.toLowerCase().trim();
  return VALID_ENV.has(e) ? e : 'correspondent';
}

/**
 * @param {object} raw
 * @returns {object}
 */
export function pickAllowedConfigPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const key of ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      const v = raw[key];
      if (v === undefined) continue;
      if (typeof v === 'string' || typeof v === 'number' || v === null) {
        out[key] = v === null ? '' : `${v}`;
      }
    }
  }
  return out;
}

/**
 * @param {string} encompassEnv
 * @returns {Promise<{ config: object|null, updatedAt: string|null }>}
 */
export async function getProcessorAssignmentToolConfig(encompassEnv) {
  const env = normalizeProcessorAssignmentEnv(encompassEnv);
  const pool = getPool();
  if (!pool) {
    const err = new Error('Database is not configured (DATABASE_URL)');
    err.statusCode = 503;
    throw err;
  }
  const r = await pool.query(
    `SELECT payload, updated_at FROM processor_assignment_tool_config WHERE encompass_env = $1`,
    [env],
  );
  if (!r.rows.length) {
    return { config: null, updatedAt: null };
  }
  const row = r.rows[0];
  const payload = row.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
  return {
    config: payload,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

/**
 * Merge partial payload into existing row (or create).
 * @param {string} encompassEnv
 * @param {object} partial
 * @returns {Promise<{ config: object, updatedAt: string|null }>}
 */
export async function saveProcessorAssignmentToolConfig(encompassEnv, partial) {
  const env = normalizeProcessorAssignmentEnv(encompassEnv);
  const pool = getPool();
  if (!pool) {
    const err = new Error('Database is not configured (DATABASE_URL)');
    err.statusCode = 503;
    throw err;
  }

  const patch = pickAllowedConfigPayload(partial);
  const existing = await pool.query(
    `SELECT payload FROM processor_assignment_tool_config WHERE encompass_env = $1`,
    [env],
  );
  const prev =
    existing.rows[0]?.payload && typeof existing.rows[0].payload === 'object'
      ? { ...existing.rows[0].payload }
      : {};
  const merged = { ...prev, ...patch };

  if (merged.processorsJson != null && `${merged.processorsJson}`.trim() !== '') {
    try {
      const parsed = JSON.parse(merged.processorsJson);
      if (!Array.isArray(parsed)) {
        const err = new Error('processorsJson must be a JSON array');
        err.statusCode = 400;
        throw err;
      }
    } catch (e) {
      if (e.statusCode === 400) throw e;
      const err = new Error(`processorsJson is not valid JSON: ${e.message}`);
      err.statusCode = 400;
      throw err;
    }
  }

  const r = await pool.query(
    `INSERT INTO processor_assignment_tool_config (encompass_env, payload, updated_at)
     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (encompass_env) DO UPDATE SET
       payload = EXCLUDED.payload,
       updated_at = CURRENT_TIMESTAMP
     RETURNING payload, updated_at`,
    [env, JSON.stringify(merged)],
  );

  const row = r.rows[0];
  return {
    config: row.payload && typeof row.payload === 'object' ? { ...row.payload } : {},
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}
