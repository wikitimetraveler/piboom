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
  normalizeFaaWeatherCam,
  mergeVolcanoWebcamRows,
  pickBetterVolcanoRow,
  ingestWebCoosWebcams,
  ingestUsgsNimsWebcams,
  ingestUsgsVolcanoWebcams,
  ingestFaaWeatherCams,
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
        newestImage: { imageUrl: 'https://volcview.wr.usgs.gov/img/k.jpg' },
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

  test('normalizeUsgsVolcanoFeature ignores dead avcamsplus.faa.gov externalUrl', () => {
    const row = normalizeUsgsVolcanoFeature({
      properties: {
        webcamCode: 'egegik-NE',
        webcamName: 'Egegik - NE',
        externalUrl: 'https://avcamsplus.faa.gov/map/-157.3759,58.2089,11/cameraSite/127.0/details/camera/127.0',
        newestImage: { imageUrl: 'https://avo-volcview.wr.usgs.gov/ashcam-api/images/webcams/egegik.jpg' },
        vName: 'Egegik',
      },
      geometry: { type: 'Point', coordinates: [-157.4, 58.2] },
    }, { feed: 'avo' });

    expect(row.camera_url).toBe('https://avo.alaska.edu/webcam/');
    expect(row.image_url).toMatch(/egegik\.jpg$/);
  });

  test('normalizeUsgsVolcanoFeature ignores dead avcams.faa.gov externalUrl', () => {
    const row = normalizeUsgsVolcanoFeature({
      properties: {
        webcamCode: 'coldBay-NE',
        webcamName: 'Cold Bay - NE',
        externalUrl: 'http://avcams.faa.gov/viewsite.php?bookmark=71KBZOTI',
        newestImage: { imageUrl: 'https://avo-volcview.wr.usgs.gov/ashcam-api/images/webcams/cold.jpg' },
        vName: 'Pavlof',
      },
      geometry: { type: 'Point', coordinates: [-162.7, 55.2] },
    }, { feed: 'avo' });

    expect(row.camera_url).toBe('https://avo.alaska.edu/webcam/');
    expect(row.image_url).toMatch(/cold\.jpg$/);
    expect(row.name).toMatch(/Pavlof/);
  });

  test('normalizeUsgsVolcanoFeature sets AK state and AVO metadata from avo feed', () => {
    const row = normalizeUsgsVolcanoFeature({
      properties: {
        webcamCode: 'PAVO01',
        webcamName: 'Pavlof',
        volcanoName: 'Pavlof',
        vnum: '312030',
      },
      geometry: { type: 'Point', coordinates: [-161.9, 55.4] },
    }, { feed: 'avo' });

    expect(row.state_abbr).toBe('AK');
    expect(row.name).toMatch(/Pavlof/);
    expect(row.raw.feed).toBe('avo');
    expect(row.raw.volcanoName).toBe('Pavlof');
    expect(row.raw.attribution).toMatch(/AVO/i);
  });

  test('pickBetterVolcanoRow prefers image URL and AVO feed', () => {
    const usgs = normalizeUsgsVolcanoFeature({
      properties: { webcamCode: 'SHIS01', webcamName: 'Shishaldin' },
      geometry: { type: 'Point', coordinates: [-163.2, 54.8] },
    }, { feed: 'usgs' });
    const avo = normalizeUsgsVolcanoFeature({
      properties: {
        webcamCode: 'SHIS01',
        webcamName: 'Shishaldin',
        volcanoName: 'Shishaldin',
        newestImage: { imageUrl: 'https://avo.example/shis.jpg' },
      },
      geometry: { type: 'Point', coordinates: [-163.2, 54.8] },
    }, { feed: 'avo' });

    expect(pickBetterVolcanoRow(usgs, avo).raw.feed).toBe('avo');
    expect(pickBetterVolcanoRow(usgs, avo).image_url).toBe('https://avo.example/shis.jpg');
  });

  test('mergeVolcanoWebcamRows dedupes by webcam code', () => {
    const a = normalizeUsgsVolcanoFeature({
      properties: { webcamCode: 'CLEV01', webcamName: 'Cleveland' },
      geometry: { type: 'Point', coordinates: [-169.9, 52.8] },
    }, { feed: 'usgs' });
    const b = normalizeUsgsVolcanoFeature({
      properties: {
        webcamCode: 'CLEV01',
        webcamName: 'Cleveland',
        newestImage: { imageUrl: 'https://avo.example/clev.jpg' },
      },
      geometry: { type: 'Point', coordinates: [-169.9, 52.8] },
    }, { feed: 'avo' });
    const other = normalizeUsgsVolcanoFeature({
      properties: { webcamCode: 'OKMO01', webcamName: 'Okmok' },
      geometry: { type: 'Point', coordinates: [-169.3, 53.4] },
    }, { feed: 'avo' });

    const merged = mergeVolcanoWebcamRows([a, b, other]);
    expect(merged).toHaveLength(2);
    expect(merged.find((r) => r.source_id === 'CLEV01')?.image_url).toBe('https://avo.example/clev.jpg');
  });

  test('normalizeFaaWeatherCam maps site camera direction and image URI', () => {
    const row = normalizeFaaWeatherCam(
      { siteId: 585, siteName: 'Cold Bay', latitude: 55.2, longitude: -162.7, state: 'AK' },
      { cameraDirection: 'N' },
      { imageUri: 'https://images.example/coldbay-n.jpg', imageTimestamp: 1710000000 }
    );

    expect(row).toMatchObject({
      source: 'faa_weathercam',
      source_id: '585:N',
      name: 'Cold Bay — N view',
      lat: 55.2,
      lng: -162.7,
      state_abbr: 'AK',
      image_url: 'https://images.example/coldbay-n.jpg',
      hazard_types: ['aviation', 'weather', 'hazard'],
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

describe('ingestUsgsVolcanoWebcams (mocked fetch)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    upsertHazardWebcams.mockClear();
    initFireCamerasSchema.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('merges global and AVO feeds and dedupes by webcam code', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [{
            properties: { webcamCode: 'SHIS01', webcamName: 'Shishaldin' },
            geometry: { type: 'Point', coordinates: [-163.2, 54.8] },
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [{
            properties: {
              webcamCode: 'SHIS01',
              webcamName: 'Shishaldin',
              volcanoName: 'Shishaldin',
              newestImage: { imageUrl: 'https://avo.example/shis.jpg' },
            },
            geometry: { type: 'Point', coordinates: [-163.2, 54.8] },
          }],
        }),
      });

    const result = await ingestUsgsVolcanoWebcams();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(upsertHazardWebcams).toHaveBeenCalledWith([
      expect.objectContaining({
        source_id: 'SHIS01',
        image_url: 'https://avo.example/shis.jpg',
        raw: expect.objectContaining({ feed: 'avo' }),
      }),
    ]);
    expect(result).toMatchObject({ upserted: 1, fetched: 2, normalized: 1, dedupedFrom: 2 });
  });
});

describe('ingestFaaWeatherCams (mocked fetch)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    upsertHazardWebcams.mockClear();
    initFireCamerasSchema.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('fetches sites and summaries then upserts camera mounts', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          payload: [{ siteId: 585, siteName: 'Cold Bay', latitude: 55.2, longitude: -162.7, state: 'AK' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          payload: {
            site: {
              siteName: 'Cold Bay',
              cameras: [{
                cameraDirection: 'N',
                currentImages: [{ imageUri: 'https://images.example/coldbay-n.jpg' }],
              }],
            },
          },
        }),
      });

    const result = await ingestFaaWeatherCams();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('weathercams.faa.gov/api/sites'),
      expect.any(Object)
    );
    expect(upsertHazardWebcams).toHaveBeenCalledWith([
      expect.objectContaining({ source: 'faa_weathercam', source_id: '585:N' }),
    ]);
    expect(result).toMatchObject({ upserted: 1, fetched: 1, normalized: 1, sitesProcessed: 1 });
  });
});
