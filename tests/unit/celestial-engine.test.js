/**
 * Development work by David Lane
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
globalThis.Astronomy = require('astronomy-engine');

await import('../../public/planetarium/js/celestial-engine.js');

const { CelestialEngine } = globalThis;
const {
  equatorialToAltAz,
  bodyAltAz,
  moonPhaseFraction,
  moonPhaseLabel,
  skySnapshot,
  twilightLabel,
} = CelestialEngine;

const HF = { lat: 42.898, lon: -70.864, label: 'Hampton Falls, NH' };

describe('CelestialEngine', () => {
  test('exports default observer and body list', () => {
    expect(CelestialEngine.DEFAULT_OBSERVER.lat).toBeCloseTo(42.898, 3);
    expect(CelestialEngine.BODY_IDS.some((b) => b.id === 'uranus')).toBe(true);
    expect(CelestialEngine.BODY_IDS.some((b) => b.id === 'neptune')).toBe(true);
  });

  test('equatorialToAltAz places Polaris near expected altitude from Hampton Falls', () => {
    const aa = equatorialToAltAz(37.954, 89.264, new Date('2026-01-15T02:00:00Z'), HF);
    expect(aa.alt).toBeGreaterThan(40);
    expect(aa.alt).toBeLessThan(50);
    expect(aa.az).toBeGreaterThan(350);
  });

  test('bodyAltAz returns Jupiter above horizon on a known night', () => {
    const jup = bodyAltAz('jupiter', new Date('2026-01-15T02:00:00Z'), HF);
    expect(jup).not.toBeNull();
    expect(jup.name).toBe('Jupiter');
    expect(jup.alt).toBeGreaterThan(40);
    expect(Number.isFinite(jup.ra)).toBe(true);
  });

  test('Venus has finite alt/az', () => {
    const venus = bodyAltAz('venus', new Date('2026-08-31T00:00:00Z'), HF);
    expect(venus).not.toBeNull();
    expect(Number.isFinite(venus.alt)).toBe(true);
    expect(Number.isFinite(venus.az)).toBe(true);
  });

  test('moonPhaseFraction stays in 0..1', () => {
    const f = moonPhaseFraction(new Date('2026-08-31T02:00:00Z'));
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(1);
  });

  test('moonPhaseLabel returns a named phase', () => {
    expect(moonPhaseLabel(new Date('2026-08-31T02:00:00Z')).length).toBeGreaterThan(3);
  });

  test('twilightLabel covers daylight and night', () => {
    expect(twilightLabel(10)).toMatch(/Daylight/);
    expect(twilightLabel(-20)).toBe('');
  });

  test('skySnapshot includes astronomy-engine marker and planets', () => {
    const snap = skySnapshot({ date: new Date('2026-01-15T02:00:00Z'), observer: HF });
    expect(snap.engine).toBe('astronomy-engine');
    expect(snap.caption).toMatch(/Hampton/);
    expect(Array.isArray(snap.allBodies)).toBe(true);
    expect(snap.allBodies.length).toBeGreaterThanOrEqual(7);
  });
});
