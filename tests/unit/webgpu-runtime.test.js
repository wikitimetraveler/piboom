/**
 * Development work by David Lane
 */
import '../../public/shared/js/webgpu-runtime.js';
import '../../public/shared/js/webgpu-globe.js';
import '../../public/shared/js/webgpu-blacklight-poster.js';
import '../../public/shared/js/webgpu-knowledge-constellation.js';
import '../../public/shared/js/webgpu-planetarium-sky.js';
import '../../public/shared/js/webgpu-calc-engine-dag.js';
import '../../public/finance/js/disasters-unified/webgpu-heat-overlay.js';
import '../../public/shared/calcEngineLibrary.js';
import '../../public/shared/calculationEngine.js';

const {
  WebGpuRuntime,
  WebGpuGlobe,
  WebGpuBlacklightPoster,
  WebGpuKnowledgeConstellation,
  WebGpuPlanetariumSky,
  WebGpuCalcEngineDag,
  DuWebGpuHeat,
  createFHACalculatorConfig,
} = globalThis;

describe('WebGpuRuntime', () => {
  test('detectBackend returns webgpu when navigator.gpu is present', () => {
    expect(WebGpuRuntime.detectBackend({})).toBe('webgpu');
  });

  test('detectBackend falls back to webgl2 when gpu is missing', () => {
    expect(WebGpuRuntime.detectBackend(null)).toBe('webgl2');
    expect(WebGpuRuntime.detectBackend(undefined)).toBe('webgl2');
  });

  test('pixelRatio caps devicePixelRatio at 2', () => {
    const prev = globalThis.window;
    globalThis.window = { devicePixelRatio: 3.5 };
    expect(WebGpuRuntime.pixelRatio(2)).toBe(2);
    expect(WebGpuRuntime.pixelRatio(1.25)).toBe(1.25);
    globalThis.window = prev;
  });

  test('shouldPause follows document.hidden', () => {
    const prev = globalThis.document;
    globalThis.document = { hidden: true };
    expect(WebGpuRuntime.shouldPause()).toBe(true);
    globalThis.document = { hidden: false };
    expect(WebGpuRuntime.shouldPause()).toBe(false);
    globalThis.document = prev;
  });

  test('requestGpu returns webgl2 when navigator.gpu is absent', async () => {
    const prev = globalThis.navigator;
    globalThis.navigator = {};
    const result = await WebGpuRuntime.requestGpu();
    expect(result.backend).toBe('webgl2');
    globalThis.navigator = prev;
  });
});

