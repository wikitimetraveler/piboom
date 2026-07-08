/**
 * @jest-environment node
 */
import { mkdtemp, writeFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  REEL_OUTPUT_URL,
  buildReelNarrationScenes,
  getReelRenderStatus,
  resetReelRenderJob
} from '../../services/newport-pier-reel.service.js';

const sampleCatalog = {
  version: 1,
  fish: [{ id: 'a' }, { id: 'b' }],
  stops: [
    { id: 'shore-end', label: 'Shore end', heygenScript: 'At the shore end.' },
    { id: 'mid-pier', label: 'Mid pier', heygenScript: 'Mid pier pelagics.' }
  ]
};

describe('newport-pier-reel.service', () => {
  beforeEach(() => {
    resetReelRenderJob();
  });

  test('buildReelNarrationScenes includes intro, stops, species, and outro', () => {
    const scenes = buildReelNarrationScenes(sampleCatalog);
    expect(scenes[0].id).toBe('scene0');
    expect(scenes[1].text).toBe('At the shore end.');
    expect(scenes[2].text).toBe('Mid pier pelagics.');
    expect(scenes[3].id).toBe('scene3');
    expect(scenes[3].text).toMatch(/2 species/);
    expect(scenes[4].id).toBe('scene4');
    expect(scenes[4].text).toMatch(/DevConnect Labs/);
  });

  test('getReelRenderStatus returns idle after reset', () => {
    resetReelRenderJob();
    expect(getReelRenderStatus().status).toBe('idle');
  });

  test('writeReelNarration writes mp3 files with injectable synthesize', async () => {
    const { writeReelNarration } = await import('../../services/newport-pier-reel.service.js');
    const dir = await mkdtemp(path.join(os.tmpdir(), 'np-reel-nar-'));
    const result = await writeReelNarration(sampleCatalog, {
      outDir: dir,
      synthesize: async (text) => Buffer.from(text).toString('base64')
    });
    expect(result.sceneCount).toBe(5);
    expect(result.files).toHaveLength(5);
    for (const file of result.files) {
      const s = await stat(file);
      expect(s.size).toBeGreaterThan(0);
    }
  });

  test('REEL_OUTPUT_URL points at public pier reel', () => {
    expect(REEL_OUTPUT_URL).toBe('/nature/assets/newport-pier/newport-pier-reel.mp4');
  });
});
