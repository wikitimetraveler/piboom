/**
 * Disaster Policy Desk — Declared / Pending enforcement records (BRD field set).
 * Complements Unified Disasters hazard feeds; does not replace them.
 * Development work by David Lane
 */
import crypto from 'node:crypto';
import { getPool } from './database.service.js';

const memoryEvents = new Map();

export const POLICY_KINDS = Object.freeze(['declared', 'pending']);
export const POLICY_STATUSES = Object.freeze(['draft', 'active', 'ended']);

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS disaster_policy_events (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('declared', 'pending')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'ended')),
  event_name TEXT NOT NULL,
  disaster_type TEXT,
  fema_declaration_number TEXT,
  fema_emergency_declaration_date DATE,
  fema_major_disaster_declaration_date DATE,
  presidential_declaration_date DATE,
  acme_emergency_declaration_date DATE,
  acme_disaster_announcement TEXT,
  acme_treasury_hold BOOLEAN NOT NULL DEFAULT FALSE,
  acme_funding_suspension BOOLEAN NOT NULL DEFAULT FALSE,
  incident_begin_date DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disaster_policy_areas (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES disaster_policy_events(id) ON DELETE CASCADE,
  county_code CHAR(5) NOT NULL,
  county_name TEXT NOT NULL,
  state CHAR(2) NOT NULL,
  zip_code TEXT,
  incident_begin_date DATE,
  incident_end_date DATE,
  inspection_required_appraisals_on_or_before DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disaster_policy_areas_event ON disaster_policy_areas (event_id);
CREATE INDEX IF NOT EXISTS idx_disaster_policy_areas_geo ON disaster_policy_areas (state, county_code);
`;

export async function initDisasterPolicySchema() {
  const pool = getPool();
  if (!pool) {
    console.warn('⚠️  Database pool not initialized; disaster_policy schema skipped (memory mode)');
    return { mode: 'memory' };
  }
  await pool.query(CREATE_SQL);
  // Rename legacy brand columns → ACME (never emit old lender names in product API)
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'disaster_policy_events' AND column_name = 'amerihome_treasury_hold'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'disaster_policy_events' AND column_name = 'acme_treasury_hold'
      ) THEN
        ALTER TABLE disaster_policy_events RENAME COLUMN amerihome_emergency_declaration_date TO acme_emergency_declaration_date;
        ALTER TABLE disaster_policy_events RENAME COLUMN amerihome_disaster_announcement TO acme_disaster_announcement;
        ALTER TABLE disaster_policy_events RENAME COLUMN amerihome_treasury_hold TO acme_treasury_hold;
        ALTER TABLE disaster_policy_events RENAME COLUMN amerihome_funding_suspension TO acme_funding_suspension;
      END IF;
    END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'loans' AND column_name = 'county_fips'
      ) THEN
        ALTER TABLE loans ADD COLUMN county_fips CHAR(5);
      END IF;
    END $$;
  `);
  console.log('✅ Disaster policy schema ensured');
  return { mode: 'postgres' };
}

function asDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Postgres DATE columns arrive as local-midnight Date objects; the API speaks YYYY-MM-DD. */
function dateOnly(v) {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  return asDate(v);
}

function todayIso() {
  return dateOnly(new Date());
}

function asBool(v, fallback = false) {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return fallback;
}

function policyError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

/** A county area has no ZIP; a ZIP area is one ZIP Code inside its county. */
function areaKey(a) {
  return `${a.state}:${a.countyCode}:${a.zipCode || ''}`;
}

