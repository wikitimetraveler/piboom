/**
 * Development work by David Lane
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  createRes,
  MockWikimediaRateLimitError,
  mbGroupArtistSearch
} from '../helpers/music-research-mocks.js';

const mbGet = jest.fn();
const wikimediaApiGet = jest.fn();

await jest.unstable_mockModule('../../services/musicbrainz.service.js', () => ({
  mbGet,
  MUSICBRAINZ_USER_AGENT: 'test-agent'
}));

await jest.unstable_mockModule('../../services/music-research-wikimedia.service.js', () => ({
  wikimediaApiGet,
  wikidataApiGet: wikimediaApiGet,
  WikimediaRateLimitError: MockWikimediaRateLimitError
}));

await jest.unstable_mockModule('../../services/free-geocoding.service.js', () => ({
  geocodeAddressFree: jest.fn()
}));

await jest.unstable_mockModule('../../lib/google-api-key.js', () => ({
  getGoogleBrowserApiKey: jest.fn(() => ''),
  getGoogleServerApiKey: jest.fn(() => 'test-google-key')
}));

const { searchWikipedia } = await import('../../controllers/music-research.controller.js');

describe('searchWikipedia', () => {
  beforeEach(() => {
    mbGet.mockReset();
    wikimediaApiGet.mockReset();
  });

  test('returns 503 when Wikipedia and MusicBrainz both fail', async () => {
    wikimediaApiGet.mockRejectedValue(new MockWikimediaRateLimitError('429'));
    mbGet.mockResolvedValue({ data: { artists: [] } });

    const req = { body: { artist: 'The Band' } };
    const res = createRes();

    await searchWikipedia(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ rateLimited: true })
    );
  }, 20000);

  test('returns MusicBrainz payload when Wikipedia is rate limited', async () => {
    wikimediaApiGet.mockRejectedValue(new MockWikimediaRateLimitError('429'));
    mbGet.mockImplementation(async (path) => {
      if (path === '/artist') {
        return mbGroupArtistSearch;
      }
      return { data: { relations: [] } };
    });

    const req = { body: { artist: 'The Band' } };
    const res = createRes();

    await searchWikipedia(req, res);

    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'The Band',
        birthDate: '1967',
        birthPlace: 'Toronto',
        wikipediaRateLimited: true,
        url: expect.stringContaining('musicbrainz.org')
      })
    );
  }, 20000);

  test('fills birthDate from MusicBrainz when Wikidata birthDate is Unknown', async () => {
    wikimediaApiGet.mockImplementation(async (url) => {
      if (url.includes('list=search') || url.includes('srsearch')) {
        return { data: { query: { search: [{ title: 'The Band' }] } } };
      }
      if (url.includes('rest_v1/page/summary')) {
        return {
          data: {
            extract: 'Canadian-American rock group.',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/The_Band' } }
          }
        };
      }
      if (url.includes('pageprops')) {
        return {
          data: {
            query: {
              pages: {
                '1': {
                  title: 'The Band',
                  pageprops: { wikibase_item: 'Q123' }
                }
              }
            }
          }
        };
      }
      if (url.includes('wbgetentities')) {
        if (url.includes('props=labels')) {
          return { data: { entities: {} } };
        }
        return {
          data: {
            entities: {
              Q123: { claims: {} }
            }
          }
        };
      }
      return { data: {} };
    });

    mbGet.mockImplementation(async (path) => {
      if (path === '/artist') {
        return {
          data: {
            artists: [
              {
                ...mbGroupArtistSearch.data.artists[0],
                'life-span': { begin: '1968' }
              }
            ]
          }
        };
      }
      return { data: { relations: [] } };
    });

    const req = { body: { artist: 'The Band' } };
    const res = createRes();

    await searchWikipedia(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'The Band',
        birthDate: '1968',
        birthPlace: 'Toronto'
      })
    );
  }, 15000);
});
