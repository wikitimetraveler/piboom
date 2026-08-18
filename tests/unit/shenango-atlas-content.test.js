/**
 * @jest-environment node
 */
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_PATH = path.join(process.cwd(), 'public/nature/data/shenango-content.json');
const REEL_PATH = path.join(process.cwd(), 'public/nature/data/shenango-story-reel.json');
const PAGE_PATH = path.join(process.cwd(), 'public/nature/shenango-valley.html');
const CONTENT_JS_PATH = path.join(process.cwd(), 'public/nature/js/shenango-content.js');
const REEL_JS_PATH = path.join(process.cwd(), 'public/nature/js/shenango-story-reel.js');

let content;
let reel;
let page;
let contentJs;
let reelJs;

beforeAll(async () => {
  content = JSON.parse(await readFile(CONTENT_PATH, 'utf8'));
  reel = JSON.parse(await readFile(REEL_PATH, 'utf8'));
  page = await readFile(PAGE_PATH, 'utf8');
  contentJs = await readFile(CONTENT_JS_PATH, 'utf8');
  reelJs = await readFile(REEL_JS_PATH, 'utf8');
});

function pickEn(value) {
  if (typeof value === 'string') return value;
  return String(value?.en || '');
}

describe('Shenango Valley happening-now events', () => {
  test('page mounts a dated events board with filters', () => {
    expect(page).toContain('id="svEvents"');
    expect(page).toContain('id="svEventList"');
    expect(page).toContain('data-event-filter="upcoming"');
    expect(contentJs).toContain('function renderEvents');
    expect(contentJs).toContain("params.get('events') === '1'");
    expect(content.ui.en.eventsHeading).toMatch(/Happening now/i);
  });

  test('events are dated, sourced, and pinned to real sites', () => {
    const siteIds = new Set((content.sites || []).map((site) => site.id));
    const ids = new Set();
    expect(content.events.length).toBeGreaterThanOrEqual(18);

    for (const ev of content.events) {
      expect(ev.id).toBeTruthy();
      expect(ids.has(ev.id)).toBe(false);
      ids.add(ev.id);
      expect(pickEn(ev.title).length).toBeGreaterThan(4);
      expect(pickEn(ev.place).length).toBeGreaterThan(8);
      expect(pickEn(ev.copy).length).toBeGreaterThan(20);
      expect(String(ev.source || '')).toMatch(/^https:\/\//);
      expect(ev.sourceName).toBeTruthy();
      expect(siteIds.has(ev.siteId)).toBe(true);
      expect(['music', 'market', 'civic', 'sports']).toContain(ev.category);
      expect(['park', 'downtown']).toContain(ev.area);

      const start = ev.allDay
        ? new Date(`${ev.start}T12:00:00-04:00`)
        : new Date(ev.start);
      const end = ev.allDay
        ? new Date(`${ev.end || ev.start}T23:59:59-04:00`)
        : new Date(ev.end);
      expect(Number.isNaN(start.getTime())).toBe(false);
      expect(Number.isNaN(end.getTime())).toBe(false);
      expect(end.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(start.getFullYear()).toBe(2026);
    }
  });

  test('2026 valley nights still on the public calendar are present', () => {
    const titles = content.events.map((ev) => pickEn(ev.title)).join(' | ');
    const starts = content.events.map((ev) => String(ev.start));
    expect(titles).toMatch(/Silver Springs/);
    expect(titles).toMatch(/Menagerie/);
    expect(titles).toMatch(/Buhl Day on Labor Day/);
    expect(titles).toMatch(/Rockin/);
    expect(titles).toMatch(/River Market/);
    expect(titles).toMatch(/Acoustic Archives/);
    expect(starts.some((s) => s.startsWith('2026-08-16'))).toBe(true);
    expect(starts.some((s) => s.startsWith('2026-08-28'))).toBe(true);
    expect(starts.some((s) => s.startsWith('2026-09-06'))).toBe(true);
    expect(starts.some((s) => s.startsWith('2026-09-07'))).toBe(true);
    expect(content.sites.some((site) => site.id === 'warehouse-sales')).toBe(true);
  });

  test('story reel visits Happening now', () => {
    const eventScene = reel.scenes.find((scene) => scene.id === 'events');
    expect(eventScene).toBeTruthy();
    expect(eventScene.anchor).toBe('svEvents');
    expect(eventScene.action).toBe('openEvents');
    expect(reelJs).toContain("case 'openEvents'");
  });

  test('event images that are referenced exist on disk', async () => {
    const images = new Set(
      content.events.map((ev) => ev.image).filter(Boolean)
    );
    for (const image of images) {
      const fsPath = path.join(process.cwd(), 'public', image.replace(/^\//, ''));
      await expect(access(fsPath)).resolves.toBeUndefined();
    }
  });
});
