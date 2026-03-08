import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { getPool } from './database.service.js';
import { extractFieldIdsFromTarget } from '../public/shared/unit-tests-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UNIT_TESTS_DIR = path.join(__dirname, '..', 'data', 'unit-tests');

/**
 * Parse Excel buffer and extract headers, rows, and field IDs from Target column.
 * Matches unit-tests.js format: Step, Action, Target, Description.
 */
async function parseUnitTestExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Workbook has no worksheets');
  // ExcelJS row.values truncates trailing empty cells (issue #1456); use getCell to preserve all columns
  const jsonData = [];
  let maxCol = sheet.columnCount || 0;
  sheet.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber > maxCol) maxCol = colNumber;
    });
  });
  const colCount = Math.max(maxCol, 50);
  sheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
    const rowData = [];
    for (let c = 1; c <= colCount; c++) {
      const v = row.getCell(c).value;
      rowData.push(v == null ? '' : v);
    }
    jsonData.push(rowData);
  });

  if (!jsonData.length) {
    throw new Error('Excel file is empty');
  }

  // Find header row (contains "Step")
  let headerRowIndex = -1;
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    const firstCell = String(row[0] || '').toLowerCase().trim();
    const rowString = row.map((cell) => String(cell || '').toLowerCase().trim()).join(' ');
    if (firstCell === 'step' || rowString.includes('step')) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex === -1) headerRowIndex = 0;

  const headers = jsonData[headerRowIndex].map((h) => String(h || '').trim());
  const targetColIndex = headers.findIndex((h) => String(h).toLowerCase().trim() === 'target');
  const dataRows = jsonData.slice(headerRowIndex + 1);

  const fieldIds = new Set();
  const rows = dataRows
    .map((rawRow) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = rawRow[idx];
      });
      return obj;
    })
    .filter((obj) => {
      const hasData = Object.values(obj).some((v) => String(v || '').trim() !== '');
      if (hasData && targetColIndex >= 0 && obj[headers[targetColIndex]] != null) {
        const ids = extractFieldIdsFromTarget(obj[headers[targetColIndex]]);
        ids.forEach((id) => fieldIds.add(id));
      }
      return hasData;
    });

  return {
    headers,
    rows,
    fieldIds: [...fieldIds],
    rowCount: rows.length,
  };
}

/**
 * Save uploaded unit test file to DB (file_content BYTEA).
 * Stored in database so library works from any machine sharing the same DB.
 * @param {Buffer} buffer - Excel file buffer
 * @param {string} originalName - User's original filename
 * @returns {Promise<object>} Saved record
 */
export async function saveUnitTestFile(buffer, originalName) {
  const fileName = `${crypto.randomUUID()}.xlsx`;
  const { fieldIds, rowCount } = await parseUnitTestExcel(buffer);

  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  const result = await pool.query(
    `INSERT INTO unit_test_files (file_name, original_name, field_ids, row_count, file_content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [fileName, originalName || fileName, JSON.stringify(fieldIds), rowCount, buffer]
  );

  return result.rows[0];
}

/**
 * List all stored unit test files.
 */
export async function listUnitTestFiles() {
  const pool = getPool();
  if (!pool) return [];

  const result = await pool.query(
    `SELECT id, file_name, original_name, field_ids, row_count, uploaded_at
     FROM unit_test_files
     ORDER BY uploaded_at DESC`
  );
  return result.rows;
}

/**
 * Get unit test file by id. Returns metadata and file buffer.
 * Reads from DB file_content first (portable across machines); falls back to disk for legacy records.
 */
export async function getUnitTestFile(id) {
  const pool = getPool();
  if (!pool) throw new Error('Database not available');

  const result = await pool.query(
    `SELECT id, file_name, original_name, field_ids, row_count, file_content FROM unit_test_files WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    return null;
  }

  const record = result.rows[0];
  let buffer = record.file_content ? Buffer.from(record.file_content) : null;

  if (!buffer) {
    const filePath = path.join(UNIT_TESTS_DIR, record.file_name);
    try {
      buffer = await fs.readFile(filePath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`File not found. Re-upload or use "Save to Library" to restore.`);
      }
      throw err;
    }
  }

  const { file_content, ...meta } = record;
  return { ...meta, buffer };
}

/**
 * Search unit test files by field ID (JSONB ? operator).
 */
export async function searchByFieldId(fieldId) {
  const pool = getPool();
  if (!pool) return [];

  const result = await pool.query(
    `SELECT id, file_name, original_name, field_ids, row_count, uploaded_at
     FROM unit_test_files
     WHERE field_ids ? $1
     ORDER BY uploaded_at DESC`,
    [String(fieldId).trim()]
  );
  return result.rows;
}

/**
 * Delete unit test file from DB (and disk if legacy record).
 */
export async function deleteUnitTestFile(id) {
  const pool = getPool();
  if (!pool) throw new Error('Database not available');

  const result = await pool.query(
    `SELECT file_name, file_content FROM unit_test_files WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    return false;
  }

  await pool.query(`DELETE FROM unit_test_files WHERE id = $1`, [id]);

  const row = result.rows[0];
  if (!row.file_content) {
    const filePath = path.join(UNIT_TESTS_DIR, row.file_name);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.warn('Could not delete legacy file from disk:', filePath, err.message);
    }
  }

  return true;
}
