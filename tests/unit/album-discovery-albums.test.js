/**
 * @jest-environment node
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createRes } from '../helpers/music-research-mocks.js';

const mbGet = jest.fn();

await jest.unstable_mockModule('../../services/musicbrainz.service.js', () => ({
  mbGet,
  MUSICBRAINZ_USER_AGENT: 'test-agent'
}));

const { getAlbums } = await import('../../controllers/album-discovery.controller.js');

describe('getAlbums', () => {
  beforeEach(() => {
    mbGet.mockReset();
  });

  test('browses release-groups by MusicBrainz artist id', async () => {
    mbGet.mockImplementation(async (path, params) => {
      if (path === '/artist') {
        expect(params.query).toBe('"The Beatles"');
        return { data: { artists: [{ id: 'mbid-beatles', name: 'The Beatles' }] } };
      }
      expect(path).toBe('/release-group');
      expect(params.artist).toBe('mbid-beatles');
      expect(params.type).toBe('album');
      return {
        data: {
          'release-groups': [
            {
              id: 'rg-1',
              title: 'Please Please Me',
              'first-release-date': '1963-03-22',
              tags: [{ name: 'rock' }],
              'primary-type': 'Album'
            }
          ]
        }
      };
    });

    const res = createRes();
    await getAlbums({ body: { artist: 'The Beatles' } }, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        artist: 'The Beatles',
        albums: [
          expect.objectContaining({
            title: 'Please Please Me',
            year: '1963',
            musicBrainzId: 'rg-1'
          })
        ]
      })
    );
  });

  test('returns an empty list when the artist is unknown', async () => {
    mbGet.mockResolvedValue({ data: { artists: [] } });
    const res = createRes();
    await getAlbums({ body: { artist: 'Zzxxyy' } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, albums: [] })
    );
  });

  test('does not report a hard 500 when MusicBrainz is down', async () => {
    mbGet.mockRejectedValue(new Error('MusicBrainz 503'));
    const res = createRes();
    await getAlbums({ body: { artist: 'The Beatles' } }, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/try again/i)
      })
    );
  });
});
