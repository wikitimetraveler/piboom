import { getPool } from './database.service.js';
import { randomUUID } from 'crypto';

/** @typedef {'spotted'|'researching'|'acquired'|'keeper'|'resale'|'sold'} FindStatus */

export const FIND_STATUSES = ['spotted', 'researching', 'acquired', 'keeper', 'resale', 'sold'];

export const FIND_CATEGORIES = [
  'art',
  'bags',
  'clothing',
  'vintage_electronics',
  'audio',
  'books',
  'decor',
  'ceramics_glass',
  'sporting',
  'unknown',
];

/** Max bytes per data-URL image (approx) — reject larger to protect DB/API */
export const MAX_FIND_IMAGE_BYTES = 2 * 1024 * 1024;

export function emptyPayload() {
  return {
    images: [],
    acquisition: {
      source: '',
      location: '',
      address: '',
      latitude: null,
      longitude: null,
      placeId: '',
      pricePaid: null,
      date: '',
    },
    identification: {
      maker: '',
      probableMaker: '',
      signed: false,
      numbered: false,
      edition: '',
      medium: '',
      visibleText: '',
      confidence: 0,
    },
    condition: {
      overall: '',
      framed: false,
      notes: '',
    },
    valuation: {
      listingLow: null,
      listingHigh: null,
      realisticLow: null,
      realisticHigh: null,
      confidence: '',
      notes: '',
    },
    notes: '',
    tags: [],
    subcategory: '',
    aiAnalysis: {
      raw: null,
      summaryText: '',
      generatedAt: '',
    },
    voiceNotes: [],
    voiceSummary: {
      text: '',
      audioUrl: '',
      generatedAt: '',
    },
  };
}

/**
 * @param {number} score
 * @returns {'low'|'medium'|'high'}
 */
export function scoreLabelFromScore(score) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  if (s >= 70) return 'high';
  if (s >= 40) return 'medium';
  return 'low';
}

/**
 * Treasure score from payload (0–100).
 * @param {Record<string, unknown>} payload
 */
export function computeTreasureScore(payload) {
  if (!payload || typeof payload !== 'object') return { score: 0, scoreLabel: 'low' };

  let score = 0;
  const id = payload.identification && typeof payload.identification === 'object' ? payload.identification : {};
  const cond = payload.condition && typeof payload.condition === 'object' ? payload.condition : {};
  const val = payload.valuation && typeof payload.valuation === 'object' ? payload.valuation : {};
  const acq = payload.acquisition && typeof payload.acquisition === 'object' ? payload.acquisition : {};

  if (id.signed === true) score += 20;
  if (id.numbered === true) score += 15;
  if (cond.framed === true) score += 10;

  const pricePaid = Number(acq.pricePaid);
  const realisticHigh = Number(val.realisticHigh);
  if (Number.isFinite(pricePaid) && pricePaid > 0 && Number.isFinite(realisticHigh) && realisticHigh >= pricePaid * 2) {
    score += 25;
  }

  const conf = Number(id.confidence);
  if (Number.isFinite(conf) && conf >= 0.7) score += 10;

  const maker = String(id.maker || '').trim().toLowerCase();
  const probable = String(id.probableMaker || '').trim().toLowerCase();
  if (maker && probable) {
    if (maker === probable) score += 10;
    else if (maker.length > 2 && probable.includes(maker)) score += 10;
  }

  const overall = String(cond.overall || '').toLowerCase();
  if (overall === 'poor' || overall === 'damaged' || overall === 'bad') score -= 15;

  score = Math.max(0, Math.min(100, score));
  return { score, scoreLabel: scoreLabelFromScore(score) };
}

