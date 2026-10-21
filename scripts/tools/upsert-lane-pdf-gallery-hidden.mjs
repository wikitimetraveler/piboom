/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/** Upsert only data/lane-pdf-gallery-hidden.json into Postgres (skip full graph rebuild). */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, createTables, getPool } from '../../services/database.service.js';
import { upsertLaneDataset } from '../../services/lane-postgres.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const FILE = path.join(ROOT, 'data', 'lane-pdf-gallery-hidden.json');

async function main() {
  initializeDatabase();
  await createTables();
  const pool = getPool();
  if (!pool) {
    console.error('No DATABASE_URL / pool');
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  const client = await pool.connect();
  try {
    await upsertLaneDataset(client, 'lane-pdf-gallery-hidden', 'data/lane-pdf-gallery-hidden.json', payload);
    const check = await client.query(
      `SELECT jsonb_array_length(payload->'hiddenImageIds') AS n FROM lane_dataset WHERE dataset_key=$1`,
      ['lane-pdf-gallery-hidden']
    );
    console.log(JSON.stringify({ ok: true, hiddenCount: check.rows[0]?.n }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
