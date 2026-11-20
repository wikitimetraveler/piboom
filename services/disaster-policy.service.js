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
  governor_declaration_date DATE,
  amerihome_emergency_declaration_date DATE,
  amerihome_disaster_announcement TEXT,
  amerihome_treasury_hold BOOLEAN NOT NULL DEFAULT FALSE,
  amerihome_funding_suspension BOOLEAN NOT NULL DEFAULT FALSE,
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
  console.log('✅ Disaster policy schema ensured');
  return { mode: 'postgres' };
}

function asDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function asBool(v, fallback = false) {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return fallback;
}

function normalizeArea(raw) {
  const countyCode = String(raw?.countyCode || raw?.county_code || '').padStart(5, '0').slice(0, 5);
  const state = String(raw?.state || '').toUpperCase().slice(0, 2);
  const countyName = String(raw?.countyName || raw?.county_name || '').trim();
  if (!/^\d{5}$/.test(countyCode) || !/^[A-Z]{2}$/.test(state) || !countyName) {
    const err = new Error('AREA_INVALID');
    err.code = 'AREA_INVALID';
    throw err;
  }
  return {
    id: crypto.randomUUID(),
    countyCode,
    countyName,
    state,
    zipCode: raw?.zipCode || raw?.zip_code || null,
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
  const areas = areasIn.map(normalizeArea);

  const treasuryHold =
    kind === 'pending' && status === 'active'
      ? true
      : asBool(body.amerihomeTreasuryHold ?? body.amerihome_treasury_hold, false);

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
    governorDeclarationDate: asDate(
      body.governorDeclarationDate || body.governor_declaration_date
    ),
    amerihomeEmergencyDeclarationDate: asDate(
      body.amerihomeEmergencyDeclarationDate || body.amerihome_emergency_declaration_date
    ),
    amerihomeDisasterAnnouncement:
      body.amerihomeDisasterAnnouncement || body.amerihome_disaster_announcement || null,
    amerihomeTreasuryHold: treasuryHold,
    amerihomeFundingSuspension: asBool(
      body.amerihomeFundingSuspension ?? body.amerihome_funding_suspension,
      false
    ),
    incidentBeginDate: asDate(body.incidentBeginDate || body.incident_begin_date),
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
    femaEmergencyDeclarationDate:
      row.fema_emergency_declaration_date ?? row.femaEmergencyDeclarationDate,
    femaMajorDisasterDeclarationDate:
      row.fema_major_disaster_declaration_date ?? row.femaMajorDisasterDeclarationDate,
    presidentialDeclarationDate:
      row.presidential_declaration_date ?? row.presidentialDeclarationDate,
    governorDeclarationDate: row.governor_declaration_date ?? row.governorDeclarationDate,
    amerihomeEmergencyDeclarationDate:
      row.amerihome_emergency_declaration_date ?? row.amerihomeEmergencyDeclarationDate,
    amerihomeDisasterAnnouncement:
      row.amerihome_disaster_announcement ?? row.amerihomeDisasterAnnouncement,
    amerihomeTreasuryHold: Boolean(
      row.amerihome_treasury_hold ?? row.amerihomeTreasuryHold
    ),
    amerihomeFundingSuspension: Boolean(
      row.amerihome_funding_suspension ?? row.amerihomeFundingSuspension
    ),
    incidentBeginDate: row.incident_begin_date ?? row.incidentBeginDate,
    createdBy: row.created_by ?? row.createdBy,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    areas: areas.map((a) => ({
      id: a.id,
      countyCode: a.county_code ?? a.countyCode,
      countyName: a.county_name ?? a.countyName,
      state: a.state,
      zipCode: a.zip_code ?? a.zipCode,
      incidentBeginDate: a.incident_begin_date ?? a.incidentBeginDate,
      incidentEndDate: a.incident_end_date ?? a.incidentEndDate,
      inspectionRequiredAppraisalsOnOrBefore:
        a.inspection_required_appraisals_on_or_before ??
        a.inspectionRequiredAppraisalsOnOrBefore,
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
    governorDeclarationDate: normalized.governorDeclarationDate,
    amerihomeEmergencyDeclarationDate: normalized.amerihomeEmergencyDeclarationDate,
    amerihomeDisasterAnnouncement: normalized.amerihomeDisasterAnnouncement,
    amerihomeTreasuryHold: normalized.amerihomeTreasuryHold,
    amerihomeFundingSuspension: normalized.amerihomeFundingSuspension,
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
        presidential_declaration_date, governor_declaration_date,
        amerihome_emergency_declaration_date, amerihome_disaster_announcement,
        amerihome_treasury_hold, amerihome_funding_suspension, incident_begin_date, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
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
        normalized.governorDeclarationDate,
        normalized.amerihomeEmergencyDeclarationDate,
        normalized.amerihomeDisasterAnnouncement,
        normalized.amerihomeTreasuryHold,
        normalized.amerihomeFundingSuspension,
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
  const areas = (Array.isArray(areasIn) ? areasIn : []).map(normalizeArea);
  if (!areas.length) {
    const err = new Error('AREAS_REQUIRED');
    err.code = 'AREAS_REQUIRED';
    throw err;
  }

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
    if (mem.kind === 'pending' && next === 'active') mem.amerihomeTreasuryHold = true;
    mem.updatedAt = new Date().toISOString();
    memoryEvents.set(event.id, mem);
    return publicEvent(mem, mem.areas);
  }

  const treasury =
    event.kind === 'pending' && next === 'active' ? true : event.amerihomeTreasuryHold;
  await pool.query(
    `UPDATE disaster_policy_events
     SET status = $2, amerihome_treasury_hold = $3, updated_at = NOW()
     WHERE id = $1`,
    [event.id, next, treasury]
  );
  return getPolicyEvent(event.id);
}

/**
 * Match mock pipeline loans by state + county name for impact preview.
 */
export async function findImpactedLoans(eventId) {
  const event = await getPolicyEvent(eventId);
  if (!event) return { event: null, loans: [], count: 0 };

  const pool = getPool();
  if (!pool) {
    return { event, loans: [], count: 0, mode: 'memory' };
  }

  const pairs = event.areas.map((a) => [a.state, a.countyName.toLowerCase()]);
  if (!pairs.length) return { event, loans: [], count: 0 };

  const { rows } = await pool.query(
    `SELECT id, loan_number, borrower_name, property_address, city, state, county, zip_code,
            milestone, loan_amount, disaster_risk_score
     FROM loans
     WHERE EXISTS (
       SELECT 1 FROM disaster_policy_areas a
       WHERE a.event_id = $1
         AND a.state = loans.state
         AND LOWER(REPLACE(a.county_name, ' County', '')) = LOWER(REPLACE(loans.county, ' County', ''))
     )
     ORDER BY state, county, loan_number
     LIMIT 500`,
    [event.id]
  );

  return {
    event,
    loans: rows.map((r) => ({
      id: r.id,
      loanNumber: r.loan_number,
      borrowerName: r.borrower_name,
      propertyAddress: r.property_address,
      city: r.city,
      state: r.state,
      county: r.county,
      zipCode: r.zip_code,
      milestone: r.milestone,
      loanAmount: r.loan_amount,
      disasterRiskScore: r.disaster_risk_score,
      treasuryHold: Boolean(event.amerihomeTreasuryHold && event.status === 'active'),
      fundingSuspension: Boolean(event.amerihomeFundingSuspension && event.status === 'active'),
    })),
    count: rows.length,
  };
}

/** Test helper */
export function resetDisasterPolicyMemoryForTests() {
  memoryEvents.clear();
}
