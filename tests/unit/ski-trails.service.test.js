/**
 * Development work by David Lane
 */
import { buildProceduralDem, pointInDemBounds, loadDem, SKI_DEM_SPECS } from '../../services/ski-dem.service.js';
import {
  normalizeDifficulty,
  normalizeOsmTrails,
  runStats,
  enrichTrails,
  findRuns,
  runCatalogSnippet,
  loadTrails,
  getTrails,
  clearTrailsCache,
} from '../../services/ski-trails.service.js';

const RESORTS = [
  { id: 'snow-summit', name: 'Snow Summit', lat: 34.2285, lng: -116.891 },
  { id: 'bear-mountain', name: 'Bear Mountain', lat: 34.2272, lng: -116.8603 },
];

/** 21×21 grid dropping 100 ft per row toward the north (row 0 = south). */
function northFaceDem() {
  const dem = buildProceduralDem({
    id: 'nf',
    name: 'nf',
    south: 34.2,
    north: 34.22,
    west: -116.9,
    east: -116.876,
    rows: 21,
    cols: 21,
    floorFt: 0,
    peaks: [],
  });
  dem.heights = dem.heights.map((_, i) => 9000 - Math.floor(i / 21) * 100);
  return dem;
}

const way = (id, tags, pts) => ({
  type: 'way',
  id,
  tags,
  geometry: pts.map(([lat, lon]) => ({ lat, lon })),
});

