/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

const upsertHazardWebcams = jest.fn().mockResolvedValue({ upserted: 1 });
const initFireCamerasSchema = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule('../../services/disasters.service.js', () => ({
  initFireCamerasSchema,
  upsertHazardWebcams,
  ingestCaFireCameras: jest.fn(),
}));

const {
  normalizeUsgsNimsCamera,
  normalizeUsgsVolcanoFeature,
  normalizeWebCoosAsset,
  normalizeSeedMount,
  ingestWebCoosWebcams,
  ingestUsgsNimsWebcams,
} = await import('../../services/hazard-webcam-ingest.service.js');

describe('hazard-webcam-ingest normalizers', () => {
  test('normalizeUsgsNimsCamera maps camId, coords, hazard tags, and image URL', () => {
    const row = normalizeUsgsNimsCamera({
      camId: 'CAM123',
      latitude: 38.5,
      longitude: -120.2,
      siteName: 'American River',
      stateCode: 'CA',
      thumbDir: 'https://example.usgs.gov/thumbs/',
      latestFile: 'frame.jpg',
    });

    expect(row).toMatchObject({
      source: 'usgs_nims',
      source_id: 'CAM123',
      lat: 38.5,
      lng: -120.2,
      state_abbr: 'CA',
      media_type: 'still_image',
      image_url: 'https://example.usgs.gov/thumbs/frame.jpg',
    });
    expect(row.hazard_types).toEqual(expect.arrayContaining(['river', 'hazard']));
    expect(row.raw.attribution).toMatch(/USGS NIMS/i);
  });

  test('normalizeUsgsNimsCamera returns null without coords or camId', () => {
    expect(normalizeUsgsNimsCamera({ camId: 'X' })).toBeNull();
    expect(normalizeUsgsNimsCamera({ latitude: 1, longitude: 2 })).toBeNull();
  });

  test('normalizeUsgsVolcanoFeature maps GeoJSON point and volcano tags', () => {
    const row = normalizeUsgsVolcanoFeature({
      properties: {
        webcamCode: 'KILUEA01',
        webcamName: 'Kilauea Summit',
        imageUrl: 'https://volcview.wr.usgs.gov/img/k.jpg',
        state: 'HI',
      },
      geometry: { type: 'Point', coordinates: [-155.28, 19.41] },
    });

    expect(row).toMatchObject({
      source: 'usgs_volcano',
      source_id: 'KILUEA01',
      lat: 19.41,
      lng: -155.28,
      hazard_types: ['volcano', 'hazard'],
      image_url: 'https://volcview.wr.usgs.gov/img/k.jpg',
    });
  });

  test('normalizeWebCoosAsset maps coastal asset with live stream default', () => {
    const row = normalizeWebCoosAsset({
      slug: 'duck-pier',
      title: 'Duck Pier',
      latitude: 36.17,
      longitude: -75.75,
      state: 'NC',
      services: [{ slug: 'live-hls', url: 'https://webcoos.org/live/duck.m3u8' }],
    });

    expect(row).toMatchObject({
      source: 'webcoos',
      source_id: 'duck-pier',
      lat: 36.17,
      lng: -75.75,
      hazard_types: ['coastal', 'hazard'],
      media_type: 'live_stream',
      camera_url: 'https://webcoos.org/live/duck.m3u8',
    });
  });

  test('normalizeWebCoosAsset prefers snapshot service when present', () => {
    const row = normalizeWebCoosAsset({
      id: 'beach-cam',
      name: 'Beach Cam',
      lat: 33.7,
      lng: -78.9,
      services: [
        { service_slug: 'snapshot-image', endpoint: 'https://webcoos.org/snap.jpg' },
      ],
    });

    expect(row.media_type).toBe('still_image');
    expect(row.image_url).toBe('https://webcoos.org/snap.jpg');
  });

  test('normalizeSeedMount maps curated UCSD seed rows', () => {
    const row = normalizeSeedMount(
      {
        source_id: 'hpwren:bm-n-mobo-c',
        name: 'HPWREN Mt. Woodson',
        lat: 33.0,
        lng: -117.0,
        hazard_types: ['fire'],
        media_type: 'still_image',
      },
      'ucsd_hpwren'
    );

    expect(row).toMatchObject({
      source: 'ucsd_hpwren',
      source_id: 'hpwren:bm-n-mobo-c',
      hazard_types: ['fire'],
    });
  });
});

describe('ingestWebCoosWebcams', () => {
  const prev = process.env.WEBCOOS_API_TOKEN;

  afterEach(() => {
    if (prev === undefined) delete process.env.WEBCOOS_API_TOKEN;
    else process.env.WEBCOOS_API_TOKEN = prev;
  });

  test('skips gracefully when WEBCOOS_API_TOKEN is missing', async () => {
    delete process.env.WEBCOOS_API_TOKEN;
    const result = await ingestWebCoosWebcams();
    expect(result).toEqual({
      upserted: 0,
      skipped: true,
      reason: 'missing WEBCOOS_API_TOKEN',
    });
  });
});

describe('ingestUsgsNimsWebcams (mocked fetch)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    upsertHazardWebcams.mockClear();
    initFireCamerasSchema.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('fetches NIMS list and upserts normalized cameras', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { camId: 'N1', latitude: 40.1, longitude: -105.2, siteName: 'Big Thompson River' },
      ],
    });

    const result = await ingestUsgsNimsWebcams();

    expect(initFireCamerasSchema).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/nims/v0/cameras'),
      expect.any(Object)
    );
    expect(upsertHazardWebcams).toHaveBeenCalledWith([
      expect.objectContaining({ source: 'usgs_nims', source_id: 'N1' }),
    ]);
    expect(result).toEqual({ upserted: 1, fetched: 1, normalized: 1 });
  });
});
