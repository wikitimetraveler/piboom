/**
 * Local artist catalog for Music Research when Wikipedia / MusicBrainz are down.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isMissingArtistField } from './music-research-musicbrainz.service.js';

const catalogPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/music-research-catalog.json'
);

let cachedArtists = null;

function loadArtists() {
  if (cachedArtists) return cachedArtists;
  try {
    const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    cachedArtists = Array.isArray(raw?.artists) ? raw.artists : [];
  } catch (error) {
    console.error('Music research catalog failed to load:', error.message);
    cachedArtists = [];
  }
  return cachedArtists;
}

export function normalizeArtistQuery(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function catalogAliases(artist) {
  const names = [artist?.name, ...(artist?.aliases || [])];
  return names.map(normalizeArtistQuery).filter(Boolean);
}

export function findCatalogArtist(name) {
  const q = normalizeArtistQuery(name);
  if (!q) return null;
  const artists = loadArtists();
  const exact = artists.find((artist) => catalogAliases(artist).includes(q));
  if (exact) return exact;
  return artists.find((artist) => catalogAliases(artist).some((alias) => alias.includes(q) || q.includes(alias))) || null;
}

export function suggestCatalogArtists(query, limit = 8) {
  const q = normalizeArtistQuery(query);
  if (!q) return [];
  return loadArtists()
    .filter((artist) => catalogAliases(artist).some((alias) => alias.includes(q) || q.includes(alias)))
    .slice(0, limit)
    .map((artist) => ({
      name: artist.name,
      type: artist.type || (artist.isBand ? 'Group' : 'Person'),
      disambiguation: '',
      mbid: artist.mbid || '',
      source: 'catalog'
    }));
}

function withMemberDefaults(member) {
  return {
    name: member.name,
    instrument: member.instrument || 'Unknown',
    birthPlace: member.birthPlace || 'Unknown',
    birthDate: member.birthDate || 'Unknown',
    deathDate: member.deathDate || null,
    deathPlace: member.deathPlace || null,
    associatedActs: member.associatedActs || [],
    imageUrl: member.imageUrl || null,
    equipment: member.equipment || []
  };
}

export function catalogToWikipediaResult(catalog) {
  if (!catalog) return null;
  return {
    name: catalog.name,
    description: catalog.description,
    genre: catalog.genre || 'Various',
    birthDate: catalog.birthDate || 'Unknown',
    birthPlace: catalog.birthPlace || 'Unknown',
    bandMembers: (catalog.bandMembers || []).map(withMemberDefaults),
    url: catalog.url || '',
    image: catalog.image || '',
    source: 'catalog'
  };
}

export function catalogToKgResult(catalog, artistName) {
  const wiki = catalogToWikipediaResult(catalog);
  if (!wiki) {
    return {
      success: true,
      name: artistName,
      description: `${artistName} is a music artist.`,
      detailedDescription: `${artistName} is a music artist.`,
      genre: 'Music',
      birthDate: 'Not specified',
      birthPlace: 'Not specified',
      bandMembers: [],
      url: '',
      image: '',
      imageUrl: '',
      degraded: true
    };
  }
  return {
    success: true,
    name: wiki.name,
    description: wiki.description,
    detailedDescription: wiki.description,
    genre: wiki.genre,
    birthDate: wiki.birthDate,
    birthPlace: wiki.birthPlace,
    bandMembers: wiki.bandMembers,
    url: wiki.url,
    image: wiki.image,
    imageUrl: wiki.image,
    source: 'catalog'
  };
}

export function catalogToAlbumResult(catalog) {
  if (!catalog) return null;
  const albums = (catalog.albums || []).map((album, index) => ({
    id: album.id || `catalog-${normalizeArtistQuery(catalog.name)}-${index}`,
    title: album.title,
    year: album.year || 'Unknown',
    releaseDate: album.releaseDate || (album.year ? `${album.year}-01-01` : '9999-12-31'),
    type: album.type || 'Album',
    coverArt: album.coverArt || '',
    coverArtLarge: album.coverArtLarge || '',
    artist: catalog.name
  }));
  return {
    artist: catalog.name,
    albums,
    total: albums.length,
    source: 'catalog'
  };
}

export function mergeCatalogMemberDetails(members, catalog) {
  if (!catalog?.bandMembers?.length) return members || [];
  const byName = new Map(
    catalog.bandMembers.map((member) => [normalizeArtistQuery(member.name), member])
  );
  return (members || []).map((member) => {
    const extra = byName.get(normalizeArtistQuery(member.name));
    if (!extra) return member;
    const out = { ...member };
    if (isMissingArtistField(out.birthDate) && extra.birthDate) out.birthDate = extra.birthDate;
    if (isMissingArtistField(out.birthPlace) && extra.birthPlace) out.birthPlace = extra.birthPlace;
    if (isMissingArtistField(out.instrument) && extra.instrument) out.instrument = extra.instrument;
    return out;
  });
}

export function catalogToMusicBrainzResult(catalog) {
  if (!catalog) return null;
  return {
    name: catalog.name,
    mbid: catalog.mbid || '',
    type: catalog.type || (catalog.isBand ? 'Group' : 'Person'),
    country: '',
    beginDate: catalog.birthPlace || 'Unknown',
    bandMembers: (catalog.bandMembers || []).map(withMemberDefaults),
    source: 'catalog'
  };
}

export function catalogToArtistInfo(catalog) {
  if (!catalog) return null;
  return {
    name: catalog.name,
    birthPlace: catalog.birthPlace || 'Unknown',
    birthDate: catalog.birthDate || 'Unknown',
    bandMembers: (catalog.bandMembers || []).map(withMemberDefaults),
    isBand: catalog.isBand === true,
    mbid: catalog.mbid,
    coordinates: catalog.coordinates || null
  };
}

export function catalogMapSeed(catalog) {
  if (!catalog?.coordinates) return { mapData: [], timelineEvents: [] };
  const eventType = catalog.isBand ? 'formation' : 'birth';
  const mapData = [{
    name: catalog.birthPlace,
    lat: catalog.coordinates.lat,
    lng: catalog.coordinates.lng,
    eventType
  }];
  const timelineEvents = [{
    date: catalog.birthDate || 'Unknown',
    title: catalog.isBand ? `Formed: ${catalog.name}` : `Born: ${catalog.name}`,
    description: catalog.isBand ? `Formation of ${catalog.name}` : `Birth of ${catalog.name}`,
    location: catalog.birthPlace || 'Unknown',
    type: eventType,
    coordinates: { lat: catalog.coordinates.lat, lng: catalog.coordinates.lng }
  }];
  return { mapData, timelineEvents };
}

export function applyCatalogFallback(artistInfo, catalog) {
  if (!catalog || !artistInfo) return artistInfo;
  const out = { ...artistInfo };
  if (isMissingArtistField(out.birthDate) && !isMissingArtistField(catalog.birthDate)) {
    out.birthDate = catalog.birthDate;
  }
  if (isMissingArtistField(out.birthPlace) && !isMissingArtistField(catalog.birthPlace)) {
    out.birthPlace = catalog.birthPlace;
  }
  if ((!out.bandMembers || !out.bandMembers.length) && catalog.bandMembers?.length) {
    out.bandMembers = catalog.bandMembers.map(withMemberDefaults);
  }
  if (catalog.isBand !== undefined && out.isBand === undefined) out.isBand = catalog.isBand;
  if (catalog.mbid && !out.mbid) out.mbid = catalog.mbid;
  if (catalog.coordinates && !out.coordinates) out.coordinates = catalog.coordinates;
  if (
    !out.description ||
    out.description === 'No Wikipedia page found' ||
    out.description === 'No description available'
  ) {
    out.description = catalog.description;
  }
  return out;
}

const RELEASE_TITLE_RE = /\((album|ep|song|single|soundtrack|compilation|live album|box set)\)/i;

export function isWikipediaReleaseTitle(title) {
  return RELEASE_TITLE_RE.test(String(title || ''));
}

export function pickWikipediaArtistHit(hits, artistName) {
  const list = Array.isArray(hits) ? hits : [];
  if (!list.length) return null;
  const want = normalizeArtistQuery(artistName);
  const notRelease = list.filter((hit) => !isWikipediaReleaseTitle(hit.title));
  const exact = notRelease.find((hit) => normalizeArtistQuery(hit.title) === want);
  if (exact) return exact;
  if (notRelease.length) return notRelease[0];
  return null;
}
