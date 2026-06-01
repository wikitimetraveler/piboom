/**
 * Shared mocks for Music Research unit tests.
 */
import { jest } from '@jest/globals';

export class MockWikimediaRateLimitError extends Error {
  constructor(msg = 'Wikimedia rate limit exceeded') {
    super(msg);
    this.name = 'WikimediaRateLimitError';
    this.rateLimited = true;
  }
}

export function createRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

export const defaultGeocodeResult = {
  latitude: 43.65,
  longitude: -79.38,
  display_name: 'Toronto, ON'
};

export const mbGroupArtistSearch = {
  data: {
    artists: [
      {
        id: 'mbid-band',
        name: 'The Band',
        type: 'Group',
        'life-span': { begin: '1967' },
        'begin-area': { name: 'Toronto' }
      }
    ]
  }
};

export const mbPersonArtistSearch = {
  data: {
    artists: [
      {
        id: 'mbid-person',
        name: 'Bob Dylan',
        type: 'Person',
        'life-span': { begin: '1941-05-24' },
        'begin-area': { name: 'Duluth' },
        area: { name: 'United States' }
      }
    ]
  }
};

export function mbGetEmpty() {
  return jest.fn().mockResolvedValue({ data: { artists: [] } });
}
