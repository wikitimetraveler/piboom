/**
 * Development work by David Lane
 */
import { fetchIssPasses, normalizePass } from '../../services/planetarium-iss.service.js';

describe('planetarium-iss.service', () => {
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

  test('fetchIssPasses normalizes upstream response', async () => {
    const calls = [];
    const mockFetch = async (url, opts) => {
      calls.push({ url, opts });
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
    expect(calls[0].url).toContain('lat=42.9');
  });
});
