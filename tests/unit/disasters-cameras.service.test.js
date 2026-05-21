import {
  filterFireCamerasByDistance,
  sortCamerasByDistance
} from '../../services/disasters.service.js';

describe('disasters.service fire camera geo filters', () => {
  const centerLat = 34.05;
  const centerLng = -118.25;

  test('filterFireCamerasByDistance keeps cameras within radius and drops missing coords', () => {
    const cameras = [
      { id: 1, lat: 34.06, lng: -118.26 },
      { id: 2, lat: 35.5, lng: -118.5 },
      { id: 3, lat: null, lng: -118.26 },
      { id: 4, lat: 34.08, lng: -118.30 }
    ];

    const within25 = filterFireCamerasByDistance(cameras, centerLat, centerLng, 25);
    const ids = within25.map((c) => c.id);
    expect(ids).toContain(1);
    expect(ids).toContain(4);
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(3);
  });

  test('filterFireCamerasByDistance returns empty when all cameras are far away', () => {
    const cameras = [{ id: 1, lat: 40.0, lng: -74.0 }];
    const result = filterFireCamerasByDistance(cameras, centerLat, centerLng, 10);
    expect(result).toHaveLength(0);
  });

  test('sortCamerasByDistance orders nearest-first and attaches distance fields', () => {
    const cameras = [
      { id: 1, lat: 34.2, lng: -118.4 },
      { id: 2, lat: 34.06, lng: -118.26 },
      { id: 3, lat: 34.1, lng: -118.3 }
    ];

    const sorted = sortCamerasByDistance(cameras, centerLat, centerLng);
    expect(sorted[0].id).toBe(2);
    expect(sorted[0].distance_km).not.toBeNull();
    expect(sorted[0].distance_miles).not.toBeNull();
    expect(sorted[1].distance_km).toBeGreaterThanOrEqual(sorted[0].distance_km);
  });
});
