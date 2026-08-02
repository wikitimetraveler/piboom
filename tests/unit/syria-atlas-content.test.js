/**
 * @jest-environment node
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_PATH = path.join(process.cwd(), 'public/syria/data/syria-content.json');
const REEL_PATH = path.join(process.cwd(), 'public/syria/data/syria-story-reel.json');
const REEL_JS_PATH = path.join(process.cwd(), 'public/syria/js/syria-story-reel.js');
const ARABIC_RE = /[\u0600-\u06FF]/;

const CARD_SECTIONS = ['foods', 'music', 'hookah', 'living'];

let content;
let reel;
let reelJs;

beforeAll(async () => {
  content = JSON.parse(await readFile(CONTENT_PATH, 'utf8'));
  reel = JSON.parse(await readFile(REEL_PATH, 'utf8'));
  reelJs = await readFile(REEL_JS_PATH, 'utf8');
});

/** Every visitor-facing string is authored in both languages — nothing falls back mid-page. */
function expectBilingual(value, label) {
  expect(typeof value === 'object' && value !== null).toBe(true);
  expect(String(value.en || '').trim().length).toBeGreaterThan(0);
  expect(String(value.ar || '').trim().length).toBeGreaterThan(0);
  expect(ARABIC_RE.test(value.ar)).toBe(true);
  expect(ARABIC_RE.test(value.en)).toBe(false);
  expect(label).toBeTruthy();
}

describe('syria content', () => {
  test('UI tables cover the same keys in both languages', () => {
    const en = Object.keys(content.ui.en).sort();
    const ar = Object.keys(content.ui.ar).sort();
    expect(ar).toEqual(en);
    expect(content.ui.en.dir).toBe('ltr');
    expect(content.ui.ar.dir).toBe('rtl');
  });

  test('guide is Niqula and points at an existing portrait path', () => {
    expectBilingual(content.guide.name, 'guide.name');
    expect(content.guide.name.en).toBe('Niqula');
    expect(content.guide.portrait).toBe('/syria/assets/niqula-guide-portrait-256.png');
  });

  test('eras are bilingual and carry a placeable year', () => {
    expect(content.eras.length).toBeGreaterThan(5);
    for (const era of content.eras) {
      expect(typeof era.yearCE).toBe('number');
      expect(era.yearCE).toBeLessThanOrEqual(new Date().getFullYear());
      expect(String(era.image || '')).toMatch(/^\/syria\/assets\//);
      for (const field of ['years', 'title', 'copy', 'narration', 'history']) {
        expectBilingual(era[field], `era ${era.id}.${field}`);
      }
    }
  });

  test('sites have coordinates inside Syria and a known filter category', () => {
    const categories = new Set(['history', 'food', 'music', 'living']);
    for (const site of content.sites) {
      expect(categories.has(site.category)).toBe(true);
      expect(site.lat).toBeGreaterThan(32);
      expect(site.lat).toBeLessThan(38);
      expect(site.lng).toBeGreaterThan(35);
      expect(site.lng).toBeLessThan(43);
      for (const field of ['name', 'place', 'blurb']) {
        expectBilingual(site[field], `site ${site.id}.${field}`);
      }
    }
    expect(new Set(content.sites.map((s) => s.category)).size).toBe(categories.size);
  });

  test('cards are bilingual and only link to sites that exist', () => {
    const siteIds = new Set(content.sites.map((site) => site.id));
    for (const section of CARD_SECTIONS) {
      expect(content[section].length).toBeGreaterThan(0);
      for (const item of content[section]) {
        for (const field of ['name', 'tagline', 'history']) {
          expectBilingual(item[field], `${section} ${item.id}.${field}`);
        }
        expect(String(item.image || '')).toMatch(/^\/syria\/assets\//);
        expect(item.tags.en.length).toBe(item.tags.ar.length);
        if (item.siteId) expect(siteIds.has(item.siteId)).toBe(true);
      }
    }
    for (const era of content.eras) {
      if (era.siteId) expect(siteIds.has(era.siteId)).toBe(true);
    }
  });

  test('phrases are Arabic with transliteration and an English gloss', () => {
    expect(content.phrases.length).toBeGreaterThan(5);
    for (const phrase of content.phrases) {
      expect(ARABIC_RE.test(phrase.ar)).toBe(true);
      expect(phrase.translit.trim().length).toBeGreaterThan(0);
      expect(phrase.en.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('syria story reel', () => {
  test('scenes are bilingual and anchored to sections on the page', () => {
    expect(reel.scenes.length).toBeGreaterThan(4);
    for (const scene of reel.scenes) {
      expect(scene.anchor.startsWith('sy')).toBe(true);
      for (const field of ['kicker', 'title', 'copy', 'narration']) {
        expectBilingual(scene[field], `scene ${scene.id}.${field}`);
      }
    }
  });

  test('every scene action is handled by the reel player', () => {
    for (const scene of reel.scenes) {
      if (!scene.action) continue;
      expect(reelJs).toContain(`case '${scene.action}':`);
    }
  });
});
