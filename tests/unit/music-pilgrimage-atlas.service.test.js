/**
 * Development work by David Lane
 */
import { describe, test, expect } from '@jest/globals';
import {
  parseSetlistPreview,
  buildMapBounds,
  normalizeAtlasQuery,
  formatStopRow,
} from '../../services/music-pilgrimage-atlas.service.js';
import {
  isValidClientId,
  normalizeBookmarkType,
  normalizeRouteConfig,
  normalizeRouteLabel,
} from '../../services/music-pilgrimage-personal.service.js';

describe('music-pilgrimage-atlas.service', () => {
  test('parseSetlistPreview extracts song names', () => {
    const raw = JSON.stringify([
      { song: [{ name: 'Bertha' }, { name: 'Good Lovin\'' }] },
      { song: [{ name: 'Scarlet Begonias' }] },
    ]);
    expect(parseSetlistPreview(raw)).toBe("Bertha · Good Lovin' · Scarlet Begonias");
  });

  test('buildMapBounds from stops', () => {
    const bounds = buildMapBounds([
      { lat: 40, lng: -120 },
      { lat: 38, lng: -122 },
      { lat: null, lng: null },
    ]);
    expect(bounds).toEqual({ north: 40, south: 38, east: -120, west: -122 });
  });

  test('normalizeAtlasQuery caps limit and parses filters', () => {
    const q = normalizeAtlasQuery({ year: '1977', city: 'Berkeley', limit: '9999', mode: 'city' });
    expect(q.year).toBe(1977);
    expect(q.city).toBe('Berkeley');
    expect(q.limit).toBe(500);
    expect(q.mode).toBe('city');
  });

  test('formatStopRow includes enrichments', () => {
    const row = formatStopRow(
      {
        id: 1,
        show_date: '1977-05-08',
        venue_name: 'Barton Hall',
        city: 'Ithaca',
        state: 'NY',
        country: 'USA',
        latitude: 42.44,
        longitude: -76.48,
        setlist: '[]',
        recording_available: true,
        archive_identifier: null,
        notes: 'Legendary show',
      },
      3
    );
    expect(row.routeOrder).toBe(3);
    expect(row.enrichments.timeMachineUrl).toContain('1977-05-08');
    expect(row.enrichments.youtubeSearch).toContain('youtube.com');
  });
});

describe('music-pilgrimage-personal.service', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  test('isValidClientId', () => {
    expect(isValidClientId(validUuid)).toBe(true);
    expect(isValidClientId('bad')).toBe(false);
  });

  test('normalizeBookmarkType', () => {
    expect(normalizeBookmarkType('wishlist')).toBe('wishlist');
    expect(normalizeBookmarkType('invalid')).toBeNull();
  });

  test('normalizeRouteConfig keeps allowed keys only', () => {
    expect(normalizeRouteConfig({ year: 1977, city: 'SF', foo: 'bar' })).toEqual({
      year: 1977,
      city: 'SF',
    });
  });

  test('normalizeRouteLabel trims and rejects empty', () => {
    expect(normalizeRouteLabel('  West Coast 1977  ')).toBe('West Coast 1977');
    expect(normalizeRouteLabel('')).toBeNull();
  });
});
