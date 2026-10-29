/**
 * USGS 3DEP lidar helpers for the ski point cloud: Web Mercator bounds,
 * Entwine node selection, the SKLD binary layout, and tree-cover along a run.
 * Development work by David Lane
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKI_DEM_SPECS } from './ski-dem.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LIDAR_DIR = path.join(__dirname, '../data/ski/lidar');

export const LIDAR_HEADER_BYTES = 40;
export const LIDAR_POINT_STRIDE = 8;
export const LIDAR_MAGIC = 'SKLD';
export const LIDAR_VERSION = 1;

/** ASPRS classes that are sensor noise, not terrain or trees. */
export const LIDAR_NOISE_CLASSES = new Set([7, 18]);
/** Low, medium, and high vegetation. */
export const LIDAR_VEG_CLASSES = new Set([3, 4, 5]);

export const TREE_COVER_RADIUS_M = 15;
export const TREE_COVER_MIN_HAG_M = 2;
export const TREE_COVER_TREE_PCT = 40;
export const TREE_COVER_GLADE_PCT = 15;

const WEB_MERCATOR_R = 6378137;
const M_PER_DEG = 111320;

export function lngLatToWebMercator(lng, lat) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));
  const x = (Number(lng) * Math.PI / 180) * WEB_MERCATOR_R;
  const y = Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI / 180) / 2)) * WEB_MERCATOR_R;
  return { x, y };
}

export function webMercatorToLngLat(x, y) {
  const lng = (Number(x) / WEB_MERCATOR_R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(Number(y) / WEB_MERCATOR_R)) - Math.PI / 2) * (180 / Math.PI);
  return { lng, lat };
}

/** Geographic bbox → EPSG:3857 XY box. Z is not projected. */
export function bboxTo3857({ south, north, west, east }) {
  const sw = lngLatToWebMercator(west, south);
  const ne = lngLatToWebMercator(east, north);
  return { minX: sw.x, minY: sw.y, maxX: ne.x, maxY: ne.y };
}

export function eptKeyParts(key) {
  const parts = String(key || '').split('-').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0)) return null;
  return { d: parts[0], x: parts[1], y: parts[2], z: parts[3] };
}

/** Cube of an Entwine node inside the dataset root bounds [minX, minY, minZ, maxX, maxY, maxZ]. */
export function eptNodeCube(rootBounds, key) {
  const part = eptKeyParts(key);
  if (!part || !Array.isArray(rootBounds) || rootBounds.length < 6) return null;
  const [minX, minY, minZ, maxX, maxY, maxZ] = rootBounds;
  const n = 2 ** part.d;
  const sx = (maxX - minX) / n;
  const sy = (maxY - minY) / n;
  const sz = (maxZ - minZ) / n;
  return {
    minX: minX + part.x * sx,
    minY: minY + part.y * sy,
    minZ: minZ + part.z * sz,
    maxX: minX + (part.x + 1) * sx,
    maxY: minY + (part.y + 1) * sy,
    maxZ: minZ + (part.z + 1) * sz,
    depth: part.d,
  };
}

export function eptNodeOverlaps(rootBounds, key, query) {
  const cube = eptNodeCube(rootBounds, key);
  if (!cube || !query) return false;
  return cube.minX <= query.maxX && cube.maxX >= query.minX && cube.minY <= query.maxY && cube.maxY >= query.minY;
}

export function isEptAncestor(parentKey, childKey) {
  const parent = eptKeyParts(parentKey);
  const child = eptKeyParts(childKey);
  if (!parent || !child || child.d <= parent.d) return false;
  const shift = child.d - parent.d;
  return (child.x >> shift) === parent.x && (child.y >> shift) === parent.y && (child.z >> shift) === parent.z;
}

/**
 * Keep overlapping nodes at targetDepth, plus shallower leaves when a branch
 * ends early. Ancestors of a kept node are dropped so the cloud is not stacked.
 */
