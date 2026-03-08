import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { getFieldPath, coerce as coerceUtil } from '../public/shared/unit-tests-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const headerAliases = {
  loanguid: ['loanguid', 'loan guid', 'loan_guid', 'loanid', 'loan id', 'loan_id', 'guid'],
  field: ['field', 'fieldpath', 'jsonpath', 'path', 'target'],
  expected: ['expected', 'expected value', 'expectedvalue', 'value', 'calculation', 'calc', 'set'],
};

const operators = {
  equals: (actual, expected) => actual === expected,
  contains: (actual, expected) =>
    typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected),
  gt: (actual, expected) => Number(actual) > Number(expected),
  gte: (actual, expected) => Number(actual) >= Number(expected),
  lt: (actual, expected) => Number(actual) < Number(expected),
  lte: (actual, expected) => Number(actual) <= Number(expected),
  not: (actual, expected) => actual !== expected,
  regex: (actual, expected) => {
    if (typeof actual !== 'string') return false;
    return new RegExp(expected).test(actual);
  },
};

function normalizeHeaderValue(value) {
  return String(value || '').toLowerCase().trim();
}

function baseHeaderKey(key) {
  return String(key || '').toLowerCase().trim().replace(/__\d+$/, '');
}

function isNumericHeader(value) {
  return /^\d+$/.test(String(value || '').trim());
}

function normalizeKeys(row) {
  const normalized = {};
  Object.keys(row).forEach((key) => {
    normalized[key.toLowerCase().trim()] = row[key];
  });
  return normalized;
}

function isEmptyRow(row) {
  return Object.values(row).every((value) => value === null || value === undefined || value === '');
}

function pickValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return null;
}

function extractFieldId(value) {
  const fieldPath = getFieldPath(value);
  return fieldPath ?? '';
}

function toOperator(value) {
  if (!value) return 'equals';
  const cleaned = String(value).toLowerCase().trim();
  if (['=', 'eq', 'equals', 'equal'].includes(cleaned)) return 'equals';
  if (['contains', 'include', 'includes'].includes(cleaned)) return 'contains';
  if (['gt', '>'].includes(cleaned)) return 'gt';
  if (['gte', '>='].includes(cleaned)) return 'gte';
  if (['lt', '<'].includes(cleaned)) return 'lt';
  if (['lte', '<='].includes(cleaned)) return 'lte';
  if (['not', 'neq', '!='].includes(cleaned)) return 'not';
  if (['regex', 'matches', 'match'].includes(cleaned)) return 'regex';
  return 'equals';
}

function coerce(value) {
  return coerceUtil(value);
}

function getValueByPath(obj, pathValue) {
  if (!obj || !pathValue) return undefined;
  const parts = String(pathValue)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const normalized = row.map(normalizeHeaderValue);
    const hasField = normalized.some((cell) => headerAliases.field.includes(cell));
    const hasExpected = normalized.some(
      (cell) => headerAliases.expected.includes(cell) || isNumericHeader(cell),
    );
    if (hasField && hasExpected) {
      return i;
    }
  }
  return -1;
}

async function parseWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Workbook has no worksheets');
  const rows = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
    const vals = row.values;
    rows.push((vals && vals.length > 1 ? vals.slice(1) : []).map((v) => (v == null ? '' : v)));
  });
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex === -1) {
    throw new Error('Missing required columns (field + expected). Update the sheet headers.');
  }
  const headerCounts = new Map();
  const headers = rows[headerRowIndex].map((value) => {
    const rawHeader = String(value || '').trim();
    if (!rawHeader) return '';
    const base = rawHeader;
    const count = (headerCounts.get(base) || 0) + 1;
    headerCounts.set(base, count);
    return count > 1 ? `${base}__${count}` : base;
  });
  const dataRows = rows.slice(headerRowIndex + 1);
  return dataRows
    .map((row) => {
      const obj = {};
      headers.forEach((header, idx) => {
        if (!header) return;
        obj[header] = row[idx];
      });
      return obj;
    })
    .filter((row) => !isEmptyRow(row));
}

