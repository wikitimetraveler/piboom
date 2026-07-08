/**
 * @jest-environment node
 */
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  clipFieldsFromUrl,
  mergeStopSave,
  saveNewportPierStop,
  validateClipUrl
} from '../../services/newport-pier.service.js';

const baseCatalog = {
  version: 1,
  avatar: { avatarId: 'a1', label: 'Test' },
  stops: [
    {
      id: 'first-bench',
      label: 'First benches',
      heygenScript: 'Old script',
      heygenVideoUrl: null
    }
  ]
};

describe('newport-pier.service', () => {
  test('validateClipUrl accepts site paths and https', () => {
    expect(validateClipUrl('/nature/assets/clip.webm')).toBe('/nature/assets/clip.webm');
    expect(validateClipUrl('https://cdn.example.com/v.mp4')).toBe('https://cdn.example.com/v.mp4');
    expect(validateClipUrl('')).toBeNull();
    expect(() => validateClipUrl('http://insecure.example/x.mp4')).toThrow(/https/);
  });

  test('clipFieldsFromUrl maps webm to alpha field', () => {
    expect(clipFieldsFromUrl('/x.webm')).toEqual({
      heygenVideoUrl: null,
      heygenVideoAlphaUrl: '/x.webm'
    });
    expect(clipFieldsFromUrl('/x.mp4')).toEqual({
      heygenVideoUrl: '/x.mp4',
      heygenVideoAlphaUrl: null
    });
  });

  test('mergeStopSave updates stop and avatar', () => {
    const catalog = JSON.parse(JSON.stringify(baseCatalog));
    mergeStopSave(catalog, {
      stopId: 'first-bench',
      heygenScript: 'New script',
      heygenVideoUrl: '/clip.mp4',
      avatar: { avatarId: 'new-id', label: 'Presenter' }
    });
    expect(catalog.stops[0].heygenScript).toBe('New script');
    expect(catalog.stops[0].heygenVideoUrl).toBe('/clip.mp4');
    expect(catalog.avatar.avatarId).toBe('new-id');
  });

  test('saveNewportPierStop writes catalog file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'np-pier-'));
    const dataPath = path.join(dir, 'catalog.json');
    await writeFile(dataPath, `${JSON.stringify(baseCatalog, null, 2)}\n`, 'utf8');
    await saveNewportPierStop(
      {
        stopId: 'first-bench',
        heygenScript: 'Persisted script',
        clipUrl: 'https://files.heygen.ai/demo.webm',
        avatar: { avatarId: 'saved-avatar', label: 'Lane' }
      },
      { dataPath }
    );
    const saved = JSON.parse(await readFile(dataPath, 'utf8'));
    expect(saved.stops[0].heygenScript).toBe('Persisted script');
    expect(saved.stops[0].heygenVideoAlphaUrl).toBe('https://files.heygen.ai/demo.webm');
    expect(saved.avatar.avatarId).toBe('saved-avatar');
  });
});
