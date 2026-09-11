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
const geocodeAddressFree = jest.fn();

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
  geocodeAddressFree
}));

await jest.unstable_mockModule('../../lib/google-api-key.js', () => ({
  getGoogleBrowserApiKey: jest.fn(() => ''),
  getGoogleServerApiKey: jest.fn(() => 'test-google-key')
}));

const {
  searchWikipedia,
  searchMusicBrainz,
  searchAlbums,
  suggestArtists,
  quickSearch,
  enrichArtist
} = await import('../../controllers/music-research.controller.js');

function mockGeocodePlaces() {
  geocodeAddressFree.mockImplementation(async (address) => {
    const a = String(address || '').toLowerCase();
    if (a.includes('palo alto')) return { latitude: 37.44, longitude: -122.14, display_name: 'Palo Alto' };
    if (a.includes('san francisco')) return { latitude: 37.77, longitude: -122.42, display_name: 'San Francisco' };
    if (a.includes('berkeley')) return { latitude: 37.87, longitude: -122.27, display_name: 'Berkeley' };
    if (a.includes('brooklyn')) return { latitude: 40.68, longitude: -73.94, display_name: 'Brooklyn' };
    if (a.includes('san bruno')) return { latitude: 37.63, longitude: -122.41, display_name: 'San Bruno' };
    if (a.includes('london')) return { latitude: 51.5, longitude: -0.12, display_name: 'London' };
    if (a.includes('cambridge')) return { latitude: 52.2, longitude: 0.12, display_name: 'Cambridge' };
    if (a.includes('birmingham')) return { latitude: 52.48, longitude: -1.9, display_name: 'Birmingham' };
    if (a.includes('toronto')) return { latitude: 43.65, longitude: -79.38, display_name: 'Toronto' };
    return { latitude: 40.0, longitude: -74.0, display_name: address };
  });
}

describe('searchWikipedia', () => {
  beforeEach(() => {
    mbGet.mockReset();
    wikimediaApiGet.mockReset();
  });

  test('returns catalog payload when Wikipedia and MusicBrainz both fail', async () => {
    wikimediaApiGet.mockRejectedValue(new MockWikimediaRateLimitError('429'));
    mbGet.mockResolvedValue({ data: { artists: [] } });

    const req = { body: { artist: 'The Band' } };
    const res = createRes();

    await searchWikipedia(req, res);

    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'The Band',
        source: 'catalog',
        wikipediaRateLimited: true
      })
    );
  }, 20000);

  test('returns degraded 200 for unknown artist when both sources fail', async () => {
    wikimediaApiGet.mockRejectedValue(new MockWikimediaRateLimitError('429'));
    mbGet.mockResolvedValue({ data: { artists: [] } });

    const req = { body: { artist: 'Zzxq Not A Band 99999' } };
    const res = createRes();

    await searchWikipedia(req, res);

    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Zzxq Not A Band 99999',
        degraded: true
      })
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

describe('searchMusicBrainz catalog fallback', () => {
  beforeEach(() => {
    mbGet.mockReset();
  });

  test('returns catalog members when MusicBrainz throws', async () => {
    mbGet.mockRejectedValue(new Error('MusicBrainz 503'));
    const res = createRes();
    await searchMusicBrainz({ body: { artist: 'Grateful Dead' } }, res);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Grateful Dead',
        source: 'catalog',
        bandMembers: expect.arrayContaining([
          expect.objectContaining({ name: 'Jerry Garcia' })
        ])
      })
    );
  });
});

describe('searchAlbums catalog fallback', () => {
  beforeEach(() => {
    mbGet.mockReset();
  });

  test('returns catalog albums when MusicBrainz throws', async () => {
    mbGet.mockRejectedValue(new Error('MusicBrainz 503'));
    const res = createRes();
    await searchAlbums({ body: { artist: 'Pink Floyd' } }, res);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        artist: 'Pink Floyd',
        source: 'catalog',
        albums: expect.arrayContaining([
          expect.objectContaining({ title: 'The Dark Side of the Moon' })
        ])
      })
    );
  });
});

describe('suggestArtists', () => {
  beforeEach(() => {
    mbGet.mockReset();
  });

  test('falls back to catalog when MusicBrainz suggest fails', async () => {
    mbGet.mockRejectedValue(new Error('MusicBrainz 503'));
    const res = createRes();
    await suggestArtists({ query: { q: 'grateful' }, body: {} }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'catalog',
        suggestions: expect.arrayContaining([
          expect.objectContaining({ name: 'Grateful Dead' })
        ])
      })
    );
  });
});

