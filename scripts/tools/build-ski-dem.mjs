/**
 * Bake tight ski-area heightmaps (Wrightwood / Big Bear / Snow Valley), ~40 m cells.
 * `--only <demId>` bakes one area.
 * Source order: AWS Terrarium tiles (USGS 3DEP in the US) → Open-Meteo (GLO-90) → procedural peaks.
 * Development work by David Lane
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { buildProceduralDem, SKI_DEM_SPECS } from '../../services/ski-dem.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../../data/ski');
const UA = { 'User-Agent': 'DevConnectLabs-SkiTopo/1.0' };
const TERRARIUM_ZOOM = 14;

function gridPoints(spec) {
  const pts = [];
  for (let r = 0; r < spec.rows; r++) {
    const lat = spec.south + (r / (spec.rows - 1)) * (spec.north - spec.south);
    for (let c = 0; c < spec.cols; c++) {
      pts.push([lat, spec.west + (c / (spec.cols - 1)) * (spec.east - spec.west)]);
    }
  }
  return pts;
}

function globalPixel(lat, lng, z) {
  const scale = 256 * 2 ** z;
  const latR = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * scale,
  };
}

async function fetchTerrariumGrid(spec) {
  const tiles = new Map();
  const tile = async (tx, ty) => {
    const key = `${tx}/${ty}`;
    if (!tiles.has(key)) {
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${TERRARIUM_ZOOM}/${tx}/${ty}.png`;
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`Terrarium ${key} ${res.status}`);
      const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
        .raw()
        .toBuffer({ resolveWithObject: true });
      tiles.set(key, { data, channels: info.channels });
    }
    return tiles.get(key);
  };
  const meters = async (gx, gy) => {
    const t = await tile(Math.floor(gx / 256), Math.floor(gy / 256));
    const i = ((gy % 256) * 256 + (gx % 256)) * t.channels;
    return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
  };

  const heights = [];
  for (const [lat, lng] of gridPoints(spec)) {
    const p = globalPixel(lat, lng, TERRARIUM_ZOOM);
    const x0 = Math.floor(p.x - 0.5);
    const y0 = Math.floor(p.y - 0.5);
    const tx = p.x - 0.5 - x0;
    const ty = p.y - 0.5 - y0;
    const m =
      (await meters(x0, y0)) * (1 - tx) * (1 - ty) +
      (await meters(x0 + 1, y0)) * tx * (1 - ty) +
      (await meters(x0, y0 + 1)) * (1 - tx) * ty +
      (await meters(x0 + 1, y0 + 1)) * tx * ty;
    heights.push(Math.round(m * 3.28084));
  }
  console.log(`  ${spec.id}: ${tiles.size} Terrarium tiles @ z${TERRARIUM_ZOOM}`);
  return heights;
}

async function fetchOpenMeteoGrid(spec) {
  const pts = gridPoints(spec);
  const heights = [];
  for (let i = 0; i < pts.length; i += 100) {
    const batch = pts.slice(i, i + 100);
    const lat = batch.map((p) => p[0].toFixed(5)).join(',');
    const lng = batch.map((p) => p[1].toFixed(5)).join(',');
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`,
      { headers: UA }
    );
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.elevation) || data.elevation.length !== batch.length) {
      throw new Error('Open-Meteo elevation length mismatch');
    }
    heights.push(...data.elevation.map((m) => Math.round((Number(m) || 0) * 3.28084)));
    await new Promise((r) => setTimeout(r, 200));
  }
  return heights;
}

async function bakeOne(spec, { proceduralOnly }) {
  let heights;
  let source = 'procedural';
  const sources = proceduralOnly
    ? []
    : [
        ['terrarium-3dep', fetchTerrariumGrid],
        ['open-meteo', fetchOpenMeteoGrid],
      ];
  for (const [name, fn] of sources) {
    try {
      heights = await fn(spec);
      source = name;
      break;
    } catch (err) {
      console.warn(`DEM ${spec.id}: ${name} failed — ${err.message}`);
    }
  }
  if (!heights) heights = buildProceduralDem(spec).heights;
  const out = {
    id: spec.id,
    name: spec.name,
    south: spec.south,
    north: spec.north,
    west: spec.west,
    east: spec.east,
    rows: spec.rows,
    cols: spec.cols,
    units: 'ft',
    source,
    heights,
  };
  const file = path.join(OUT_DIR, spec.file);
  await writeFile(file, `${JSON.stringify(out)}\n`, 'utf8');
  const lo = Math.min(...heights);
  const hi = Math.max(...heights);
  console.log(`Wrote ${file} (${source}, ${spec.rows}×${spec.cols}, ${lo}–${hi} ft)`);
}

async function main() {
  const proceduralOnly = process.argv.includes('--procedural');
  const onlyAt = process.argv.indexOf('--only');
  const only = onlyAt > -1 ? process.argv[onlyAt + 1] : null;
  for (const spec of SKI_DEM_SPECS) {
    if (only && spec.id !== only) continue;
    await bakeOne(spec, { proceduralOnly });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