export function selectEptNodes(rootBounds, query, entries, targetDepth) {
  const overlapping = (entries || []).filter(
    (e) => e && e.count > 0 && eptNodeOverlaps(rootBounds, e.key, query) && (eptKeyParts(e.key)?.d ?? 99) <= targetDepth
  );
  return overlapping.filter((e) => {
    const depth = eptKeyParts(e.key).d;
    if (depth === targetDepth) return true;
    return !overlapping.some((other) => other !== e && isEptAncestor(e.key, other.key));
  });
}

export function targetDepthForMeters(rootBounds, meters) {
  const span = Math.max(rootBounds[3] - rootBounds[0], rootBounds[4] - rootBounds[1]);
  if (!(span > 0) || !(meters > 0)) return 0;
  return Math.max(0, Math.min(30, Math.round(Math.log2(span / meters))));
}

/** Octree depth whose cubes tile `query` into about `columns` cells. */
export function targetDepthForCoverage(rootBounds, query, columns) {
  const qw = query ? query.maxX - query.minX : rootBounds[3] - rootBounds[0];
  const qh = query ? query.maxY - query.minY : rootBounds[4] - rootBounds[1];
  const side = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, columns))));
  const meters = Math.max(qw, qh) / side;
  return targetDepthForMeters(rootBounds, meters);
}

export function spreadNodes(nodes, rootBounds, keep) {
  const list = [...(nodes || [])];
  if (list.length <= keep) return list;
  const grid = Math.max(1, Math.ceil(Math.sqrt(keep)));
  const spanX = rootBounds[3] - rootBounds[0] || 1;
  const spanY = rootBounds[4] - rootBounds[1] || 1;
  const buckets = new Map();
  list.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  for (const node of list) {
    const cube = eptNodeCube(rootBounds, node.key);
    if (!cube) continue;
    const ix = Math.min(grid - 1, Math.max(0, Math.floor(((cube.minX - rootBounds[0]) / spanX) * grid)));
    const iy = Math.min(grid - 1, Math.max(0, Math.floor(((cube.minY - rootBounds[1]) / spanY) * grid)));
    const bucketKey = `${ix}:${iy}`;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
    buckets.get(bucketKey).push(node);
  }
  const lists = [...buckets.values()];
  const out = [];
  let guard = 0;
  while (out.length < keep && guard < list.length + 2) {
    let moved = false;
    for (const bucket of lists) {
      if (!bucket.length) continue;
      out.push(bucket.shift());
      moved = true;
      if (out.length >= keep) break;
    }
    if (!moved) break;
    guard += 1;
  }
  return out;
}

/** Hierarchy counts above this are subsampled, so they must not consume the whole download budget. */
export const LIDAR_COLUMN_SHARE = 8000;

function columnCenter(rootBounds, node) {
  const cube = eptNodeCube(rootBounds, node.key);
  if (!cube) return null;
  return { x: (cube.minX + cube.maxX) / 2, y: (cube.minY + cube.maxY) / 2 };
}

/**
 * Keep every z slice of a chosen column. Fat hierarchy counts are charged a
 * fixed share so the download tiles the resort instead of filling the middle.
 */
