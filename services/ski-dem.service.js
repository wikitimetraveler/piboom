/**
 * Tight ski-area DEM bounds, interpolation, and procedural fallback.
 * Development work by David Lane
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FOUNTAIN_VALLEY = { lat: 33.7095, lng: -117.9537 };

export const SKI_DEM_SPECS = [
  {
    id: 'wrightwood',
    name: 'Mountain High',
    file: 'wrightwood-dem.json',
    south: 34.35,
    north: 34.395,
    west: -117.71,
    east: -117.645,
    rows: 126,
    cols: 151,
    floorFt: 6200,
    peaks: [
      { lat: 34.3765, lng: -117.6915, elevFt: 8200, sigma: 0.012 },
      { lat: 34.377, lng: -117.661, elevFt: 8200, sigma: 0.011 },
      { lat: 34.389, lng: -117.677, elevFt: 7800, sigma: 0.01 },
    ],
  },
  {
    id: 'snow-valley',
    name: 'Snow Valley',
    file: 'snow-valley-dem.json',
    south: 34.2,
    north: 34.236,
    west: -117.066,
    east: -117.01,
    rows: 101,
    cols: 130,
    floorFt: 6500,
    peaks: [
      { lat: 34.2125, lng: -117.0395, elevFt: 7841, sigma: 0.008 },
      { lat: 34.214, lng: -117.0285, elevFt: 7500, sigma: 0.007 },
    ],
  },
  {
    id: 'big-bear',
    name: 'Big Bear ski basin',
    file: 'big-bear-dem.json',
    south: 34.2,
    north: 34.248,
    west: -116.93,
    east: -116.84,
    rows: 135,
    cols: 208,
    floorFt: 6680,
    peaks: [
      { lat: 34.2285, lng: -116.891, elevFt: 8200, sigma: 0.01 },
      { lat: 34.2272, lng: -116.8603, elevFt: 8805, sigma: 0.011 },
      { lat: 34.2439, lng: -116.9114, elevFt: 6750, sigma: 0.016 },
    ],
  },
  {
    id: 'mammoth',
    name: 'Mammoth Mountain',
    file: 'mammoth-dem.json',
    south: 37.612,
    north: 37.667,
    west: -119.07,
    east: -118.972,
    rows: 154,
    cols: 217,
    floorFt: 7800,
    peaks: [
      { lat: 37.6308, lng: -119.0326, elevFt: 11053, sigma: 0.013 },
      { lat: 37.6455, lng: -119.04, elevFt: 10400, sigma: 0.008 },
    ],
  },
  {
    id: 'june',
    name: 'June Mountain',
    file: 'june-dem.json',
    south: 37.73,
    north: 37.78,
    west: -119.105,
    east: -119.045,
    rows: 140,
    cols: 133,
    floorFt: 7500,
    peaks: [
      { lat: 37.749, lng: -119.082, elevFt: 10090, sigma: 0.009 },
      { lat: 37.756, lng: -119.072, elevFt: 9200, sigma: 0.008 },
    ],
  },
];

export function pointInDemBounds(dem, lat, lng) {
  if (!dem) return false;
  return lat >= dem.south && lat <= dem.north && lng >= dem.west && lng <= dem.east;
}

export function interpolateDem(dem, lat, lng) {
  if (!dem || !Array.isArray(dem.heights)) return null;
  if (!pointInDemBounds(dem, lat, lng)) return null;
  const { south, north, west, east, rows, cols, heights } = dem;
  const fy = ((lat - south) / (north - south)) * (rows - 1);
  const fx = ((lng - west) / (east - west)) * (cols - 1);
  const x0 = Math.max(0, Math.min(cols - 2, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(rows - 2, Math.floor(fy)));
  const tx = fx - x0;
  const ty = fy - y0;
  const i00 = y0 * cols + x0;
  const i10 = y0 * cols + x0 + 1;
  const i01 = (y0 + 1) * cols + x0;
  const i11 = (y0 + 1) * cols + x0 + 1;
  const z =
    heights[i00] * (1 - tx) * (1 - ty) +
    heights[i10] * tx * (1 - ty) +
    heights[i01] * (1 - tx) * ty +
    heights[i11] * tx * ty;
  return Math.round(z);
}

export function buildProceduralDem(spec) {
  const { south, north, west, east, rows, cols, floorFt, peaks } = spec;
  const heights = [];
  for (let r = 0; r < rows; r++) {
    const lat = south + (r / (rows - 1)) * (north - south);
    for (let c = 0; c < cols; c++) {
      const lng = west + (c / (cols - 1)) * (east - west);
      let z = floorFt;
      for (const peak of peaks) {
        const dLat = lat - peak.lat;
        const dLng = lng - peak.lng;
        const d = Math.sqrt(dLat * dLat + dLng * dLng);
        const relief = Math.max(0, peak.elevFt - floorFt);
        z += relief * Math.exp(-((d / peak.sigma) ** 2));
      }
      heights.push(Math.round(z));
    }
  }
  return {
    id: spec.id,
    name: spec.name,
    south,
    north,
    west,
    east,
    rows,
    cols,
    units: 'ft',
    source: 'procedural',
    heights,
  };
}

export function loadDem(id) {
  const spec = SKI_DEM_SPECS.find((s) => s.id === id);
  if (!spec) return null;
  const file = path.join(__dirname, '../data/ski', spec.file);
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function cellSizeMeters(dem) {
  const latMid = (dem.south + dem.north) / 2;
  const dLat = (dem.north - dem.south) / Math.max(1, dem.rows - 1);
  const dLng = (dem.east - dem.west) / Math.max(1, dem.cols - 1);
  return {
    northM: dLat * 111_320,
    eastM: dLng * 111_320 * Math.cos((latMid * Math.PI) / 180),
  };
}

/** Horn slope (deg) and aspect (deg from north, clockwise). */
export function slopeAspectAt(dem, row, col) {
  const { rows, cols, heights } = dem;
  if (row <= 0 || col <= 0 || row >= rows - 1 || col >= cols - 1) {
    return { slopeDeg: 0, aspectDeg: 0 };
  }
  const { northM, eastM } = cellSizeMeters(dem);
  const z = (r, c) => heights[r * cols + c] * 0.3048;
  const dzEast =
    (z(row - 1, col + 1) + 2 * z(row, col + 1) + z(row + 1, col + 1) -
      (z(row - 1, col - 1) + 2 * z(row, col - 1) + z(row + 1, col - 1))) /
    (8 * eastM);
  const dzNorth =
    (z(row + 1, col - 1) + 2 * z(row + 1, col) + z(row + 1, col + 1) -
      (z(row - 1, col - 1) + 2 * z(row - 1, col) + z(row - 1, col + 1))) /
    (8 * northM);
  const slopeRad = Math.atan(Math.sqrt(dzEast * dzEast + dzNorth * dzNorth));
  let aspect = (Math.atan2(-dzEast, -dzNorth) * 180) / Math.PI;
  if (aspect < 0) aspect += 360;
  return { slopeDeg: (slopeRad * 180) / Math.PI, aspectDeg: aspect };
}

