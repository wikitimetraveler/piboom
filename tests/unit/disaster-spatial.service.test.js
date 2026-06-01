/**
 * Development work by David Lane
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const poolQuery = jest.fn();
const isPostgisAvailable = jest.fn();

await jest.unstable_mockModule('../../services/database.service.js', () => ({
  getPool: () => ({ query: poolQuery }),
  isPostgisAvailable
}));

await jest.unstable_mockModule('../../services/disasters.service.js', () => ({
  calculateDistance: (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
      * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
  filterFireCamerasByDistance: (cameras) => cameras,
  sortCamerasByDistance: (cameras) => cameras,
  DISASTER_ROLLING_WINDOW_DAYS: 90
}));

const {
  milesToMeters,
  findDisastersNearPoint,
  findCamerasNearPoint,
  findLoansNearPoint,
  resolveDisastersNearPoint
} = await import('../../services/disaster-spatial.service.js');

describe('disaster-spatial.service', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    isPostgisAvailable.mockReset();
  });

  test('milesToMeters converts using 1609.34', () => {
    expect(milesToMeters(50)).toBeCloseTo(80467, 0);
  });

  test('findDisastersNearPoint returns null when PostGIS unavailable', async () => {
    isPostgisAvailable.mockResolvedValue(false);
    const result = await findDisastersNearPoint({ lat: 34, lng: -118, radiusMiles: 25 });
    expect(result).toBeNull();
    expect(poolQuery).not.toHaveBeenCalled();
  });

  test('findDisastersNearPoint uses ST_DWithin and ST_MakePoint', async () => {
    isPostgisAvailable.mockResolvedValue(true);
    poolQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          source: 'fema',
          event_type: 'fire',
          lat: 34.1,
          lng: -118.2,
          distance_meters: 1200
        }]
      });

    const result = await findDisastersNearPoint({
      lat: 34.05,
      lng: -118.25,
      radiusMiles: 50,
      limit: 10,
      offset: 0
    });

    expect(result.total).toBe(1);
    expect(result.rows[0].distance_miles).toBeGreaterThan(0);
    expect(poolQuery.mock.calls[0][0]).toContain('ST_DWithin');
    expect(poolQuery.mock.calls[0][0]).toContain('ST_MakePoint');
    expect(poolQuery.mock.calls[0][1][2]).toBeCloseTo(milesToMeters(50), 1);
  });

  test('findCamerasNearPoint orders by KNN operator', async () => {
    isPostgisAvailable.mockResolvedValue(true);
    poolQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await findCamerasNearPoint({
      lat: 37.77,
      lng: -122.42,
      radiusMiles: 10,
      filters: { state: 'CA' }
    });

    expect(poolQuery.mock.calls[1][0]).toContain('geom <->');
    expect(poolQuery.mock.calls[1][0]).toContain('UPPER(TRIM(COALESCE(state_abbr');
  });

  test('findLoansNearPoint uses ST_DWithin on loans.geom', async () => {
    isPostgisAvailable.mockResolvedValue(true);
    poolQuery
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })
      .mockResolvedValueOnce({ rows: [{ loan_number: 'LN1', distance_meters: 500 }] });

    const result = await findLoansNearPoint({
      lat: 29.76,
      lng: -95.37,
      radiusMiles: 25,
      filters: { state: 'TX' }
    });

    expect(result.total).toBe(2);
    expect(poolQuery.mock.calls[0][0]).toContain('FROM loans');
    expect(poolQuery.mock.calls[0][0]).toContain('ST_DWithin');
  });

  test('resolveDisastersNearPoint falls back to Haversine when PostGIS unavailable', async () => {
    isPostgisAvailable.mockResolvedValue(false);
    poolQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, lat: 34.05, lng: -118.25, event_type: 'fire', start_time: new Date() },
        { id: 2, lat: 40.0, lng: -100.0, event_type: 'fire', start_time: new Date() }
      ]
    });

    const result = await resolveDisastersNearPoint({
      lat: 34.05,
      lng: -118.25,
      radiusMiles: 50,
      limit: 10
    });

    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.rows[0].distance_miles).not.toBeNull();
    expect(poolQuery.mock.calls[0][0]).not.toContain('ST_DWithin');
  });
});
