/**
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LIMITS_PATH = path.join(__dirname, '..', 'data', 'gse', 'fhfa-loan-limits-2026.json');

let cache;

function loadLimits() {
  if (!cache) {
    const raw = fs.readFileSync(LIMITS_PATH, 'utf8');
    cache = JSON.parse(raw);
  }
  return cache;
}

export function normalizeCountyName(name) {
  if (name == null || typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * @returns {{ limit: number, highCost: boolean, year: number, matched: { state: string, county: string } } | null}
 */
export function lookupLoanLimit(state, county, units) {
  const data = loadLimits();
  const st = String(state || '').trim().toUpperCase();
  const co = normalizeCountyName(county);
  const u = Math.min(4, Math.max(1, parseInt(String(units), 10) || 1));
  const key = String(u);

  for (const row of data.counties || []) {
    if (String(row.state).toUpperCase() !== st) continue;
    if (normalizeCountyName(row.county).toLowerCase() !== co.toLowerCase()) continue;
    const limits = row.limitsByUnit || {};
    const limit = limits[key];
    if (limit == null || !Number.isFinite(Number(limit))) return null;
    return {
      limit: Number(limit),
      highCost: !!row.highCost,
      year: data.year,
      matched: { state: row.state, county: row.county }
    };
  }
  return null;
}