export function budgetNodes(nodes, rootBounds, maxPoints, query) {
  const list = (nodes || []).filter((n) => n && n.count > 0);
  const total = list.reduce((sum, n) => sum + n.count, 0);
  if (!list.length || !(maxPoints > 0) || total <= maxPoints) return list;
  const columns = new Map();
  for (const node of list) {
    const part = eptKeyParts(node.key);
    if (!part) continue;
    const id = `${part.d}-${part.x}-${part.y}`;
    if (!columns.has(id)) columns.set(id, []);
    columns.get(id).push(node);
  }
  const columnNodes = [...columns.values()].map((col) => ({
    key: col[0].key,
    count: col.reduce((sum, node) => sum + node.count, 0),
    nodes: col,
  }));
  if (!columnNodes.length) return [];
  const counts = columnNodes.map((col) => col.count).sort((a, b) => a - b);
  const typical = counts[Math.floor((counts.length - 1) / 2)];
  const share = Math.max(1, Math.min(LIDAR_COLUMN_SHARE, typical));
  const affordable = Math.max(1, Math.floor(maxPoints / share));
  if (columnNodes.length <= affordable) return columnNodes.flatMap((col) => col.nodes);

  const qx0 = query ? query.minX : rootBounds[0];
  const qy0 = query ? query.minY : rootBounds[1];
  const qx1 = query ? query.maxX : rootBounds[3];
  const qy1 = query ? query.maxY : rootBounds[4];
  const side = Math.max(1, Math.ceil(Math.sqrt(affordable)));
  const cw = (qx1 - qx0) / side || 1;
  const ch = (qy1 - qy0) / side || 1;
  const cx = (qx0 + qx1) / 2;
  const cy = (qy0 + qy1) / 2;
  const cells = Array.from({ length: side * side }, () => []);
  for (const col of columnNodes) {
    const center = columnCenter(rootBounds, col);
    if (!center) continue;
    const ix = clamp(Math.floor((center.x - qx0) / cw), 0, side - 1);
    const iy = clamp(Math.floor((center.y - qy0) / ch), 0, side - 1);
    cells[iy * side + ix].push(col);
  }
  const ordered = cells
    .map((cols, i) => {
      const ix = i % side;
      const iy = Math.floor(i / side);
      const x = qx0 + (ix + 0.5) * cw;
      const y = qy0 + (iy + 0.5) * ch;
      return { cols, d: (x - cx) ** 2 + (y - cy) ** 2, i, x, y };
    })
    .filter((cell) => cell.cols.length)
    .sort((a, b) => a.d - b.d || a.i - b.i);

  const out = [];
  let taken = 0;
  for (const cell of ordered) {
    if (taken >= affordable) break;
    cell.cols.sort((a, b) => {
      const ca = columnCenter(rootBounds, a);
      const cb = columnCenter(rootBounds, b);
      const da = ca ? (ca.x - cell.x) ** 2 + (ca.y - cell.y) ** 2 : Infinity;
      const db = cb ? (cb.x - cell.x) ** 2 + (cb.y - cell.y) ** 2 : Infinity;
      return da - db || String(a.key).localeCompare(String(b.key));
    });
    out.push(...cell.cols[0].nodes);
    taken += 1;
  }
  return out;
}

export function eptIsWebMercator(ept) {
  const srs = ept?.srs || {};
  const blob = `${srs.authority || ''} ${srs.horizontal || ''} ${srs.wkt || ''} ${srs.proj4 || ''}`;
  return /3857|Pseudo-Mercator|Popular_Visualisation_Pseudo_Mercator|WGS_1984_Web_Mercator/i.test(blob);
}

export function featureBboxOverlaps(feature, bounds) {
  const geom = feature?.geometry;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  const scan = (coords) => {
    if (!coords) return;
    if (typeof coords[0] === 'number') {
      minLng = Math.min(minLng, coords[0]);
      maxLng = Math.max(maxLng, coords[0]);
      minLat = Math.min(minLat, coords[1]);
      maxLat = Math.max(maxLat, coords[1]);
      return;
    }
    for (const child of coords) scan(child);
  };
  if (geom?.coordinates) scan(geom.coordinates);
  const p = feature?.properties || {};
  if (!Number.isFinite(minLng) && p.xmin != null) {
    minLng = Number(p.xmin);
    maxLng = Number(p.xmax);
    minLat = Number(p.ymin);
    maxLat = Number(p.ymax);
  }
  if (!Number.isFinite(minLng)) return false;
  return maxLng >= bounds.west && minLng <= bounds.east && maxLat >= bounds.south && minLat <= bounds.north;
}

