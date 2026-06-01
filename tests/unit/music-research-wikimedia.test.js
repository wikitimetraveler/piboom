/**
 * Development work by David Lane
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  createRes,
  MockWikimediaRateLimitError,
  mbGetEmpty
} from '../helpers/music-research-mocks.js';

const axiosGet = jest.fn();
const mbGet = mbGetEmpty();

await jest.unstable_mockModule('axios', () => ({
  default: { get: axiosGet }
}));

await jest.unstable_mockModule('../../services/musicbrainz.service.js', () => ({
  mbGet,
  MUSICBRAINZ_USER_AGENT: 'test-agent'
}));

await jest.unstable_mockModule('../../lib/google-api-key.js', () => ({
  getGoogleBrowserApiKey: jest.fn(() => ''),
  getGoogleServerApiKey: jest.fn(() => 'test-google-key')
}));

const {
  wikimediaApiGet,
  WikimediaRateLimitError,
  WIKIMEDIA_USER_AGENT,
  clearWikimediaCacheForTests
} = await import('../../services/music-research-wikimedia.service.js');

describe('music-research-wikimedia.service', () => {
  beforeEach(() => {
    axiosGet.mockReset();
    clearWikimediaCacheForTests();
  });

  test('retries on 429 then succeeds', async () => {
    axiosGet
      .mockResolvedValueOnce({
        status: 429,
        headers: { 'retry-after': '0' },
        data: null
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: { ok: true }
      });

    const res = await wikimediaApiGet('https://en.wikipedia.org/w/api.php?test=retry', {
      maxAttempts: 3
    });

    expect(res.data).toEqual({ ok: true });
    expect(axiosGet).toHaveBeenCalledTimes(2);
  });

  test('returns cached data without second HTTP call', async () => {
    axiosGet.mockResolvedValue({
      status: 200,
      headers: {},
      data: { cached: true }
    });

    const url = 'https://en.wikipedia.org/w/api.php?test=cache';
    await wikimediaApiGet(url);
    await wikimediaApiGet(url);

    expect(axiosGet).toHaveBeenCalledTimes(1);
  });

  test('cache distinguishes query params', async () => {
    axiosGet.mockResolvedValue({
      status: 200,
      headers: {},
      data: { ok: true }
    });

    const base = 'https://en.wikipedia.org/w/api.php';
    await wikimediaApiGet(base, { params: { action: 'query', srsearch: 'a' } });
    await wikimediaApiGet(base, { params: { action: 'query', srsearch: 'a' } });
    await wikimediaApiGet(base, { params: { action: 'query', srsearch: 'b' } });

    expect(axiosGet).toHaveBeenCalledTimes(2);
  });

  test('sends Wikimedia User-Agent on requests', async () => {
    axiosGet.mockResolvedValue({
      status: 200,
      headers: {},
      data: {}
    });

    await wikimediaApiGet('https://en.wikipedia.org/w/api.php?ua=test');

    expect(axiosGet).toHaveBeenCalledWith(
      'https://en.wikipedia.org/w/api.php?ua=test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': WIKIMEDIA_USER_AGENT
        })
      })
    );
  });

  test('throws WikimediaRateLimitError when retries exhausted', async () => {
    axiosGet.mockResolvedValue({
      status: 429,
      headers: { 'retry-after': '0' },
      data: null
    });

    await expect(
      wikimediaApiGet('https://en.wikipedia.org/w/api.php?test=limit', { maxAttempts: 2 })
    ).rejects.toBeInstanceOf(WikimediaRateLimitError);
  }, 15000);
});

describe('music-research map-data rate limit', () => {
  beforeEach(() => {
    axiosGet.mockReset();
    mbGet.mockReset();
    mbGet.mockResolvedValue({ data: { artists: [] } });
    clearWikimediaCacheForTests();
  });

  test('getMapData returns 503 when Wikimedia and MusicBrainz both fail', async () => {
    axiosGet.mockResolvedValue({
      status: 429,
      headers: { 'retry-after': '0' },
      data: null
    });

    const { getMapData } = await import('../../controllers/music-research.controller.js');
    const req = { body: { artist: 'The Band' } };
    const res = createRes();

    await getMapData(req, res);

    expect(mbGet).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rateLimited: true,
        error: expect.stringContaining('rate-limiting')
      })
    );
  }, 20000);
});
