/**
 * Development work by David Lane
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildSystemPrompt,
  GUIDE_NAME,
  AVATAR_NAME,
} from '../../services/mountain-high-assistant.service.js';

const CATALOG_PATH = path.join(process.cwd(), 'data/mountain-high.json');

describe('mountain-high-assistant.service', () => {
  test('guide names', () => {
    expect(GUIDE_NAME).toBe('Jill');
    expect(AVATAR_NAME).toBe('Jill');
  });

  test('buildSystemPrompt embeds types, 21+, and Long Beach / L.A. locksmith', async () => {
    const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    const prompt = buildSystemPrompt(catalog, {
      disclaimer: 'Educational geography only.',
      entries: [
        {
          name: 'Hindu Kush',
          type: 'indica',
          origin: { place: 'Hindu Kush range', note: 'Mountain landraces.' },
        },
      ],
    });
    expect(prompt).toContain('Jill');
    expect(prompt).toContain('21');
    expect(prompt).toContain('Indica');
    expect(prompt).toContain('Sativa');
    expect(prompt).toContain('Long Beach');
    expect(prompt).toContain('Los Angeles');
    expect(prompt).toContain('Hindu Kush');
    expect(prompt).toMatch(/no medical|No medical/i);
    expect(prompt).toMatch(/cultivation/i);
    expect(prompt).toMatch(/Do not invent hours/i);
  });

  test('catalog has five type cards and locksmith areas', async () => {
    const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    expect(catalog.types).toHaveLength(5);
    expect(catalog.types.map((t) => t.id)).toEqual([
      'indica',
      'sativa',
      'hybrid',
      'hemp',
      'ruderalis',
    ]);
    catalog.types.forEach((t) => {
      expect(t.name).toBeTruthy();
      expect(t.tagline).toBeTruthy();
      expect(t.history).toBeTruthy();
    });
    expect(catalog.locksmith.areas).toEqual(['Long Beach', 'Los Angeles']);
    expect(catalog.shop.phone).toBe('+1 909-219-1370');
  });

  test('catalog bag mockups are two satchels and two medical pouches', async () => {
    const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    expect(catalog.bags).toHaveLength(4);
    expect(catalog.bags.map((b) => b.id)).toEqual([
      'satchel-indoor',
      'satchel-outdoor',
      'medical-indoor',
      'medical-outdoor',
    ]);
    catalog.bags.forEach((bag) => {
      expect(bag.mockup).toBe(true);
      expect(bag.image).toMatch(/\/mountain-high\/assets\/bags\//);
      expect(bag.cultivationNote).toBeTruthy();
      expect(bag.story).toBeTruthy();
    });
    expect(catalog.bags.filter((b) => b.kind === 'satchel')).toHaveLength(2);
    expect(catalog.bags.filter((b) => b.kind === 'medical')).toHaveLength(2);
    expect(catalog.bags.filter((b) => b.grow === 'indoor')).toHaveLength(2);
    expect(catalog.bags.filter((b) => b.grow === 'outdoor')).toHaveLength(2);
  });

  test('catalog lab merch is a sticker and a t-shirt mockup', async () => {
    const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    expect(catalog.merch.pagePath).toBe('/mountain-high/');
    expect(catalog.merch.items.map((m) => m.id)).toEqual(['sticker', 'tshirt']);
    catalog.merch.items.forEach((item) => {
      expect(item.mockup).toBe(true);
      expect(item.image).toMatch(/\/mountain-high\/assets\/lab\//);
    });
  });

  test('Jill prompt marks bag art as mockups and still forbids grow recipes', async () => {
    const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    const prompt = buildSystemPrompt(catalog, { entries: [] });
    expect(prompt).toMatch(/Ridge Satchel/);
    expect(prompt).toMatch(/Clinic Pouch/);
    expect(prompt).toMatch(/Lab sticker/);
    expect(prompt).toMatch(/mockup/i);
    expect(prompt).toMatch(/No cultivation how-to/i);
    expect(prompt).toMatch(/Homegrown/);
    expect(prompt).toMatch(/Roll Another Number/);
    expect(prompt).toMatch(/hippie botanist/i);
  });
});
