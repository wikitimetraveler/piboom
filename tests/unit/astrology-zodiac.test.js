/**
 * Development work by David Lane
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import '../../public/entertainment/js/astrology-zodiac.js';

const { AstrologyZodiac } = globalThis;

const TWELVE = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];

function loadMenuConfig() {
  const file = join(process.cwd(), 'public/shared/menu-config.js');
  const code = readFileSync(file, 'utf8');
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  return sandbox.MENU_CONFIG;
}

describe('AstrologyZodiac catalog', () => {
  test('lists all twelve signs in ecliptic order with glyphs and elements', () => {
    expect(AstrologyZodiac.SIGNS.map((sign) => sign.id)).toEqual(TWELVE);
    expect(AstrologyZodiac.SIGNS).toHaveLength(12);
    AstrologyZodiac.SIGNS.forEach((sign) => {
      expect(sign.glyph).toBeTruthy();
      expect(sign.name).toBeTruthy();
      expect(sign.dates).toMatch(/[A-Z][a-z]{2} \d/);
      expect(['fire', 'earth', 'air', 'water']).toContain(sign.element);
      expect(sign.stars.length).toBeGreaterThanOrEqual(4);
      expect(sign.lines.length).toBeGreaterThanOrEqual(3);
    });
  });

  test('three signs per element', () => {
    const counts = { fire: 0, earth: 0, air: 0, water: 0 };
    AstrologyZodiac.SIGNS.forEach((sign) => {
      counts[sign.element] += 1;
    });
    expect(counts).toEqual({ fire: 3, earth: 3, air: 3, water: 3 });
  });
});

describe('AstrologyZodiac.signForMonthDay', () => {
  test('resolves cusps, year wrap, and leap day', () => {
    expect(AstrologyZodiac.signForMonthDay(3, 21).id).toBe('aries');
    expect(AstrologyZodiac.signForMonthDay(4, 19).id).toBe('aries');
    expect(AstrologyZodiac.signForMonthDay(4, 20).id).toBe('taurus');
    expect(AstrologyZodiac.signForMonthDay(12, 21).id).toBe('sagittarius');
    expect(AstrologyZodiac.signForMonthDay(12, 22).id).toBe('capricorn');
    expect(AstrologyZodiac.signForMonthDay(12, 25).id).toBe('capricorn');
    expect(AstrologyZodiac.signForMonthDay(1, 1).id).toBe('capricorn');
    expect(AstrologyZodiac.signForMonthDay(1, 19).id).toBe('capricorn');
    expect(AstrologyZodiac.signForMonthDay(1, 20).id).toBe('aquarius');
    expect(AstrologyZodiac.signForMonthDay(2, 29).id).toBe('pisces');
    expect(AstrologyZodiac.signForMonthDay(3, 20).id).toBe('pisces');
  });

  test('rejects impossible calendar days', () => {
    expect(AstrologyZodiac.signForMonthDay(2, 30)).toBeNull();
    expect(AstrologyZodiac.signForMonthDay(13, 1)).toBeNull();
    expect(AstrologyZodiac.signForMonthDay(4, 0)).toBeNull();
    expect(AstrologyZodiac.signForMonthDay('leo', 1)).toBeNull();
  });
});

describe('AstrologyZodiac query helpers', () => {
  test('parseSignQuery reads ?sign= and hash ids', () => {
    expect(AstrologyZodiac.parseSignQuery('?sign=Leo').id).toBe('leo');
    expect(AstrologyZodiac.parseSignQuery('#virgo').id).toBe('virgo');
    expect(AstrologyZodiac.parseSignQuery('?foo=1')).toBeNull();
  });

  test('textGlyph forces text presentation so signs stay gold, not emoji', () => {
    const marked = AstrologyZodiac.textGlyph(AstrologyZodiac.signById('leo'));
    expect(marked).toContain('♌');
    expect(marked).toContain('\uFE0E');
  });

  test('constellationSvg draws the named asterism', () => {
    const svg = AstrologyZodiac.constellationSvg(AstrologyZodiac.signById('scorpio'));
    expect(svg).toContain('Scorpio asterism');
    expect(svg).toContain('<line');
    expect(svg).toContain('<circle');
  });
});

describe('astrology page wiring', () => {
  test('entertainment nav, hub, search, and HTML all name the page', () => {
    const menu = loadMenuConfig();
    const href = '/entertainment/astrology.html';
    expect(menu.NAV_ENTERTAINMENT.some((item) => item.href === href)).toBe(true);
    expect(menu.ENTERTAINMENT_TOOLS.some((item) => item.href === href)).toBe(true);

    const search = readFileSync(join(process.cwd(), 'public/shared/tool-search-index.js'), 'utf8');
    expect(search).toContain(href);

    const html = readFileSync(join(process.cwd(), 'public/entertainment/astrology.html'), 'utf8');
    expect(html).toContain('astrology-zodiac.js');
    expect(html).toContain('id="astroWheel"');
    expect(html).toContain('id="astroSky"');
    expect(html).toContain('id="astroGallery"');
    ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].forEach((glyph) => {
      expect(html).toContain(glyph);
    });
  });
});
