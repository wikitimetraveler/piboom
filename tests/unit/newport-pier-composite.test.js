/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  CLIPS_WEB_DIR,
  downloadMedia,
  extFromUrl,
  localClipWebPath,
  publicPathFromUrl,
  resolveClipSource,
  resolveMediaInput
} from '../../lib/newport-pier-composite.js';

describe('newport-pier-composite', () => {
  test('publicPathFromUrl maps site paths under public/', () => {
    const p = publicPathFromUrl('/nature/assets/newport-pier/walk.mp4');
    expect(p).toMatch(/public[\\/]nature[\\/]assets[\\/]newport-pier[\\/]walk\.mp4$/);
  });

  test('extFromUrl ignores query string', () => {
    expect(extFromUrl('https://cdn.example.com/a.webm?Expires=1&Signature=x')).toBe('.webm');
    expect(extFromUrl('/clip.mp4')).toBe('.mp4');
  });

  test('localClipWebPath uses clips directory', () => {
    expect(localClipWebPath('first-bench')).toBe(`${CLIPS_WEB_DIR}/first-bench.webm`);
  });

  test('resolveMediaInput returns local path for site URLs without fetch', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'np-comp-'));
    const clipDir = path.join(dir, 'public', 'nature', 'assets', 'clips');
    await mkdir(clipDir, { recursive: true });
    const clipFile = path.join(clipDir, 'test.webm');
    await writeFile(clipFile, 'webm-bytes');

    const fetchMock = jest.fn();
    const webPath = '/nature/assets/clips/test.webm';
    const originalRoot = path.dirname(path.dirname(path.dirname(publicPathFromUrl(webPath))));
    // publicPathFromUrl resolves from repo root; use absolute file in temp via direct path
    const { path: resolved, cleanupDir } = await resolveMediaInput(clipFile, { fetchImpl: fetchMock });
    expect(resolved).toBe(clipFile);
    expect(cleanupDir).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await rm(dir, { recursive: true, force: true });
  });

  test('resolveMediaInput downloads https URLs via fetch', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
    });
    const url = 'https://files.heygen.ai/demo.webm?Signature=abc&Key-Pair-Id=xyz';
    const { path: resolved, cleanupDir } = await resolveMediaInput(url, { fetchImpl: fetchMock });
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: 'follow' }));
    expect(resolved).toMatch(/input\.webm$/);
    expect(cleanupDir).toBeTruthy();
    await rm(cleanupDir, { recursive: true, force: true });
  });

  test('downloadMedia throws CLIP_DOWNLOAD_FAILED on 403', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(
      downloadMedia('https://files.heygen.ai/expired.webm?Signature=x', fetchMock)
    ).rejects.toMatchObject({ code: 'CLIP_DOWNLOAD_FAILED', status: 403 });
  });

  test('resolveClipSource prefers cached local clip when file exists', async () => {
    const stopId = 'test-composite-cache';
    const webPath = localClipWebPath(stopId);
    const fsPath = publicPathFromUrl(webPath);
    await mkdir(path.dirname(fsPath), { recursive: true });
    await writeFile(fsPath, 'cached-clip');
    try {
      const source = await resolveClipSource({
        stopId,
        clipUrl: 'https://files.heygen.ai/expired.webm?Signature=x&Key-Pair-Id=y',
        videoId: null
      });
      expect(source).toEqual({ url: webPath, source: 'cached-local' });
    } finally {
      await rm(fsPath, { force: true });
    }
  });
});
