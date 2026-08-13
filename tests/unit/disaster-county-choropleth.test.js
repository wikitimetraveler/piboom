/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockGetPool = jest.fn(() => ({ query: mockQuery }));

await jest.unstable_mockModule('../../services/database.service.js', () => ({
  getPool: mockGetPool,
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

await jest.unstable_mockModule('../../services/free-geocoding.service.js', () => ({
  geocodeAddressFree: jest.fn(),
}));

await jest.unstable_mockModule('../../services/disaster-impact-graph.service.js', () => ({
  refreshDisasterImpactGraphFromCurrentData: jest.fn(),
}));

await jest.unstable_mockModule('../../services/disaster-spatial.service.js', () => ({
  resolveCamerasNearPoint: jest.fn(),
  resolveDisastersNearPoint: jest.fn(),
  resolveLoansNearPoint: jest.fn(),
}));

await jest.unstable_mockModule('../../services/disaster-daily-briefing.service.js', () => ({
  buildDailyBriefing: jest.fn(),
}));

await jest.unstable_mockModule('../../services/disaster-web-crawler.service.js', () => ({
  crawlDisasterWeb: jest.fn(),
}));

await jest.unstable_mockModule('../../lib/disaster-live-endpoint-guard.js', () => ({
  buildDisasterLiveCacheKey: jest.fn(),
  checkDisasterLiveRateLimit: jest.fn(() => ({ allowed: true })),
  getDisasterLiveCache: jest.fn(),
  getRequestIp: jest.fn(() => '127.0.0.1'),
  setDisasterLiveCache: jest.fn(),
}));

await jest.unstable_mockModule('../../services/loan-pipeline.service.js', () => ({
  default: {},
  getAllLoans: jest.fn(),
}));

await jest.unstable_mockModule('../../services/disaster-risk.service.js', () => ({
  default: {},
}));

const { cameraCountySummaryByState } = await import('../../controllers/disasters.controller.js');
const { countyRiskSummaryByState } = await import('../../controllers/loan-pipeline.controller.js');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('county choropleth rollups', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockGetPool.mockClear();
    mockGetPool.mockReturnValue({ query: mockQuery });
  });

  test('cameraCountySummaryByState requires state', async () => {
    const res = mockRes();
    await cameraCountySummaryByState({ query: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('cameraCountySummaryByState returns county camera counts', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ county_name: 'Los Angeles', camera_count: 12 }],
    });
    const res = mockRes();
    await cameraCountySummaryByState({ query: { state: 'ca' } }, res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('CA');
    expect(res.body.data.counties[0].camera_count).toBe(12);
    expect(mockQuery.mock.calls[0][0]).toMatch(/fire_cameras/);
  });

  test('countyRiskSummaryByState labels ops triage metric', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          county_name: 'Orange',
          loan_count: 3,
          avg_ops_triage: 4.5,
          max_ops_triage: 7,
        },
      ],
    });
    const res = mockRes();
    await countyRiskSummaryByState({ query: { state: 'CA' } }, res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metric).toBe('ops_triage');
    expect(res.body.data.note).toMatch(/not a loss probability/i);
    expect(res.body.data.counties[0].avg_ops_triage).toBe(4.5);
  });
});
