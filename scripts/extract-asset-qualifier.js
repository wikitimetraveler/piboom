#!/usr/bin/env node
// Minimal Excel extractor for Asset Qualifier workbook
// Usage: node scripts/extract-asset-qualifier.js "data/30 Retail Lending - Asset Qualifier Calculator, August 10, 2022.xlsx" > asset-qualifier.json

import fs from 'fs';
import path from 'path';

async function main() {
  const xlsxPath = process.argv[2] || 'data/30 Retail Lending - Asset Qualifier Calculator, August 10, 2022.xlsx';

  // Lazy-load xlsx so this script fails gracefully if not installed
  let XLSX;
  try {
    XLSX = await import('xlsx');
  } catch (e) {
    console.error('Missing dependency: xlsx. Install with: npm i xlsx');
    process.exit(1);
  }

  if (!fs.existsSync(xlsxPath)) {
    console.error(`File not found: ${xlsxPath}`);
    process.exit(1);
  }

  const wb = XLSX.read(fs.readFileSync(xlsxPath), { type: 'buffer', cellFormula: true, cellHTML: false, cellNF: true });
  const sheets = wb.SheetNames;

  const result = {
    file: path.basename(xlsxPath),
    sheets: [],
    extractedAt: new Date().toISOString()
  };

  for (const sheetName of sheets) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    // Convert to JSON rows while preserving raw cell objects for formulas
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const rows = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell) {
          row.push({
            a1: addr,
            v: cell.v ?? null,
            t: cell.t ?? null,
            f: cell.f ?? null // formula, if present
          });
        } else {
          row.push(null);
        }
      }
      rows.push(row);
    }

    // Heuristic: first non-empty row as headers
    const headerRowIdx = rows.findIndex(r => r && r.some(cell => cell && String(cell.v || '').trim() !== ''));
    const headers = headerRowIdx >= 0 ? rows[headerRowIdx].map(cell => (cell && cell.v != null ? String(cell.v).trim() : '')) : [];

    // Collect formula cells
    const formulas = [];
    rows.forEach(r => {
      if (!r) return;
      r.forEach(cell => {
        if (cell && cell.f) {
          formulas.push({ a1: cell.a1, f: cell.f, v: cell.v ?? null });
        }
      });
    });

    result.sheets.push({
      name: sheetName,
      size: { rows: rows.length, cols: rows[0] ? rows[0].length : 0 },
      headerRowIdx,
      headers,
      formulaCount: formulas.length,
      formulas
    });
  }

  // Output JSON to stdout
  process.stdout.write(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


