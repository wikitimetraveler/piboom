/**
 * Development work by David Lane
 */
import {
  SKI_DEM_SPECS,
  FOUNTAIN_VALLEY,
  pointInDemBounds,
  interpolateDem,
  buildProceduralDem,
  loadDem,
  slopeAspectAt,
  aspectName,
} from '../../services/ski-dem.service.js';

const MH = { lat: 34.377, lng: -117.678 };
const SUMMIT = { lat: 34.2285, lng: -116.891 };
const BEAR = { lat: 34.2272, lng: -116.8603 };
const SNOW_VALLEY = { lat: 34.2253, lng: -117.0369 };
const MAMMOTH_LODGE = { lat: 37.6511, lng: -119.0268 };
const MAMMOTH_SUMMIT = { lat: 37.6308, lng: -119.0326 };
const JUNE_LODGE = { lat: 37.7685, lng: -119.0905 };

describe('ski DEM', () => {
  test('Wrightwood DEM covers Mountain High only — not Fountain Valley', () => {
    const spec = SKI_DEM_SPECS.find((s) => s.id === 'wrightwood');
    expect(pointInDemBounds(spec, MH.lat, MH.lng)).toBe(true);
    expect(pointInDemBounds(spec, FOUNTAIN_VALLEY.lat, FOUNTAIN_VALLEY.lng)).toBe(false);
    expect(pointInDemBounds(spec, SUMMIT.lat, SUMMIT.lng)).toBe(false);
  });

  test('Big Bear DEM covers Snow Summit and Bear Mountain — not Fountain Valley', () => {
    const spec = SKI_DEM_SPECS.find((s) => s.id === 'big-bear');
    expect(pointInDemBounds(spec, SUMMIT.lat, SUMMIT.lng)).toBe(true);
    expect(pointInDemBounds(spec, BEAR.lat, BEAR.lng)).toBe(true);
    expect(pointInDemBounds(spec, FOUNTAIN_VALLEY.lat, FOUNTAIN_VALLEY.lng)).toBe(false);
    expect(pointInDemBounds(spec, MH.lat, MH.lng)).toBe(false);
  });

  test('Snow Valley DEM covers Running Springs — not Big Bear or Fountain Valley', () => {
    const spec = SKI_DEM_SPECS.find((s) => s.id === 'snow-valley');
    expect(pointInDemBounds(spec, SNOW_VALLEY.lat, SNOW_VALLEY.lng)).toBe(true);
    expect(pointInDemBounds(spec, SUMMIT.lat, SUMMIT.lng)).toBe(false);
    expect(pointInDemBounds(spec, FOUNTAIN_VALLEY.lat, FOUNTAIN_VALLEY.lng)).toBe(false);
  });

  test('Mammoth and June DEMs each cover their own resort only', () => {
    const mammoth = SKI_DEM_SPECS.find((s) => s.id === 'mammoth');
    const june = SKI_DEM_SPECS.find((s) => s.id === 'june');
    expect(pointInDemBounds(mammoth, MAMMOTH_LODGE.lat, MAMMOTH_LODGE.lng)).toBe(true);
    expect(pointInDemBounds(mammoth, MAMMOTH_SUMMIT.lat, MAMMOTH_SUMMIT.lng)).toBe(true);
    expect(pointInDemBounds(mammoth, JUNE_LODGE.lat, JUNE_LODGE.lng)).toBe(false);
    expect(pointInDemBounds(june, JUNE_LODGE.lat, JUNE_LODGE.lng)).toBe(true);
    expect(pointInDemBounds(june, MAMMOTH_LODGE.lat, MAMMOTH_LODGE.lng)).toBe(false);
  });

  test('interpolation returns a height inside the mesh and null outside', () => {
    const dem = buildProceduralDem(SKI_DEM_SPECS[0]);
    const z = interpolateDem(dem, MH.lat, MH.lng);
    expect(z).toBeGreaterThan(6000);
    expect(interpolateDem(dem, FOUNTAIN_VALLEY.lat, FOUNTAIN_VALLEY.lng)).toBeNull();
  });

  test('slope/aspect: a west-rising ramp faces west and is steeper than a flat', () => {
    const spec = {
      id: 'ramp',
      name: 'ramp',
      south: 34.2,
      north: 34.21,
      west: -117.7,
      east: -117.69,
      rows: 5,
      cols: 5,
      floorFt: 1000,
      peaks: [],
    };
    const dem = buildProceduralDem(spec);
    dem.heights = dem.heights.map((_, i) => {
      const c = i % 5;
      return 1000 + c * 400;
    });
    const mid = slopeAspectAt(dem, 2, 2);
    expect(mid.slopeDeg).toBeGreaterThan(5);
    expect(aspectName(mid.aspectDeg)).toBe('W');
  });

  test('slope/aspect: terrain dropping toward the north faces north (ski-lake side)', () => {
    const spec = {
      id: 'north-face',
      name: 'north-face',
      south: 34.2,
      north: 34.21,
      west: -117.7,
      east: -117.69,
      rows: 5,
      cols: 5,
      floorFt: 1000,
      peaks: [],
    };
    const dem = buildProceduralDem(spec);
    dem.heights = dem.heights.map((_, i) => 3000 - Math.floor(i / 5) * 400);
    expect(aspectName(slopeAspectAt(dem, 2, 2).aspectDeg)).toBe('N');
  });

  test('committed DEM files match specs and stay on the ski areas', () => {
    for (const spec of SKI_DEM_SPECS) {
      const dem = loadDem(spec.id);
      expect(dem.rows).toBe(spec.rows);
      expect(dem.cols).toBe(spec.cols);
      expect(dem.heights).toHaveLength(spec.rows * spec.cols);
      expect(pointInDemBounds(dem, FOUNTAIN_VALLEY.lat, FOUNTAIN_VALLEY.lng)).toBe(false);
    }
    const ww = loadDem('wrightwood');
    expect(interpolateDem(ww, MH.lat, MH.lng)).toBeGreaterThan(6000);
    const bb = loadDem('big-bear');
    expect(interpolateDem(bb, SUMMIT.lat, SUMMIT.lng)).toBeGreaterThan(6500);
    expect(interpolateDem(bb, BEAR.lat, BEAR.lng)).toBeGreaterThan(6500);
    const sv = loadDem('snow-valley');
    expect(interpolateDem(sv, SNOW_VALLEY.lat, SNOW_VALLEY.lng)).toBeGreaterThan(6000);
    const mm = loadDem('mammoth');
    expect(interpolateDem(mm, MAMMOTH_SUMMIT.lat, MAMMOTH_SUMMIT.lng)).toBeGreaterThan(10500);
    expect(interpolateDem(mm, MAMMOTH_LODGE.lat, MAMMOTH_LODGE.lng)).toBeGreaterThan(8400);
    const jm = loadDem('june');
    expect(interpolateDem(jm, JUNE_LODGE.lat, JUNE_LODGE.lng)).toBeGreaterThan(7300);
  });
});