function dedupeAreas(areas, taken = new Set()) {
  const seen = new Set(taken);
  return areas.filter((a) => {
    const key = areaKey(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeArea(raw) {
  const countyCode = String(raw?.countyCode || raw?.county_code || '').padStart(5, '0').slice(0, 5);
  const state = String(raw?.state || '').toUpperCase().slice(0, 2);
  const countyName = String(raw?.countyName || raw?.county_name || '').trim();
  if (!/^\d{5}$/.test(countyCode) || !/^[A-Z]{2}$/.test(state) || !countyName) {
    throw policyError('AREA_INVALID');
  }
  const zipRaw = String(raw?.zipCode ?? raw?.zip_code ?? '').trim();
  if (zipRaw && !/^\d{5}$/.test(zipRaw)) {
    throw policyError('ZIP_INVALID');
  }
  return {
    id: crypto.randomUUID(),
    countyCode,
    countyName,
    state,
    zipCode: zipRaw || null,
    incidentBeginDate: asDate(raw?.incidentBeginDate || raw?.incident_begin_date),
    incidentEndDate: asDate(raw?.incidentEndDate || raw?.incident_end_date),
    inspectionRequiredAppraisalsOnOrBefore: asDate(
      raw?.inspectionRequiredAppraisalsOnOrBefore ||
        raw?.inspection_required_appraisals_on_or_before
    ),
  };
}

function normalizeEventInput(body = {}) {
  const kind = String(body.kind || '').toLowerCase();
  if (!POLICY_KINDS.includes(kind)) {
    const err = new Error('KIND_INVALID');
    err.code = 'KIND_INVALID';
    throw err;
  }
  let status = String(body.status || (kind === 'pending' ? 'draft' : 'active')).toLowerCase();
  if (!POLICY_STATUSES.includes(status)) {
    const err = new Error('STATUS_INVALID');
    err.code = 'STATUS_INVALID';
    throw err;
  }
  const eventName = String(body.eventName || body.event_name || '').trim();
  if (!eventName) {
    const err = new Error('EVENT_NAME_REQUIRED');
    err.code = 'EVENT_NAME_REQUIRED';
    throw err;
  }
  const areasIn = Array.isArray(body.areas) ? body.areas : [];
  if (!areasIn.length) {
    const err = new Error('AREAS_REQUIRED');
    err.code = 'AREAS_REQUIRED';
    throw err;
  }
  const incidentBeginDate = asDate(body.incidentBeginDate || body.incident_begin_date);
  // Areas inherit the event's begin date unless they carry their own.
  const areas = dedupeAreas(areasIn.map(normalizeArea)).map((a) => ({
    ...a,
    incidentBeginDate: a.incidentBeginDate || incidentBeginDate,
  }));

  const treasuryHold =
    kind === 'pending' && status === 'active'
      ? true
      : asBool(
          body.acmeTreasuryHold ??
            body.acme_treasury_hold ??
            body.amerihomeTreasuryHold ??
            body.amerihome_treasury_hold,
          false
        );

  return {
    kind,
    status,
    eventName,
    disasterType: body.disasterType || body.disaster_type || null,
    femaDeclarationNumber: body.femaDeclarationNumber || body.fema_declaration_number || null,
    femaEmergencyDeclarationDate: asDate(
      body.femaEmergencyDeclarationDate || body.fema_emergency_declaration_date
    ),
    femaMajorDisasterDeclarationDate: asDate(
      body.femaMajorDisasterDeclarationDate || body.fema_major_disaster_declaration_date
    ),
    presidentialDeclarationDate: asDate(
      body.presidentialDeclarationDate || body.presidential_declaration_date
    ),
    acmeEmergencyDeclarationDate: asDate(
      body.acmeEmergencyDeclarationDate ||
        body.acme_emergency_declaration_date ||
        body.amerihomeEmergencyDeclarationDate ||
        body.amerihome_emergency_declaration_date
    ),
    acmeDisasterAnnouncement:
      body.acmeDisasterAnnouncement ||
      body.acme_disaster_announcement ||
      body.amerihomeDisasterAnnouncement ||
      body.amerihome_disaster_announcement ||
      null,
    acmeTreasuryHold: treasuryHold,
    acmeFundingSuspension: asBool(
      body.acmeFundingSuspension ??
        body.acme_funding_suspension ??
        body.amerihomeFundingSuspension ??
        body.amerihome_funding_suspension,
      false
    ),
    incidentBeginDate,
    createdBy: body.createdBy || body.created_by || null,
    areas,
  };
}

function publicEvent(row, areas = []) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    eventName: row.event_name ?? row.eventName,
    disasterType: row.disaster_type ?? row.disasterType,
    femaDeclarationNumber: row.fema_declaration_number ?? row.femaDeclarationNumber,
    femaEmergencyDeclarationDate: dateOnly(
      row.fema_emergency_declaration_date ?? row.femaEmergencyDeclarationDate
    ),
    femaMajorDisasterDeclarationDate: dateOnly(
      row.fema_major_disaster_declaration_date ?? row.femaMajorDisasterDeclarationDate
    ),
    presidentialDeclarationDate: dateOnly(
      row.presidential_declaration_date ?? row.presidentialDeclarationDate
    ),
    acmeEmergencyDeclarationDate: dateOnly(
      row.acme_emergency_declaration_date ?? row.acmeEmergencyDeclarationDate
    ),
    acmeDisasterAnnouncement:
      row.acme_disaster_announcement ?? row.acmeDisasterAnnouncement,
    acmeTreasuryHold: Boolean(
      row.acme_treasury_hold ?? row.acmeTreasuryHold
    ),
    acmeFundingSuspension: Boolean(
      row.acme_funding_suspension ?? row.acmeFundingSuspension
    ),
    incidentBeginDate: dateOnly(row.incident_begin_date ?? row.incidentBeginDate),
    createdBy: row.created_by ?? row.createdBy,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    areas: areas.map((a) => ({
      id: a.id,
      countyCode: a.county_code ?? a.countyCode,
      countyName: a.county_name ?? a.countyName,
      state: a.state,
      zipCode: a.zip_code ?? a.zipCode ?? null,
      incidentBeginDate: dateOnly(a.incident_begin_date ?? a.incidentBeginDate),
      incidentEndDate: dateOnly(a.incident_end_date ?? a.incidentEndDate),
      inspectionRequiredAppraisalsOnOrBefore: dateOnly(
        a.inspection_required_appraisals_on_or_before ??
          a.inspectionRequiredAppraisalsOnOrBefore
      ),
    })),
  };
}

function saveMemory(normalized) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const event = {
    id,
    kind: normalized.kind,
    status: normalized.status,
    eventName: normalized.eventName,
    disasterType: normalized.disasterType,
    femaDeclarationNumber: normalized.femaDeclarationNumber,
    femaEmergencyDeclarationDate: normalized.femaEmergencyDeclarationDate,
    femaMajorDisasterDeclarationDate: normalized.femaMajorDisasterDeclarationDate,
    presidentialDeclarationDate: normalized.presidentialDeclarationDate,
    acmeEmergencyDeclarationDate: normalized.acmeEmergencyDeclarationDate,
    acmeDisasterAnnouncement: normalized.acmeDisasterAnnouncement,
    acmeTreasuryHold: normalized.acmeTreasuryHold,
    acmeFundingSuspension: normalized.acmeFundingSuspension,
    incidentBeginDate: normalized.incidentBeginDate,
    createdBy: normalized.createdBy,
    createdAt: now,
    updatedAt: now,
    areas: normalized.areas,
  };
  memoryEvents.set(id, event);
  return publicEvent(event, event.areas);
}

export async function createPolicyEvent(body) {
  const normalized = normalizeEventInput(body);
  const pool = getPool();
  if (!pool) return saveMemory(normalized);

  const id = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO disaster_policy_events (
        id, kind, status, event_name, disaster_type, fema_declaration_number,
        fema_emergency_declaration_date, fema_major_disaster_declaration_date,
        presidential_declaration_date,
        acme_emergency_declaration_date, acme_disaster_announcement,
        acme_treasury_hold, acme_funding_suspension, incident_begin_date, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id,
        normalized.kind,
        normalized.status,
        normalized.eventName,
        normalized.disasterType,
        normalized.femaDeclarationNumber,
        normalized.femaEmergencyDeclarationDate,
        normalized.femaMajorDisasterDeclarationDate,
        normalized.presidentialDeclarationDate,
        normalized.acmeEmergencyDeclarationDate,
        normalized.acmeDisasterAnnouncement,
        normalized.acmeTreasuryHold,
        normalized.acmeFundingSuspension,
        normalized.incidentBeginDate,
        normalized.createdBy,
      ]
    );
    for (const a of normalized.areas) {
      await client.query(
        `INSERT INTO disaster_policy_areas (
          id, event_id, county_code, county_name, state, zip_code,
          incident_begin_date, incident_end_date, inspection_required_appraisals_on_or_before
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          a.id,
          id,
          a.countyCode,
          a.countyName,
          a.state,
          a.zipCode,
          a.incidentBeginDate || normalized.incidentBeginDate,
          a.incidentEndDate,
          a.inspectionRequiredAppraisalsOnOrBefore,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return getPolicyEvent(id);
}

export async function listPolicyEvents({ kind, status } = {}) {
  const pool = getPool();
  if (!pool) {
    let rows = [...memoryEvents.values()];
    if (kind) rows = rows.filter((r) => r.kind === kind);
    if (status) rows = rows.filter((r) => r.status === status);
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return rows.map((r) => publicEvent(r, r.areas));
  }

  const clauses = [];
  const params = [];
  if (kind) {
    params.push(kind);
    clauses.push(`kind = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM disaster_policy_events ${where} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  const out = [];
  for (const row of rows) {
    const areas = await pool.query(
      `SELECT * FROM disaster_policy_areas WHERE event_id = $1 ORDER BY state, county_name`,
      [row.id]
    );
    out.push(publicEvent(row, areas.rows));
  }
  return out;
}

export async function getPolicyEvent(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const pool = getPool();
  if (!pool) {
    const row = memoryEvents.get(key);
    return row ? publicEvent(row, row.areas) : null;
  }
  const { rows } = await pool.query(`SELECT * FROM disaster_policy_events WHERE id = $1`, [key]);
  if (!rows[0]) return null;
  const areas = await pool.query(
    `SELECT * FROM disaster_policy_areas WHERE event_id = $1 ORDER BY state, county_name`,
    [key]
  );
  return publicEvent(rows[0], areas.rows);
}

export async function appendPolicyAreas(id, areasIn = []) {
  const event = await getPolicyEvent(id);
  if (!event) return null;
  const requested = (Array.isArray(areasIn) ? areasIn : []).map(normalizeArea);
  if (!requested.length) {
    throw policyError('AREAS_REQUIRED');
  }
  // Areas already on the event are skipped rather than stored twice.
  const areas = dedupeAreas(requested, new Set(event.areas.map(areaKey))).map((a) => ({
    ...a,
    incidentBeginDate: a.incidentBeginDate || event.incidentBeginDate,
  }));
  if (!areas.length) return event;

  const pool = getPool();
  if (!pool) {
    const mem = memoryEvents.get(event.id);
    mem.areas = [...mem.areas, ...areas];
    mem.updatedAt = new Date().toISOString();
    memoryEvents.set(event.id, mem);
    return publicEvent(mem, mem.areas);
  }

  for (const a of areas) {
    await pool.query(
      `INSERT INTO disaster_policy_areas (
        id, event_id, county_code, county_name, state, zip_code,
        incident_begin_date, incident_end_date, inspection_required_appraisals_on_or_before
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        a.id,
        event.id,
        a.countyCode,
        a.countyName,
        a.state,
        a.zipCode,
        a.incidentBeginDate || event.incidentBeginDate,
        a.incidentEndDate,
        a.inspectionRequiredAppraisalsOnOrBefore,
      ]
    );
  }
  await pool.query(`UPDATE disaster_policy_events SET updated_at = NOW() WHERE id = $1`, [
    event.id,
  ]);
  return getPolicyEvent(event.id);
}

export async function setPolicyStatus(id, status) {
  const next = String(status || '').toLowerCase();
  if (!POLICY_STATUSES.includes(next)) {
    const err = new Error('STATUS_INVALID');
    err.code = 'STATUS_INVALID';
    throw err;
  }
  const event = await getPolicyEvent(id);
  if (!event) return null;

  const pool = getPool();
  if (!pool) {
    const mem = memoryEvents.get(event.id);
    mem.status = next;
    if (mem.kind === 'pending' && next === 'active') mem.acmeTreasuryHold = true;
    mem.updatedAt = new Date().toISOString();
    memoryEvents.set(event.id, mem);
    return publicEvent(mem, mem.areas);
  }

  const treasury =
    event.kind === 'pending' && next === 'active' ? true : event.acmeTreasuryHold;
  await pool.query(
    `UPDATE disaster_policy_events
     SET status = $2, acme_treasury_hold = $3, updated_at = NOW()
     WHERE id = $1`,
    [event.id, next, treasury]
  );
  return getPolicyEvent(event.id);
}

/**
 * Update BRD fields on an existing event (areas stay append/remove via dedicated endpoints).
 */
export async function updatePolicyEvent(id, body = {}) {
  const event = await getPolicyEvent(id);
  if (!event) return null;

  const eventName = String(body.eventName ?? body.event_name ?? event.eventName).trim();
  if (!eventName) {
    const err = new Error('EVENT_NAME_REQUIRED');
    err.code = 'EVENT_NAME_REQUIRED';
    throw err;
  }

  let kind = event.kind;
  if (body.kind != null && String(body.kind).trim() !== '') {
    const nextKind = String(body.kind || '').toLowerCase();
    if (!POLICY_KINDS.includes(nextKind)) {
      const err = new Error('KIND_INVALID');
      err.code = 'KIND_INVALID';
      throw err;
    }
    kind = nextKind;
  }

  const patch = {
    kind,
    eventName,
    disasterType:
      body.disasterType !== undefined || body.disaster_type !== undefined
        ? body.disasterType || body.disaster_type || null
        : event.disasterType,
    femaDeclarationNumber:
      body.femaDeclarationNumber !== undefined || body.fema_declaration_number !== undefined
        ? body.femaDeclarationNumber || body.fema_declaration_number || null
        : event.femaDeclarationNumber,
    femaEmergencyDeclarationDate:
      body.femaEmergencyDeclarationDate !== undefined ||
      body.fema_emergency_declaration_date !== undefined
        ? asDate(body.femaEmergencyDeclarationDate || body.fema_emergency_declaration_date)
        : event.femaEmergencyDeclarationDate,
    femaMajorDisasterDeclarationDate:
      body.femaMajorDisasterDeclarationDate !== undefined ||
      body.fema_major_disaster_declaration_date !== undefined
        ? asDate(
            body.femaMajorDisasterDeclarationDate || body.fema_major_disaster_declaration_date
          )
        : event.femaMajorDisasterDeclarationDate,
    presidentialDeclarationDate:
      body.presidentialDeclarationDate !== undefined ||
      body.presidential_declaration_date !== undefined
        ? asDate(body.presidentialDeclarationDate || body.presidential_declaration_date)
        : event.presidentialDeclarationDate,
    acmeEmergencyDeclarationDate:
      body.acmeEmergencyDeclarationDate !== undefined ||
      body.acme_emergency_declaration_date !== undefined ||
      body.amerihomeEmergencyDeclarationDate !== undefined
        ? asDate(
            body.acmeEmergencyDeclarationDate ||
              body.acme_emergency_declaration_date ||
              body.amerihomeEmergencyDeclarationDate ||
              body.amerihome_emergency_declaration_date
          )
        : event.acmeEmergencyDeclarationDate,
    acmeDisasterAnnouncement:
      body.acmeDisasterAnnouncement !== undefined ||
      body.acme_disaster_announcement !== undefined ||
      body.amerihomeDisasterAnnouncement !== undefined
        ? body.acmeDisasterAnnouncement ||
          body.acme_disaster_announcement ||
          body.amerihomeDisasterAnnouncement ||
          body.amerihome_disaster_announcement ||
          null
        : event.acmeDisasterAnnouncement,
    acmeTreasuryHold:
      body.acmeTreasuryHold !== undefined ||
      body.acme_treasury_hold !== undefined ||
      body.amerihomeTreasuryHold !== undefined
        ? asBool(
            body.acmeTreasuryHold ??
              body.acme_treasury_hold ??
              body.amerihomeTreasuryHold ??
              body.amerihome_treasury_hold,
            event.acmeTreasuryHold
          )
        : event.acmeTreasuryHold,
    acmeFundingSuspension:
      body.acmeFundingSuspension !== undefined ||
      body.acme_funding_suspension !== undefined ||
      body.amerihomeFundingSuspension !== undefined
        ? asBool(
            body.acmeFundingSuspension ??
              body.acme_funding_suspension ??
              body.amerihomeFundingSuspension ??
              body.amerihome_funding_suspension,
            event.acmeFundingSuspension
          )
        : event.acmeFundingSuspension,
    incidentBeginDate:
      body.incidentBeginDate !== undefined || body.incident_begin_date !== undefined
        ? asDate(body.incidentBeginDate || body.incident_begin_date)
        : event.incidentBeginDate,
  };

  // Areas that were following the event's begin date keep following it.
  const beginChanged = patch.incidentBeginDate !== event.incidentBeginDate;

  const pool = getPool();
  if (!pool) {
    const mem = memoryEvents.get(event.id);
    if (beginChanged) {
      mem.areas = mem.areas.map((a) =>
        !a.incidentBeginDate || a.incidentBeginDate === event.incidentBeginDate
          ? { ...a, incidentBeginDate: patch.incidentBeginDate }
          : a
      );
    }
    Object.assign(mem, patch, { updatedAt: new Date().toISOString() });
    memoryEvents.set(event.id, mem);
    return publicEvent(mem, mem.areas);
  }

  await pool.query(
    `UPDATE disaster_policy_events SET
      kind = $2,
      event_name = $3,
      disaster_type = $4,
      fema_declaration_number = $5,
      fema_emergency_declaration_date = $6,
      fema_major_disaster_declaration_date = $7,
      presidential_declaration_date = $8,
      acme_emergency_declaration_date = $9,
      acme_disaster_announcement = $10,
      acme_treasury_hold = $11,
      acme_funding_suspension = $12,
      incident_begin_date = $13,
      updated_at = NOW()
     WHERE id = $1`,
    [
      event.id,
      patch.kind,
      patch.eventName,
      patch.disasterType,
      patch.femaDeclarationNumber,
      patch.femaEmergencyDeclarationDate,
      patch.femaMajorDisasterDeclarationDate,
      patch.presidentialDeclarationDate,
      patch.acmeEmergencyDeclarationDate,
      patch.acmeDisasterAnnouncement,
      patch.acmeTreasuryHold,
      patch.acmeFundingSuspension,
      patch.incidentBeginDate,
    ]
  );
  if (beginChanged) {
    await pool.query(
      `UPDATE disaster_policy_areas SET incident_begin_date = $2
       WHERE event_id = $1
         AND (incident_begin_date IS NULL OR incident_begin_date IS NOT DISTINCT FROM $3::date)`,
      [event.id, patch.incidentBeginDate, event.incidentBeginDate]
    );
  }
  return getPolicyEvent(event.id);
}

export async function deletePolicyEvent(id) {
  const event = await getPolicyEvent(id);
  if (!event) return null;

  const pool = getPool();
  if (!pool) {
    memoryEvents.delete(event.id);
    return { id: event.id, deleted: true };
  }
  await pool.query(`DELETE FROM disaster_policy_events WHERE id = $1`, [event.id]);
  return { id: event.id, deleted: true };
}

export async function removePolicyArea(eventId, areaId) {
  const event = await getPolicyEvent(eventId);
  if (!event) return null;
  const areaKey = String(areaId || '').trim();
  if (!areaKey) {
    const err = new Error('AREA_INVALID');
    err.code = 'AREA_INVALID';
    throw err;
  }

  const target = event.areas.find((a) => a.id === areaKey);
  if (!target) {
    const err = new Error('AREA_NOT_FOUND');
    err.code = 'AREA_NOT_FOUND';
    throw err;
  }
  if (event.areas.length <= 1) {
    const err = new Error('AREAS_REQUIRED');
    err.code = 'AREAS_REQUIRED';
    throw err;
  }

  const pool = getPool();
  if (!pool) {
    const mem = memoryEvents.get(event.id);
    mem.areas = mem.areas.filter((a) => a.id !== areaKey);
    mem.updatedAt = new Date().toISOString();
    memoryEvents.set(event.id, mem);
    return publicEvent(mem, mem.areas);
  }

  await pool.query(`DELETE FROM disaster_policy_areas WHERE id = $1 AND event_id = $2`, [
    areaKey,
    event.id,
  ]);
  await pool.query(`UPDATE disaster_policy_events SET updated_at = NOW() WHERE id = $1`, [
    event.id,
  ]);
  return getPolicyEvent(event.id);
}

/**
 * Set the Incident Period End Date (and/or the appraisal inspection cutoff) on some of an
 * event's areas. Only the keys present in the patch are written; null or '' clears a date.
 */
export async function updatePolicyAreas(eventId, body = {}) {
  const event = await getPolicyEvent(eventId);
  if (!event) return null;

  const areaIds = [...new Set((Array.isArray(body.areaIds) ? body.areaIds : []).map(String))];
  if (!areaIds.length) throw policyError('AREAS_REQUIRED');
  const known = new Set(event.areas.map((a) => a.id));
  if (areaIds.some((id) => !known.has(id))) throw policyError('AREA_NOT_FOUND');

  const patch = {};
  for (const key of ['incidentEndDate', 'inspectionRequiredAppraisalsOnOrBefore']) {
    if (body[key] === undefined) continue;
    const cleared = body[key] === null || body[key] === '';
    const value = cleared ? null : asDate(body[key]);
    if (!cleared && !value) throw policyError('DATE_INVALID');
    patch[key] = value;
  }
  if (!Object.keys(patch).length) throw policyError('AREA_PATCH_EMPTY');
  if (patch.incidentEndDate && event.incidentBeginDate && patch.incidentEndDate < event.incidentBeginDate) {
    throw policyError('END_BEFORE_BEGIN');
  }

  const pool = getPool();
  if (!pool) {
    const mem = memoryEvents.get(event.id);
    const ids = new Set(areaIds);
    mem.areas = mem.areas.map((a) => (ids.has(a.id) ? { ...a, ...patch } : a));
    mem.updatedAt = new Date().toISOString();
    memoryEvents.set(event.id, mem);
    return publicEvent(mem, mem.areas);
  }

  const columns = {
    incidentEndDate: 'incident_end_date',
    inspectionRequiredAppraisalsOnOrBefore: 'inspection_required_appraisals_on_or_before',
  };
  const params = [event.id, areaIds];
  const sets = Object.keys(patch).map((key) => {
    params.push(patch[key]);
    return `${columns[key]} = $${params.length}`;
  });
  await pool.query(
    `UPDATE disaster_policy_areas SET ${sets.join(', ')}
     WHERE event_id = $1 AND id = ANY($2::uuid[])`,
    params
  );
  await pool.query(`UPDATE disaster_policy_events SET updated_at = NOW() WHERE id = $1`, [
    event.id,
  ]);
  return getPolicyEvent(event.id);
}

function countyKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+county$/i, '')
    .trim();
}

/**
 * Every area a loan falls in, with how it matched. A ZIP area matches on the property ZIP
 * only; a county area matches on FIPS (county_code ↔ loans.county_fips) or, failing that,
 * on the normalized county name.
 */
export function findLoanAreaMatches(loan, areas) {
  const loanState = String(loan?.state || '').toUpperCase();
  const loanFips = String(loan?.countyFips || loan?.county_fips || '').trim().padStart(5, '0').slice(0, 5);
  const loanCounty = countyKey(loan?.county);
  const loanZip = String(loan?.zipCode ?? loan?.zip_code ?? '').trim().slice(0, 5);

  const matches = [];
  for (const area of areas || []) {
    if (String(area.state || '').toUpperCase() !== loanState) continue;
    const areaZip = String(area.zipCode ?? area.zip_code ?? '').trim();
    if (areaZip) {
      if (loanZip && loanZip === areaZip) matches.push({ area, method: 'zip' });
      continue;
    }
    const areaFips = String(area.countyCode || area.county_code || '').padStart(5, '0').slice(0, 5);
    if (/^\d{5}$/.test(loanFips) && loanFips !== '00000' && loanFips === areaFips) {
      matches.push({ area, method: 'fips' });
      continue;
    }
    const areaCounty = countyKey(area.countyName || area.county_name);
    if (areaCounty && loanCounty && areaCounty === loanCounty) matches.push({ area, method: 'name' });
  }
  return matches;
}

const MATCH_PRECEDENCE = ['zip', 'fips', 'name'];

/** Most specific way a loan matched any area: zip, then fips, then name; null when it did not. */
export function classifyLoanAreaMatch(loan, areas) {
  const methods = new Set(findLoanAreaMatches(loan, areas).map((m) => m.method));
  return MATCH_PRECEDENCE.find((m) => methods.has(m)) || null;
}

/** BRD reporting channels, in report order. Loans without one fall under `unassigned`. */
export const POLICY_CHANNELS = Object.freeze([
  Object.freeze({ id: 'delegated', label: 'Correspondent Delegated' }),
  Object.freeze({ id: 'non_delegated', label: 'Correspondent Non-Delegated' }),
  Object.freeze({ id: 'consumer', label: 'Consumer Direct' }),
  Object.freeze({ id: 'unassigned', label: 'Channel not recorded' }),
]);

const MILESTONE_ORDER = ['Application', 'Processing', 'Underwriting', 'Closing', 'Funded'];

function normalizeChannel(raw) {
  const s = String(raw || '').toLowerCase().replace(/[^a-z]/g, '');
  if (s.includes('nondelegated')) return 'non_delegated';
  if (s.includes('delegated')) return 'delegated';
  if (s.includes('consumer')) return 'consumer';
  return 'unassigned';
}

function normalizeBook(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('inventory')) return 'inventory';
  if (s.includes('servicing')) return 'servicing';
  return 'pipeline';
}

function tally(bucket, loan) {
  bucket.count += 1;
  bucket.amount += Number(loan.loanAmount) || 0;
}

/**
 * BRD impact report: Pipeline by Channel by Milestone, plus Inventory and Servicing Portfolio.
 * Pure — takes the loan rows produced by the impact query.
 */
export function buildImpactReport(loans = []) {
  const report = {
    generatedAt: new Date().toISOString(),
    totals: { count: 0, amount: 0, treasuryHold: 0, fundingSuspension: 0 },
    pipeline: { count: 0, amount: 0, milestones: [], channels: [] },
    inventory: { count: 0, amount: 0 },
    servicing: { count: 0, amount: 0 },
    channelNotRecorded: 0,
  };
  const channels = new Map(
    POLICY_CHANNELS.map((c) => [c.id, { ...c, count: 0, amount: 0, byMilestone: {} }])
  );
  const milestones = new Set();

  for (const loan of loans) {
    tally(report.totals, loan);
    if (loan.treasuryHold) report.totals.treasuryHold += 1;
    if (loan.fundingSuspension) report.totals.fundingSuspension += 1;

    if (loan.loanBook !== 'pipeline') {
      tally(report[loan.loanBook], loan);
      continue;
    }
    tally(report.pipeline, loan);
    const channel = channels.get(loan.channel) || channels.get('unassigned');
    if (channel.id === 'unassigned') report.channelNotRecorded += 1;
    tally(channel, loan);
    const milestone = loan.milestone || 'Not set';
    milestones.add(milestone);
    if (!channel.byMilestone[milestone]) channel.byMilestone[milestone] = { count: 0, amount: 0 };
    tally(channel.byMilestone[milestone], loan);
  }

  const rank = (m) => {
    const i = MILESTONE_ORDER.indexOf(m);
    return i === -1 ? MILESTONE_ORDER.length : i;
  };
  report.pipeline.milestones = [...milestones].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  // The three BRD channels always print; the catch-all row only when it has loans.
  report.pipeline.channels = [...channels.values()].filter(
    (c) => c.id !== 'unassigned' || c.count > 0
  );
  return report;
}

const LOAN_LIST_LIMIT = 5000;
const EMPTY_MATCH_COUNTS = Object.freeze({ byZip: 0, byFips: 0, byName: 0 });

function areaLabel(area) {
  return area.zipCode ? `ZIP ${area.zipCode}` : `${area.countyName}, ${area.state}`;
}

/**
 * Loans whose property falls in any of the areas. `channel` and `loan_book` are read when the
 * loans table carries them (to_jsonb tolerates their absence).
 */
async function queryLoansForAreas(pool, areas) {
  const { rows } = await pool.query(
    `SELECT l.id, l.loan_number, l.borrower_name, l.property_address, l.city, l.state, l.county,
            l.zip_code, l.milestone, l.loan_amount, l.disaster_risk_score, l.county_fips,
            to_jsonb(l)->>'channel' AS channel,
            to_jsonb(l)->>'loan_book' AS loan_book
     FROM loans l
     WHERE EXISTS (
       SELECT 1
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
         AS a(state, county_code, county_name, zip_code)
       WHERE a.state = l.state
         AND CASE
           WHEN a.zip_code IS NOT NULL THEN LEFT(TRIM(l.zip_code), 5) = a.zip_code
           ELSE (
             (
               NULLIF(TRIM(COALESCE(l.county_fips, '')), '') IS NOT NULL
               AND LPAD(TRIM(l.county_fips), 5, '0') = a.county_code
             )
             OR LOWER(REPLACE(a.county_name, ' County', '')) = LOWER(REPLACE(l.county, ' County', ''))
           )
         END
     )
     ORDER BY l.state, l.county, l.loan_number`,
    [
      areas.map((a) => a.state),
      areas.map((a) => a.countyCode),
      areas.map((a) => a.countyName),
      areas.map((a) => a.zipCode || null),
    ]
  );
  return rows;
}

/** Whether the loans table can tell the report a loan's channel and book at all. */
async function loanReportColumns(pool) {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'loans' AND column_name IN ('channel', 'loan_book')`
  );
  const names = new Set(rows.map((r) => r.column_name));
  return { channel: names.has('channel'), loanBook: names.has('loan_book') };
}

async function impactForAreas(pool, areas, event) {
  const [rows, loanColumns] = await Promise.all([
    queryLoansForAreas(pool, areas),
    loanReportColumns(pool),
  ]);
  return { ...describeImpactedLoans(rows, areas, event), loanColumns };
}

/**
 * Shape loan rows for the desk. Holds apply only while the event is active and at least one of
 * the loan's areas is still inside its incident period (no Incident Period End Date on or
 * before today).
 */
export function describeImpactedLoans(rows, areas, { status, acmeTreasuryHold, acmeFundingSuspension } = {}) {
  const today = todayIso();
  const active = status === 'active';
  const matchCounts = { ...EMPTY_MATCH_COUNTS };

  const loans = rows.map((r) => {
    const matches = findLoanAreaMatches(
      { state: r.state, county: r.county, county_fips: r.county_fips, zip_code: r.zip_code },
      areas
    );
    const matchMethod = MATCH_PRECEDENCE.find((m) => matches.some((x) => x.method === m)) || 'name';
    if (matchMethod === 'zip') matchCounts.byZip += 1;
    else if (matchMethod === 'fips') matchCounts.byFips += 1;
    else matchCounts.byName += 1;

    const open = matches.filter((m) => !m.area.incidentEndDate || m.area.incidentEndDate > today);
    const inIncidentPeriod = open.length > 0 || matches.length === 0;
    const shown = (open[0] || matches[0])?.area;
    const endDates = matches.map((m) => m.area.incidentEndDate).filter(Boolean).sort();

    return {
      id: r.id,
      loanNumber: r.loan_number,
      borrowerName: r.borrower_name,
      propertyAddress: r.property_address,
      city: r.city,
      state: r.state,
      county: r.county,
      countyFips: r.county_fips || null,
      zipCode: r.zip_code,
      milestone: r.milestone,
      loanAmount: Number(r.loan_amount) || 0,
      disasterRiskScore: r.disaster_risk_score,
      channel: normalizeChannel(r.channel),
      loanBook: normalizeBook(r.loan_book),
      matchMethod,
      matchedArea: shown ? areaLabel(shown) : null,
      incidentEndDate: inIncidentPeriod ? null : endDates[endDates.length - 1] || null,
      treasuryHold: Boolean(active && acmeTreasuryHold && inIncidentPeriod),
      fundingSuspension: Boolean(active && acmeFundingSuspension && inIncidentPeriod),
    };
  });

  return {
    loans: loans.slice(0, LOAN_LIST_LIMIT),
    count: loans.length,
    truncated: loans.length > LOAN_LIST_LIMIT,
    matchCounts,
    report: buildImpactReport(loans),
  };
}

function emptyImpact() {
  return describeImpactedLoans([], []);
}

/**
 * Impacted loans + BRD report for a saved event.
 */
export async function findImpactedLoans(eventId) {
  const event = await getPolicyEvent(eventId);
  if (!event) return { event: null, ...emptyImpact() };

  const pool = getPool();
  if (!pool) return { event, mode: 'memory', ...emptyImpact() };
  if (!event.areas.length) return { event, ...emptyImpact() };

  return { event, ...(await impactForAreas(pool, event.areas, event)) };
}

/**
 * Impacted loans + BRD report for an area list that has not been saved yet (review step).
 * Nothing is on hold until the event is declared, so hold flags come back false.
 */
export async function previewImpactedLoans(areasIn = []) {
  const areas = dedupeAreas((Array.isArray(areasIn) ? areasIn : []).map(normalizeArea));
  if (!areas.length) throw policyError('AREAS_REQUIRED');

  const pool = getPool();
  if (!pool) return { mode: 'memory', ...emptyImpact() };

  return impactForAreas(pool, areas);
}

/**
 * Distinct counties for a FEMA DR/EM number from unified disasters rows.
 */
export async function listFemaCountiesByDisasterNumber(disasterNumber) {
  const raw = String(disasterNumber || '').trim();
  if (!raw) return { disasterNumber: '', counties: [], count: 0 };

  const normalized = raw.replace(/\s+/g, '');
  const digits = normalized.replace(/^(DR|EM|FM)-?/i, '');
  const pool = getPool();
  if (!pool) {
    return { disasterNumber: normalized, counties: [], count: 0, mode: 'memory' };
  }

  const { rows } = await pool.query(
    `SELECT DISTINCT county_fips, county_name, state_abbr
     FROM disasters
     WHERE LOWER(source) = 'fema'
       AND (
         source_id = $1
         OR source_id = $2
         OR source_id ILIKE $3
         OR source_id ILIKE $4
         OR COALESCE(raw->>'disasterNumber','') = $2
         OR COALESCE(raw->>'disasterNumber','') = $1
       )
       AND county_fips IS NOT NULL
       AND county_fips <> '00000'
     ORDER BY state_abbr, county_name
     LIMIT 500`,
    [
      normalized,
      digits,
      `${normalized}%`,
      `%${digits}%`,
    ]
  );

  const counties = rows.map((r) => ({
    countyFips: String(r.county_fips).padStart(5, '0'),
    countyName: String(r.county_name || '').replace(/\s+County$/i, ''),
    state: String(r.state_abbr || '').toUpperCase(),
  }));

  return { disasterNumber: normalized, counties, count: counties.length };
}

/** Test helper */
export function resetDisasterPolicyMemoryForTests() {
  memoryEvents.clear();
}
