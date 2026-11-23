/**
 * Governor / federal disaster declarations desk — editable working list.
 * Federal DR/EM/FM rows come from live OpenFEMA (same cadence as the disaster feed).
 * Governor orders are staff-entered real executive orders (no static seed file).
 * Development work by David Lane
 */
import crypto from 'node:crypto';
import { getPool } from './database.service.js';

export const DECLARATION_KINDS = Object.freeze([
  'governor_order',
  'federal_dr',
  'federal_em',
  'federal_fm',
]);

export const DECLARATION_SOURCES = Object.freeze(['openfema', 'manual']);

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS governor_disaster_declarations (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('governor_order', 'federal_dr', 'federal_em', 'federal_fm')),
  state CHAR(2) NOT NULL,
  declared_date DATE NOT NULL,
  declaration_id TEXT,
  incident_title TEXT NOT NULL,
  incident_begin_date DATE,
  area_summary TEXT,
  source_url TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('openfema', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_decl_declared_date
  ON governor_disaster_declarations (declared_date DESC);
CREATE INDEX IF NOT EXISTS idx_gov_decl_state
  ON governor_disaster_declarations (state);
CREATE INDEX IF NOT EXISTS idx_gov_decl_kind
  ON governor_disaster_declarations (kind);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gov_decl_declaration_id_unique
  ON governor_disaster_declarations (declaration_id)
  WHERE declaration_id IS NOT NULL AND declaration_id <> '';
`;

/** @type {Map<string, object>} */
const memoryRows = new Map();
let memoryReady = false;

function declarationError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function asDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function dateOnly(v) {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  return asDate(v);
}

function normalizeState(v) {
  const s = String(v || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(s)) return null;
  return s;
}

function normalizeKind(v) {
  const k = String(v || '')
    .trim()
    .toLowerCase();
  return DECLARATION_KINDS.includes(k) ? k : null;
}

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function requireTitle(v) {
  const t = String(v || '').trim();
  if (!t) throw declarationError('TITLE_REQUIRED');
  return t;
}

function normalizeSource(v, fallback = 'manual') {
  const s = String(v || '')
    .trim()
    .toLowerCase();
  return DECLARATION_SOURCES.includes(s) ? s : fallback;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    state: row.state,
    declaredDate: dateOnly(row.declared_date ?? row.declaredDate),
    declarationId: row.declaration_id ?? row.declarationId ?? null,
    incidentTitle: row.incident_title ?? row.incidentTitle,
    incidentBeginDate: dateOnly(row.incident_begin_date ?? row.incidentBeginDate),
    areaSummary: row.area_summary ?? row.areaSummary ?? null,
    sourceUrl: row.source_url ?? row.sourceUrl ?? null,
    notes: row.notes ?? null,
    source: normalizeSource(row.source, 'manual'),
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function normalizeInput(body = {}, { partial = false } = {}) {
  const out = {};

  if (!partial || body.kind !== undefined) {
    const kind = normalizeKind(body.kind);
    if (!kind) throw declarationError('KIND_INVALID');
    out.kind = kind;
  }

  if (!partial || body.state !== undefined) {
    const state = normalizeState(body.state);
    if (!state) throw declarationError('STATE_INVALID');
    out.state = state;
  }

  if (!partial || body.declaredDate !== undefined) {
    const declaredDate = asDate(body.declaredDate);
    if (!declaredDate) throw declarationError('DATE_INVALID');
    out.declaredDate = declaredDate;
  }

  if (!partial || body.incidentTitle !== undefined) {
    out.incidentTitle = requireTitle(body.incidentTitle);
  }

  if (!partial || body.declarationId !== undefined) {
    out.declarationId = trimOrNull(body.declarationId);
  }

  if (!partial || body.incidentBeginDate !== undefined) {
    if (body.incidentBeginDate == null || body.incidentBeginDate === '') {
      out.incidentBeginDate = null;
    } else {
      const begin = asDate(body.incidentBeginDate);
      if (!begin) throw declarationError('DATE_INVALID');
      out.incidentBeginDate = begin;
    }
  }

  if (!partial || body.areaSummary !== undefined) {
    out.areaSummary = trimOrNull(body.areaSummary);
  }
  if (!partial || body.sourceUrl !== undefined) {
    out.sourceUrl = trimOrNull(body.sourceUrl);
  }
  if (!partial || body.notes !== undefined) {
    out.notes = trimOrNull(body.notes);
  }

  return out;
}

function ensureMemoryReady() {
  memoryReady = true;
}

export async function initGovernorDeclarationsSchema() {
  const pool = getPool();
  if (!pool) {
    console.warn('⚠️  Database pool not initialized; governor_disaster_declarations schema skipped (memory mode)');
    ensureMemoryReady();
    return { mode: 'memory', count: memoryRows.size };
  }
  await pool.query(CREATE_SQL);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'governor_disaster_declarations' AND column_name = 'source'
      ) THEN
        ALTER TABLE governor_disaster_declarations
          ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
          CHECK (source IN ('openfema', 'manual'));
      END IF;
    END $$;
  `);
  // Drop prior static-seed federal rows; live OpenFEMA sync replaces them.
  const purgedFederal = await pool.query(`
    DELETE FROM governor_disaster_declarations
    WHERE kind IN ('federal_dr', 'federal_em', 'federal_fm')
      AND COALESCE(source, 'manual') = 'manual'
  `);
  // Drop research-seed governor EO placeholders (staff re-add real orders as needed).
  const purgedGov = await pool.query(`
    DELETE FROM governor_disaster_declarations
    WHERE kind = 'governor_order'
      AND declaration_id IN (
        'EO 26-232', 'EO 2026-09', 'EO 11.05.26.01', 'EO 26-227',
        'EO 63', 'EO 26-13', 'Statewide Disaster Emergency'
      )
  `);
  const countRes = await pool.query('SELECT COUNT(*)::int AS n FROM governor_disaster_declarations');
  const n = countRes.rows[0]?.n ?? 0;
  console.log(
    `✅ Governor declarations schema ensured (${n} rows; purged federal seed ${purgedFederal.rowCount || 0}, seed governor orders ${purgedGov.rowCount || 0})`
  );
  return {
    mode: 'postgres',
    count: n,
    purgedFederalSeed: purgedFederal.rowCount || 0,
    purgedGovernorSeed: purgedGov.rowCount || 0,
  };
}

