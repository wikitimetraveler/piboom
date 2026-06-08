/**
 * MusicBrainz helpers for music graph seeding.
 */
import { mbGet } from './musicbrainz.service.js';

export function slugifyName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function artistExternalId(mbid, name) {
  const id = String(mbid || '').trim();
  if (id) return id;
  const slug = slugifyName(name);
  return slug ? `slug:${slug}` : 'slug:unknown';
}

export function albumExternalId(musicbrainzId, recordId) {
  const mbid = String(musicbrainzId || '').trim();
  if (mbid) return mbid;
  return `record:${recordId}`;
}

function extractInstrument(relation) {
  if (relation.attributes?.length) return relation.attributes.join(', ');
  return null;
}

function mapMemberRelation(relation) {
  const member = relation.artist;
  if (!member?.id) return null;
  return {
    name: member.name,
    mbid: member.id,
    type: member.type || 'Person',
    instrument: extractInstrument(relation),
    begin: relation.begin || null,
    end: relation.end || null
  };
}

/**
 * Extract band members from MusicBrainz artist-rels payload.
 * @param {object} detailedArtist
 * @returns {Array<{ name, mbid, type, instrument, begin, end }>}
 */
export function parseBandMembersFromRelations(detailedArtist) {
  const members = [];
  const seen = new Set();

  for (const relation of detailedArtist?.relations || []) {
    const isMember =
      (relation.type === 'member' && (!relation.direction || relation.direction === 'forward')) ||
      (relation.type === 'member of band' &&
        relation.direction === 'backward' &&
        detailedArtist.type === 'Group') ||
      (relation.type === 'member of band' && relation.artist && !relation.direction);

    if (!isMember) continue;

    const mapped = mapMemberRelation(relation);
    if (!mapped || seen.has(mapped.mbid)) continue;
    seen.add(mapped.mbid);
    members.push(mapped);
  }

  return members;
}

export async function searchArtistByName(artistName) {
  const query = String(artistName || '').trim();
  if (!query) return null;

  const searchResponse = await mbGet('/artist', { query, limit: 1 });
  const artistData = searchResponse.data?.artists?.[0];
  if (!artistData) return null;

  return {
    name: artistData.name,
    mbid: artistData.id,
    type: artistData.type || 'Unknown',
    disambiguation: artistData.disambiguation || null
  };
}

export async function getArtistWithMembers(mbid) {
  const id = String(mbid || '').trim();
  if (!id) return { artist: null, members: [] };

  const detailResponse = await mbGet(`/artist/${id}`, { inc: 'artist-rels' });
  const detailedArtist = detailResponse.data;
  if (!detailedArtist) return { artist: null, members: [] };

  return {
    artist: {
      name: detailedArtist.name,
      mbid: detailedArtist.id,
      type: detailedArtist.type || 'Unknown',
      disambiguation: detailedArtist.disambiguation || null
    },
    members: parseBandMembersFromRelations(detailedArtist)
  };
}

export async function resolveArtistForGraph(artistName, knownMbid = null) {
  const mbid = String(knownMbid || '').trim();
  if (mbid) {
    try {
      const { artist, members } = await getArtistWithMembers(mbid);
      if (artist) return { artist, members };
    } catch (error) {
      console.warn(`MusicBrainz artist lookup failed for ${mbid}:`, error.message);
    }
  }

  try {
    const found = await searchArtistByName(artistName);
    if (!found) {
      return {
        artist: {
          name: String(artistName || '').trim(),
          mbid: null,
          type: 'Unknown',
          disambiguation: null
        },
        members: []
      };
    }
    const { artist, members } = await getArtistWithMembers(found.mbid);
    return { artist: artist || found, members };
  } catch (error) {
    console.warn(`MusicBrainz search failed for ${artistName}:`, error.message);
    return {
      artist: {
        name: String(artistName || '').trim(),
        mbid: null,
        type: 'Unknown',
        disambiguation: null
      },
      members: []
    };
  }
}
