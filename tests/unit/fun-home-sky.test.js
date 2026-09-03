/**
 * Development work by David Lane
 */
import '../../public/shared/js/fun-home-sky.js';

const { FunHomeSky } = globalThis;

describe('FunHomeSky', () => {
  test('exports a Hampton Falls default observer and bright-star catalog', () => {
    expect(FunHomeSky.DEFAULT_OBSERVER.lat).toBeCloseTo(42.898, 3);
    expect(FunHomeSky.DEFAULT_OBSERVER.lon).toBeCloseTo(-70.864, 3);
    expect(FunHomeSky.BRIGHT_STARS.length).toBeGreaterThan(40);
    expect(FunHomeSky.BRIGHT_STARS.some((s) => s.n === 'Sirius')).toBe(true);
    expect(FunHomeSky.BRIGHT_STARS.some((s) => s.n === 'Polaris')).toBe(true);
  });

  test('equatorialToAltAz places Polaris near zenith from Hampton Falls', () => {
    const lst = FunHomeSky.localSiderealDegrees(new Date('2026-01-15T02:00:00Z'), -70.864);
    const polaris = FunHomeSky.BRIGHT_STARS.find((s) => s.n === 'Polaris');
    const aa = FunHomeSky.equatorialToAltAz(polaris.ra, polaris.dec, 42.898, lst);
    expect(aa.alt).toBeGreaterThan(40);
  });

  test('projectAltAz hides objects below the horizon', () => {
    expect(FunHomeSky.projectAltAz(-5, 180)).toBeNull();
    const zenith = FunHomeSky.projectAltAz(80, 180);
    expect(zenith).not.toBeNull();
    expect(zenith.x).toBeCloseTo(50, 0);
    expect(zenith.y).toBeLessThan(30);
  });

  test('projectSky returns stars, planets, and milky way samples', () => {
    const sky = FunHomeSky.projectSky(new Date('2026-08-31T02:00:00Z'));
    expect(sky.stars.length).toBeGreaterThan(5);
    expect(Array.isArray(sky.planets)).toBe(true);
    expect(Array.isArray(sky.milkyWay)).toBe(true);
    expect(sky.observer.label).toMatch(/Hampton/);
  });

  test('resolveSkyDate falls back to evening when the Sun is up', () => {
    const noon = new Date('2026-06-21T16:00:00Z');
    const resolved = FunHomeSky.resolveSkyDate(noon, FunHomeSky.DEFAULT_OBSERVER);
    expect(resolved.getTime()).not.toBe(noon.getTime());
    expect(resolved.getHours()).toBe(21);
  });

  test('projectAsterisms draws lines when both stars are up', () => {
    const sky = FunHomeSky.projectSky(new Date('2026-08-31T02:00:00Z'));
    const lines = FunHomeSky.projectAsterisms(sky);
    expect(Array.isArray(lines)).toBe(true);
    if (lines.length) {
      expect(lines[0]).toEqual(
        expect.objectContaining({ x1: expect.any(Number), x2: expect.any(Number) })
      );
    }
  });

  test('formatSkyCaption includes phase and observer', () => {
    const sky = FunHomeSky.projectSky(new Date('2026-08-31T02:00:00Z'));
    const caption = FunHomeSky.formatSkyCaption(sky);
    expect(caption).toMatch(/Sky ·/);
    expect(caption).toMatch(/Hampton/);
    expect(caption).toMatch(/Moon|quarter|crescent|gibbous|Full|New/i);
  });

  test('moonPhaseLabel returns a named phase', () => {
    const label = FunHomeSky.moonPhaseLabel(new Date('2026-08-31T02:00:00Z'));
    expect(label.length).toBeGreaterThan(3);
  });

  test('moonPhaseFraction stays in 0..1', () => {
    const f = FunHomeSky.moonPhaseFraction(new Date('2026-08-31T02:00:00Z'));
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(1);
  });

  test('projectHorizon returns arc points and cardinals', () => {
    const hz = FunHomeSky.projectHorizon({ fovAz: 160, minAlt: 4, maxAlt: 88 });
    expect(hz.points.length).toBeGreaterThan(10);
    expect(Array.isArray(hz.cardinals)).toBe(true);
  });

  test('resolveObserver falls back without geolocation', () => {
    const prev = globalThis.navigator;
    globalThis.navigator = {};
    return new Promise((resolve) => {
      FunHomeSky.resolveObserver((obs) => {
        expect(obs.lat).toBeCloseTo(FunHomeSky.DEFAULT_OBSERVER.lat, 3);
        globalThis.navigator = prev;
        resolve();
      });
    });
  });

  test('scrubIndexToHour maps evening slider indices', () => {
    expect(FunHomeSky.scrubIndexToHour(21)).toBe(21);
    expect(FunHomeSky.scrubIndexToHour(24)).toBe(0);
    expect(FunHomeSky.scrubIndexToHour(28)).toBe(4);
  });

  test('buildLocalSkyDate sets local hours on a copy', () => {
    const base = new Date('2026-08-31T14:00:00');
    const d = FunHomeSky.buildLocalSkyDate(base, 22, 30);
    expect(d.getHours()).toBe(22);
    expect(d.getMinutes()).toBe(30);
    expect(base.getHours()).toBe(14);
  });

  test('projectSky forceTime skips evening fallback', () => {
    const noon = new Date('2026-06-21T12:00:00');
    const sky = FunHomeSky.projectSky(noon, FunHomeSky.DEFAULT_OBSERVER, { forceTime: true });
    expect(sky.scrubbed).toBe(true);
    expect(sky.usedEveningFallback).toBe(false);
    expect(sky.date.getHours()).toBe(12);
  });

  test('subsolarPoint and sunDirBody are unit-length and finite', () => {
    const when = new Date('2026-06-21T16:00:00Z');
    const ss = FunHomeSky.subsolarPoint(when);
    expect(Number.isFinite(ss.lat)).toBe(true);
    expect(ss.lat).toBeGreaterThan(15);
    expect(ss.lat).toBeLessThan(25);
    const dir = FunHomeSky.sunDirBody(when);
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    expect(len).toBeCloseTo(1, 5);
    expect(dir.y).toBeGreaterThan(0);
  });

  test('buildPlanetariumUrl encodes body', () => {
    const url = FunHomeSky.buildPlanetariumUrl(
      {
        date: new Date(2026, 7, 31, 21, 0),
        observer: FunHomeSky.DEFAULT_OBSERVER,
        body: 'mars',
      },
      ''
    );
    expect(url).toContain('/planetarium/?');
    expect(url).toContain('body=mars');
  });
});
