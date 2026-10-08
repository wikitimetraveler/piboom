/**
 * Development work by David Lane
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import '../../public/entertainment/js/dinosaurs-catalog.js';

const { DinosaursCatalog: C } = globalThis;

const FORMS = ['theropod', 'prosauropod', 'sauropod', 'stegosaur', 'ceratopsian', 'ankylosaur'];

function read(rel) {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function loadMenuConfig() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read('public/shared/menu-config.js'), sandbox);
  return sandbox.MENU_CONFIG;
}

describe('DinosaursCatalog eras', () => {
  test('three Mesozoic periods, oldest first, with contiguous boundaries', () => {
    expect(C.ERAS.map((e) => e.id)).toEqual(['triassic', 'jurassic', 'cretaceous']);
    expect(C.ERAS[0].startMa).toBe(252);
    expect(C.ERAS[2].endMa).toBe(66);
    for (let i = 1; i < C.ERAS.length; i += 1) {
      expect(C.ERAS[i].startMa).toBe(C.ERAS[i - 1].endMa);
    }
  });

  test('every era carries a full sky palette and a default species from that era', () => {
    C.ERAS.forEach((era) => {
      ['zenith', 'horizon', 'sun', 'haze', 'cloud', 'ridge'].forEach((key) => {
        expect(era.sky[key]).toMatch(/^#[0-9a-f]{6}$/i);
      });
      expect(era.ground).toMatch(/^#[0-9a-f]{6}$/i);
      const def = C.defaultSpeciesForEra(era.id);
      expect(def).not.toBeNull();
      expect(def.era).toBe(era.id);
    });
  });
});

describe('DinosaursCatalog species', () => {
  test('nine unique species, three per era', () => {
    expect(C.SPECIES).toHaveLength(9);
    expect(new Set(C.SPECIES.map((s) => s.id)).size).toBe(9);
    C.ERAS.forEach((era) => expect(C.speciesForEra(era.id)).toHaveLength(3));
  });

  test('each species has stats, palette, and a buildable body plan', () => {
    C.SPECIES.forEach((sp) => {
      expect(sp.name).toBeTruthy();
      expect(sp.lengthM).toBeGreaterThan(0);
      expect(['carnivore', 'herbivore']).toContain(sp.diet);
      expect(sp.found).toBeTruthy();
      expect(sp.blurb.length).toBeGreaterThan(40);
      expect(sp.ma[0]).toBeGreaterThanOrEqual(sp.ma[1]);
      const era = C.eraById(sp.era);
      expect(sp.ma[0]).toBeLessThanOrEqual(era.startMa);
      expect(sp.ma[1]).toBeGreaterThanOrEqual(era.endMa);
      ['skin', 'belly', 'accent'].forEach((k) => expect(sp.palette[k]).toMatch(/^#[0-9a-f]{6}$/i));
      expect(FORMS).toContain(sp.body.form);
      expect(sp.body.torso).toHaveLength(3);
      expect(sp.body.neck[0]).toBeGreaterThanOrEqual(2);
      expect(sp.body.tail[0]).toBeGreaterThanOrEqual(4);
      expect(sp.body.legs).toHaveLength(2);
    });
  });

  test('lookups are case-insensitive and miss cleanly', () => {
    expect(C.speciesById('Tyrannosaurus').name).toBe('Tyrannosaurus');
    expect(C.eraById('JURASSIC').name).toBe('Jurassic');
    expect(C.speciesById('velociraptor')).toBeNull();
    expect(C.eraById('')).toBeNull();
    expect(C.speciesForEra('permian')).toEqual([]);
    expect(C.defaultSpeciesForEra('permian')).toBeNull();
  });
});

describe('DinosaursCatalog helpers', () => {
  test('formatLength shows metres and feet', () => {
    expect(C.formatLength(12.3)).toBe('12.3 m · 40 ft');
    expect(C.formatLength(9)).toBe('9 m · 30 ft');
    expect(C.formatLength(0)).toBe('');
    expect(C.formatLength('abc')).toBe('');
  });

  test('formatMa collapses equal bounds', () => {
    expect(C.formatMa([68, 66])).toBe('68–66 Ma');
    expect(C.formatMa([154, 154])).toBe('154 Ma');
    expect(C.formatMa(null)).toBe('');
  });

  test('humansLong and scaleShare size the parade', () => {
    expect(C.humansLong(12.3)).toBe(7);
    expect(C.humansLong(1)).toBe(1);
    expect(C.humansLong(-2)).toBe(0);
    expect(C.maxLengthM()).toBe(22);
    expect(C.scaleShare(22)).toBe(1);
    expect(C.scaleShare(11)).toBeCloseTo(0.5);
    expect(C.scaleShare(50)).toBe(1);
    expect(C.scaleShare(0)).toBe(0);
  });

  test('hexToRgb01 handles long, short, and bad input', () => {
    expect(C.hexToRgb01('#ff0000')).toEqual([1, 0, 0]);
    expect(C.hexToRgb01('#fff')).toEqual([1, 1, 1]);
    expect(C.hexToRgb01('nope')).toEqual([0, 0, 0]);
  });
});

describe('dinosaurs page wiring', () => {
  const href = '/entertainment/dinosaurs.html';

  test('entertainment nav, hub, search, and home link the page', () => {
    const menu = loadMenuConfig();
    expect(menu.NAV_ENTERTAINMENT.some((item) => item.href === href)).toBe(true);
    expect(menu.ENTERTAINMENT_TOOLS.some((item) => item.href === href)).toBe(true);
    expect(read('public/shared/tool-search-index.js')).toContain(href);
    expect(read('public/index.html')).toContain(href);
  });

  test('HTML mounts sky, sim, stage, and sections and loads every script', () => {
    const html = read('public/entertainment/dinosaurs.html');
    ['dinoSky', 'dinoSim', 'dinoStage', 'dinoEras', 'dinoHerd', 'dinoScale', 'dinoReadout', 'dinoImpact'].forEach((id) => {
      expect(html).toContain(`id="${id}"`);
    });
    [
      '/shared/js/webgpu-runtime.js',
      'three.min.js',
      'gsap.min.js',
      'dinosaurs-catalog.js',
      'dinosaurs-sky.js',
      'dinosaurs-sim.js',
      'dinosaurs-scene.js',
      'dinosaurs.js',
      '/entertainment/css/dinosaurs.css',
    ].forEach((src) => expect(html).toContain(src));
    expect(html.indexOf('dinosaurs-catalog.js')).toBeLessThan(html.indexOf('/entertainment/js/dinosaurs.js'));
  });

  test('graphics modules keep their fallbacks and teardown paths', () => {
    const sky = read('public/entertainment/js/dinosaurs-sky.js');
    expect(sky).toContain("getContext('webgl2'");
    expect(sky).toContain('cssFallback');
    expect(sky).toContain('prefers-reduced-motion');

    const sim = read('public/entertainment/js/dinosaurs-sim.js');
    expect(sim).toContain('WebGpuRuntime');
    expect(sim).toContain('@compute');
    expect(sim).toContain('prefersReducedMotion');
    expect(sim).toContain('dispose');

    const scene = read('public/entertainment/js/dinosaurs-scene.js');
    expect(scene).toContain('renderer.dispose()');
    expect(scene).toContain('IntersectionObserver');
    expect(scene).toContain('prefers-reduced-motion');

    expect(existsSync(join(process.cwd(), 'public/entertainment/css/dinosaurs.css'))).toBe(true);
  });
});
