#!/usr/bin/env node
/**
 * Bulk import unit test Excel files into the library.
 * Usage: node scripts/import-unit-tests.js <directory>
 * Example: node scripts/import-unit-tests.js ./public/unitTests
 *
 * Reads all .xlsx files from the directory, saves to data/unit-tests/,
 * extracts field IDs, and inserts into unit_test_files table.
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, createTables, getPool } from '../services/database.service.js';
import { saveUnitTestFile } from '../services/unit-tests-file.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: node scripts/import-unit-tests.js <directory>');
    process.exit(1);
  }

  // Initialize database
  try {
    initializeDatabase();
    await createTables();
  } catch (err) {
    console.error('Database init failed:', err.message);
    process.exit(1);
  }

  const resolvedDir = path.resolve(dir);
  let entries;
  try {
    entries = await fs.readdir(resolvedDir, { withFileTypes: true });
  } catch (err) {
    console.error('Error reading directory:', err.message);
    process.exit(1);
  }

  const files = entries
    .filter((e) => e.isFile() && /\.xlsx$/i.test(e.name))
    .map((e) => path.join(resolvedDir, e.name));

  if (files.length === 0) {
    console.log('No .xlsx files found in', resolvedDir);
    process.exit(0);
  }

  console.log(`Found ${files.length} Excel file(s). Importing...`);

  const pool = getPool();
  if (!pool) {
    console.error('Database not available. Ensure DATABASE_URL is set and server has initialized DB.');
    process.exit(1);
  }

  let imported = 0;
  let failed = 0;

  for (const filePath of files) {
    const baseName = path.basename(filePath);
    try {
      const buffer = await fs.readFile(filePath);
      const record = await saveUnitTestFile(buffer, baseName);
      console.log(`  OK: ${baseName} (id=${record.id}, ${record.row_count} rows, ${(record.field_ids || []).length} fields)`);
      imported++;
    } catch (err) {
      console.error(`  FAIL: ${baseName} - ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Imported: ${imported}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
