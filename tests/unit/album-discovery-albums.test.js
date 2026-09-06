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

const { getAlbums, matchIdentifiedAlbumOnMusicBrainz } = await import('../../controllers/album-discovery.controller.js');

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

  test('matchIdentifiedAlbumOnMusicBrainz confirms title and artist', async () => {
    mbGet.mockResolvedValue({
      data: {
        'release-groups': [
          {
            id: 'rg-abbey',
            title: 'Abbey Road',
            'first-release-date': '1969-09-26',
            tags: [{ name: 'rock' }],
            'primary-type': 'Album',
            'artist-credit': [{ name: 'The Beatles' }]
          }
        ]
      }
    });

    const match = await matchIdentifiedAlbumOnMusicBrainz('Abbey Road', 'The Beatles');
    expect(mbGet).toHaveBeenCalledWith(
      '/release-group',
      expect.objectContaining({
        query: 'releasegroup:"Abbey Road" AND artist:"The Beatles"'
      })
    );
    expect(match).toEqual(
      expect.objectContaining({
        title: 'Abbey Road',
        artist: 'The Beatles',
        year: '1969',
        musicBrainzId: 'rg-abbey'
      })
    );
  });

  test('matchIdentifiedAlbumOnMusicBrainz returns null when no release groups', async () => {
    mbGet.mockResolvedValue({ data: { 'release-groups': [] } });
    await expect(matchIdentifiedAlbumOnMusicBrainz('Nope', 'Nobody')).resolves.toBeNull();
  });

  test('matchIdentifiedAlbumOnMusicBrainz returns null without a title', async () => {
    await expect(matchIdentifiedAlbumOnMusicBrainz('', 'The Beatles')).resolves.toBeNull();
    expect(mbGet).not.toHaveBeenCalled();
  });
});
