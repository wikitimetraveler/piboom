/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';
import {
  FOUNTAIN_VALLEY,
  RADIUS_MILES,
  clearThriftCache,
  dedupeStores,
  getThriftNearFountainValley,
  milesBetween,
  normalizeOverpassElement,
  overpassThriftQuery,
  withinThriftRadius,
} from '../../services/local-thrift.service.js';

function jsonResponse(body, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  };
}

describe('local-thrift.service', () => {
  beforeEach(() => clearThriftCache());

  test('Fountain Valley is the center and the radius is 30 miles', () => {
    expect(FOUNTAIN_VALLEY.name).toBe('Fountain Valley');
    expect(RADIUS_MILES).toBe(30);
    expect(milesBetween(FOUNTAIN_VALLEY.lat, FOUNTAIN_VALLEY.lng, FOUNTAIN_VALLEY.lat, FOUNTAIN_VALLEY.lng)).toBe(0);
    expect(overpassThriftQuery()).toContain('shop"="second_hand"');
    expect(overpassThriftQuery()).toContain('shop"="charity"');
  });

  test('keeps a nearby thrift shop and drops one past 30 miles', () => {
    const near = normalizeOverpassElement({
      type: 'node',
      id: 1,
      lat: 33.748,
      lon: -117.906,
      tags: {
        name: 'Goodwill on 5th',
        shop: 'second_hand',
        'addr:street': 'W 5th St',
        'addr:city': 'Santa Ana',
      },
    });
    const far = normalizeOverpassElement({
      type: 'node',
      id: 2,
      lat: 34.5,
      lon: -118.2,
      tags: { name: 'Far Thrift', shop: 'charity' },
    });
    expect(near.name).toBe('Goodwill on 5th');
    expect(near.address).toContain('Santa Ana');
    expect(near.miles).toBeLessThan(10);
    expect(withinThriftRadius(near.lat, near.lng)).toBe(true);
    expect(far).toBeNull();
  });

  test('dedupes the same shop reported twice', () => {
    const stores = dedupeStores([
      { id: 'a', name: 'Savers Huntington Beach', lat: 33.66, lng: -118.0, miles: 4 },
      { id: 'b', name: 'Savers Huntington Beach', lat: 33.6602, lng: -118.0002, miles: 4.1 },
      { id: 'c', name: 'Out of the Closet', lat: 33.72, lng: -117.99, miles: 2 },
    ]);
    expect(stores.map((s) => s.id)).toEqual(['c', 'a']);
  });

  test('Overpass results are filtered, sorted, and cached', async () => {
    const fetchFn = jest.fn(async () =>
      jsonResponse({
        elements: [
          { type: 'node', id: 9, lat: 33.72, lon: -117.99, tags: { name: 'Closer Thrift', shop: 'second_hand' } },
          { type: 'way', id: 8, center: { lat: 33.8, lon: -117.9 }, tags: { name: 'Anaheim Charity Shop', shop: 'charity' } },
          { type: 'node', id: 7, lat: 33.7, lon: -117.95, tags: { shop: 'second_hand' } },
          { type: 'node', id: 6, lat: 36.1, lon: -115.1, tags: { name: 'Las Vegas Thrift', shop: 'second_hand' } },
        ],
      })
    );
    const first = await getThriftNearFountainValley(fetchFn);
    const second = await getThriftNearFountainValley(fetchFn);
    expect(first.stores.map((s) => s.name)).toEqual(['Closer Thrift', 'Anaheim Charity Shop']);
    expect(first.radiusMiles).toBe(30);
    expect(second).toEqual(first);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