function deepMergePayload(base, patch) {
  const out = JSON.parse(JSON.stringify(base));
  if (!patch || typeof patch !== 'object') return out;

  for (const key of Object.keys(patch)) {
    const v = patch[key];
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && typeof out[key] === 'object' && out[key] !== null && !Array.isArray(out[key])) {
      out[key] = deepMergePayload(out[key], v);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function validateImagesInPayload(payload) {
  const images = payload.images;
  if (!Array.isArray(images)) return;
  for (const img of images) {
    const url = typeof img === 'string' ? img : img?.url;
    if (typeof url === 'string' && url.startsWith('data:') && url.length > MAX_FIND_IMAGE_BYTES) {
      throw new Error(`Image exceeds max size (${MAX_FIND_IMAGE_BYTES} bytes)`);
    }
  }
}

function rowToFind(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: row.category,
    status: row.status,
    score: row.score,
    scoreLabel: row.score_label,
    payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listFinds(userId, { limit = 200 } = {}) {
  const pool = getPool();
  if (!pool) throw new ServiceUnavailableError('Database not available');
  const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const result = await pool.query(
    `SELECT * FROM finds WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2`,
    [userId, lim]
  );
  return result.rows.map(rowToFind);
}

export async function getFind(userId, id) {
  const pool = getPool();
  if (!pool) throw new ServiceUnavailableError('Database not available');
  const result = await pool.query(`SELECT * FROM finds WHERE id = $1 AND user_id = $2`, [id, userId]);
  return rowToFind(result.rows[0]) || null;
}

export class ServiceUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ServiceUnavailableError';
    this.statusCode = 503;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

/**
 * @param {string} userId
 * @param {object} body
 */
export async function createFind(userId, body) {
  const pool = getPool();
  if (!pool) throw new ServiceUnavailableError('Database not available');

  const title = String(body.title || 'Untitled find').slice(0, 500);
  let category = String(body.category || 'unknown').slice(0, 100);
  if (!FIND_CATEGORIES.includes(category)) category = 'unknown';

  let status = String(body.status || 'researching').slice(0, 50);
  if (!FIND_STATUSES.includes(status)) status = 'researching';

  const base = emptyPayload();
  const payload = deepMergePayload(base, body.payload || {});
  validateImagesInPayload(payload);

  const { score, scoreLabel } = computeTreasureScore(payload);

  const result = await pool.query(
    `INSERT INTO finds (user_id, title, category, status, score, score_label, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [userId, title, category, status, score, scoreLabel, JSON.stringify(payload)]
  );
  return rowToFind(result.rows[0]);
}

/**
 * @param {string} userId
 * @param {number|string} id
 * @param {object} body
 */
export async function updateFind(userId, id, body) {
  const pool = getPool();
  if (!pool) throw new ServiceUnavailableError('Database not available');

  const existing = await getFind(userId, id);
  if (!existing) throw new NotFoundError('Find not found');

  let title = existing.title;
  if (body.title !== undefined) title = String(body.title).slice(0, 500);

  let category = existing.category;
  if (body.category !== undefined) {
    category = String(body.category).slice(0, 100);
    if (!FIND_CATEGORIES.includes(category)) category = 'unknown';
  }

  let status = existing.status;
  if (body.status !== undefined) {
    status = String(body.status).slice(0, 50);
    if (!FIND_STATUSES.includes(status)) throw new ValidationError('Invalid status');
  }

  let payload = existing.payload;
  if (body.payload !== undefined) {
    const base = deepMergePayload(emptyPayload(), existing.payload);
    payload = deepMergePayload(base, body.payload);
    validateImagesInPayload(payload);
  }

  const { score, scoreLabel } = computeTreasureScore(payload);

  const result = await pool.query(
    `UPDATE finds SET title = $1, category = $2, status = $3, score = $4, score_label = $5,
     payload = $6::jsonb, updated_at = CURRENT_TIMESTAMP
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
    [title, category, status, score, scoreLabel, JSON.stringify(payload), id, userId]
  );
  if (!result.rows.length) throw new NotFoundError('Find not found');
  return rowToFind(result.rows[0]);
}

export async function deleteFind(userId, id) {
  const pool = getPool();
  if (!pool) throw new ServiceUnavailableError('Database not available');
  const result = await pool.query(`DELETE FROM finds WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId]);
  if (!result.rows.length) throw new NotFoundError('Find not found');
  return { deleted: id };
}

export async function appendVoiceNote(userId, id, { transcript, type = 'note', audioUrl = '' }) {
  const existing = await getFind(userId, id);
  if (!existing) throw new NotFoundError('Find not found');

  const note = {
    id: randomUUID(),
    type: String(type).slice(0, 50),
    transcript: String(transcript || '').slice(0, 20000),
    audioUrl: String(audioUrl || '').slice(0, 500000),
    createdAt: new Date().toISOString(),
  };

  const payload = deepMergePayload(emptyPayload(), existing.payload);
  if (!Array.isArray(payload.voiceNotes)) payload.voiceNotes = [];
  payload.voiceNotes.push(note);

  const pool = getPool();
  if (!pool) throw new ServiceUnavailableError('Database not available');
  const { score, scoreLabel } = computeTreasureScore(payload);

  const result = await pool.query(
    `UPDATE finds SET payload = $1::jsonb, score = $2, score_label = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 AND user_id = $5
     RETURNING *`,
    [JSON.stringify(payload), score, scoreLabel, id, userId]
  );
  return rowToFind(result.rows[0]);
}
