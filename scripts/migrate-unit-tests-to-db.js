#!/usr/bin/env node
/**
 * Migrate existing unit test files from disk to database (file_content BYTEA).
 * Run on the machine that has data/unit-tests/ with the Excel files.
 * After migration, the library will work from any machine sharing the same DB.
 *
 * Usage: node scripts/migrate-unit-tests-to-db.js
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, createTables, getPool } from '../services/database.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UNIT_TESTS_DIR = path.join(__dirname, '..', 'data', 'unit-tests');

async function main() {
  try {
    initializeDatabase();
    await createTables();
  } catch (err) {
    console.error('Database init failed:', err.message);
    process.exit(1);
  }

  const pool = getPool();
  if (!pool) {
    console.error('Database not available.');
    process.exit(1);
  }

  const result = await pool.query(
    `SELECT id, file_name, original_name FROM unit_test_files WHERE file_content IS NULL`
  );

  if (result.rows.length === 0) {
    console.log('No records to migrate (all have file_content).');
    process.exit(0);
  }

  console.log(`Found ${result.rows.length} record(s) without file_content. Migrating from disk...`);

  let migrated = 0;
  let failed = 0;

  for (const row of result.rows) {
    const filePath = path.join(UNIT_TESTS_DIR, row.file_name);
    try {
      const buffer = await fs.readFile(filePath);
      await pool.query(
        `UPDATE unit_test_files SET file_content = $1 WHERE id = $2`,
        [buffer, row.id]
      );
      console.log(`  OK: ${(row.original_name || row.file_name)} (id=${row.id})`);
      migrated++;
    } catch (err) {
      console.error(`  FAIL: ${row.file_name} (id=${row.id}) - ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
