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
  equatorialToAltAzNaive,
  j2000ToAltAz,
  bodyAltAz,
  moonPhaseFraction,
  moonPhaseLabel,
  skySnapshot,
  twilightLabel,
  altAzToVec3,
  shortestAzDelta,
  unwrapAzTarget,
  fisheyeScreenToDir,
  clipHorizonSegment,
  eqjToEnuMatrix,
  eqjUnitFromRaDec,
} = CelestialEngine;

const HF = { lat: 42.898, lon: -70.864, label: 'Hampton Falls, NH' };
const WHEN = new Date('2026-01-15T02:00:00Z');

describe('CelestialEngine', () => {
  test('exports default observer and body list', () => {
    expect(CelestialEngine.DEFAULT_OBSERVER.lat).toBeCloseTo(42.898, 3);
    expect(CelestialEngine.BODY_IDS.some((b) => b.id === 'uranus')).toBe(true);
    expect(CelestialEngine.BODY_IDS.some((b) => b.id === 'neptune')).toBe(true);
  });

  test('j2000ToAltAz places Polaris near lat+(dec-90) from Hampton Falls', () => {
    const polarisDec = 89.264;
    const expected = HF.lat + (polarisDec - 90);
    const aa = j2000ToAltAz(37.954, polarisDec, WHEN, HF);
    expect(Math.abs(aa.alt - expected)).toBeLessThan(0.3);
    expect(aa.az).toBeGreaterThan(350);
  });

  test('j2000ToAltAz differs from naive Horizon by >0.15° for Vega in 2026', () => {
    const ra = 279.2347;
    const dec = 38.7837;
    const precessed = j2000ToAltAz(ra, dec, WHEN, HF);
    const naive = equatorialToAltAzNaive(ra, dec, WHEN, HF);
    const dAlt = precessed.alt - naive.alt;
    let dAz = ((precessed.az - naive.az + 540) % 360) - 180;
    const ang = Math.hypot(dAlt, dAz * Math.cos((precessed.alt * Math.PI) / 180));
    expect(ang).toBeGreaterThan(0.15);
  });

  test('equatorialToAltAz aliases j2000ToAltAz for catalog stars', () => {
    const a = equatorialToAltAz(101.2872, -16.7161, WHEN, HF);
    const b = j2000ToAltAz(101.2872, -16.7161, WHEN, HF);
    expect(a.alt).toBeCloseTo(b.alt, 5);
    expect(a.az).toBeCloseTo(b.az, 5);
  });

  test('altAzToVec3 maps zenith and north horizon', () => {
    const zenith = altAzToVec3(90, 180);
    expect(zenith.x).toBeCloseTo(0, 5);
    expect(zenith.y).toBeCloseTo(1, 5);
    expect(zenith.z).toBeCloseTo(0, 5);
    const north = altAzToVec3(0, 0);
    expect(north.x).toBeCloseTo(0, 5);
    expect(north.y).toBeCloseTo(0, 5);
    expect(north.z).toBeCloseTo(-1, 5);
  });

  test('eqjToEnuMatrix rotates Polaris near local zenith ENU', () => {
    const eqj = eqjUnitFromRaDec(37.954, 89.264);
    const { rot } = eqjToEnuMatrix(WHEN, HF);
    const enu = CelestialEngine.rotateVec(rot, eqj.x, eqj.y, eqj.z);
    expect(enu.y).toBeGreaterThan(0.65);
  });

  test('shortestAzDelta / unwrapAzTarget take the short arc', () => {
    expect(shortestAzDelta(350, 10)).toBeCloseTo(20, 5);
    expect(shortestAzDelta(10, 350)).toBeCloseTo(-20, 5);
    expect(unwrapAzTarget(350, 10)).toBeCloseTo(370, 5);
  });

  test('fisheyeScreenToDir center is look vector; rim at 180° FOV is 90° off', () => {
    const center = fisheyeScreenToDir(0, 0, 180, 89, 180);
    expect(center.y).toBeGreaterThan(0.99);
    const rim = fisheyeScreenToDir(0, 1, 180, 89, 180);
    const dot = center.x * rim.x + center.y * rim.y + center.z * rim.z;
    const ang = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
    expect(ang).toBeCloseTo(90, 0);
  });

  test('clipHorizonSegment keeps one endpoint when the other is below floor', () => {
    const above = altAzToVec3(20, 180);
    const below = altAzToVec3(-20, 180);
    const clipped = clipHorizonSegment(
      above.x,
      above.y,
      above.z,
      below.x,
      below.y,
      below.z,
      -8
    );
    expect(clipped).not.toBeNull();
    expect(clipped.a.y).toBeGreaterThanOrEqual(Math.sin((-8 * Math.PI) / 180) - 1e-6);
    expect(clipped.b.y).toBeGreaterThanOrEqual(Math.sin((-8 * Math.PI) / 180) - 1e-6);
    const bothDown = clipHorizonSegment(below.x, below.y, below.z, below.x, below.y, below.z, -8);
    expect(bothDown).toBeNull();
  });

  test('bodyAltAz returns Jupiter above horizon on a known night', () => {
    const jup = bodyAltAz('jupiter', WHEN, HF);
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
    const snap = skySnapshot({ date: WHEN, observer: HF });
    expect(snap.engine).toBe('astronomy-engine');
    expect(snap.caption).toMatch(/Hampton/);
    expect(Array.isArray(snap.allBodies)).toBe(true);
    expect(snap.allBodies.length).toBeGreaterThanOrEqual(7);
  });
});
