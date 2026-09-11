/**
 * Development work by David Lane
 */
import { describe, test, expect } from '@jest/globals';
import {
  findCatalogArtist,
  suggestCatalogArtists,
  pickWikipediaArtistHit,
  mergeCatalogMemberDetails
} from '../../services/music-research-catalog.service.js';

describe('music-research-catalog.service', () => {
  test('findCatalogArtist matches aliases', () => {
    const artist = findCatalogArtist('the dead');
    expect(artist?.name).toBe('Grateful Dead');
  });

  test('suggestCatalogArtists returns backup matches', () => {
    const rows = suggestCatalogArtists('floyd');
    expect(rows.some((row) => row.name === 'Pink Floyd')).toBe(true);
  });

  test('pickWikipediaArtistHit skips album pages', () => {
    const hit = pickWikipediaArtistHit(
      [
        { title: 'Grateful Dead (album)' },
        { title: 'Grateful Dead' }
      ],
      'Grateful Dead'
    );
    expect(hit.title).toBe('Grateful Dead');
  });

  test('mergeCatalogMemberDetails fills missing birth fields', () => {
    const catalog = findCatalogArtist('Grateful Dead');
    const merged = mergeCatalogMemberDetails(
      [{ name: 'Jerry Garcia', birthDate: 'Unknown', birthPlace: 'Unknown', instrument: 'guitar' }],
      catalog
    );
    expect(merged[0].birthDate).toBe('1942');
    expect(merged[0].birthPlace).toBe('San Francisco');
  });
});
