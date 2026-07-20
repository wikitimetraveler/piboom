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

    const finance = await getHeygenVideoLibrary({ domain: 'finance' });
    expect(finance.videos.length).toBeGreaterThanOrEqual(3);
    expect(finance.videos.every((v) => v.domain === 'finance')).toBe(true);
    expect(finance.videos.some((v) => v.id === 'finance-calc-engine-demo')).toBe(true);
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

  test('getHeygenVideoLibrary includes nature HyperFrames reel', async () => {
    const nature = await getHeygenVideoLibrary({ domain: 'nature', kind: 'hyperframes' });
    expect(nature.items.some((v) => v.id === 'hf-newport-pier')).toBe(true);
    const pier = nature.items.find((v) => v.id === 'hf-newport-pier');
    expect(pier?.sourcePage).toBe('/nature/newport-pier.html');
  });

  test('getHeygenVideoLibrary includes ICE RAG HyperFrames reel', async () => {
    const finance = await getHeygenVideoLibrary({ domain: 'finance', kind: 'hyperframes' });
    expect(finance.items.some((v) => v.id === 'hf-ice-rag')).toBe(true);
    const ice = finance.items.find((v) => v.id === 'hf-ice-rag');
    expect(ice?.videoUrl).toBe('/shared/assets/video/ice-rag-reel.mp4');
    expect(ice?.projectDir).toBe('video/ice-rag');
  });

  test('lane entries include full and short variants when present', async () => {
    const lane = await getHeygenVideoLibrary({ domain: 'lane' });
    const slugs = new Set(lane.videos.map((v) => v.id));
    expect(slugs.has('lane-jonathan-homer-lane-full')).toBe(true);
    expect(slugs.has('lane-jonathan-homer-lane-short')).toBe(true);
  });
});
