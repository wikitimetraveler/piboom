#!/usr/bin/env node
/** FEMA-only disaster ingest smoke test */
import 'dotenv/config';
import { initializeDatabase, createTables } from '../../services/database.service.js';
import { initDisastersSchema, ingestFema } from '../../services/disasters.service.js';
import { getPool } from '../../services/database.service.js';

async function main() {
  console.log('FEMA-only pull');
  const pool = initializeDatabase();
  if (!pool) {
    console.error('BLOCKED: DATABASE_URL not set');
    process.exit(1);
  }
  await createTables();
  await initDisastersSchema();

  const before = await pool.query(`SELECT COUNT(*)::int AS n FROM disasters WHERE source = 'fema'`);
  console.log('FEMA rows in DB before:', before.rows[0]?.n ?? 0);

  const result = await ingestFema();
  console.log('Ingest result:', result);

  const after = await pool.query(`SELECT COUNT(*)::int AS n FROM disasters WHERE source = 'fema'`);
  const recent = await pool.query(
    `SELECT state_abbr, county_name, title, start_time
     FROM disasters WHERE source = 'fema'
     ORDER BY start_time DESC NULLS LAST LIMIT 5`
  );
  console.log('FEMA rows in DB after:', after.rows[0]?.n ?? 0);
  console.log('Latest 5 FEMA rows:');
  recent.rows.forEach((r) => console.log(`  - ${r.start_time?.toISOString?.()?.slice(0, 10) || r.start_time} | ${r.county_name}, ${r.state_abbr} | ${r.title}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
