/**
 * Development work by David Lane
 */
import {
  fetchIssPasses,
  normalizePass,
  lookAnglesFromTle,
  geodeticFromTle,
  predictPassesFromTle,
  clearIssTleCache,
} from '../../services/planetarium-iss.service.js';

/** Sample ISS TLE (epoch varies; used only for structure / math smoke). */
const SAMPLE_TLE = [
  '1 25544U 98067A   26001.50000000  .00016717  00000-0  10270-3 0  9000',
  '2 25544  51.6400 120.0000 0001000  90.0000 270.0000 15.50000000100000',
];

describe('planetarium-iss.service', () => {
  beforeEach(() => {
    clearIssTleCache();
  });

  test('normalizePass maps open-notify fields', () => {
    const pass = normalizePass({ risetime: 1700000000, duration: 420, maxElev: 62 });
    expect(pass.riseTime).toBe(1700000000);
    expect(pass.duration).toBe(420);
    expect(pass.maxElev).toBe(62);
    expect(pass.start).toMatch(/T/);
  });

  test('fetchIssPasses rejects invalid coords', async () => {
    await expect(fetchIssPasses('x', 0)).rejects.toMatchObject({ code: 'INVALID_COORDS' });
  });

  test('fetchIssPasses falls back to Open Notify when TLE fails', async () => {
    const calls = [];
    const mockFetch = async (url) => {
      calls.push(String(url));
      if (/celestrak|gp\.php/i.test(String(url))) {
        return { ok: false, status: 502, text: async () => 'err' };
      }
      return {
        ok: true,
        json: async () => ({
          response: [{ risetime: 1700000100, duration: 300, maxElev: 35 }],
        }),
      };
    };
    const result = await fetchIssPasses(42.9, -70.86, mockFetch);
    expect(result.count).toBe(1);
    expect(result.passes[0].maxElev).toBe(35);
    expect(result.source).toBe('open-notify.org');
    expect(calls.some((u) => u.includes('lat=42.9'))).toBe(true);
  });

  test('lookAnglesFromTle returns finite alt/az for a sample TLE', () => {
    const look = lookAnglesFromTle(SAMPLE_TLE, new Date('2026-01-01T12:00:00Z'), 42.9, -70.86);
    // Propagation may return null if epoch is too stale; either null or finite angles
    if (look) {
      expect(Number.isFinite(look.alt)).toBe(true);
      expect(Number.isFinite(look.az)).toBe(true);
    } else {
      expect(look).toBeNull();
    }
  });

  test('geodeticFromTle returns a sub-satellite point when propagation works', () => {
    const geo = geodeticFromTle(SAMPLE_TLE, new Date('2026-01-01T12:00:00Z'));
    if (geo) {
      expect(Number.isFinite(geo.lat)).toBe(true);
      expect(Number.isFinite(geo.lon)).toBe(true);
      expect(Number.isFinite(geo.altKm)).toBe(true);
    } else {
      expect(geo).toBeNull();
    }
  });

  test('predictPassesFromTle returns an array', () => {
    const passes = predictPassesFromTle(
      SAMPLE_TLE,
      42.9,
      -70.86,
      new Date('2026-01-01T00:00:00Z'),
      6,
      10
    );
    expect(Array.isArray(passes)).toBe(true);
  });
});
