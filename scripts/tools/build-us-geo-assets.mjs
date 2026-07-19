/**
 * Build US states TopoJSON + per-state county GeoJSON for Unified Disasters geo picker.
 * Data source: us-atlas@3 (Census Bureau, public domain).
 *
 * Usage: node scripts/tools/build-us-geo-assets.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { feature } from 'topojson-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const GEO_DIR = path.join(ROOT, 'public/finance/assets/geo');
const COUNTIES_DIR = path.join(GEO_DIR, 'counties');

const STATES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const COUNTIES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';

/** State FIPS (2-digit) → postal abbreviation */
const FIPS_TO_ST = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '78': 'VI',
};

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  fs.mkdirSync(COUNTIES_DIR, { recursive: true });

  console.log('Fetching US states TopoJSON…');
  const statesTopo = await fetchJson(STATES_URL);
  fs.writeFileSync(path.join(GEO_DIR, 'us-states.topojson'), JSON.stringify(statesTopo));
  console.log('  → public/finance/assets/geo/us-states.topojson');

  const statesFc = feature(statesTopo, statesTopo.objects.states);
  statesFc.features = (statesFc.features || []).map((f) => {
    const fips = String(f.id ?? '').padStart(2, '0');
    const abbr = FIPS_TO_ST[fips] || '';
    return {
      ...f,
      properties: {
        ...(f.properties || {}),
        state_fips: fips,
        state_abbr: abbr,
        name: f.properties?.name || abbr,
      },
    };
  });
  fs.writeFileSync(path.join(GEO_DIR, 'us-states.geojson'), JSON.stringify(statesFc));
  console.log(`  → public/finance/assets/geo/us-states.geojson (${statesFc.features.length} states)`);

  console.log('Fetching US counties TopoJSON…');
  const countiesTopo = await fetchJson(COUNTIES_URL);
  const allFeatures = feature(countiesTopo, countiesTopo.objects.counties).features;

  const byState = {};
  for (const f of allFeatures) {
    const fips = String(f.id ?? '').padStart(5, '0');
    const stFips = fips.slice(0, 2);
    const st = FIPS_TO_ST[stFips];
    if (!st) continue;
    if (!byState[st]) byState[st] = [];
    const name = (f.properties?.name || '').replace(/\s+County$/i, '').trim();
    byState[st].push({
      type: 'Feature',
      id: fips,
      properties: { name, county_fips: fips, state_abbr: st },
      geometry: f.geometry,
    });
  }

  const manifest = { states: Object.keys(byState).sort(), generatedAt: new Date().toISOString() };
  let total = 0;
  for (const [st, features] of Object.entries(byState)) {
    features.sort((a, b) => (a.properties.name || '').localeCompare(b.properties.name || ''));
    const outPath = path.join(COUNTIES_DIR, `${st}.geojson`);
    fs.writeFileSync(outPath, JSON.stringify({ type: 'FeatureCollection', features }));
    total += features.length;
    console.log(`  → counties/${st}.geojson (${features.length} counties)`);
  }

  fs.writeFileSync(path.join(GEO_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Done — ${manifest.states.length} states, ${total} counties.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
