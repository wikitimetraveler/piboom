/**
 * Development work by David Lane
 */
import { readFileSync, existsSync } from 'fs';
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
      expect(sign.oracle).toMatch(/Rose/);
      expect(sign.shadow).toBeTruthy();
      expect(sign.gift).toBeTruthy();
      expect(sign.askRose).toMatch(new RegExp(`Read ${sign.name}`));
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

describe('AstrologyZodiac spread', () => {
  test('spreadForMonthDay is deterministic and keeps the birthday as Sun', () => {
    const a = AstrologyZodiac.spreadForMonthDay(9, 14);
    const b = AstrologyZodiac.spreadForMonthDay(9, 14);
    expect(a.sun.id).toBe('virgo');
    expect(a.cross.id).not.toBe(a.sun.id);
    expect(a.path.id).not.toBe(a.sun.id);
    expect(a.cross.id).not.toBe(a.path.id);
    expect(b.cross.id).toBe(a.cross.id);
    expect(b.path.id).toBe(a.path.id);
    expect(AstrologyZodiac.spreadPrompt(a)).toBe(
      `Read this Sun / Cross / Path: ${a.sun.name}, ${a.cross.name}, ${a.path.name}`
    );
  });

  test('spreadForMonthDay rejects impossible dates', () => {
    expect(AstrologyZodiac.spreadForMonthDay(2, 30)).toBeNull();
  });

  test('parseReadingQuery reads ?reading=1', () => {
    expect(AstrologyZodiac.parseReadingQuery('?sign=cancer&reading=1')).toBe(true);
    expect(AstrologyZodiac.parseReadingQuery('?sign=cancer')).toBe(false);
  });

  test('wheelWedgesSvg paints twelve element wedges', () => {
    const svg = AstrologyZodiac.wheelWedgesSvg();
    expect(svg).toContain('astro-wedges');
    TWELVE.forEach((id) => expect(svg).toContain(`data-sign="${id}"`));
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

    const home = readFileSync(join(process.cwd(), 'public/index.html'), 'utf8');
    expect(home).toContain(href);

    const theater = readFileSync(join(process.cwd(), 'public/planetarium/index.html'), 'utf8');
    expect(theater).toContain(href);

    const html = readFileSync(join(process.cwd(), 'public/entertainment/astrology.html'), 'utf8');
    expect(html).toContain('<h1>Rose</h1>');
    expect(html).toContain('astrology-zodiac.js');
    expect(html).toContain('astrology-arcana.js');
    expect(html).toContain('astrology-heygen.js');
    expect(html).toContain('astrology-rose-chat.js');
    expect(html).toContain('id="astroWheel"');
    expect(html).toContain('id="astroSky"');
    expect(html).toContain('id="astroGallery"');
    expect(html).toContain('id="astroArcanaGallery"');
    expect(html).toContain('id="astroGalleryHeading"');
    expect(html).toContain('Flip the deck');
    expect(html).toContain('id="astroSpread"');
    expect(html).toContain('id="astroMeetRose"');
    expect(html).toContain('id="astroWedges"');
    expect(html).toContain('id="astroFinder"');
    expect(html).not.toContain('astro-hero__nav');
    expect(html).toContain('/planetarium/');
    expect(html).toContain('/shared/tts.js');
    expect(html).toContain('id="astroHeygenMedia"');
    expect(html).toContain('rose-guide-portrait.png');
    expect(existsSync(join(process.cwd(), 'public/entertainment/assets/rose-guide-portrait.png'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'public/entertainment/assets/rose-guide-portrait-256.png'))).toBe(true);
    ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].forEach((glyph) => {
      expect(html).toContain(glyph);
    });
  });

  test('page color pass wires rose parlor tokens, wedges, and reactive sky', () => {
    const css = readFileSync(join(process.cwd(), 'public/entertainment/css/astrology.css'), 'utf8');
    expect(css).toContain('--as-rose:');
    expect(css).toContain('--as-rose-deep:');
    expect(css).toContain('--as-element:');
    expect(css).toContain('body.astro-page[data-element="fire"]');
    expect(css).toContain('.astro-wedge[data-element="fire"]');
    expect(css).toContain('.astro-toolbar button[data-element-filter="water"][aria-pressed="true"]');
    expect(css).toContain('.astro-rose-dock');
    expect(css).toContain('.astro-section-head');

    const js = readFileSync(join(process.cwd(), 'public/entertainment/js/astrology.js'), 'utf8');
    expect(js).toContain('ELEMENT_RGB');
    expect(js).toContain('document.body.dataset.element');
    expect(js).toContain('nebulae');
    expect(js).toContain('petals');
    expect(js).toContain('astroWedges');
    expect(js).toContain('arcanaGalleryMarkup');
    expect(js).toContain('astro-chip--${sign.element}');
    expect(js).not.toMatch(/astro-detail__meta[\s\S]*modality[\s\S]*Flip the card/);
  });
});