/**
 * List declarations. Filters: since (YYYY-MM-DD), state, kind.
 * Default since = three months before today when since is omitted.
 */
export async function listGovernorDeclarations(filters = {}) {
  const pool = getPool();
  const since =
    filters.since === null || filters.since === ''
      ? null
      : filters.since
        ? asDate(filters.since)
        : threeMonthsAgoIso();
  if (filters.since && !since && filters.since !== null && filters.since !== '') {
    throw declarationError('DATE_INVALID');
  }
  const state = filters.state ? normalizeState(filters.state) : null;
  if (filters.state && !state) throw declarationError('STATE_INVALID');
  const kind = filters.kind ? normalizeKind(filters.kind) : null;
  if (filters.kind && !kind) throw declarationError('KIND_INVALID');

  if (!pool) {
    ensureMemoryReady();
    let rows = [...memoryRows.values()].map(mapRow);
    if (since) rows = rows.filter((r) => r.declaredDate >= since);
    if (state) rows = rows.filter((r) => r.state === state);
    if (kind) rows = rows.filter((r) => r.kind === kind);
    rows.sort((a, b) => {
      const d = String(b.declaredDate).localeCompare(String(a.declaredDate));
      if (d) return d;
      return String(b.id).localeCompare(String(a.id));
    });
    return rows;
  }

  const clauses = [];
  const params = [];
  if (since) {
    params.push(since);
    clauses.push(`declared_date >= $${params.length}`);
  }
  if (state) {
    params.push(state);
    clauses.push(`state = $${params.length}`);
  }
  if (kind) {
    params.push(kind);
    clauses.push(`kind = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const res = await pool.query(
    `SELECT * FROM governor_disaster_declarations ${where}
     ORDER BY declared_date DESC, id DESC`,
    params
  );
  return res.rows.map(mapRow);
}

export async function getGovernorDeclaration(id) {
  const key = String(id || '');
  if (!key) return null;
  const pool = getPool();
  if (!pool) {
    ensureMemoryReady();
    return mapRow(memoryRows.get(key) || null);
  }
  const res = await pool.query('SELECT * FROM governor_disaster_declarations WHERE id = $1', [key]);
  return mapRow(res.rows[0] || null);
}

export async function createGovernorDeclaration(body = {}) {
  const n = normalizeInput(body);
  const now = new Date().toISOString();
  const source = normalizeSource(body.source, 'manual');
  const row = {
    id: crypto.randomUUID(),
    kind: n.kind,
    state: n.state,
    declaredDate: n.declaredDate,
    declarationId: n.declarationId ?? null,
    incidentTitle: n.incidentTitle,
    incidentBeginDate: n.incidentBeginDate ?? null,
    areaSummary: n.areaSummary ?? null,
    sourceUrl: n.sourceUrl ?? null,
    notes: n.notes ?? null,
    source,
    createdAt: now,
    updatedAt: now,
  };

  const pool = getPool();
  if (!pool) {
    ensureMemoryReady();
    memoryRows.set(row.id, row);
    return mapRow(row);
  }

  await pool.query(
    `INSERT INTO governor_disaster_declarations (
      id, kind, state, declared_date, declaration_id, incident_title,
      incident_begin_date, area_summary, source_url, notes, source, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      row.id,
      row.kind,
      row.state,
      row.declaredDate,
      row.declarationId,
      row.incidentTitle,
      row.incidentBeginDate,
      row.areaSummary,
      row.sourceUrl,
      row.notes,
      row.source,
      row.createdAt,
      row.updatedAt,
    ]
  );
  return getGovernorDeclaration(row.id);
}

export async function updateGovernorDeclaration(id, body = {}) {
  const existing = await getGovernorDeclaration(id);
  if (!existing) return null;

  const patch = normalizeInput(body, { partial: true });
  const next = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  const pool = getPool();
  if (!pool) {
    memoryRows.set(existing.id, {
      id: next.id,
      kind: next.kind,
      state: next.state,
      declaredDate: next.declaredDate,
      declarationId: next.declarationId,
      incidentTitle: next.incidentTitle,
      incidentBeginDate: next.incidentBeginDate,
      areaSummary: next.areaSummary,
      sourceUrl: next.sourceUrl,
      notes: next.notes,
      source: next.source || existing.source || 'manual',
      createdAt: existing.createdAt,
      updatedAt: next.updatedAt,
    });
    return mapRow(memoryRows.get(existing.id));
  }

  await pool.query(
    `UPDATE governor_disaster_declarations SET
      kind = $2,
      state = $3,
      declared_date = $4,
      declaration_id = $5,
      incident_title = $6,
      incident_begin_date = $7,
      area_summary = $8,
      source_url = $9,
      notes = $10,
      updated_at = NOW()
    WHERE id = $1`,
    [
      existing.id,
      next.kind,
      next.state,
      next.declaredDate,
      next.declarationId,
      next.incidentTitle,
      next.incidentBeginDate,
      next.areaSummary,
      next.sourceUrl,
      next.notes,
    ]
  );
  return getGovernorDeclaration(existing.id);
}

export async function deleteGovernorDeclaration(id) {
  const existing = await getGovernorDeclaration(id);
  if (!existing) return false;
  const pool = getPool();
  if (!pool) {
    memoryRows.delete(existing.id);
    return true;
  }
  await pool.query('DELETE FROM governor_disaster_declarations WHERE id = $1', [existing.id]);
  return true;
}

export function threeMonthsAgoIso(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() - 3);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function kindFromFemaType(declarationType) {
  const t = String(declarationType || '')
    .trim()
    .toUpperCase();
  if (t === 'DR') return 'federal_dr';
  if (t === 'EM') return 'federal_em';
  if (t === 'FM' || t === 'FS') return 'federal_fm';
  return null;
}

function titleCaseWords(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Collapse OpenFEMA county rows into one desk row per declaration.
 * Exported for unit tests.
 */
export function aggregateOpenFemaDeclarations(rows = []) {
  /** @type {Map<string, object>} */
  const byId = new Map();
  for (const item of rows) {
    const declarationId =
      trimOrNull(item.femaDeclarationString) ||
      (item.disasterNumber != null && item.state
        ? `${String(item.declarationType || 'DR').toUpperCase()}-${item.disasterNumber}-${String(item.state).toUpperCase()}`
        : null);
    if (!declarationId) continue;
    const kind = kindFromFemaType(item.declarationType);
    if (!kind) continue;
    const state = normalizeState(item.state);
    if (!state) continue;
    const declaredDate = asDate(item.declarationDate);
    if (!declaredDate) continue;

    const titleRaw = trimOrNull(item.declarationTitle) || trimOrNull(item.incidentType) || 'Disaster declaration';
    const incidentTitle = titleCaseWords(titleRaw);
    const incidentBeginDate = asDate(item.incidentBeginDate);
    const areaName =
      trimOrNull(item.designatedArea) ||
      (trimOrNull(item.county) ? `${trimOrNull(item.county)} County` : null);
    const disasterNumber = item.disasterNumber != null ? String(item.disasterNumber) : null;
    const sourceUrl = disasterNumber ? `https://www.fema.gov/disaster/${disasterNumber}` : null;

    let agg = byId.get(declarationId);
    if (!agg) {
      agg = {
        kind,
        state,
        declaredDate,
        declarationId,
        incidentTitle,
        incidentBeginDate,
        areas: new Set(),
        sourceUrl,
      };
      byId.set(declarationId, agg);
    } else {
      if (declaredDate < agg.declaredDate) agg.declaredDate = declaredDate;
      if (incidentBeginDate && (!agg.incidentBeginDate || incidentBeginDate < agg.incidentBeginDate)) {
        agg.incidentBeginDate = incidentBeginDate;
      }
      if (incidentTitle && incidentTitle.length > (agg.incidentTitle || '').length) {
        agg.incidentTitle = incidentTitle;
      }
    }
    if (areaName) agg.areas.add(areaName);
  }

  return [...byId.values()].map((agg) => {
    const areaList = [...agg.areas].sort((a, b) => a.localeCompare(b));
    let areaSummary = null;
    if (areaList.length === 1) areaSummary = areaList[0];
    else if (areaList.length > 1) {
      const shown = areaList.slice(0, 3).join(', ');
      const more = areaList.length - 3;
      areaSummary = more > 0 ? `${areaList.length} areas including ${shown} and ${more} more` : shown;
    }
    return {
      kind: agg.kind,
      state: agg.state,
      declaredDate: agg.declaredDate,
      declarationId: agg.declarationId,
      incidentTitle: agg.incidentTitle,
      incidentBeginDate: agg.incidentBeginDate,
      areaSummary,
      sourceUrl: agg.sourceUrl,
      notes: null,
      source: 'openfema',
    };
  });
}

async function findByDeclarationId(declarationId) {
  const key = trimOrNull(declarationId);
  if (!key) return null;
  const pool = getPool();
  if (!pool) {
    ensureMemoryReady();
    for (const row of memoryRows.values()) {
      if (row.declarationId === key) return mapRow(row);
    }
    return null;
  }
  const res = await pool.query(
    `SELECT * FROM governor_disaster_declarations WHERE declaration_id = $1 LIMIT 1`,
    [key]
  );
  return mapRow(res.rows[0] || null);
}

async function upsertFederalFromSync(payload) {
  const existing = await findByDeclarationId(payload.declarationId);
  if (!existing) {
    return createGovernorDeclaration({ ...payload, source: 'openfema' });
  }
  // Refresh FEMA fields; keep staff notes when present.
  const patch = {
    kind: payload.kind,
    state: payload.state,
    declaredDate: payload.declaredDate,
    declarationId: payload.declarationId,
    incidentTitle: payload.incidentTitle,
    incidentBeginDate: payload.incidentBeginDate,
    areaSummary: payload.areaSummary,
    sourceUrl: payload.sourceUrl,
  };
  const updated = await updateGovernorDeclaration(existing.id, patch);
  const pool = getPool();
  if (!pool) {
    const mem = memoryRows.get(existing.id);
    if (mem) {
      mem.source = 'openfema';
      memoryRows.set(existing.id, mem);
    }
    return mapRow(memoryRows.get(existing.id));
  }
  await pool.query(`UPDATE governor_disaster_declarations SET source = 'openfema' WHERE id = $1`, [
    existing.id,
  ]);
  return getGovernorDeclaration(existing.id) || updated;
}

/**
 * Pull live OpenFEMA DisasterDeclarationsSummaries for the last ~3 months and upsert
 * federal DR/EM/FM rows. Preserves staff governor_order rows and existing notes.
 * Runs with the disaster feed refresh (daily scheduler, refresh script, POST /refresh).
 */
export async function syncGovernorDeclarationsFromOpenFema(options = {}) {
  const since = asDate(options.since) || threeMonthsAgoIso();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return { fetched: 0, unique: 0, inserted: 0, updated: 0, removed: 0, error: 'fetch unavailable' };
  }

  const baseUrl = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';
  // Match disasters.service ingestFema OData style (unquoted YYYY-MM-DD).
  const filter = `declarationDate ge ${since}`;
  const url = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$top=1000&$orderby=${encodeURIComponent('declarationDate desc')}`;

  let data;
  try {
    console.log(`📣 Governor declarations: syncing live OpenFEMA since ${since}`);
    const resp = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DevConnectLabs-GovernorDeclarations/1.0',
      },
    });
    if (!resp.ok) {
      throw new Error(`OpenFEMA ${resp.status} ${resp.statusText}`);
    }
    data = await resp.json();
  } catch (err) {
    console.warn('⚠️  Governor declarations OpenFEMA sync failed:', err.message);
    return { fetched: 0, unique: 0, inserted: 0, updated: 0, removed: 0, since, error: err.message };
  }

  const rows = data.DisasterDeclarationsSummaries || [];
  const aggregated = aggregateOpenFemaDeclarations(rows);
  const syncedIds = new Set(aggregated.map((r) => r.declarationId));
  let inserted = 0;
  let updated = 0;

  for (const payload of aggregated) {
    const before = await findByDeclarationId(payload.declarationId);
    await upsertFederalFromSync(payload);
    if (before) updated += 1;
    else inserted += 1;
  }

  // Drop OpenFEMA federal rows that fell out of the rolling window.
  let removed = 0;
  const pool = getPool();
  if (!pool) {
    ensureMemoryReady();
    for (const [id, row] of [...memoryRows.entries()]) {
      if (
        row.source === 'openfema' &&
        ['federal_dr', 'federal_em', 'federal_fm'].includes(row.kind) &&
        row.declarationId &&
        !syncedIds.has(row.declarationId)
      ) {
        memoryRows.delete(id);
        removed += 1;
      }
    }
  } else if (syncedIds.size > 0) {
    const res = await pool.query(
      `DELETE FROM governor_disaster_declarations
       WHERE source = 'openfema'
         AND kind IN ('federal_dr', 'federal_em', 'federal_fm')
         AND declaration_id IS NOT NULL
         AND NOT (declaration_id = ANY($1::text[]))`,
      [[...syncedIds]]
    );
    removed = res.rowCount || 0;
  } else {
    const res = await pool.query(
      `DELETE FROM governor_disaster_declarations
       WHERE source = 'openfema'
         AND kind IN ('federal_dr', 'federal_em', 'federal_fm')`
    );
    removed = res.rowCount || 0;
  }

  const summary = {
    fetched: rows.length,
    unique: aggregated.length,
    inserted,
    updated,
    removed,
    since,
  };
  console.log(
    `📣 Governor declarations: OpenFEMA sync complete (fetched ${summary.fetched}, unique ${summary.unique}, inserted ${summary.inserted}, updated ${summary.updated}, removed ${summary.removed})`
  );
  return summary;
}

export function resetGovernorDeclarationsMemoryForTests() {
  memoryRows.clear();
  memoryReady = false;
}

export default {
  initGovernorDeclarationsSchema,
  listGovernorDeclarations,
  getGovernorDeclaration,
  createGovernorDeclaration,
  updateGovernorDeclaration,
  deleteGovernorDeclaration,
  syncGovernorDeclarationsFromOpenFema,
  aggregateOpenFemaDeclarations,
  threeMonthsAgoIso,
  resetGovernorDeclarationsMemoryForTests,
  DECLARATION_KINDS,
  DECLARATION_SOURCES,
};
