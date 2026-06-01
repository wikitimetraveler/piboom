/**
 * Development work by David Lane
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  createRes,
  MockWikimediaRateLimitError,
  defaultGeocodeResult,
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
  applyMusicBrainzFallback,
  formatMusicBrainzDate,
  mapMusicBrainzArtist,
  isMissingArtistField,
  enrichMemberBirthDatesFromMusicBrainz
} = await import('../../services/music-research-musicbrainz.service.js');

const { getMapData } = await import('../../controllers/music-research.controller.js');

describe('music-research-musicbrainz.service', () => {
  beforeEach(() => {
    mbGet.mockReset();
  });

  test('formatMusicBrainzDate extracts year', () => {
    expect(formatMusicBrainzDate('1940-01-15')).toBe('1940');
    expect(formatMusicBrainzDate('')).toBe('Unknown');
  });

  test('isMissingArtistField treats Unknown and Not specified as missing', () => {
    expect(isMissingArtistField('Unknown')).toBe(true);
    expect(isMissingArtistField('Not specified')).toBe(true);
    expect(isMissingArtistField('')).toBe(true);
    expect(isMissingArtistField('1950')).toBe(false);
  });

  test('mapMusicBrainzArtist maps Group as band with formation fields', () => {
    const mapped = mapMusicBrainzArtist(mbGroupArtistSearch.data.artists[0]);
    expect(mapped.isBand).toBe(true);
    expect(mapped.birthDate).toBe('1967');
    expect(mapped.birthPlace).toBe('Toronto');
    expect(mapped.mbid).toBe('mbid-band');
  });

  test('mapMusicBrainzArtist maps Person as solo artist', () => {
    const mapped = mapMusicBrainzArtist({
      id: 'mbid-solo',
      name: 'Bob Dylan',
      type: 'Person',
      'life-span': { begin: '1941-05-24' },
      'begin-area': { name: 'Duluth' }
    });
    expect(mapped.isBand).toBe(false);
    expect(mapped.birthDate).toBe('1941');
    expect(mapped.birthPlace).toBe('Duluth');
  });

  test('applyMusicBrainzFallback fills only missing fields', () => {
    const merged = applyMusicBrainzFallback(
      { birthDate: 'Unknown', birthPlace: 'London', name: 'Test' },
      { birthDate: '1940', birthPlace: 'Toronto', isBand: false, mbid: 'mbid-1' }
    );
    expect(merged.birthDate).toBe('1940');
    expect(merged.birthPlace).toBe('London');
    expect(merged.mbid).toBe('mbid-1');
  });

  test('applyMusicBrainzFallback does not overwrite Wikidata values', () => {
    const merged = applyMusicBrainzFallback(
      { birthDate: '1950', birthPlace: 'Hibbing', name: 'Bob Dylan' },
      { birthDate: '1940', birthPlace: 'Toronto', isBand: false, mbid: 'mbid-1' }
    );
    expect(merged.birthDate).toBe('1950');
    expect(merged.birthPlace).toBe('Hibbing');
  });
});

describe('enrichMemberBirthDatesFromMusicBrainz', () => {
  beforeEach(() => {
    mbGet.mockReset();
  });

  test('fills birthDate from mbid lookup', async () => {
    mbGet.mockResolvedValue({
      data: {
        id: 'mbid-abc',
        'life-span': { begin: '1943-05-24' },
        'begin-area': { name: 'Toronto' }
      }
    });

    const out = await enrichMemberBirthDatesFromMusicBrainz([
      { name: 'Rick Danko', mbid: 'mbid-abc', birthDate: 'Unknown', birthPlace: 'Unknown' }
    ]);

    expect(mbGet).toHaveBeenCalledWith('/artist/mbid-abc');
    expect(out[0].birthDate).toBe('1943');
    expect(out[0].birthPlace).toBe('Toronto');
  });
});

describe('getMapData MusicBrainz fallback', () => {
  beforeEach(() => {
    mbGet.mockReset();
    wikimediaApiGet.mockReset();
    geocodeAddressFree.mockReset();
    wikimediaApiGet.mockRejectedValue(new MockWikimediaRateLimitError('429'));
    geocodeAddressFree.mockResolvedValue(defaultGeocodeResult);
    mbGet.mockImplementation(async (path) => {
      if (path === '/artist') {
        return mbGroupArtistSearch;
      }
      return { data: { relations: [] } };
    });
  });

  test('returns 200 with wikipediaRateLimited when Wikipedia 429 and MB succeeds', async () => {
    const req = { body: { artist: 'The Band' } };
    const res = createRes();

    await getMapData(req, res);

    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        wikipediaRateLimited: true,
        mapData: expect.arrayContaining([
          expect.objectContaining({ eventType: 'formation' })
        ]),
        timelineEvents: expect.arrayContaining([
          expect.objectContaining({ date: '1967' })
        ])
      })
    );
  }, 20000);

  test('merges MB birthDate when Wikidata returns Unknown via Wikipedia path', async () => {
    wikimediaApiGet.mockImplementation(async (url) => {
      if (url.includes('list=search') || url.includes('srsearch')) {
        return { data: { query: { search: [{ title: 'The Band' }] } } };
      }
      if (url.includes('pageprops')) {
        return { data: { query: { pages: { '1': { title: 'The Band' } } } } };
      }
      return { data: {} };
    });

    mbGet.mockImplementation(async (path) => {
      if (path === '/artist') {
        return mbGroupArtistSearch;
      }
      return { data: { relations: [] } };
    });

    const req = { body: { artist: 'The Band' } };
    const res = createRes();

    await getMapData(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mapData: expect.arrayContaining([
          expect.objectContaining({ eventType: 'formation' })
        ]),
        timelineEvents: expect.arrayContaining([
          expect.objectContaining({ date: '1967' })
        ])
      })
    );
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('wikipediaRateLimited');
  }, 15000);
});