describe('ski-trails.service', () => {
  test('OSM piste:difficulty maps to known keys; junk is unrated', () => {
    expect(normalizeDifficulty('Intermediate')).toBe('intermediate');
    expect(normalizeDifficulty('expert')).toBe('expert');
    expect(normalizeDifficulty('extreme-ish')).toBe('unknown');
    expect(normalizeDifficulty(undefined)).toBe('unknown');
  });

  test('normalizes Overpass elements: resort polygon, nearest fallback, merge, skip areas and stations', () => {
    const summitPoly = [
      [34.22, -116.9],
      [34.24, -116.9],
      [34.24, -116.88],
      [34.22, -116.88],
      [34.22, -116.9],
    ];
    const elements = [
      way(1, { landuse: 'winter_sports', name: 'Snow Summit Mountain Resort' }, summitPoly),
      way(10, { 'piste:type': 'downhill', 'piste:difficulty': 'intermediate', name: 'Westridge' }, [
        [34.23, -116.895],
        [34.225, -116.894],
      ]),
      way(11, { 'piste:type': 'downhill', 'piste:difficulty': 'intermediate', name: 'Westridge' }, [
        [34.225, -116.894],
        [34.222, -116.893],
      ]),
      way(12, { 'piste:type': 'downhill', 'piste:difficulty': 'expert', name: 'Geronimo' }, [
        [34.22, -116.861],
        [34.226, -116.86],
      ]),
      way(13, { 'piste:type': 'downhill', area: 'yes' }, [
        [34.23, -116.89],
        [34.231, -116.89],
        [34.231, -116.889],
        [34.23, -116.89],
      ]),
      way(20, { aerialway: 'chair_lift', name: 'Chair 1' }, [
        [34.23, -116.89],
        [34.235, -116.889],
      ]),
      way(21, { aerialway: 'station' }, [
        [34.23, -116.89],
        [34.2301, -116.89],
      ]),
    ];
    const { runs, lifts } = normalizeOsmTrails(elements, RESORTS);
    expect(runs).toHaveLength(2);
    const westridge = runs.find((r) => r.name === 'Westridge');
    expect(westridge.resort).toBe('snow-summit');
    expect(westridge.paths).toHaveLength(2);
    expect(runs.find((r) => r.name === 'Geronimo').resort).toBe('bear-mountain');
    expect(lifts).toHaveLength(1);
    expect(lifts[0]).toMatchObject({ name: 'Chair 1', type: 'chair_lift', resort: 'snow-summit' });
  });

  test('runStats: uphill-drawn run is flipped, vertical and pitch come off the DEM, faces north', () => {
    const dem = northFaceDem();
    const run = {
      id: 'r',
      name: 'Test',
      difficulty: 'intermediate',
      paths: [
        [
          [34.218, -116.888],
          [34.202, -116.888],
        ].reverse(),
      ],
    };
    const s = runStats(run, dem);
    expect(s.topFt).toBeGreaterThan(s.bottomFt);
    expect(s.verticalFt).toBeGreaterThan(1400);
    expect(s.verticalFt).toBeLessThan(1700);
    expect(s.avgPitchDeg).toBeGreaterThan(13);
    expect(s.avgPitchDeg).toBeLessThan(18);
    expect(s.maxPitchDeg).toBeGreaterThanOrEqual(s.avgPitchDeg);
    expect(s.aspect).toBe('N');
    expect(s.profile[0][1]).toBeGreaterThan(s.profile[s.profile.length - 1][1]);
  });

  test('enrichTrails orients lifts bottom → top and drops off-DEM geometry', () => {
    const dem = northFaceDem();
    const out = enrichTrails(
      {
        runs: [{ id: 'off', name: 'Off map', difficulty: 'easy', paths: [[[40, -100], [40.1, -100]]] }],
        lifts: [{ id: 'l', name: 'Up', type: 'chair_lift', coords: [[34.204, -116.888], [34.218, -116.888]] }],
      },
      dem
    );
    expect(out.runs).toHaveLength(0);
    expect(out.lifts[0].coords[0][0]).toBe(34.218);
    expect(out.lifts[0].bottomFt).toBeLessThan(out.lifts[0].topFt);
    expect(out.lifts[0].riseFt).toBeGreaterThan(1000);
  });

  test('findRuns filters by difficulty, pitch band, facing; sorted by vertical', () => {
    const runs = [
      { id: 'a', name: 'A', difficulty: 'intermediate', avgPitchDeg: 14, aspect: 'N', verticalFt: 900, resort: 'x' },
      { id: 'b', name: 'B', difficulty: 'intermediate', avgPitchDeg: 27, aspect: 'NE', verticalFt: 1200, resort: 'x' },
      { id: 'c', name: 'C', difficulty: 'intermediate', avgPitchDeg: 12, aspect: 'S', verticalFt: 1500, resort: 'x' },
      { id: 'd', name: 'D', difficulty: 'advanced', avgPitchDeg: 18, aspect: 'NW', verticalFt: 1300, resort: 'x' },
      { id: 'e', name: 'E', difficulty: 'intermediate', avgPitchDeg: 19, aspect: 'NW', verticalFt: 1100, resort: 'x' },
    ];
    const hits = findRuns(runs, { difficulty: 'intermediate', maxPitch: 25, facing: 'north' });
    expect(hits.map((r) => r.id)).toEqual(['e', 'a']);
    expect(findRuns(runs, { minVerticalFt: 1250 }).map((r) => r.id)).toEqual(['c', 'd']);
  });

  test('runCatalogSnippet gives Ridge names, rating, pitch, and facing', () => {
    const text = runCatalogSnippet(
      [
        { name: 'Goldrush', resort: 'mountain-high', label: 'More difficult', verticalFt: 1573, lengthFt: 6240, avgPitchDeg: 14.1, maxPitchDeg: 24.7, aspect: 'N', topFt: 8139, bottomFt: 6566 },
        { name: null, resort: 'mountain-high', label: 'Easier', verticalFt: 50 },
      ],
      { 'mountain-high': 'Mountain High' }
    );
    expect(text).toContain('Goldrush (Mountain High; More difficult)');
    expect(text).toContain('avg 14.1°');
    expect(text).toContain('faces N');
    expect(text.split('\n')).toHaveLength(1);
  });

  test('committed trails stay on the DEMs and the resorts face north (SoCal snow side)', () => {
    clearTrailsCache();
    for (const spec of SKI_DEM_SPECS) {
      const raw = loadTrails(spec.id);
      expect(raw.attribution).toMatch(/OpenStreetMap/);
      expect(raw.runs.length).toBeGreaterThan(20);
      const dem = loadDem(spec.id);
      const pts = raw.runs.flatMap((r) => r.paths.flat());
      const inside = pts.filter(([lat, lng]) => pointInDemBounds(dem, lat, lng)).length;
      expect(inside / pts.length).toBeGreaterThan(0.99);

      const enriched = getTrails(spec.id);
      for (const resort of raw.resorts) {
        const named = enriched.runs.filter((r) => r.resort === resort.id && r.name);
        expect(named.length).toBeGreaterThan(10);
        const northish = named.filter((r) => ['N', 'NE', 'NW'].includes(r.aspect)).length;
        expect(northish / named.length).toBeGreaterThan(0.6);
      }
    }
    const summitOnly = getTrails('big-bear', { resort: 'snow-summit' });
    expect(summitOnly.runs.every((r) => r.resort === 'snow-summit')).toBe(true);
    expect(getTrails('fountain-valley')).toBeNull();
  });
});
