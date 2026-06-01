/**
 * MusicBrainz fallbacks for Music Research (birth dates / places).
 */
import { mbGet } from './musicbrainz.service.js';

export function isMissingArtistField(value) {
  const v = String(value || '').trim();
  return !v || v === 'Unknown' || v === 'Not specified';
}

/** Normalize life-span.begin (e.g. 1940-01-15 → 1940). */
export function formatMusicBrainzDate(iso) {
  if (!iso) return 'Unknown';
  const m = String(iso).match(/^(\d{4})/);
  return m ? m[1] : 'Unknown';
}

export function mapMusicBrainzArtist(artistData) {
  if (!artistData) return null;
  const type = artistData.type || '';
  const birthPlace = artistData['begin-area']?.name || artistData.area?.name || 'Unknown';
  return {
    name: artistData.name,
    mbid: artistData.id,
    type,
    isBand: type === 'Group',
    birthDate: formatMusicBrainzDate(artistData['life-span']?.begin),
    birthPlace
  };
}

export async function getMusicBrainzArtistByName(artistName) {
  try {
    const response = await mbGet('/artist', { query: artistName, limit: 1 });
    const artistData = response.data?.artists?.[0];
    if (!artistData) return null;
    return mapMusicBrainzArtist(artistData);
  } catch (error) {
    console.error('MusicBrainz artist lookup failed:', error.message);
    return null;
  }
}

/** Fill only missing birthDate / birthPlace / mbid / isBand on artistInfo. */
export function applyMusicBrainzFallback(artistInfo, mb) {
  if (!mb || !artistInfo) return artistInfo;
  const out = { ...artistInfo };
  if (isMissingArtistField(out.birthDate) && !isMissingArtistField(mb.birthDate)) {
    out.birthDate = mb.birthDate;
  }
  if (isMissingArtistField(out.birthPlace) && !isMissingArtistField(mb.birthPlace)) {
    out.birthPlace = mb.birthPlace;
  }
  if (mb.mbid && !out.mbid) out.mbid = mb.mbid;
  if (mb.isBand !== undefined && out.isBand === undefined) out.isBand = mb.isBand;
  return out;
}

/** Set birthDate / birthPlace from MB artist record when member has mbid. */
export async function enrichMemberBirthDatesFromMusicBrainz(members) {
  const out = [];
  for (const member of (members || []).slice(0, 10)) {
    let m = { ...member };
    if (m.mbid && isMissingArtistField(m.birthDate)) {
      try {
        const res = await mbGet(`/artist/${m.mbid}`);
        const data = res.data;
        const date = formatMusicBrainzDate(data['life-span']?.begin);
        if (!isMissingArtistField(date)) m.birthDate = date;
        if (isMissingArtistField(m.birthPlace)) {
          const place = data['begin-area']?.name || data.area?.name;
          if (place) m.birthPlace = place;
        }
      } catch (error) {
        console.warn(`MusicBrainz member date lookup failed for ${m.name}:`, error.message);
      }
    }
    out.push(m);
  }
  return out;
}
