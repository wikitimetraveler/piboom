/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';
import skiPlaces, {
  placesQueryForKind,
  overpassShopsForKind,
  fetchLiveStopsForRoute,
  getStops,
  clearPlacesCache,
} from '../../services/ski-places.service.js';

function jsonResponse(body, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  };
}

describe('ski-places.service', () => {
  beforeEach(() => {
    clearPlacesCache();
    delete process.env.GOOGLE_SERVER_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  test('maps kinds to Places keywords and Overpass shop tags', () => {
    expect(placesQueryForKind('thrift')).toBe('thrift store');
    expect(overpassShopsForKind('thrift')).toEqual(['second_hand', 'charity']);
  });

  test('live search covers thrift only — no smoke shops or dispensaries', () => {
    expect(skiPlaces.LIVE_KINDS).toEqual(['thrift']);
    expect(overpassShopsForKind('smoke')).toEqual([]);
    expect(overpassShopsForKind('dispensary')).toEqual([]);
  });

  test('Overpass fallback returns live rows and caches the route', async () => {
    const fetchFn = jest.fn(async () =>
      jsonResponse({
        elements: [
          {
            id: 99,
            lat: 34.36,
            lon: -117.62,
            tags: { name: 'Pine Second Hand', shop: 'second_hand' },
          },
        ],
      })
    );

    const first = await fetchLiveStopsForRoute('wrightwood', fetchFn);
    const second = await fetchLiveStopsForRoute('wrightwood', fetchFn);
    expect(first.length).toBeGreaterThan(0);
    expect(first[0].source).toBe('live');
    expect(first[0].name).toBe('Pine Second Hand');
    expect(second).toEqual(first);
    expect(fetchFn.mock.calls.length).toBeGreaterThan(0);
    expect(fetchFn.mock.calls.length).toBeLessThan(first.length * 2);
  });

  test('getStops merges seed scenic with live shops', async () => {
    const fetchFn = jest.fn(async () =>
      jsonResponse({
        elements: [
          { id: 1, lat: 34.1, lon: -117.5, tags: { name: 'Live Thrift', shop: 'second_hand' } },
        ],
      })
    );
    const stops = await getStops({ route: 'wrightwood', fetchFn });
    expect(stops.some((s) => s.id === 'mormon-rocks')).toBe(true);
    expect(stops.some((s) => s.name === 'Live Thrift')).toBe(true);
  });
});
