import type { TestColumn, UnitTestRow, UnitTestWorkbook } from '../types/workbook.js';

const SCENARIO_HEADER_RE = /^test\s*#?\s*(\d+)$/i;

export function extractTestNumberFromHeader(header: string): string | null {
  const raw = String(header || '').trim();
  if (!raw) return null;
  if (raw.toLowerCase() === 'reset') return 'RESET';
  const m = raw.match(SCENARIO_HEADER_RE);
  if (m) return m[1];
  return null;
}

export function isScenarioColumnHeader(header: string): boolean {
  const raw = String(header || '').trim();
  if (!raw) return false;
  return raw.toLowerCase() === 'reset' || SCENARIO_HEADER_RE.test(raw);
}

/** Resolve Test 1, Test 2, … columns from workbook headers (after Description). */
export function getTestColumnsFromHeaders(headers: string[]): TestColumn[] {
  const descIndex = headers.findIndex((h) => String(h).toLowerCase().trim() === 'description');
  const startIndex = descIndex >= 0 ? descIndex + 1 : 0;
  const result: TestColumn[] = [];
  for (let i = startIndex; i < headers.length; i++) {
    const raw = String(headers[i] || '').trim();
    if (!isScenarioColumnHeader(raw)) break;
    const testNum = extractTestNumberFromHeader(raw) || String(result.length + 1);
    result.push({ field: headers[i], testNumber: testNum });
  }
  return result;
}

export function getTestColumns(workbook: UnitTestWorkbook): TestColumn[] {
  if (workbook.headers?.length) {
    return getTestColumnsFromHeaders(workbook.headers);
  }
  const row = workbook.rows[0];
  if (!row) return [];
  return getTestColumnsFromHeaders(Object.keys(row));
}

export function pickTestColumnForRow(row: UnitTestRow, columns: TestColumn[]): TestColumn | null {
  if (!columns.length) return null;
  const nonEmpty = columns.find((col) => {
    const value = row[col.field];
    return value !== null && value !== undefined && String(value).trim() !== '';
  });
  return nonEmpty || columns[0];
}

export function findTestColumnByNumber(columns: TestColumn[], testNumber: string): TestColumn | null {
  return columns.find((c) => c.testNumber === String(testNumber)) || null;
}

export function parseWorkbookJson(raw: unknown): UnitTestWorkbook {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Workbook must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  const rows = obj.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Workbook must include a non-empty rows array');
  }
  const headers = Array.isArray(obj.headers)
    ? (obj.headers as string[])
    : Object.keys(rows[0] as object);
  return {
    meta: obj.meta as UnitTestWorkbook['meta'],
    headers,
    testDescriptions: obj.testDescriptions as UnitTestWorkbook['testDescriptions'],
    rows: rows as UnitTestRow[],
  };
}