describe('WebGpuGlobe', () => {
  test('latLonToUv wraps lon and clamps lat to equirect UV', () => {
    const eq = WebGpuGlobe.latLonToUv(0, 0);
    expect(eq.u).toBeCloseTo(0.5, 5);
    expect(eq.v).toBeCloseTo(0.5, 5);
    const west = WebGpuGlobe.latLonToUv(0, -180);
    expect(west.u).toBeCloseTo(0, 5);
    const north = WebGpuGlobe.latLonToUv(90, 0);
    expect(north.v).toBeCloseTo(1, 5);
    const south = WebGpuGlobe.latLonToUv(-90, 180);
    expect(south.v).toBeCloseTo(0, 5);
    expect(south.u).toBeCloseTo(0, 5);
  });

  test('HERO_BODIES lists ten NASA worlds including Mars and Moon', () => {
    expect(WebGpuGlobe.HERO_BODIES).toHaveLength(10);
    expect(WebGpuGlobe.HERO_BODIES).toEqual(
      expect.arrayContaining(['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'pluto'])
    );
    expect(WebGpuGlobe.resolveBody('mars').label).toBe('Mars');
    expect(WebGpuGlobe.resolveBody('moon').href).toBe('/family/lane-museum.html?lunar=1');
    expect(WebGpuGlobe.LANE_CRATER.lat).toBeCloseTo(-9.5, 5);
    expect(WebGpuGlobe.LANE_CRATER.lon).toBeCloseTo(132.36, 5);
    expect(WebGpuGlobe.LAVA_SEEDS.length).toBeGreaterThan(0);
  });

  test('BODIES carry radius, tilt, spin, and Saturn ring bounds', () => {
    const earth = WebGpuGlobe.resolveBody('earth');
    const saturn = WebGpuGlobe.resolveBody('saturn');
    const uranus = WebGpuGlobe.resolveBody('uranus');
    const venus = WebGpuGlobe.resolveBody('venus');
    expect(earth.radiusKm).toBe(6371);
    expect(earth.tiltDeg).toBeCloseTo(23.4, 5);
    expect(venus.spinRate).toBeLessThan(0);
    expect(uranus.tiltDeg).toBeCloseTo(97.8, 5);
    expect(saturn.rings).toEqual(
      expect.objectContaining({
        inner: 1.11,
        outer: 2.27,
        cassini: 1.95,
      })
    );
    expect(saturn.rings.inner).toBeLessThan(saturn.rings.outer);
    expect(WebGpuGlobe.resolveBody('jupiter').rings).toBeNull();
  });

  test('visualScale is monotonic Pluto < Earth < Jupiter and clamped', () => {
    const pluto = WebGpuGlobe.visualScale(WebGpuGlobe.resolveBody('pluto').radiusKm);
    const earth = WebGpuGlobe.visualScale(WebGpuGlobe.resolveBody('earth').radiusKm);
    const jupiter = WebGpuGlobe.visualScale(WebGpuGlobe.resolveBody('jupiter').radiusKm);
    expect(pluto).toBeLessThan(earth);
    expect(earth).toBeLessThan(jupiter);
    expect(pluto).toBeGreaterThanOrEqual(0.48);
    expect(jupiter).toBeLessThanOrEqual(1.75);
    expect(WebGpuGlobe.visualScale(0)).toBe(1);
    expect(WebGpuGlobe.visualScale(NaN)).toBe(1);
  });

  test('DEFAULT_SUN_DIR points stage-left (positive X)', () => {
    expect(WebGpuGlobe.DEFAULT_SUN_DIR.x).toBeGreaterThan(0);
    expect(WebGpuGlobe.DEFAULT_SUN_DIR.y).toBeGreaterThan(0);
    const sync = WebGpuGlobe.ensureHeroSync();
    expect(sync.sunDir.x).toBeGreaterThan(0);
  });

  test('LANDMARKS include Moon, Mars, Jupiter, Earth, Saturn, and outer-body targets', () => {
    expect(WebGpuGlobe.LANDMARKS.moon.lat).toBeCloseTo(-9.5, 5);
    expect(WebGpuGlobe.LANDMARKS.moon.href).toMatch(/lane-museum/);
    expect(WebGpuGlobe.LANDMARKS.mars.label).toBe('Olympus Mons');
    expect(WebGpuGlobe.LANDMARKS.jupiter.label).toBe('Great Red Spot');
    expect(WebGpuGlobe.LANDMARKS.earth.label).toMatch(/Hampton/);
    expect(WebGpuGlobe.LANDMARKS.saturn.label).toMatch(/Cassini/);
    expect(WebGpuGlobe.LANDMARKS.mercury.label).toMatch(/Caloris/);
    expect(WebGpuGlobe.LANDMARKS.venus.label).toMatch(/Maxwell/);
    expect(WebGpuGlobe.LANDMARKS.neptune.label).toMatch(/Dark Spot/);
    expect(WebGpuGlobe.LANDMARKS.pluto.label).toMatch(/Sputnik/);
    expect(typeof WebGpuGlobe.applySunFromDate).toBe('function');
  });

  test('capFirmsPoints drops bad coords and respects max', () => {
    const rows = [
      { lat: 34.1, lng: -118.2, raw: { frp: 40, brightness: 340 } },
      { lat: 999, lng: 0 },
      { latitude: 40, longitude: -120, frp: 10 },
      { lat: 20, lng: 10 },
    ];
    const capped = WebGpuGlobe.capFirmsPoints(rows, 2);
    expect(capped).toHaveLength(2);
    expect(capped[0].lat).toBe(34.1);
    expect(capped[0].lon).toBe(-118.2);
    expect(capped[0].weight).toBeGreaterThan(0);
    expect(capped[0].weight).toBeLessThanOrEqual(3);
  });
});

describe('WebGpuBlacklightPoster', () => {
  test('fftBands splits a frequency buffer into bass mids highs', () => {
    const data = new Uint8Array(64);
    data.fill(10);
    data[0] = 255;
    data[1] = 255;
    const bands = WebGpuBlacklightPoster.fftBands(data);
    expect(bands.bass).toBeGreaterThan(bands.mids);
    expect(bands.mids).toBeGreaterThan(0);
    expect(bands.highs).toBeGreaterThan(0);
    expect(bands.bass).toBeLessThanOrEqual(1);
  });

  test('hashString is stable and in unit range', () => {
    expect(WebGpuBlacklightPoster.hashString('Zed|Studio')).toBe(
      WebGpuBlacklightPoster.hashString('Zed|Studio')
    );
    expect(WebGpuBlacklightPoster.hashString('Zed|Studio')).toBeGreaterThanOrEqual(0);
    expect(WebGpuBlacklightPoster.hashString('Zed|Studio')).toBeLessThan(1);
    expect(WebGpuBlacklightPoster.hashString('A')).not.toBe(WebGpuBlacklightPoster.hashString('B'));
  });
});

describe('WebGpuKnowledgeConstellation', () => {
  test('inferStore maps GSE / ICE / HeyGen / Encompass blobs', () => {
    expect(WebGpuKnowledgeConstellation.inferStore({ category: 'pooling' })).toBe('gse');
    expect(WebGpuKnowledgeConstellation.inferStore({ repo: 'imt-developerconnect' })).toBe('ice');
    expect(WebGpuKnowledgeConstellation.inferStore({ sourceType: 'heygen-docs' })).toBe('heygen');
    expect(WebGpuKnowledgeConstellation.inferStore({ title: 'Encompass custom field' })).toBe(
      'encompass'
    );
  });

  test('normalizeNeighbors and layoutNeighbors produce unit-square points', () => {
    const rows = [
      { id: 'S1', title: 'UMBS pooling', score: 0.9, category: 'pooling' },
      { id: 'S2', title: 'ICE Postman', score: 0.4, repo: 'imt-foo' },
    ];
    const neighbors = WebGpuKnowledgeConstellation.normalizeNeighbors(rows);
    expect(neighbors).toHaveLength(2);
    expect(neighbors[0].store).toBe('gse');
    expect(neighbors[1].store).toBe('ice');
    const laid = WebGpuKnowledgeConstellation.layoutNeighbors(neighbors);
    expect(laid[0].x).toBeGreaterThan(0);
    expect(laid[0].x).toBeLessThan(1);
    expect(laid[0].y).toBeGreaterThan(0);
    expect(laid[0].y).toBeLessThan(1);
  });
});

describe('WebGpuPlanetariumSky', () => {
  test('exports mount and compute shader', () => {
    expect(typeof WebGpuPlanetariumSky.mount).toBe('function');
    expect(WebGpuPlanetariumSky.COMPUTE_WGSL).toMatch(/@compute/);
  });
});

describe('DuWebGpuHeat', () => {
  test('parseFirmsWeight blends FRP and brightness', () => {
    const low = DuWebGpuHeat.parseFirmsWeight({ raw: { frp: 4, brightness: 290 } });
    const high = DuWebGpuHeat.parseFirmsWeight({ raw: { frp: 80, brightness: 360 } });
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(3);
  });
});

describe('WebGpuCalcEngineDag', () => {
  test('exports mount, layout, and compute shaders', () => {
    expect(typeof WebGpuCalcEngineDag.mount).toBe('function');
    expect(typeof WebGpuCalcEngineDag.layoutFhaDag).toBe('function');
    expect(WebGpuCalcEngineDag.PAINT_WGSL).toMatch(/@compute/);
    expect(WebGpuCalcEngineDag.INTEGER_KERNEL_WGSL).toMatch(/round_half_up_mul_div/);
  });

  test('layoutFhaDag from createFHACalculatorConfig has 11 results and expected edges', () => {
    const config = createFHACalculatorConfig({ prefix: 'fs' });
    expect(config.groups).toHaveLength(11);
    const { nodes, edges, maxDepth } = WebGpuCalcEngineDag.layoutFhaDag(config.groups);
    const results = nodes.filter((n) => n.isResult);
    expect(results).toHaveLength(11);
    expect(nodes).toHaveLength(18);
    expect(edges).toHaveLength(18);
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'fs_g12', to: 'fs_g15' }),
        expect.objectContaining({ from: 'fs_g15', to: 'fs_g18' }),
        expect.objectContaining({ from: 'fs_g20', to: 'fs_g24' }),
        expect.objectContaining({ from: 'fs_g28', to: 'fs_g30' }),
        expect.objectContaining({ from: 'fs_g24', to: 'fs_g33' }),
      ])
    );
    expect(maxDepth).toBeGreaterThanOrEqual(4);
    nodes.forEach((n) => {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(1);
      expect(n.y).toBeGreaterThan(0);
      expect(n.y).toBeLessThan(1);
    });
  });
});
