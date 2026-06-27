/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

const geocodeAddressFree = jest.fn();

await jest.unstable_mockModule('../../services/free-geocoding.service.js', () => ({
  geocodeAddressFree
}));

await jest.unstable_mockModule('../../services/disasters.service.js', () => ({
  initDisastersSchema: jest.fn().mockResolvedValue(undefined),
  upsertDisasters: jest.fn(),
  normalizeFemaV2ToUnified: jest.fn(),
  ingestFema: jest.fn(),
  ingestFirmsNrt: jest.fn(),
  ingestUsgsQuakes: jest.fn(),
  ingestNwsCap: jest.fn(),
  ingestNhc: jest.fn(),
  ingestCaFireCameras: jest.fn(),
  backfillDisasterGeocodes: jest.fn(),
  pruneOldDisasters: jest.fn(),
  DISASTER_ROLLING_WINDOW_DAYS: 90
}));

await jest.unstable_mockModule('../../services/hazard-webcam-ingest.service.js', () => ({
  ingestHazardWebcams: jest.fn(),
  getHazardWebcamById: jest.fn(),
  getHazardWebcamStats: jest.fn(),
  resolveUsgsNimsLatestImage: jest.fn(),
  resolveUsgsVolcanoLatestImage: jest.fn(),
  resolveFaaWeatherCamLatestImage: jest.fn(),
}));

await jest.unstable_mockModule('../../services/geocoding-cache.service.js', () => ({
  geocodeCountyStateWithCache: jest.fn(),
}));

await jest.unstable_mockModule('../../services/disaster-impact-graph.service.js', () => ({
  refreshDisasterImpactGraphFromCurrentData: jest.fn(),
}));

await jest.unstable_mockModule('../../services/disaster-spatial.service.js', () => ({
  resolveCamerasNearPoint: jest.fn(),
  resolveDisastersNearPoint: jest.fn(),
  resolveLoansNearPoint: jest.fn(),
}));

const { geocodeAddress } = await import('../../controllers/disasters.controller.js');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('disasters.controller geocodeAddress', () => {
  beforeEach(() => {
    geocodeAddressFree.mockReset();
  });

  test('returns 400 when q is missing', async () => {
    const req = { query: {} };
    const res = createRes();

    await geocodeAddress(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Query parameter q is required',
    });
    expect(geocodeAddressFree).not.toHaveBeenCalled();
  });

  test('returns coordinates when geocodeAddressFree succeeds', async () => {
    geocodeAddressFree.mockResolvedValue({
      latitude: 34.05,
      longitude: -118.25,
      display_name: 'Los Angeles, CA, USA',
    });

    const req = { query: { q: 'Los Angeles, CA' } };
    const res = createRes();

    await geocodeAddress(req, res);

    expect(geocodeAddressFree).toHaveBeenCalledWith('Los Angeles, CA');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      query: 'Los Angeles, CA',
      latitude: 34.05,
      longitude: -118.25,
      label: 'Los Angeles, CA, USA',
    });
  });

  test('returns 404 when geocodeAddressFree has no coordinates', async () => {
    geocodeAddressFree.mockResolvedValue({ latitude: null, longitude: null });

    const req = { query: { q: 'nowhere xyz' } };
    const res = createRes();

    await geocodeAddress(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'No coordinates found',
      query: 'nowhere xyz',
    });
  });
});
