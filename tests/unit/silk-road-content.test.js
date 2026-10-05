/**
 * Silk Road journey: bilingual stop data, atlas links, and page wiring.
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const data = JSON.parse(read('public/silk-road/data/silk-road.json'));
const ARABIC = /[\u0600-\u06FF]/;

const ATLASES = ['egypt', 'holy-land', 'jordan', 'lebanon', 'syria', 'iraq', 'iran', 'oman'];

describe('Silk Road data', () => {
  test('visits all eight atlases once, in route order', () => {
    expect(data.stops.map((s) => s.id)).toEqual(ATLASES);
  });

  test('every stop links to an existing atlas page', () => {
    for (const stop of data.stops) {
      expect(stop.atlas).toBe(`/${stop.id}/`);
      expect(fs.existsSync(path.join(root, 'public', stop.id, 'index.html'))).toBe(true);
    }
  });

  test('every bilingual field has English and Arabic text', () => {
    for (const stop of data.stops) {
      for (const key of ['guide', 'country', 'city', 'era', 'story', 'handoff']) {
        expect(stop[key].en.trim().length).toBeGreaterThan(0);
        expect(ARABIC.test(stop[key].ar)).toBe(true);
      }
      expect(stop.goods.length).toBeGreaterThanOrEqual(2);
      for (const good of stop.goods) {
        expect(good.en.trim().length).toBeGreaterThan(0);
        expect(ARABIC.test(good.ar)).toBe(true);
      }
    }
  });

  test('each handoff names the next stop guide', () => {
    data.stops.slice(0, -1).forEach((stop, i) => {
      const next = data.stops[i + 1];
      expect(stop.handoff.en).toContain(next.guide.en);
      expect(stop.handoff.ar).toContain(next.guide.ar);
    });
  });

  test('UI strings exist in both languages', () => {
    const enKeys = Object.keys(data.ui.en).sort();
    expect(Object.keys(data.ui.ar).sort()).toEqual(enKeys);
    for (const key of enKeys) expect(ARABIC.test(data.ui.ar[key]) || key === 'langToggle').toBe(true);
  });

  test('stops and waypoints sit inside the map viewBox', () => {
    const pts = [...data.stops, ...Object.values(data.waypoints)];
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(800);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(700);
    }
    for (const stop of data.stops) {
      for (const v of stop.via || []) {
        if (v.waypoint) expect(data.waypoints[v.waypoint]).toBeDefined();
      }
      if (stop.embark) expect((stop.via || []).some((v) => v.waypoint === stop.embark)).toBe(true);
    }
  });
});

describe('Silk Road page wiring', () => {
  const html = read('public/silk-road/index.html');
  const js = read('public/silk-road/js/silk-road.js');

  test('page loads its data, map, and shared atlas nav', () => {
    expect(html).toContain('id="srMap"');
    expect(html).toContain('/shared/js/levant-atlas-nav.js');
    expect(html).toContain('/silk-road/js/silk-road.js');
    expect(js).toContain('/silk-road/data/silk-road.json');
  });

  test('shares the atlas language key and Arabic voice', () => {
    expect(js).toContain("'meAtlasLang'");
    expect(js).toContain('ar-XA');
  });

  test('every data-sr-i18n key exists in the UI strings', () => {
    const keys = [...html.matchAll(/data-sr-i18n="([^"]+)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(5);
    for (const key of keys) expect(data.ui.en[key]).toBeDefined();
  });

  test('is linked from the atlas nav and the More menu', () => {
    expect(read('public/shared/js/levant-atlas-nav.js')).toContain("href: '/silk-road/'");
    expect(read('public/shared/menu-config.js')).toContain("href: '/silk-road/'");
  });
});
