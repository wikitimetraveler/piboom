/**
 * Development work by David Lane
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  bboxTo3857,
  budgetNodes,
  coverLabelForPct,
  eptIsWebMercator,
  eptNodeCube,
  eptNodeOverlaps,
  featureBboxOverlaps,
  lidarFilePath,
  loadLidarManifest,
  lngLatToWebMercator,
  packLidarFile,
  quantizePoint,
  dequantizePoint,
  readLasHeader,
  readLasPoint,
  selectEptNodes,
  targetDepthForMeters,
  targetDepthForCoverage,
  treeCoverForPaths,
  unpackLidarFile,
  webMercatorToLngLat,
  workUnitFromFeature,
} from '../../services/ski-lidar.service.js';

describe('ski-lidar.service', () => {
  test('Web Mercator round-trips and the ski bbox grows north and east', () => {
    const p = lngLatToWebMercator(-117.7, 34.37);
    const back = webMercatorToLngLat(p.x, p.y);
    expect(back.lng).toBeCloseTo(-117.7, 5);
    expect(back.lat).toBeCloseTo(34.37, 5);
    expect(p.x).toBeLessThan(0);
    expect(p.y).toBeGreaterThan(0);

    const box = bboxTo3857({ south: 34.35, north: 34.39, west: -117.71, east: -117.65 });
    expect(box.minX).toBeLessThan(box.maxX);
    expect(box.minY).toBeLessThan(box.maxY);
  });

  test('Entwine nodes overlap only when their cube meets the query', () => {
    const root = [0, 0, 0, 800, 800, 800];
    const low = eptNodeCube(root, '1-0-0-0');
    expect(low.maxX).toBe(400);
    expect(low.maxY).toBe(400);
    const query = { minX: 10, minY: 10, maxX: 100, maxY: 100 };
    expect(eptNodeOverlaps(root, '1-0-0-0', query)).toBe(true);
    expect(eptNodeOverlaps(root, '1-1-1-0', query)).toBe(false);

    const picked = selectEptNodes(root, query, [
      { key: '0-0-0-0', count: 10 },
      { key: '1-0-0-0', count: 5 },
      { key: '1-1-1-0', count: 5 },
      { key: '2-0-0-0', count: 4 },
    ], 1);
    expect(picked.map((n) => n.key)).toEqual(['1-0-0-0']);
    expect(targetDepthForMeters([0, 0, 0, 800, 800, 800], 100)).toBe(3);
  });

  test('budgetNodes thins a dense node list toward the point cap', () => {
    const root = [0, 0, 0, 400, 400, 400];
    const nodes = [
      { key: '1-0-0-0', count: 1000 },
      { key: '1-1-0-0', count: 1000 },
      { key: '1-0-1-0', count: 1000 },
      { key: '1-1-1-0', count: 1000 },
    ];
    const kept = budgetNodes(nodes, root, 2000);
    expect(kept.length).toBe(2);
    expect(new Set(kept.map((n) => n.key)).size).toBe(2);
  });

  test('budgetNodes keeps every elevation slice in a kept column', () => {
    const root = [0, 0, 0, 400, 400, 400];
    const nodes = [
      { key: '1-0-0-0', count: 1000 },
      { key: '1-0-0-1', count: 1000 },
      { key: '1-1-1-0', count: 1000 },
      { key: '1-1-1-1', count: 1000 },
    ];
    const kept = budgetNodes(nodes, root, 2000);
    expect(kept).toHaveLength(2);
    const column = kept[0].key.split('-').slice(0, 3).join('-');
    expect(kept.every((n) => n.key.startsWith(`${column}-`))).toBe(true);
  });

  test('budgetNodes fills from the middle of the query', () => {
    const root = [0, 0, 0, 400, 400, 400];
    const kept = budgetNodes(
      [
        { key: '1-0-0-0', count: 3000 },
        { key: '1-1-1-0', count: 3000 },
      ],
      root,
      3000,
      { minX: 250, minY: 250, maxX: 350, maxY: 350 }
    );
    expect(kept.map((n) => n.key)).toEqual(['1-1-1-0']);
  });

  test('budgetNodes spreads fat nodes across the query', () => {
    const root = [0, 0, 0, 800, 800, 800];
    const kept = budgetNodes(
      [
        { key: '2-1-1-0', count: 100000 },
        { key: '2-1-2-0', count: 100000 },
        { key: '2-0-0-0', count: 100000 },
      ],
      root,
      16000
    );
    expect(kept.map((n) => n.key)).toContain('2-0-0-0');
    expect(kept).toHaveLength(2);
  });

  test('targetDepthForCoverage tiles the query', () => {
    expect(targetDepthForCoverage([0, 0, 0, 8000, 8000, 8000], { minX: 0, minY: 0, maxX: 2000, maxY: 2000 }, 4)).toBe(3);
  });

  test('quantize round-trips through the SKLD header', () => {
    const bounds = { west: -118, east: -117, south: 34, north: 35, zMinFt: 6000, zMaxFt: 8000 };
    const src = { lng: -117.5, lat: 34.5, elevFt: 7000, cls: 5, hagM: 12.2 };
    const q = quantizePoint(src, bounds);
    expect(q.hag).toBe(12);
    expect(q.cls).toBe(5);
    const back = dequantizePoint(q, bounds);
    expect(back.lng).toBeCloseTo(src.lng, 4);
    expect(back.lat).toBeCloseTo(src.lat, 4);
    expect(back.elevFt).toBeCloseTo(7000, 0);

    const file = packLidarFile(bounds, [src, { ...src, lng: -117.25, cls: 2, hagM: 0 }]);
    expect(file.subarray(0, 4).toString('ascii')).toBe('SKLD');
    expect(file.length).toBe(40 + 16);
    const unpacked = unpackLidarFile(file);
    expect(unpacked.count).toBe(2);
    expect(unpacked.stride).toBe(8);
    expect(unpacked.points[0].cls).toBe(5);
    expect(unpacked.points[1].cls).toBe(2);
    expect(unpacked.points[0].lng).toBeCloseTo(-117.5, 4);
    expect(unpacked.bounds.zMinFt).toBeCloseTo(6000, 1);
  });

  test('LAS header and point class follow format 0 and format 6', () => {
    const header = Buffer.alloc(375);
    header.write('LASF', 0);
    header.writeUInt8(1, 24);
    header.writeUInt8(4, 25);
    header.writeUInt16LE(375, 94);
    header.writeUInt32LE(375, 96);
    header.writeUInt8(6, 104);
    header.writeUInt16LE(30, 105);
    header.writeUInt32LE(0, 107);
    header.writeBigUInt64LE(9n, 247);
    header.writeDoubleLE(0.01, 131);
    header.writeDoubleLE(0.01, 139);
    header.writeDoubleLE(0.01, 147);
    header.writeDoubleLE(100, 155);
    header.writeDoubleLE(200, 163);
    header.writeDoubleLE(10, 171);
    const parsed = readLasHeader(header);
    expect(parsed.pointCount).toBe(9);
    expect(parsed.format).toBe(6);
    expect(parsed.scale[0]).toBeCloseTo(0.01);

    const rec = Buffer.alloc(30);
    rec.writeInt32LE(1000, 0);
    rec.writeInt32LE(2000, 4);
    rec.writeInt32LE(500, 8);
    rec.writeUInt16LE(400, 12);
    rec.writeUInt8(2, 15);
    rec.writeUInt8(4, 16);
    const point = readLasPoint(rec, parsed);
    expect(point.x).toBeCloseTo(110, 5);
    expect(point.y).toBeCloseTo(220, 5);
    expect(point.z).toBeCloseTo(15, 5);
    expect(point.cls).toBe(4);
    expect(point.intensity).toBe(400);

    const legacy = Buffer.alloc(28);
    legacy.writeUInt8(0x87, 15);
    expect(readLasPoint(legacy, { ...parsed, format: 1 }).cls).toBe(7);
  });

  test('tree cover counts tall vegetation near the run and ignores the rest', () => {
    const paths = [[[34, -117], [34.0002, -117]]];
    const points = [
      ...Array.from({ length: 4 }, () => ({ lat: 34.0001, lng: -117.00002, cls: 5, hagM: 8 })),
      ...Array.from({ length: 4 }, () => ({ lat: 34.0001, lng: -117.00002, cls: 2, hagM: 0 })),
      { lat: 34.0001, lng: -117.00002, cls: 3, hagM: 1 },
      { lat: 34.01, lng: -117, cls: 5, hagM: 20 },
    ];
    const cover = treeCoverForPaths(points, paths);
    expect(cover.treeCoverPct).toBe(44);
    expect(cover.coverLabel).toBe('tree');
    expect(coverLabelForPct(20)).toBe('glade');
    expect(coverLabelForPct(5)).toBe('open');
    expect(treeCoverForPaths([], paths)).toEqual({ treeCoverPct: null, coverLabel: null });
  });

  test('work-unit lookup, mercator check, and manifest paths', () => {
    const feature = {
      properties: { name: 'USGS_LPC_CA_Example_2016', year: 2016, url: 'https://example.test/USGS_LPC_CA_Example_2016/ept.json' },
      geometry: { type: 'Polygon', coordinates: [[[-117.8, 34.3], [-117.6, 34.3], [-117.6, 34.5], [-117.8, 34.5], [-117.8, 34.3]]] },
    };
    expect(featureBboxOverlaps(feature, { south: 34.35, north: 34.39, west: -117.71, east: -117.65 })).toBe(true);
    expect(featureBboxOverlaps(feature, { south: 40, north: 41, west: -105, east: -104 })).toBe(false);
    const unit = workUnitFromFeature(feature);
    expect(unit.baseUrl).toBe('https://example.test/USGS_LPC_CA_Example_2016');
    expect(unit.year).toBe(2016);
    expect(eptIsWebMercator({ srs: { horizontal: '3857', wkt: 'PROJCS["WGS 84 / Pseudo-Mercator"]' } })).toBe(true);
    expect(eptIsWebMercator({ srs: { wkt: 'PROJCS["NAD83 / UTM zone 11N"]' } })).toBe(false);
    expect(lidarFilePath('wrightwood', 0)).toMatch(/wrightwood-lod0\.bin$/);
    expect(lidarFilePath('wrightwood', 1)).toMatch(/wrightwood-lod1\.bin$/);
    expect(loadLidarManifest('not-a-resort')).toBeNull();
  });

  test('every ski destination has a baked LOD0 lidar cloud', () => {
    const { destinations } = JSON.parse(
      readFileSync(path.join(process.cwd(), 'data', 'ski', 'destinations.json'), 'utf8')
    );
    const dems = [...new Set(destinations.map((d) => d.dem).filter(Boolean))];
    expect(dems.length).toBeGreaterThan(0);
    for (const dem of dems) {
      const manifest = loadLidarManifest(dem);
      expect({ dem, baked: Boolean(manifest?.lods?.['0']) }).toEqual({ dem, baked: true });
      expect(existsSync(lidarFilePath(dem, 0))).toBe(true);
    }
  });
});
