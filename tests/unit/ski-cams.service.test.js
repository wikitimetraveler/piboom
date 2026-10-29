/**
 * Development work by David Lane
 */
import { getSkiCams, groupSkiCams, loadResortCamLinks, normalizeHighways } from '../../services/ski-cams.service.js';
import { loadDestinations } from '../../services/ski-topo.service.js';

const dest = {
  id: 'mountain-high',
  lat: 34.377,
  lng: -117.678,
  summitLat: 34.3765,
  summitLng: -117.6915,
  highways: ['I-5 / CA-91', 'I-15', 'CA-138', 'CA-2'],
  chainHighways: ['CA-2', 'CA-138'],
};

const cam = (id, source, lat, lng, extra = {}) => ({
  id,
  source,
  name: `Cam ${id}`,
  lat,
  lng,
  image_url: `https://img.test/${id}.jpg`,
  camera_url: `https://cam.test/${id}`,
  ...extra,
});

describe('ski-cams.service', () => {
  test('normalizeHighways maps CA routes to Caltrans SR names', () => {
    expect(normalizeHighways(['I-5 / CA-91', 'CA-2', 'US-395', 'Mt Baldy Rd'])).toEqual(['I-5', 'SR-91', 'SR-2', 'US-395']);
    expect(normalizeHighways(['CA-210'])).toEqual(['SR-210', 'I-210']);
  });

  test('groupSkiCams splits mountain, nearby, and road cams', () => {
    const groups = groupSkiCams(dest, [
      cam(1, 'alertcalifornia', 34.3828, -117.684),
      cam(2, 'alertcalifornia', 34.5, -117.5),
      cam(3, 'caltrans_cwwp2', 34.36, -117.63, { raw: { route: 'I-15' } }),
      cam(4, 'caltrans_cwwp2', 34.37, -117.65, { raw: { route: 'SR-2' } }),
      cam(5, 'caltrans_cwwp2', 34.37, -117.66, { raw: { route: 'I-210' } }),
      cam(6, 'alertcalifornia', 34.38, -117.68, { image_url: null }),
      cam(7, 'alertcalifornia', 36.0, -118.0),
    ]);
    expect(groups.mountain.map((c) => c.id)).toEqual([1]);
    expect(groups.mountain[0].sourceLabel).toBe('ALERTCalifornia');
    expect(groups.nearby.map((c) => c.id)).toEqual([2]);
    expect(groups.roads.map((c) => c.id)).toEqual([4, 3]);
    expect(groups.roads[0].route).toBe('SR-2');
  });

  test('road cams keep at most four per route', () => {
    const rows = Array.from({ length: 6 }, (_, i) => cam(10 + i, 'caltrans_cwwp2', 34.36, -117.63 - i * 0.01, { raw: { route: 'I-15' } }));
    rows.push(cam(30, 'caltrans_cwwp2', 34.3, -117.5, { raw: { route: 'SR-138' } }));
    const { roads } = groupSkiCams(dest, rows);
    expect(roads.filter((c) => c.route === 'I-15')).toHaveLength(4);
    expect(roads[0].route).toBe('SR-138');
  });

  test('every resort has an official cam link', async () => {
    const links = await loadResortCamLinks();
    const { destinations } = await loadDestinations();
    for (const d of destinations) {
      expect({ id: d.id, has: (links.resorts[d.id] || []).length > 0 }).toEqual({ id: d.id, has: true });
    }
  });

  test('getSkiCams keeps official links when the catalog is down', async () => {
    const down = await getSkiCams('mammoth', { findCams: async () => { throw new Error('no db'); } });
    expect(down.resort.name).toMatch(/Mammoth/);
    expect(down.official.length).toBeGreaterThan(0);
    expect(down.roads).toEqual([]);
    expect(down.note).toMatch(/unavailable/);
    expect(await getSkiCams('not-a-resort', { findCams: async () => ({ rows: [] }) })).toBeNull();
  });
});