function createTestCases(rows) {
  const tests = [];
  rows.forEach((row, index) => {
    if (isEmptyRow(row)) {
      return;
    }
    const normalized = normalizeKeys(row);
    const loanGuid = pickValue(normalized, headerAliases.loanguid);
    const rawFieldPath = pickValue(normalized, headerAliases.field);
    const fallbackField =
      pickValue(normalized, ['target', 'fieldid', 'field id', 'field_id']) || rawFieldPath;
    const fieldPath = extractFieldId(fallbackField || rawFieldPath);
    const operator = toOperator(pickValue(normalized, ['operator', 'op', 'comparison']));
    const baseTitle =
      pickValue(normalized, ['test', 'name', 'title', 'description', 'action']) ||
      `Row ${index + 1}`;

    const keys = Object.keys(normalized);
    const expectedColumns = keys.filter((key) => {
      const baseKey = baseHeaderKey(key);
      return headerAliases.expected.includes(baseKey) || isNumericHeader(baseKey);
    });

    if (!expectedColumns.length) {
      tests.push({
        title: baseTitle,
        index,
        loanGuid,
        fieldPath,
        expected: null,
        operator,
      });
      return;
    }

    expectedColumns.forEach((key) => {
      const baseKey = baseHeaderKey(key);
      const label = isNumericHeader(baseKey) ? `Case ${baseKey}` : baseKey;
      tests.push({
        title: expectedColumns.length > 1 ? `${baseTitle} (${label})` : baseTitle,
        index,
        loanGuid,
        fieldPath,
        expected: normalized[key],
        operator,
      });
    });
  });
  return tests;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const [key, rawValue] = token.slice(2).split('=');
      const value = rawValue ?? argv[i + 1];
      if (rawValue === undefined) i += 1;
      args[key] = value === undefined ? true : value;
    } else if (!args.file && !token.startsWith('-')) {
      args.file = token;
    }
  }
  return args;
}

function printUsage() {
  console.log('Usage: node scripts/run-finance-unit-tests.js --file <path> [options]');
  console.log('Options:');
  console.log('  --base-url <url>           API base URL (default: http://localhost:3000)');
  console.log('  --default-loan-guid <id>   Default loan GUID if not supplied per row');
  console.log('  --verbose                  Print every test result');
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = args.file || args.f;
  if (!filePath) {
    printUsage();
    process.exit(1);
  }

  const baseUrl = args['base-url'] || process.env.UNIT_TEST_API_BASE || 'http://localhost:3000';
  const defaultLoanGuid = args['default-loan-guid'] || process.env.DEFAULT_LOAN_GUID || '';
  const verbose = Boolean(args.verbose);

  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  const buffer = await fs.readFile(absolutePath);
  const rows = await parseWorkbook(buffer);
  const tests = createTestCases(rows);

  if (!tests.length) {
    console.log('No tests found in file.');
    return;
  }

  const loanCache = new Map();
  let passed = 0;
  let failed = 0;

  for (const testCase of tests) {
    const loanGuid = testCase.loanGuid || defaultLoanGuid;
    const detailBase = `Loan: ${loanGuid || 'N/A'} | Field: ${testCase.fieldPath || 'N/A'}`;
    if (!loanGuid) {
      failed += 1;
      if (verbose) {
        console.log(`FAIL ${testCase.title} | ${detailBase} | Missing loan GUID`);
      }
      continue;
    }
    if (!testCase.fieldPath) {
      failed += 1;
      if (verbose) {
        console.log(`FAIL ${testCase.title} | ${detailBase} | Missing field path`);
      }
      continue;
    }

    try {
      let loan = loanCache.get(loanGuid);
      if (!loan) {
        const response = await fetch(
          `${baseUrl}/api/encompass-hub/loans/${encodeURIComponent(loanGuid)}`,
          { cache: 'no-store' },
        );
        if (!response.ok) {
          throw new Error(`Loan API failed (${response.status})`);
        }
        loan = await response.json();
        loanCache.set(loanGuid, loan);
      }

      const actual = getValueByPath(loan, testCase.fieldPath);
      const expected = coerce(testCase.expected);
      const actualValue = coerce(actual);
      const evaluator = operators[testCase.operator] || operators.equals;
      const ok = evaluator(actualValue, expected);
      if (ok) {
        passed += 1;
        if (verbose) {
          console.log(`PASS ${testCase.title} | ${detailBase} | Expected ${expected}`);
        }
      } else {
        failed += 1;
        console.log(
          `FAIL ${testCase.title} | ${detailBase} | Expected ${expected} | Actual ${actualValue}`,
        );
      }
    } catch (error) {
      failed += 1;
      console.log(`FAIL ${testCase.title} | ${detailBase} | ${error.message}`);
    }
  }

  console.log(`Run complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(`Runner failed: ${error.message}`);
  process.exit(1);
});
