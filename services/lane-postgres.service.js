/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { getPool } from './database.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const LANE_JSON_FILE_RE = /^lane.*\.json$/i;
const CORE_DATASET_KEY = 'laneData';
const LANE_JSON_SKIP_RE = /(backup|\.schema\.json$)/i;

function toDatasetKey(fileName) {
  return String(fileName || '').replace(/\.json$/i, '');
}

function toChecksum(value) {
  const asString = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('sha256').update(asString).digest('hex');
}

async function listLaneJsonFiles() {
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        LANE_JSON_FILE_RE.test(entry.name) &&
        !LANE_JSON_SKIP_RE.test(entry.name)
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function parseYearNumber(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

async function replaceLaneGraphTables(client, laneDataDoc) {
  const nodes = Array.isArray(laneDataDoc?.nodes) ? laneDataDoc.nodes : [];
  const links = Array.isArray(laneDataDoc?.links) ? laneDataDoc.links : [];

  await client.query('DELETE FROM lane_relationship');
  await client.query('DELETE FROM lane_person');

  for (const node of nodes) {
    const payload = node && typeof node === 'object' ? node : {};
    const personId = Number(payload.id);
    if (!Number.isFinite(personId)) continue;
    await client.query(
      `INSERT INTO lane_person
        (person_id, name, generation, gender, birth_year, death_year_text, born, death_place, payload, updated_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (person_id) DO UPDATE SET
        name = EXCLUDED.name,
        generation = EXCLUDED.generation,
        gender = EXCLUDED.gender,
        birth_year = EXCLUDED.birth_year,
        death_year_text = EXCLUDED.death_year_text,
        born = EXCLUDED.born,
        death_place = EXCLUDED.death_place,
        payload = EXCLUDED.payload,
        updated_at = CURRENT_TIMESTAMP`,
      [
        personId,
        String(payload.name || '').trim() || `Person ${personId}`,
        Number.isFinite(Number(payload.generation)) ? Number(payload.generation) : null,
        typeof payload.gender === 'string' ? payload.gender.trim() : null,
        parseYearNumber(payload.birthYear),
        payload.deathYear == null ? null : String(payload.deathYear),
        payload.born == null ? null : String(payload.born),
        payload.deathPlace == null ? null : String(payload.deathPlace),
        JSON.stringify(payload)
      ]
    );
  }

  for (const link of links) {
    const payload = link && typeof link === 'object' ? link : {};
    const sourceId = Number(payload.source);
    const targetId = Number(payload.target);
    const relation = String(payload.relation || '').trim();
    if (!Number.isFinite(sourceId) || !Number.isFinite(targetId) || !relation) continue;

    await client.query(
      `INSERT INTO lane_relationship
        (source_person_id, target_person_id, relation, payload, updated_at)
       VALUES
        ($1, $2, $3, $4::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (source_person_id, target_person_id, relation) DO UPDATE SET
        payload = EXCLUDED.payload,
        updated_at = CURRENT_TIMESTAMP`,
      [sourceId, targetId, relation, JSON.stringify(payload)]
    );
  }
}

export async function upsertLaneDataset(client, datasetKey, sourceFile, payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const checksum = toChecksum(body);
  await client.query(
    `INSERT INTO lane_dataset (dataset_key, source_file, payload, checksum_sha256, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (dataset_key) DO UPDATE SET
       source_file = EXCLUDED.source_file,
       payload = EXCLUDED.payload,
       checksum_sha256 = EXCLUDED.checksum_sha256,
       updated_at = CURRENT_TIMESTAMP`,
    [datasetKey, sourceFile, JSON.stringify(body), checksum]
  );
}

/**
 * Idempotent backfill for all data/lane*.json files.
 */
export async function backfillLaneDataFromFilesystem() {
  const pool = getPool();
  if (!pool) return { imported: 0, graphRebuilt: false, files: [] };

  const files = await listLaneJsonFiles();
  if (!files.length) return { imported: 0, graphRebuilt: false, files: [] };

  const client = await pool.connect();
  let graphRebuilt = false;
  try {
    await client.query('BEGIN');
    for (const fileName of files) {
      const fullPath = path.join(DATA_DIR, fileName);
      const raw = await fs.readFile(fullPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const datasetKey = toDatasetKey(fileName);
      await upsertLaneDataset(client, datasetKey, `data/${fileName}`, parsed);
      if (datasetKey === CORE_DATASET_KEY) {
        await replaceLaneGraphTables(client, parsed);
        graphRebuilt = true;
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw error;
  } finally {
    client.release();
  }

  return { imported: files.length, graphRebuilt, files };
}

export async function getLaneGraphDataFromPostgres() {
  const pool = getPool();
  if (!pool) return null;
  const [nodesRes, linksRes] = await Promise.all([
    pool.query(`SELECT payload FROM lane_person ORDER BY person_id`),
    pool.query(`SELECT payload FROM lane_relationship ORDER BY relationship_id`)
  ]);
  if (!nodesRes.rows.length) return null;
  return {
    nodes: nodesRes.rows.map((row) => row.payload || {}),
    links: linksRes.rows.map((row) => row.payload || {})
  };
}

export async function getLaneDatasetFromPostgres(datasetKey) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(
    `SELECT payload FROM lane_dataset WHERE dataset_key = $1`,
    [String(datasetKey || '').trim()]
  );
  return res.rows[0]?.payload || null;
}

export async function getAllPeopleFromPostgres() {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(`SELECT payload FROM lane_person ORDER BY person_id`);
  return res.rows.map((row) => row.payload || {});
}

export async function getPersonByIdFromPostgres(personId) {
  const pool = getPool();
  const id = Number(personId);
  if (!pool || !Number.isFinite(id)) return null;
  const res = await pool.query(`SELECT payload FROM lane_person WHERE person_id = $1`, [id]);
  return res.rows[0]?.payload || null;
}

export async function getRelationshipsForPersonFromPostgres(personId) {
  const pool = getPool();
  const id = Number(personId);
  if (!pool || !Number.isFinite(id)) return [];
  const res = await pool.query(
    `SELECT
        r.relation,
        r.source_person_id,
        r.target_person_id,
        p.payload AS other_person
      FROM lane_relationship r
      JOIN lane_person p
        ON p.person_id = CASE WHEN r.source_person_id = $1 THEN r.target_person_id ELSE r.source_person_id END
      WHERE r.source_person_id = $1 OR r.target_person_id = $1
      ORDER BY r.relationship_id`,
    [id]
  );
  return res.rows.map((row) => ({
    relation: String(row.relation),
    person: row.other_person || null,
    direction: Number(row.source_person_id) === id ? 'from' : 'to'
  }));
}

export async function getParentsForPersonFromPostgres(personId) {
  const id = Number(personId);
  if (!Number.isFinite(id)) return [];
  const rels = await getRelationshipsForPersonFromPostgres(id);
  return rels
    .filter((rel) => rel.direction === 'from' && (rel.relation === 'father' || rel.relation === 'mother'))
    .map((rel) => ({ relation: rel.relation, person: rel.person }));
}

export async function getChildrenForPersonFromPostgres(personId) {
  const pool = getPool();
  const id = Number(personId);
  if (!pool || !Number.isFinite(id)) return [];
  const res = await pool.query(
    `SELECT c.payload AS child
     FROM lane_relationship r
     JOIN lane_person c ON c.person_id = r.source_person_id
     WHERE r.target_person_id = $1
       AND r.relation IN ('father', 'mother')
     ORDER BY c.person_id`,
    [id]
  );
  return res.rows.map((row) => row.child || {}).filter(Boolean);
}

export async function getSpousesForPersonFromPostgres(personId) {
  const rels = await getRelationshipsForPersonFromPostgres(personId);
  return rels.filter((rel) => rel.relation === 'spouse').map((rel) => rel.person).filter(Boolean);
}

export async function getAllLaneDatasetsFromPostgres() {
  const pool = getPool();
  if (!pool) return {};
  const res = await pool.query(`SELECT dataset_key, payload FROM lane_dataset`);
  const out = {};
  for (const row of res.rows) {
    out[String(row.dataset_key)] = row.payload || null;
  }
  return out;
}

/**
 * Recursive CTE for direct-ancestor line via father/mother edges.
 */
export async function getDirectAncestorLineIdsFromPostgres(startId, maxDepth = 64) {
  const pool = getPool();
  const sid = Number(startId);
  if (!pool || !Number.isFinite(sid)) return [];
  const sql = `
    WITH RECURSIVE lineage(person_id, depth, path) AS (
      SELECT $1::int, 0, ARRAY[$1::int]
      UNION ALL
      SELECT r.target_person_id, lineage.depth + 1, lineage.path || r.target_person_id
      FROM lineage
      JOIN lane_relationship r
        ON r.source_person_id = lineage.person_id
       AND r.relation IN ('father', 'mother')
      WHERE lineage.depth < $2::int
        AND NOT (r.target_person_id = ANY(lineage.path))
    )
    SELECT person_id, depth
    FROM lineage
    ORDER BY depth
  `;
  const res = await pool.query(sql, [sid, Number(maxDepth) || 64]);
  return res.rows.map((row) => Number(row.person_id)).filter((id) => Number.isFinite(id));
}

/**
 * Recursive CTE for deterministic direct-descendant path:
 * earliest documented child birth year, then lexical name.
 */
export async function getDirectDescendantLineIdsFromPostgres(startId, maxDepth = 64) {
  const pool = getPool();
  const sid = Number(startId);
  if (!pool || !Number.isFinite(sid)) return [];
  const sql = `
    WITH RECURSIVE line(person_id, depth, path) AS (
      SELECT $1::int, 0, ARRAY[$1::int]
      UNION ALL
      SELECT child.child_id, line.depth + 1, line.path || child.child_id
      FROM line
      JOIN LATERAL (
        SELECT r.source_person_id AS child_id
        FROM lane_relationship r
        LEFT JOIN lane_person c ON c.person_id = r.source_person_id
        WHERE r.target_person_id = line.person_id
          AND r.relation IN ('father', 'mother')
          AND NOT (r.source_person_id = ANY(line.path))
        ORDER BY COALESCE(c.birth_year, 99999), lower(COALESCE(c.name, '')), r.source_person_id
        LIMIT 1
      ) child ON true
      WHERE line.depth < $2::int
    )
    SELECT person_id, depth
    FROM line
    ORDER BY depth
  `;
  const res = await pool.query(sql, [sid, Number(maxDepth) || 64]);
  return res.rows.map((row) => Number(row.person_id)).filter((id) => Number.isFinite(id));
}
