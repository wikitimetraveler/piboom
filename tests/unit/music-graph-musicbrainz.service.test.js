/**
 * Development work by David Lane
 */
import { describe, test, expect } from '@jest/globals';
import {
  slugifyName,
  artistExternalId,
  albumExternalId,
  parseBandMembersFromRelations
} from '../../services/music-graph-musicbrainz.service.js';

describe('music-graph-musicbrainz.service', () => {
  test('slugifyName normalizes artist names', () => {
    expect(slugifyName('Grateful Dead')).toBe('grateful-dead');
    expect(slugifyName('  Bob Dylan  ')).toBe('bob-dylan');
  });

  test('artistExternalId prefers mbid', () => {
    expect(artistExternalId('abc-123', 'Grateful Dead')).toBe('abc-123');
    expect(artistExternalId(null, 'Grateful Dead')).toBe('slug:grateful-dead');
  });

  test('albumExternalId prefers musicbrainz id', () => {
    expect(albumExternalId('release-mbid', 42)).toBe('release-mbid');
    expect(albumExternalId(null, 42)).toBe('record:42');
  });

  test('parseBandMembersFromRelations extracts forward member rels', () => {
    const members = parseBandMembersFromRelations({
      type: 'Group',
      relations: [
        {
          type: 'member',
          direction: 'forward',
          artist: { id: 'm1', name: 'Jerry Garcia', type: 'Person' },
          attributes: ['guitar', 'vocals']
        },
        {
          type: 'member of band',
          direction: 'backward',
          artist: { id: 'm2', name: 'Bob Weir', type: 'Person' }
        }
      ]
    });

    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({ mbid: 'm1', instrument: 'guitar, vocals' });
    expect(members[1].mbid).toBe('m2');
  });
});
