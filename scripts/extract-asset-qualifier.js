#!/usr/bin/env node
// Minimal Excel extractor for Asset Qualifier workbook
// Usage: node scripts/extract-asset-qualifier.js "data/30 Retail Lending - Asset Qualifier Calculator, August 10, 2022.xlsx" > asset-qualifier.json

import fs from 'fs';
import path from 'path';

function colToLetter(col) {
  let letter = '';
  let c = col;
  while (c >= 0) {
    letter = String.fromCharCode((c % 26) + 65) + letter;
    c = Math.floor(c / 26) - 1;
  }
  return letter;
}

async function main() {
  const xlsxPath = process.argv[2] || 'data/30 Retail Lending - Asset Qualifier Calculator, August 10, 2022.xlsx';

  let ExcelJS;
  try {
    ExcelJS = (await import('exceljs')).default;
  } catch (e) {
    console.error('Missing dependency: exceljs. Install with: npm i exceljs');
    process.exit(1);
  }

  if (!fs.existsSync(xlsxPath)) {
    console.error(`File not found: ${xlsxPath}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(xlsxPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const result = {
    file: path.basename(xlsxPath),
    sheets: [],
    extractedAt: new Date().toISOString()
  };

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    const rows = [];

    worksheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
      const rowData = [];
      const vals = row.values;
      const numCols = vals ? vals.length - 1 : 0;
      for (let c = 1; c <= numCols; c++) {
        const cell = row.getCell(c);
        const addr = colToLetter(c - 1) + rowNum;
        rowData.push({
          a1: addr,
          v: cell.value ?? null,
          t: cell.type ?? null,
          f: cell.formula ?? null
        });
      }
      rows.push(rowData);
    });

    // Heuristic: first non-empty row as headers
    const headerRowIdx = rows.findIndex((r) => r && r.some((cell) => cell && String(cell.v || '').trim() !== ''));
    const headers = headerRowIdx >= 0 ? rows[headerRowIdx].map((cell) => (cell && cell.v != null ? String(cell.v).trim() : '')) : [];

    // Collect formula cells
    const formulas = [];
    rows.forEach((r) => {
      if (!r) return;
      r.forEach((cell) => {
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
