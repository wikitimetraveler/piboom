/**
 * Bake ski runs + lifts from OpenStreetMap (Overpass) for the ski-area DEMs.
 * Writes data/ski/{demId}-trails.json — © OpenStreetMap contributors (ODbL).
 * `--only <demId>` bakes one area.
 * Development work by David Lane
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKI_DEM_SPECS } from '../../services/ski-dem.service.js';
import { LIFT_TYPES, normalizeOsmTrails } from '../../services/ski-trails.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../../data/ski');
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function query(spec) {
  const bb = `${spec.south},${spec.west},${spec.north},${spec.east}`;
  return `[out:json][timeout:90];
(
  way["piste:type"="downhill"](${bb});
  way["aerialway"~"^(${LIFT_TYPES.join('|')})$"](${bb});
  way["landuse"="winter_sports"](${bb});
  relation["landuse"="winter_sports"](${bb});
);
out geom;`;
}

async function overpass(q) {
  let last;
  for (const url of [...OVERPASS, ...OVERPASS]) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'DevConnectLabs-SkiTopo/1.0',
        },
        body: `data=${encodeURIComponent(q)}`,
      });
      if (!res.ok) throw new Error(`${url} ${res.status}`);
      return await res.json();
    } catch (err) {
      last = err;
      console.warn(`Overpass ${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw last;
}

async function main() {
  const catalog = JSON.parse(await readFile(path.join(OUT_DIR, 'destinations.json'), 'utf8'));
  const onlyAt = process.argv.indexOf('--only');
  const only = onlyAt > -1 ? process.argv[onlyAt + 1] : null;
  for (const spec of SKI_DEM_SPECS) {
    if (only && spec.id !== only) continue;
    const resorts = catalog.destinations.filter((d) => d.dem === spec.id);
    const raw = await overpass(query(spec));
    const trails = normalizeOsmTrails(raw.elements || [], resorts);
    const out = {
      id: spec.id,
      name: spec.name,
      source: 'openstreetmap',
      attribution: '© OpenStreetMap contributors (ODbL)',
      fetchedAt: new Date().toISOString(),
      resorts: resorts.map((r) => ({ id: r.id, name: r.name })),
      runs: trails.runs,
      lifts: trails.lifts,
    };
    const file = path.join(OUT_DIR, `${spec.id}-trails.json`);
    await writeFile(file, `${JSON.stringify(out)}\n`, 'utf8');
    const byResort = {};
    for (const r of out.runs) byResort[r.resort] = (byResort[r.resort] || 0) + 1;
    console.log(
      `Wrote ${file}: ${out.runs.length} runs, ${out.lifts.length} lifts`,
      JSON.stringify(byResort)
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
