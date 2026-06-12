/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const aaronPath = join(root, 'data/lane-aaron-g-lane.json');
const assetsDir = join(root, 'public/family/assets/lane-aaron');

describe('lane-aaron-g-lane.json', () => {
  let doc;

  beforeAll(() => {
    doc = JSON.parse(readFileSync(aaronPath, 'utf8'));
  });

  test('loads Mojave pioneer chapter (Scientific Lane schema)', () => {
    expect(doc.personId).toBe(1024);
    expect(doc.hero?.title).toMatch(/Aaron G\. Lane/i);
    expect(Array.isArray(doc.timeline)).toBe(true);
    expect(doc.timeline.length).toBeGreaterThanOrEqual(5);
    expect(doc.places?.items?.length).toBeGreaterThanOrEqual(4);
    expect(doc.photoGallery?.items?.length).toBeGreaterThanOrEqual(4);
    expect(doc.routes?.beats?.length).toBeGreaterThanOrEqual(3);
  });

  test('timeline events link to map places', () => {
    const placeIds = new Set((doc.places.items || []).map((p) => p.id));
    doc.timeline.forEach((t) => {
      if (t.placeId) expect(placeIds.has(t.placeId)).toBe(true);
    });
  });

  test('committed photo assets exist on disk', () => {
    const required = [
      'mojave-narrows-1905.jpg',
      'gold-miners-long-tom.jpg',
      'cerro-gordo-1847.jpg',
      'nh-connecticut-river-valley.jpg',
      'mojave-desert-vista.jpg'
    ];
    required.forEach((name) => {
      expect(existsSync(join(assetsDir, name))).toBe(true);
    });
    (doc.photoGallery.items || []).forEach((item) => {
      const rel = String(item.url || '').replace(/^\/family\/assets\/lane-aaron\//, '');
      if (rel && !rel.endsWith('.svg')) {
        expect(existsSync(join(assetsDir, rel))).toBe(true);
      }
    });
  });

  test('cta includes narrated film asset', () => {
    const film = (doc.cta || []).find((c) => c.url?.includes('lane-aaron-mojave-presentation.mp4'));
    expect(film).toBeDefined();
    expect(film.label).toMatch(/film/i);
  });
});
