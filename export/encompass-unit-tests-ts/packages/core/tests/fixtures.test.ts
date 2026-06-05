import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { describe, expect, test } from 'vitest';
import { parseLoanSnapshotJson } from '../src/runner/parseLoanSnapshot.js';
import { parseWorkbookJson } from '../src/workbook/parseWorkbook.js';

const samplesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../samples'
);

describe('fixture schemas', () => {
  test('samples/workbook.json parses', () => {
    const raw = JSON.parse(readFileSync(path.join(samplesDir, 'workbook.json'), 'utf8'));
    const wb = parseWorkbookJson(raw);
    expect(wb.headers).toContain('Test 1');
    expect(wb.rows.length).toBeGreaterThan(0);
  });

  test('samples/loan-snapshot.json parses', () => {
    const raw = JSON.parse(readFileSync(path.join(samplesDir, 'loan-snapshot.json'), 'utf8'));
    const snap = parseLoanSnapshotJson(raw);
    expect(snap.fields).toBeTruthy();
    expect(snap.calculatedFields?.CUST11FV?.calculation).toContain('IIf');
  });
});