export function workUnitYear(feature) {
  const p = feature?.properties || {};
  const direct = Number(p.year ?? p.collectYear ?? p.year_collected);
  if (Number.isFinite(direct) && direct > 1900) return direct;
  const match = String(p.name || p.id || '').match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

export function workUnitFromFeature(feature) {
  const p = feature?.properties || {};
  const name = String(p.name || p.id || p.resource || '').trim();
  let url = String(p.url || p.ept || '').trim();
  if (!url && name) url = `https://s3-us-west-2.amazonaws.com/usgs-lidar-public/${name}/ept.json`;
  if (!url) return null;
  const eptUrl = url.endsWith('.json') ? url : `${url.replace(/\/$/, '')}/ept.json`;
  return {
    name: name || eptUrl.split('/').filter(Boolean).slice(-2, -1)[0] || '3dep',
    year: workUnitYear(feature),
    eptUrl,
    baseUrl: eptUrl.replace(/\/ept\.json$/, ''),
  };
}

export function readLasHeader(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.length < 227 || b.toString('ascii', 0, 4) !== 'LASF') {
    throw new Error('Not a LAS header');
  }
  const versionMinor = b.readUInt8(25);
  let pointCount = b.readUInt32LE(107);
  if (versionMinor >= 4 && pointCount === 0 && b.length >= 255) {
    pointCount = Number(b.readBigUInt64LE(247));
  }
  return {
    versionMinor,
    headerSize: b.readUInt16LE(94),
    offsetToPoints: b.readUInt32LE(96),
    format: b.readUInt8(104) & 0x3f,
    recordLength: b.readUInt16LE(105),
    pointCount,
    scale: [b.readDoubleLE(131), b.readDoubleLE(139), b.readDoubleLE(147)],
    offset: [b.readDoubleLE(155), b.readDoubleLE(163), b.readDoubleLE(171)],
  };
}

export function classOffsetForFormat(format) {
  return Number(format) >= 6 ? 16 : 15;
}

