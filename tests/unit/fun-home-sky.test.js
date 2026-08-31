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
});
