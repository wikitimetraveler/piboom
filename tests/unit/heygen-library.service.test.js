/**
 * @jest-environment node
 */
import { getHeygenVideoLibrary } from '../../services/heygen-library.service.js';

describe('heygen-library.service', () => {
  test('getHeygenVideoLibrary merges Lane catalog and disaster demo', async () => {
    const result = await getHeygenVideoLibrary();
    expect(result.count).toBeGreaterThan(0);
    expect(result.videos.some((v) => v.id === 'lane-jonathan-homer-lane-full')).toBe(true);
    expect(result.videos.some((v) => v.domain === 'disasters')).toBe(true);
    const jonathan = result.videos.find((v) => v.id === 'lane-jonathan-homer-lane-full');
    expect(jonathan?.hostedLocally).toBe(true);
    expect(jonathan?.videoUrl).toMatch(/^\/family\/assets\/video\//);
    expect(jonathan?.sourcePage).toMatch(/lane-heygen-line/);
  });

  test('getHeygenVideoLibrary filters by domain', async () => {
    const lane = await getHeygenVideoLibrary({ domain: 'lane' });
    expect(lane.videos.length).toBeGreaterThan(0);
    expect(lane.videos.every((v) => v.domain === 'lane')).toBe(true);

    const disasters = await getHeygenVideoLibrary({ domain: 'disasters' });
    expect(disasters.videos.length).toBeGreaterThan(0);
    expect(disasters.videos.every((v) => v.domain === 'disasters')).toBe(true);
  });

  test('getHeygenVideoLibrary includes HyperFrames reels', async () => {
    const result = await getHeygenVideoLibrary();
    expect(result.hyperframesCount).toBeGreaterThan(0);
    expect(result.items.some((v) => v.kind === 'hyperframes')).toBe(true);
    expect(result.items.some((v) => v.id === 'hf-endless-tour')).toBe(true);
  });

  test('getHeygenVideoLibrary filters by kind', async () => {
    const hf = await getHeygenVideoLibrary({ kind: 'hyperframes' });
    expect(hf.items.every((v) => v.kind === 'hyperframes')).toBe(true);
    expect(hf.videos).toEqual([]);

    const heygen = await getHeygenVideoLibrary({ kind: 'heygen' });
    expect(heygen.items.every((v) => v.kind === 'heygen')).toBe(true);
    expect(heygen.hyperframes).toEqual([]);
  });

  test('lane entries include full and short variants when present', async () => {
    const lane = await getHeygenVideoLibrary({ domain: 'lane' });
    const slugs = new Set(lane.videos.map((v) => v.id));
    expect(slugs.has('lane-jonathan-homer-lane-full')).toBe(true);
    expect(slugs.has('lane-jonathan-homer-lane-short')).toBe(true);
  });
});
