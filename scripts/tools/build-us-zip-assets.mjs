/**
 * Build per-state ZIP Code pick lists for the Disaster Policy Desk (State → County → ZIP).
 *
 * Sources:
 *   - U.S. Census Bureau 2020 ZCTA ↔ county relationship file (public domain) — which ZIPs
 *     fall in which county, including ZIPs that straddle county lines.
 *   - GeoNames US postal codes (CC BY 4.0, https://www.geonames.org) — city/area label, plus
 *     PO-box and single-site ZIPs that the Census does not publish as ZCTAs.
 *
 * Output: public/finance/assets/geo/zips/<ST>.json
 *   { state, counties: { "<5-digit county FIPS>": [["<zip>", "<city>"], …] } }
 *
 * Usage: node scripts/tools/build-us-zip-assets.mjs
 * Development work by David Lane
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const ZIPS_DIR = path.join(ROOT, 'public/finance/assets/geo/zips');

const CENSUS_URL =
  'https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt';
const GEONAMES_URL = 'https://download.geonames.org/export/zip/US.zip';

/** State FIPS (2-digit) → postal abbreviation (matches build-us-geo-assets.mjs). */
const FIPS_TO_ST = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '78': 'VI',
};
const ST_TO_FIPS = Object.fromEntries(Object.entries(FIPS_TO_ST).map(([fips, st]) => [st, fips]));

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Read one named entry out of a ZIP archive (stored or deflate). */
export function readZipEntry(buf, entryName) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP end-of-central-directory record not found');
  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < entries; n += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad ZIP central directory entry');
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === entryName) {
      const localNameLen = buf.readUInt16LE(localOffset + 26);
      const localExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      const data = buf.subarray(start, start + compressedSize);
      if (method === 0) return data;
      if (method === 8) return zlib.inflateRawSync(data);
      throw new Error(`Unsupported ZIP compression method ${method} for ${entryName}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${entryName} not found in ZIP archive`);
}

/** Census relationship rows → Map<countyFips, Set<zip>>. */
export function parseCensusZctaCounty(text) {
  const lines = text.split(/\r?\n/);
  const header = lines[0].split('|');
  const zctaIdx = header.indexOf('GEOID_ZCTA5_20');
  const countyIdx = header.indexOf('GEOID_COUNTY_20');
  if (zctaIdx < 0 || countyIdx < 0) {
    throw new Error('Census relationship file is missing GEOID_ZCTA5_20 / GEOID_COUNTY_20 columns');
  }
  const byCounty = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split('|');
    const zip = cols[zctaIdx];
    const county = cols[countyIdx];
    if (!/^\d{5}$/.test(zip || '') || !/^\d{5}$/.test(county || '')) continue;
    if (!byCounty.has(county)) byCounty.set(county, new Set());
    byCounty.get(county).add(zip);
  }
  return byCounty;
}

/** GeoNames rows → { cityByZip: Map<zip, city>, byCounty: Map<countyFips, Set<zip>> }. */
export function parseGeoNamesPostal(text) {
  const cityByZip = new Map();
  const byCounty = new Map();
  for (const line of text.split(/\r?\n/)) {
    const cols = line.split('\t');
    const zip = cols[1];
    if (!/^\d{5}$/.test(zip || '')) continue;
    const city = (cols[2] || '').trim();
    if (city && !cityByZip.has(zip)) cityByZip.set(zip, city);
    const stateFips = ST_TO_FIPS[cols[4]];
    const countyCode = cols[6];
    if (!stateFips || !/^\d{3}$/.test(countyCode || '')) continue;
    const county = `${stateFips}${countyCode}`;
    if (!byCounty.has(county)) byCounty.set(county, new Set());
    byCounty.get(county).add(zip);
  }
  return { cityByZip, byCounty };
}

async function main() {
  console.log('Fetching Census ZCTA ↔ county relationship file…');
  const census = parseCensusZctaCounty((await fetchBuffer(CENSUS_URL)).toString('utf8'));

  console.log('Fetching GeoNames US postal codes…');
  const geonames = parseGeoNamesPostal(
    readZipEntry(await fetchBuffer(GEONAMES_URL), 'US.txt').toString('utf8')
  );

  const counties = new Set([...census.keys(), ...geonames.byCounty.keys()]);
  const byState = {};
  const allZips = new Set();
  let unlabeled = 0;
  for (const county of counties) {
    const st = FIPS_TO_ST[county.slice(0, 2)];
    if (!st) continue;
    const zips = new Set([...(census.get(county) || []), ...(geonames.byCounty.get(county) || [])]);
    const rows = [...zips].sort().map((zip) => {
      const city = geonames.cityByZip.get(zip) || '';
      if (!city) unlabeled += 1;
      allZips.add(zip);
      return [zip, city];
    });
    if (!byState[st]) byState[st] = {};
    byState[st][county] = rows;
  }

  fs.mkdirSync(ZIPS_DIR, { recursive: true });
  let pairs = 0;
  for (const st of Object.keys(byState).sort()) {
    const sorted = Object.fromEntries(
      Object.keys(byState[st])
        .sort()
        .map((county) => [county, byState[st][county]])
    );
    const count = Object.values(sorted).reduce((sum, rows) => sum + rows.length, 0);
    pairs += count;
    fs.writeFileSync(path.join(ZIPS_DIR, `${st}.json`), JSON.stringify({ state: st, counties: sorted }));
    console.log(`  → zips/${st}.json (${Object.keys(sorted).length} counties, ${count} ZIP rows)`);
  }

  const manifest = {
    states: Object.keys(byState).sort(),
    generatedAt: new Date().toISOString(),
    zipCodes: allZips.size,
    countyZipRows: pairs,
    zipRowsWithoutCity: unlabeled,
    sources: [
      {
        name: 'U.S. Census Bureau — 2020 ZCTA to County Relationship File',
        url: CENSUS_URL,
        license: 'Public domain',
      },
      {
        name: 'GeoNames US postal codes',
        url: GEONAMES_URL,
        license: 'CC BY 4.0 — https://www.geonames.org',
      },
    ],
  };
  fs.writeFileSync(path.join(ZIPS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(
    `Done — ${manifest.states.length} states, ${allZips.size} ZIP Codes, ${pairs} county/ZIP rows (${unlabeled} without a city label).`
  );
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
