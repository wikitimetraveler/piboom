/**
 * Build planetarium star + constellation JSON from d3-celestial (BSD-3) cache.
 *
 * Usage:
 *   node scripts/tools/build-planetarium-catalog.mjs
 *   node scripts/tools/build-planetarium-catalog.mjs --fetch
 *
 * Sources (public / permissive):
 * - ofrohn/d3-celestial stars.6.json + starnames.json + constellations*.json (BSD)
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CACHE = path.join(ROOT, 'data/planetarium/.cache');
const OUT_STARS = path.join(ROOT, 'data/planetarium/bright-stars.json');
const OUT_LINES = path.join(ROOT, 'data/planetarium/constellation-lines.json');

const REMOTE = {
  stars: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json',
  names: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/starnames.json',
  lines: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json',
  consts: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json',
};

const MAG_LIMIT = 6.5;

function normRa(lon) {
  let ra = Number(lon);
  if (!Number.isFinite(ra)) return null;
  if (ra < 0) ra += 360;
  if (ra >= 360) ra -= 360;
  return ra;
}

async function ensureCache(fetchRemote) {
  fs.mkdirSync(CACHE, { recursive: true });
  const files = [
    ['stars.6.json', REMOTE.stars],
    ['starnames.json', REMOTE.names],
    ['constellations.lines.json', REMOTE.lines],
    ['constellations.json', REMOTE.consts],
  ];
  for (const [name, url] of files) {
    const dest = path.join(CACHE, name);
    if (!fetchRemote && fs.existsSync(dest)) continue;
    process.stdout.write(`Fetching ${name}…\n`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  }
}

function buildStars() {
  const geo = JSON.parse(fs.readFileSync(path.join(CACHE, 'stars.6.json'), 'utf8'));
  const names = JSON.parse(fs.readFileSync(path.join(CACHE, 'starnames.json'), 'utf8'));
  const stars = [];
  for (const f of geo.features || []) {
    const mag = Number(f.properties?.mag);
    if (!Number.isFinite(mag) || mag > MAG_LIMIT) continue;
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const ra = normRa(coords[0]);
    const dec = Number(coords[1]);
    if (!Number.isFinite(ra) || !Number.isFinite(dec)) continue;
    const hip = Number(f.id);
    const named = names[String(hip)] || names[hip] || {};
    const bvRaw = f.properties?.bv;
    const bv = bvRaw === '' || bvRaw == null ? null : Number(bvRaw);
    stars.push({
      hip: Number.isFinite(hip) ? hip : null,
      n: named.name || named.desig || null,
      ra: Math.round(ra * 10000) / 10000,
      dec: Math.round(dec * 10000) / 10000,
      mag: Math.round(mag * 100) / 100,
      bv: Number.isFinite(bv) ? Math.round(bv * 1000) / 1000 : null,
    });
  }
  stars.sort((a, b) => a.mag - b.mag);
  return {
    version: 1,
    source: 'd3-celestial stars.6 + starnames (BSD-3)',
    magLimit: MAG_LIMIT,
    count: stars.length,
    stars,
  };
}

function buildLines() {
  const linesGeo = JSON.parse(fs.readFileSync(path.join(CACHE, 'constellations.lines.json'), 'utf8'));
  const meta = JSON.parse(fs.readFileSync(path.join(CACHE, 'constellations.json'), 'utf8'));
  const nameById = Object.create(null);
  for (const f of meta.features || []) {
    const id = String(f.id || f.properties?.desig || '').toLowerCase();
    if (!id) continue;
    nameById[id] = f.properties?.en || f.properties?.name || id;
  }

  const constellations = [];
  for (const f of linesGeo.features || []) {
    const id = String(f.id || '').toLowerCase();
    if (!id) continue;
    const multi = f.geometry?.coordinates || [];
    const lines = [];
    for (const pathCoords of multi) {
      if (!Array.isArray(pathCoords) || pathCoords.length < 2) continue;
      for (let i = 0; i < pathCoords.length - 1; i += 1) {
        const a = pathCoords[i];
        const b = pathCoords[i + 1];
        const ra1 = normRa(a[0]);
        const dec1 = Number(a[1]);
        const ra2 = normRa(b[0]);
        const dec2 = Number(b[1]);
        if (![ra1, dec1, ra2, dec2].every(Number.isFinite)) continue;
        lines.push([
          [Math.round(ra1 * 10000) / 10000, Math.round(dec1 * 10000) / 10000],
          [Math.round(ra2 * 10000) / 10000, Math.round(dec2 * 10000) / 10000],
        ]);
      }
    }
    if (!lines.length) continue;
    constellations.push({
      id,
      name: nameById[id] || id,
      lines,
    });
  }
  constellations.sort((a, b) => a.name.localeCompare(b.name));
  return {
    version: 1,
    source: 'd3-celestial constellations.lines (BSD-3) · IAU figures',
    count: constellations.length,
    constellations,
  };
}

async function main() {
  const fetchRemote = process.argv.includes('--fetch');
  await ensureCache(fetchRemote);
  const stars = buildStars();
  const lines = buildLines();
  fs.writeFileSync(OUT_STARS, JSON.stringify(stars));
  fs.writeFileSync(OUT_LINES, JSON.stringify(lines, null, 0));
  console.log(`Wrote ${OUT_STARS} (${stars.count} stars)`);
  console.log(`Wrote ${OUT_LINES} (${lines.count} constellations)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
