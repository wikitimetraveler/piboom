/**
 * @jest-environment node
 */
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_PATH = path.join(process.cwd(), 'public/egypt/data/egypt-content.json');
const REEL_PATH = path.join(process.cwd(), 'public/egypt/data/egypt-story-reel.json');
const REEL_JS_PATH = path.join(process.cwd(), 'public/egypt/js/egypt-story-reel.js');
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

async function expectImageFile(imagePath) {
  const fsPath = path.join(process.cwd(), 'public', imagePath.replace(/^\//, ''));
  await expect(access(fsPath)).resolves.toBeUndefined();
}

describe('egypt content', () => {
  test('UI tables cover the same keys in both languages', () => {
    const en = Object.keys(content.ui.en).sort();
    const ar = Object.keys(content.ui.ar).sort();
    expect(ar).toEqual(en);
    expect(content.ui.en.dir).toBe('ltr');
    expect(content.ui.ar.dir).toBe('rtl');
    expect(content.ui.en.heroTitle).toMatch(/Egypt/);
  });

  test('brand and guide are Omar with Egypt portrait', () => {
    expectBilingual(content.brand.name, 'brand.name');
    expect(content.brand.name.en).toMatch(/Egypt/);
    expectBilingual(content.guide.name, 'guide.name');
    expect(content.guide.name.en).toBe('Omar');
    expect(content.guide.name.ar).toMatch(/عمر/);
    expect(content.guide.portrait).toBe('/egypt/assets/omar-guide-portrait-256.png');
  });

  test('eras meet density, bilingual fields, yearCE, and image paths', () => {
    expect(content.eras.length).toBeGreaterThanOrEqual(10);
    for (const era of content.eras) {
      expect(typeof era.yearCE).toBe('number');
      expect(era.yearCE).toBeLessThanOrEqual(new Date().getFullYear() + 1);
      expect(typeof era.image).toBe('string');
      expect(era.image.trim().length).toBeGreaterThan(0);
      expect(era.image.startsWith('/egypt/assets/era/')).toBe(true);
      for (const field of ['years', 'title', 'copy', 'narration', 'history']) {
        expectBilingual(era[field], `era ${era.id}.${field}`);
      }
    }
  });

  test('sites have coordinates in Egypt and a known filter category', () => {
    const categories = new Set(['history', 'food', 'music', 'living']);
    expect(content.sites.length).toBeGreaterThanOrEqual(18);
    expect(content.sites.length).toBeLessThanOrEqual(24);
    for (const site of content.sites) {
      expect(categories.has(site.category)).toBe(true);
      expect(site.lat).toBeGreaterThan(21.5);
      expect(site.lat).toBeLessThan(32);
      expect(site.lng).toBeGreaterThan(24.5);
      expect(site.lng).toBeLessThan(36);
      for (const field of ['name', 'place', 'blurb']) {
        expectBilingual(site[field], `site ${site.id}.${field}`);
      }
    }
    expect(new Set(content.sites.map((s) => s.category)).size).toBe(categories.size);
  });

  test('cards are bilingual and only link to sites that exist', () => {
    const siteIds = new Set(content.sites.map((site) => site.id));
    expect(content.foods.length).toBeGreaterThanOrEqual(12);
    expect(content.music.length).toBeGreaterThanOrEqual(10);
    expect(content.hookah.length).toBeGreaterThanOrEqual(5);
    expect(content.living.length).toBeGreaterThanOrEqual(8);
    for (const section of CARD_SECTIONS) {
      expect(content[section].length).toBeGreaterThan(0);
      for (const item of content[section]) {
        for (const field of ['name', 'tagline', 'history']) {
          expectBilingual(item[field], `${section} ${item.id}.${field}`);
        }
        expect(item.tags.en.length).toBe(item.tags.ar.length);
        if (item.siteId) expect(siteIds.has(item.siteId)).toBe(true);
      }
    }
    for (const era of content.eras) {
      if (era.siteId) expect(siteIds.has(era.siteId)).toBe(true);
    }
  });

  test('foods, music, hookah, living, and eras carry atlas image paths that exist on disk', async () => {
    for (const era of content.eras) {
      expect(era.image.startsWith('/egypt/assets/')).toBe(true);
      await expectImageFile(era.image);
    }
    for (const section of CARD_SECTIONS) {
      for (const item of content[section]) {
        expect(typeof item.image).toBe('string');
        expect(item.image.trim().length).toBeGreaterThan(0);
        expect(item.image.startsWith('/egypt/assets/')).toBe(true);
        await expectImageFile(item.image);
      }
    }
  });

  test('phrases are Egyptian Arabic with transliteration and an English gloss', () => {
    expect(content.phrases.length).toBeGreaterThanOrEqual(14);
    for (const phrase of content.phrases) {
      expect(ARABIC_RE.test(phrase.ar)).toBe(true);
      expect(phrase.translit.trim().length).toBeGreaterThan(0);
      expect(phrase.en.trim().length).toBeGreaterThan(0);
    }
  });

  test('secret raqs section is authored bilingual with images (gated in the UI)', async () => {
    expect(content.ui.en.raqsHeading).toMatch(/Raqs/i);
    expect(content.ui.ar.raqsHeading).toMatch(/رقص/);
    expect(Array.isArray(content.raqs)).toBe(true);
    expect(content.raqs.length).toBeGreaterThanOrEqual(6);
    const siteIds = new Set(content.sites.map((site) => site.id));
    for (const item of content.raqs) {
      for (const field of ['name', 'tagline', 'history']) {
        expectBilingual(item[field], `raqs ${item.id}.${field}`);
      }
      expect(item.tags.en.length).toBe(item.tags.ar.length);
      if (item.siteId) expect(siteIds.has(item.siteId)).toBe(true);
      expect(item.image.startsWith('/egypt/assets/raqs/')).toBe(true);
      await expectImageFile(item.image);
    }
  });
});

describe('egypt raqs unlock gate', () => {
  test('page hides the raqs section until unlocked and ships the unlock script', async () => {
    const html = await readFile(path.join(process.cwd(), 'public/egypt/index.html'), 'utf8');
    const unlockJs = await readFile(path.join(process.cwd(), 'public/egypt/js/egypt-raqs-unlock.js'), 'utf8');
    const guideJs = await readFile(path.join(process.cwd(), 'public/egypt/js/egypt-guide-chat.js'), 'utf8');
    expect(html).toMatch(/id="egRaqs"/);
    expect(html).toMatch(/eg-section--secret/);
    expect(html).toMatch(/egypt-raqs-unlock\.js/);
    expect(unlockJs).toMatch(/get\(['"]raqs['"]\)/);
    expect(unlockJs).toContain('egyptRaqsUnlocked');
    expect(unlockJs).toContain('dance floor');
    expect(unlockJs).toContain('قاعة');
    expect(unlockJs).toContain('الرقص');
    expect(guideJs).toContain('EgyptRaqs');
    expect(guideJs).toContain('tryRaqsUnlock');
  });
});

describe('egypt story reel', () => {
  test('scenes are bilingual and anchored to sections on the page', () => {
    expect(reel.scenes.length).toBeGreaterThan(4);
    for (const scene of reel.scenes) {
      expect(scene.anchor.startsWith('eg')).toBe(true);
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