describe('quickSearch', () => {
  beforeEach(() => {
    mbGet.mockReset();
    wikimediaApiGet.mockReset();
    geocodeAddressFree.mockReset();
    mockGeocodePlaces();
  });

  test('returns catalog members and geocoded map pins on initial pull', async () => {
    const res = createRes();
    await quickSearch({ body: { artist: 'Grateful Dead' } }, res);
    expect(mbGet).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Grateful Dead',
        source: 'catalog',
        enriched: false,
        bandMembers: expect.arrayContaining([
          expect.objectContaining({ name: 'Jerry Garcia', birthPlace: 'San Francisco' })
        ]),
        mapData: expect.arrayContaining([
          expect.objectContaining({ eventType: 'formation' }),
          expect.objectContaining({ memberName: 'Jerry Garcia' })
        ])
      })
    );
  });

  test('returns MusicBrainz members with map on initial pull', async () => {
    mbGet.mockImplementation(async (path) => {
      if (path === '/artist') {
        return {
          data: {
            artists: [
              {
                id: 'mbid-xyz',
                name: 'Unknown Band ZZ',
                type: 'Group',
                'life-span': { begin: '1999' },
                'begin-area': { name: 'Austin' }
              }
            ]
          }
        };
      }
      if (String(path).startsWith('/artist/')) {
        return {
          data: {
            id: 'mbid-xyz',
            name: 'Unknown Band ZZ',
            relations: [
              {
                type: 'member',
                direction: 'forward',
                artist: { id: 'm1', name: 'Pat Member', type: 'Person' },
                attributes: ['guitar']
              }
            ]
          }
        };
      }
      return { data: {} };
    });
    const res = createRes();
    await quickSearch({ body: { artist: 'Unknown Band ZZ' } }, res);
    expect(mbGet).toHaveBeenCalledWith('/artist', { query: 'Unknown Band ZZ', limit: 1 });
    expect(mbGet).toHaveBeenCalledWith('/artist/mbid-xyz', { inc: 'artist-rels' });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Unknown Band ZZ',
        birthDate: '1999',
        birthPlace: 'Austin',
        enriched: false,
        source: 'musicbrainz',
        bandMembers: expect.arrayContaining([
          expect.objectContaining({ name: 'Pat Member' })
        ])
      })
    );
  });

  test('returns degraded 200 when MusicBrainz throws', async () => {
    mbGet.mockRejectedValue(new Error('MusicBrainz 503'));
    const res = createRes();
    await quickSearch({ body: { artist: 'Zzxq Not Cataloged 999' } }, res);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Zzxq Not Cataloged 999',
        enriched: false,
        degraded: true
      })
    );
  });
});

describe('enrichArtist', () => {
  beforeEach(() => {
    mbGet.mockReset();
    wikimediaApiGet.mockReset();
    geocodeAddressFree.mockReset();
    mockGeocodePlaces();
  });

  test('returns wiki summary, members, and albums without per-member wiki', async () => {
    wikimediaApiGet.mockImplementation(async (url) => {
      if (String(url).includes('list=search') || String(url).includes('srsearch')) {
        return { data: { query: { search: [{ title: 'The Band' }] } } };
      }
      if (String(url).includes('rest_v1/page/summary')) {
        return {
          data: {
            extract: 'Canadian-American rock group.',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/The_Band' } }
          }
        };
      }
      return { data: {} };
    });

    mbGet.mockImplementation(async (path) => {
      if (path === '/artist') {
        return mbGroupArtistSearch;
      }
      if (String(path).startsWith('/artist/')) {
        return {
          data: {
            id: 'mbid-band',
            name: 'The Band',
            relations: [
              {
                type: 'member',
                direction: 'forward',
                artist: { id: 'm1', name: 'Robbie Robertson', type: 'Person' },
                attributes: ['guitar']
              }
            ]
          }
        };
      }
      if (path === '/release-group') {
        return {
          data: {
            'release-groups': [
              {
                id: 'rg-1',
                title: 'Music from Big Pink',
                'first-release-date': '1968-07-01',
                'primary-type': 'Album'
              }
            ]
          }
        };
      }
      return { data: {} };
    });

    const res = createRes();
    await enrichArtist({ body: { artist: 'The Band' } }, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        enriched: true,
        name: 'The Band',
        description: expect.stringContaining('Canadian-American'),
        bandMembers: expect.arrayContaining([
          expect.objectContaining({ name: 'Robbie Robertson' })
        ]),
        albums: expect.arrayContaining([
          expect.objectContaining({ title: 'Music from Big Pink' })
        ])
      })
    );

    const wikiCalls = wikimediaApiGet.mock.calls.map((c) => String(c[0]));
    expect(wikiCalls.some((u) => u.includes('srsearch') || u.includes('list=search'))).toBe(true);
    expect(wikiCalls.some((u) => u.includes('Robbie'))).toBe(false);
  });

  test('returns 200 with catalog when Wikipedia rate-limits and MB fails', async () => {
    wikimediaApiGet.mockRejectedValue(new MockWikimediaRateLimitError('429'));
    mbGet.mockRejectedValue(new Error('MusicBrainz 503'));

    const res = createRes();
    await enrichArtist({ body: { artist: 'Pink Floyd' } }, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        enriched: true,
        name: 'Pink Floyd',
        degraded: true,
        wikipediaRateLimited: true,
        bandMembers: expect.arrayContaining([
          expect.objectContaining({ name: 'David Gilmour' })
        ]),
        mapData: expect.arrayContaining([
          expect.objectContaining({ eventType: 'formation' })
        ])
      })
    );
    const payload = res.json.mock.calls[0][0];
    expect(payload.mapData.some((pin) => pin.memberName === 'David Gilmour' || pin.memberName === 'Syd Barrett' || pin.name)).toBe(true);
  });
});

