/**
 * Bake USGS 3DEP lidar point clouds for each ski DEM.
 * Source: public Entwine tiles on s3://usgs-lidar-public (AWS Open Data).
 *   npm run build:ski-lidar
 *   npm run build:ski-lidar -- --only wrightwood
 *   npm run build:ski-lidar -- --only wrightwood --max-points 20000 --lod0 5000 --skip-trails
 * LOD0 (200k points, ~1.6 MB) and LOD1 (250k points, ~2 MB) are committed, along with the USGS boundaries cache.
 * Development work by David Lane
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { interpolateDem, loadDem, SKI_DEM_SPECS } from '../../services/ski-dem.service.js';
import {
  bboxTo3857,
  budgetNodes,
  eptIsWebMercator,
  eptKeyParts,
  eptNodeOverlaps,
  featureBboxOverlaps,
  LIDAR_DIR,
  LIDAR_NOISE_CLASSES,
  packLidarFile,
  selectEptNodes,
  readLasHeader,
  readLasPoint,
  stratifyPoints,
  targetDepthForCoverage,
  LIDAR_COLUMN_SHARE,
  treeCoverForPaths,
  webMercatorToLngLat,
  workUnitFromFeature,
} from '../../services/ski-lidar.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRAILS_DIR = path.join(__dirname, '../../data/ski');
const CACHE_DIR = path.join(LIDAR_DIR, '.cache');
const UA = { 'User-Agent': 'DevConnectLabs-SkiTopo/1.0' };
const BOUNDARIES_URL = 'https://raw.githubusercontent.com/hobu/usgs-lidar/master/boundaries/resources.geojson';
const FT_PER_M = 3.28084;
const PAGE_CAP = 600;

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || process.argv[i + 1] == null) return fallback;
  return process.argv[i + 1];
}

async function fetchBuf(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchJson(url) {
  return JSON.parse(await fetchBuf(url));
}

async function loadBoundaries() {
  await mkdir(CACHE_DIR, { recursive: true });
  const cache = path.join(CACHE_DIR, 'resources.geojson');
  try {
    return JSON.parse(await readFile(cache, 'utf8'));
  } catch {
    /* download */
  }
  console.log('Downloading USGS lidar boundaries…');
  const raw = await fetchBuf(BOUNDARIES_URL);
  await writeFile(cache, raw);
  return JSON.parse(raw.toString('utf8'));
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      out[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

async function collectEntries(baseUrl, rootBounds, query, targetDepth) {
  const entries = [];
  const seen = new Set();
  let pages = 0;
  async function visit(pageKey) {
    if (seen.has(pageKey) || pages >= PAGE_CAP) return;
    seen.add(pageKey);
    pages += 1;
    const page = await fetchJson(`${baseUrl}/ept-hierarchy/${pageKey}.json`);
    const jobs = [];
    for (const [key, count] of Object.entries(page)) {
      if (!eptNodeOverlaps(rootBounds, key, query)) continue;
      const depth = eptKeyParts(key)?.d ?? 0;
      if (count === -1) {
        if (depth <= targetDepth) jobs.push(visit(key));
        continue;
      }
      if (count > 0 && depth <= targetDepth) entries.push({ key, count });
    }
    await Promise.all(jobs);
  }
  await visit('0-0-0-0');
  return { entries, pages };
}

async function createDecoder() {
  const { createLazPerf } = await import('laz-perf');
  return createLazPerf();
}

function readNode(LazPerf, file, spec, dem, zLo, zHi) {
  const header = readLasHeader(file);
  const src = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
  const dataPtr = LazPerf._malloc(src.length);
  LazPerf.HEAPU8.set(src, dataPtr);
  const laszip = new LazPerf.LASZip();
  const out = [];
  let pointPtr = 0;
  try {
    laszip.open(dataPtr, src.length);
    const count = laszip.getCount();
    const pointLength = laszip.getPointLength();
    const format = laszip.getPointFormat();
    pointPtr = LazPerf._malloc(pointLength);
    const step = Math.max(1, Math.ceil(count / 80000));
    const pointHeader = { ...header, format };
    let sample = null;
    for (let i = 0; i < count; i++) {
      laszip.getPoint(pointPtr);
      if (i % step !== 0) continue;
      const rec = Buffer.from(LazPerf.HEAPU8.subarray(pointPtr, pointPtr + pointLength));
      const p = readLasPoint(rec, pointHeader);
      if (!sample) sample = p;
      if (LIDAR_NOISE_CLASSES.has(p.cls)) continue;
      const { lat, lng } = webMercatorToLngLat(p.x, p.y);
      if (lng < spec.west || lng > spec.east || lat < spec.south || lat > spec.north) continue;
      const elevFt = p.z * FT_PER_M;
      if (elevFt < zLo || elevFt > zHi) continue;
      const ground = dem ? interpolateDem(dem, lat, lng) : null;
      const hagM = ground == null ? 0 : Math.max(0, (elevFt - ground) / FT_PER_M);
      out.push({ lat, lng, elevFt, cls: p.cls, hagM });
    }
    if (!out.length && sample) {
      const ll = webMercatorToLngLat(sample.x, sample.y);
      console.warn(
        `    no points kept (count ${count}); sample x=${sample.x.toFixed(1)} y=${sample.y.toFixed(1)} z=${sample.z.toFixed(1)} → ${ll.lat.toFixed(4)},${ll.lng.toFixed(4)} class ${sample.cls}`
      );
    }
  } finally {
    if (pointPtr) LazPerf._free(pointPtr);
    laszip.delete();
    LazPerf._free(dataPtr);
  }
  return out;
}

async function bakeOne(spec, { boundaries, lod0Cap, lod1Cap, skipTrails, dryRun, LazPerf }) {
  const units = (boundaries.features || [])
    .filter((feature) => featureBboxOverlaps(feature, spec))
    .map(workUnitFromFeature)
    .filter(Boolean);
  console.log(`${spec.id}: ${units.length} overlapping work unit(s)`);
  if (!units.length) {
    console.warn(`  no 3DEP coverage — skipped`);
    return false;
  }
  const dem = loadDem(spec.id);
  const zLo = spec.floorFt - 400;
  const zHi = Math.max(...spec.peaks.map((peak) => peak.elevFt)) + 800;
  const query = bboxTo3857(spec);
  const points = [];
  const sources = [];

  for (const unit of units) {
    let ept;
    try {
      ept = await fetchJson(unit.eptUrl);
    } catch (err) {
      console.warn(`  ${unit.name}: ept.json failed — ${err.message}`);
      continue;
    }
    if (!eptIsWebMercator(ept)) {
      console.warn(`  ${unit.name}: not EPSG:3857 — skipped`);
      continue;
    }
    const root = ept.bounds;
    const columns = Math.max(4, Math.floor(lod1Cap / LIDAR_COLUMN_SHARE));
    const targetDepth = targetDepthForCoverage(root, query, columns);
    console.log(`  ${unit.name}: reading hierarchy at depth ${targetDepth}…`);
    let entries;
    let pages;
    try {
      ({ entries, pages } = await collectEntries(unit.baseUrl, root, query, targetDepth));
    } catch (err) {
      console.warn(`  ${unit.name}: hierarchy failed — ${err.message}`);
      continue;
    }
    const chosen = budgetNodes(selectEptNodes(root, query, entries, targetDepth), root, lod1Cap, query);
    console.log(`  ${unit.name}: depth ${targetDepth}, ${pages} pages, ${entries.length} nodes → downloading ${chosen.length}`);
    if (dryRun) {
      sources.push({ name: unit.name, year: unit.year, url: unit.eptUrl, nodes: chosen.length });
      continue;
    }
    const files = await mapPool(chosen, 4, async (node) => {
      try {
        const file = await fetchBuf(`${unit.baseUrl}/ept-data/${node.key}.laz`);
        return { key: node.key, file };
      } catch (err) {
        console.warn(`  ${node.key}: ${err.message}`);
        return null;
      }
    });
    let added = 0;
    for (const item of files) {
      if (!item?.file) continue;
      try {
        const batch = readNode(LazPerf, item.file, spec, dem, zLo, zHi);
        if (batch.length) {
          points.push(...batch);
          added += batch.length;
        }
      } catch (err) {
        console.warn(`  ${item.key}: ${err.message}`);
      }
    }
    console.log(`  ${unit.name}: kept ${added.toLocaleString()} points`);
    if (added) sources.push({ name: unit.name, year: unit.year, url: unit.eptUrl });
  }

  if (dryRun) return sources.length > 0;
  if (!points.length) {
    console.warn(`  ${spec.id}: no points kept`);
    return false;
  }

  let zMinFt = Infinity;
  let zMaxFt = -Infinity;
  for (const point of points) {
    if (point.elevFt < zMinFt) zMinFt = point.elevFt;
    if (point.elevFt > zMaxFt) zMaxFt = point.elevFt;
  }
  const bounds = {
    south: spec.south,
    north: spec.north,
    west: spec.west,
    east: spec.east,
    zMinFt,
    zMaxFt,
  };
  const lod1 = stratifyPoints(points, bounds, lod1Cap);
  const lod0 = stratifyPoints(lod1, bounds, lod0Cap);
  await mkdir(LIDAR_DIR, { recursive: true });
  const lods = {};
  const writeLod = async (lod, cloud) => {
    const fileName = `${spec.id}-lod${lod}.bin`;
    const buf = packLidarFile(bounds, cloud);
    await writeFile(path.join(LIDAR_DIR, fileName), buf);
    lods[String(lod)] = { file: fileName, count: cloud.length, bytes: buf.length };
    console.log(`  wrote ${fileName} (${cloud.length.toLocaleString()} points, ${(buf.length / 1e6).toFixed(1)} MB)`);
  };
  await writeLod(0, lod0);
  if (lod1.length > lod0.length) await writeLod(1, lod1);

  const manifest = {
    id: spec.id,
    name: spec.name,
    ...bounds,
    pointStride: 8,
    headerBytes: 40,
    lods,
    sources,
    attribution: 'USGS 3DEP lidar',
    snowFree: true,
    note: '3DEP lidar flights are mostly snow-free, so this cloud is the ground and trees, not the snowpack.',
  };
  await writeFile(path.join(LIDAR_DIR, `${spec.id}.json`), `${JSON.stringify(manifest, null, 2)}\n`);

  if (!skipTrails && points.length >= 20000) {
    await applyTreeCover(spec.id, points);
  } else if (!skipTrails) {
    console.log('  skipping tree-cover update — fewer than 20,000 points');
  }
  return true;
}

async function applyTreeCover(demId, points) {
  const file = path.join(TRAILS_DIR, `${demId}-trails.json`);
  const trails = JSON.parse(await readFile(file, 'utf8'));
  let touched = 0;
  for (const run of trails.runs || []) {
    const cover = treeCoverForPaths(points, run.paths);
    if (cover.treeCoverPct == null) continue;
    run.treeCoverPct = cover.treeCoverPct;
    run.coverLabel = cover.coverLabel;
    touched += 1;
  }
  await writeFile(file, JSON.stringify(trails));
  console.log(`  tree cover written on ${touched} runs`);
}

async function main() {
  const only = argValue('--only', null);
  const lod0Cap = Number(argValue('--lod0', '200000'));
  const lod1Cap = Number(argValue('--max-points', '250000'));
  const skipTrails = process.argv.includes('--skip-trails');
  const dryRun = process.argv.includes('--dry-run');
  const boundaries = await loadBoundaries();
  const LazPerf = dryRun ? null : await createDecoder();
  let failed = 0;
  for (const spec of SKI_DEM_SPECS) {
    if (only && spec.id !== only) continue;
    try {
      const ok = await bakeOne(spec, { boundaries, lod0Cap, lod1Cap, skipTrails, dryRun, LazPerf });
      if (!ok) failed += 1;
    } catch (err) {
      failed += 1;
      console.error(`${spec.id} failed: ${err.stack || err.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
