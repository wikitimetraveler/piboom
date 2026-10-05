/**
 * Snapshot upcoming ISS arrivals from Launch Library 2 (The Space Devs).
 *
 * Usage:
 *   node scripts/tools/fetch-iss-arrivals.mjs
 *
 * Writes data/planetarium/iss-arrivals.json (offline fallback for /api/planetarium/iss-arrivals).
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LL2_UPCOMING_URL, selectArrivals } from '../../services/planetarium-arrivals.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../data/planetarium/iss-arrivals.json');

const res = await fetch(LL2_UPCOMING_URL, { headers: { Accept: 'application/json' } });
if (!res.ok) {
  console.error(`Launch Library ${res.status}`);
  process.exit(1);
}
const body = await res.json();
const arrivals = selectArrivals(body.results, Date.now());
const doc = {
  source: 'The Space Devs Launch Library 2',
  fetchedAt: new Date().toISOString(),
  arrivals,
};
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
console.log(`Wrote ${arrivals.length} ISS arrivals to ${path.relative(process.cwd(), OUT)}`);