export function readLasPoint(record, header) {
  const b = Buffer.isBuffer(record) ? record : Buffer.from(record);
  const scale = header.scale || [1, 1, 1];
  const offset = header.offset || [0, 0, 0];
  const format = Number(header.format) || 0;
  const rawClass = b.readUInt8(classOffsetForFormat(format));
  return {
    x: b.readInt32LE(0) * scale[0] + offset[0],
    y: b.readInt32LE(4) * scale[1] + offset[1],
    z: b.readInt32LE(8) * scale[2] + offset[2],
    intensity: b.readUInt16LE(12),
    // LAS 1.0–1.3 pack flags into the classification byte. The class is the low 5 bits.
    cls: format >= 6 ? rawClass : rawClass & 0x1f,
  };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function quantizeUnit(t) {
  if (!Number.isFinite(t)) return 0;
  return clamp(Math.round(t * 65535), 0, 65535);
}

export function quantizePoint(point, bounds) {
  const spanX = bounds.east - bounds.west;
  const spanY = bounds.north - bounds.south;
  const spanZ = bounds.zMaxFt - bounds.zMinFt;
  return {
    x: quantizeUnit(spanX ? (point.lng - bounds.west) / spanX : 0),
    y: quantizeUnit(spanY ? (point.lat - bounds.south) / spanY : 0),
    z: quantizeUnit(spanZ ? (point.elevFt - bounds.zMinFt) / spanZ : 0),
    cls: clamp(Math.round(Number(point.cls) || 0), 0, 255),
    hag: clamp(Math.round(Number(point.hagM) || 0), 0, 255),
  };
}

export function dequantizePoint(q, bounds) {
  return {
    lng: bounds.west + (q.x / 65535) * (bounds.east - bounds.west),
    lat: bounds.south + (q.y / 65535) * (bounds.north - bounds.south),
    elevFt: bounds.zMinFt + (q.z / 65535) * (bounds.zMaxFt - bounds.zMinFt),
    cls: q.cls,
    hagM: q.hag,
  };
}

export function packLidarFile(bounds, points) {
  const count = points.length;
  const buf = Buffer.alloc(LIDAR_HEADER_BYTES + count * LIDAR_POINT_STRIDE);
  buf.write(LIDAR_MAGIC, 0, 'ascii');
  buf.writeUInt16LE(LIDAR_VERSION, 4);
  buf.writeUInt16LE(LIDAR_POINT_STRIDE, 6);
  buf.writeUInt32LE(count, 8);
  buf.writeFloatLE(bounds.south, 12);
  buf.writeFloatLE(bounds.north, 16);
  buf.writeFloatLE(bounds.west, 20);
  buf.writeFloatLE(bounds.east, 24);
  buf.writeFloatLE(bounds.zMinFt, 28);
  buf.writeFloatLE(bounds.zMaxFt, 32);
  points.forEach((point, i) => {
    const q = point.x == null ? quantizePoint(point, bounds) : point;
    const o = LIDAR_HEADER_BYTES + i * LIDAR_POINT_STRIDE;
    buf.writeUInt16LE(q.x, o);
    buf.writeUInt16LE(q.y, o + 2);
    buf.writeUInt16LE(q.z, o + 4);
    buf.writeUInt8(q.cls, o + 6);
    buf.writeUInt8(q.hag, o + 7);
  });
  return buf;
}

export function unpackLidarFile(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.length < LIDAR_HEADER_BYTES || b.toString('ascii', 0, 4) !== LIDAR_MAGIC) {
    throw new Error('Not a ski lidar file');
  }
  const bounds = {
    south: b.readFloatLE(12),
    north: b.readFloatLE(16),
    west: b.readFloatLE(20),
    east: b.readFloatLE(24),
    zMinFt: b.readFloatLE(28),
    zMaxFt: b.readFloatLE(32),
  };
  const count = b.readUInt32LE(8);
  const points = [];
  for (let i = 0; i < count; i++) {
    const o = LIDAR_HEADER_BYTES + i * LIDAR_POINT_STRIDE;
    points.push(dequantizePoint({
      x: b.readUInt16LE(o),
      y: b.readUInt16LE(o + 2),
      z: b.readUInt16LE(o + 4),
      cls: b.readUInt8(o + 6),
      hag: b.readUInt8(o + 7),
    }, bounds));
  }
  return { version: b.readUInt16LE(4), stride: b.readUInt16LE(6), count, bounds, points };
}

export function stratifyPoints(points, bounds, limit) {
  const list = points || [];
  if (list.length <= limit) return list.slice();
  const grid = Math.max(1, Math.ceil(Math.sqrt(limit)));
  const spanX = bounds.east - bounds.west || 1;
  const spanY = bounds.north - bounds.south || 1;
  const buckets = new Map();
  for (const point of list) {
    const ix = Math.min(grid - 1, Math.max(0, Math.floor(((point.lng - bounds.west) / spanX) * grid)));
    const iy = Math.min(grid - 1, Math.max(0, Math.floor(((point.lat - bounds.south) / spanY) * grid)));
    const bucketKey = `${ix}:${iy}`;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
    buckets.get(bucketKey).push(point);
  }
  const lists = [...buckets.values()];
  const out = [];
  let guard = 0;
  while (out.length < limit && guard < list.length + 2) {
    let moved = false;
    for (const bucket of lists) {
      if (!bucket.length) continue;
      out.push(bucket.shift());
      moved = true;
      if (out.length >= limit) break;
    }
    if (!moved) break;
    guard += 1;
  }
  return out;
}

function distM(lat1, lng1, lat2, lng2) {
  const cos = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const dy = (lat2 - lat1) * M_PER_DEG;
  const dx = (lng2 - lng1) * M_PER_DEG * cos;
  return Math.hypot(dx, dy);
}

