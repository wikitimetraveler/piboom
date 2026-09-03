/**
 * Development work by David Lane
 */
import '../../public/shared/js/fun-home-sky.js';
import '../../public/shared/js/planetarium.js';

const { FunHomeSky, Planetarium } = globalThis;

describe('FunHomeSky centerAz', () => {
  test('projectAltAz honors centerAz for east-facing view', () => {
    const south = FunHomeSky.projectAltAz(45, 180, { centerAz: 180, fovAz: 160 });
    const east = FunHomeSky.projectAltAz(45, 90, { centerAz: 90, fovAz: 160 });
    expect(south).not.toBeNull();
    expect(east).not.toBeNull();
    expect(south.x).toBeCloseTo(50, 0);
    expect(east.x).toBeCloseTo(50, 0);
  });
});

describe('Planetarium', () => {
  test('parseParams reads date, time, lat, lon, facing, body, and select', () => {
    const parsed = Planetarium.parseParams(
      '?date=2026-08-31&time=22:30&lat=42.9&lon=-70.86&face=east&body=mars&select=Vega'
    );
    expect(parsed.dateParts).toEqual({ y: 2026, m: 8, d: 31 });
    expect(parsed.timeParts).toEqual({ h: 22, m: 30 });
    expect(parsed.observer.lat).toBeCloseTo(42.9, 1);
    expect(parsed.facing).toBe('east');
    expect(parsed.body).toBe('mars');
    expect(parsed.select).toBe('Vega');
  });

  test('buildShareUrl encodes observer, time, and selection', () => {
    const url = Planetarium.buildShareUrl(
      {
        date: new Date(2026, 7, 31, 22, 15),
        observer: { lat: 42.898, lon: -70.864, label: 'Hampton Falls, NH' },
        facing: 'south',
        selection: { type: 'planet', id: 'jupiter', name: 'Jupiter' },
      },
      'https://example.com'
    );
    expect(url).toContain('date=2026-08-31');
    expect(url).toContain('time=22%3A15');
    expect(url).toContain('lat=42.898');
    expect(url).toContain('body=jupiter');
  });

  test('normalizeSelection and selectionKey are stable', () => {
    const sel = Planetarium.normalizeSelection({
      type: 'star',
      id: 'Vega',
      name: 'Vega',
      alt: 40,
      az: 210,
    });
    expect(sel.type).toBe('star');
    expect(Planetarium.selectionKey(sel)).toBe('star:vega');
  });

  test('formatPlanetRows sorts by altitude descending', () => {
    const rows = Planetarium.formatPlanetRows([
      { id: 'mars', name: 'Mars', alt: 12, az: 200 },
      { id: 'jupiter', name: 'Jupiter', alt: 45, az: 180 },
    ]);
    expect(rows[0].name).toBe('Jupiter');
    expect(rows[1].name).toBe('Mars');
  });

  test('twilightLabel describes daylight', () => {
    expect(Planetarium.twilightLabel(5)).toMatch(/Daylight/);
    expect(Planetarium.twilightLabel(-20)).toBe('');
  });

  test('getSkyContext is exported', () => {
    expect(typeof Planetarium.getSkyContext).toBe('function');
  });

  test('isDarkSky treats civil twilight as not dark', () => {
    expect(Planetarium.isDarkSky(-5)).toBe(false);
    expect(Planetarium.isDarkSky(-8)).toBe(true);
  });

  test('projOptsFor uses compass azimuth when compass mode on', () => {
    const opts = Planetarium.projOptsFor({ facing: 'south', compassMode: true, compassAz: 95 });
    expect(opts.centerAz).toBe(95);
  });
});

describe('FunHomeSky.buildPlanetariumUrl', () => {
  test('encodes observer date and optional body', () => {
    const url = FunHomeSky.buildPlanetariumUrl(
      {
        date: new Date(2026, 7, 31, 21, 0),
        observer: { lat: 42.9, lon: -70.86, label: 'Hampton Falls' },
        body: 'mars',
      },
      'https://example.com'
    );
    expect(url).toContain('/planetarium/?');
    expect(url).toContain('date=2026-08-31');
    expect(url).toContain('body=mars');
    expect(url).toContain('lat=42.9');
  });
});