export function computeSlopeAspectGrids(dem) {
  const slopes = [];
  const aspects = [];
  for (let r = 0; r < dem.rows; r++) {
    for (let c = 0; c < dem.cols; c++) {
      const { slopeDeg, aspectDeg } = slopeAspectAt(dem, r, c);
      slopes.push(Number(slopeDeg.toFixed(2)));
      aspects.push(Number(aspectDeg.toFixed(1)));
    }
  }
  return { slopes, aspects };
}

export function aspectName(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const i = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return dirs[i];
}

export function summarizeTerrain(dem, samples = []) {
  const { slopes, aspects } = computeSlopeAspectGrids(dem);
  const interior = slopes.filter((_, i) => {
    const r = Math.floor(i / dem.cols);
    const c = i % dem.cols;
    return r > 0 && c > 0 && r < dem.rows - 1 && c < dem.cols - 1;
  });
  const avg = interior.reduce((s, v) => s + v, 0) / Math.max(1, interior.length);
  const max = interior.reduce((m, v) => Math.max(m, v), 0);
  const pins = samples.map((pin) => {
    const z = interpolateDem(dem, pin.lat, pin.lng);
    const fy = ((pin.lat - dem.south) / (dem.north - dem.south)) * (dem.rows - 1);
    const fx = ((pin.lng - dem.west) / (dem.east - dem.west)) * (dem.cols - 1);
    const sa = slopeAspectAt(dem, Math.round(fy), Math.round(fx));
    return {
      ...pin,
      elevFt: z,
      slopeDeg: Number(sa.slopeDeg.toFixed(1)),
      aspectDeg: Number(sa.aspectDeg.toFixed(1)),
      aspect: aspectName(sa.aspectDeg),
    };
  });
  return {
    id: dem.id,
    avgSlopeDeg: Number(avg.toFixed(1)),
    maxSlopeDeg: Number(max.toFixed(1)),
    pins,
    grids: { slopes, aspects },
  };
}

export default {
  FOUNTAIN_VALLEY,
  SKI_DEM_SPECS,
  pointInDemBounds,
  interpolateDem,
  buildProceduralDem,
  loadDem,
  cellSizeMeters,
  slopeAspectAt,
  computeSlopeAspectGrids,
  aspectName,
  summarizeTerrain,
};