function samplePolyline(path, stepM) {
  if (!path?.length) return [];
  const out = [[path[0][0], path[0][1]]];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const seg = distM(a[0], a[1], b[0], b[1]);
    if (!(seg > 0)) continue;
    let d = stepM - carry;
    while (d <= seg) {
      const t = d / seg;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += stepM;
    }
    carry = seg - (d - stepM);
  }
  const last = path[path.length - 1];
  out.push([last[0], last[1]]);
  return out;
}

export function coverLabelForPct(pct) {
  if (pct == null || Number.isNaN(pct)) return null;
  if (pct >= TREE_COVER_TREE_PCT) return 'tree';
  if (pct >= TREE_COVER_GLADE_PCT) return 'glade';
  return 'open';
}

/**
 * Share of vegetation returns more than 2 m above ground within ~15 m of the run.
 * points: { lat, lng, cls, hagM }. paths: array of [lat, lng] polylines.
 */
export function treeCoverForPaths(points, paths, {
  radiusM = TREE_COVER_RADIUS_M,
  minHagM = TREE_COVER_MIN_HAG_M,
} = {}) {
  const lines = (paths || []).filter((path) => path && path.length >= 2);
  if (!points?.length || !lines.length) return { treeCoverPct: null, coverLabel: null };
  const samples = lines.flatMap((path) => samplePolyline(path, radiusM));
  const cell = radiusM;
  const grid = new Map();
  const keyOf = (lat, lng) => {
    const y = Math.floor((lat * M_PER_DEG) / cell);
    const x = Math.floor((lng * M_PER_DEG * Math.cos((lat * Math.PI) / 180)) / cell);
    return `${x}:${y}`;
  };
  points.forEach((point, index) => {
    const bucketKey = keyOf(point.lat, point.lng);
    if (!grid.has(bucketKey)) grid.set(bucketKey, []);
    grid.get(bucketKey).push(index);
  });
  const seen = new Set();
  let veg = 0;
  let total = 0;
  for (const [lat, lng] of samples) {
    const cy = Math.floor((lat * M_PER_DEG) / cell);
    const cx = Math.floor((lng * M_PER_DEG * Math.cos((lat * Math.PI) / 180)) / cell);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = grid.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const index of bucket) {
          if (seen.has(index)) continue;
          const point = points[index];
          if (distM(lat, lng, point.lat, point.lng) > radiusM) continue;
          seen.add(index);
          total += 1;
          if (LIDAR_VEG_CLASSES.has(point.cls) && point.hagM > minHagM) veg += 1;
        }
      }
    }
  }
  if (!total) return { treeCoverPct: 0, coverLabel: 'open' };
  const treeCoverPct = Math.round((100 * veg) / total);
  return { treeCoverPct, coverLabel: coverLabelForPct(treeCoverPct) };
}

export function knownDemId(id) {
  return SKI_DEM_SPECS.some((spec) => spec.id === id);
}

export function lidarFilePath(id, lod) {
  return path.join(LIDAR_DIR, `${id}-lod${lod}.bin`);
}

export function loadLidarManifest(id) {
  if (!knownDemId(id)) return null;
  const file = path.join(LIDAR_DIR, `${id}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

export default {
  LIDAR_DIR,
  LIDAR_HEADER_BYTES,
  LIDAR_POINT_STRIDE,
  LIDAR_NOISE_CLASSES,
  LIDAR_VEG_CLASSES,
  lngLatToWebMercator,
  webMercatorToLngLat,
  bboxTo3857,
  eptNodeCube,
  eptNodeOverlaps,
  isEptAncestor,
  selectEptNodes,
  targetDepthForMeters,
  targetDepthForCoverage,
  LIDAR_COLUMN_SHARE,
  spreadNodes,
  budgetNodes,
  eptIsWebMercator,
  featureBboxOverlaps,
  workUnitFromFeature,
  readLasHeader,
  readLasPoint,
  quantizePoint,
  dequantizePoint,
  packLidarFile,
  unpackLidarFile,
  stratifyPoints,
  treeCoverForPaths,
  coverLabelForPct,
  loadLidarManifest,
  lidarFilePath,
  knownDemId,
};
