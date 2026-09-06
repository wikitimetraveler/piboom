import {
  clampMaxAlbums,
  parseVisionAlbumsFromText,
  parseVisionSingleAlbum,
  normalizeAlbumEntry,
  buildSingleAlbumVisionPrompt,
  buildShelfVisionPrompt,
  extractAlbumInfoFromText,
} from '../../services/album-discovery-vision.service.js';

describe('album-discovery-vision.service', () => {
  test('clampMaxAlbums bounds 1–6', () => {
    expect(clampMaxAlbums(0)).toBe(1);
    expect(clampMaxAlbums(3)).toBe(3);
    expect(clampMaxAlbums(6)).toBe(6);
    expect(clampMaxAlbums(99)).toBe(6);
    expect(clampMaxAlbums('bad', 6)).toBe(6);
  });

  test('parseVisionAlbumsFromText reads albums array', () => {
    const text = `{
      "albums": [
        { "albumName": "Voulez-Vous", "artistName": "ABBA", "year": "1979", "estimatedValue": 12 },
        { "albumName": "You Can Dance", "artistName": "Madonna", "year": "1987", "confidence": "high" }
      ]
    }`;
    const albums = parseVisionAlbumsFromText(text);
    expect(albums).toHaveLength(2);
    expect(albums[0].albumName).toBe('Voulez-Vous');
    expect(albums[1].artistName).toBe('Madonna');
    expect(albums[1].confidence).toBe('high');
    expect(albums[0].estimatedValue).toBeNull();
    expect(albums[0].genre).toBe('');
    expect(albums[0].description).toBe('');
  });

  test('parseVisionSingleAlbum accepts single object', () => {
    const text = '{"albumName":"Dark Side of the Moon","artistName":"Pink Floyd","year":"1973"}';
    const album = parseVisionSingleAlbum(text);
    expect(album.albumName).toBe('Dark Side of the Moon');
    expect(album.artistName).toBe('Pink Floyd');
    expect(album.year).toBe('1973');
  });

  test('normalizeAlbumEntry rejects incomplete rows and drops invented fields', () => {
    expect(normalizeAlbumEntry({ albumName: 'X' })).toBeNull();
    const row = normalizeAlbumEntry({
      albumName: 'X',
      artistName: 'Y',
      year: 'Unknown',
      genre: 'Rock',
      description: 'A landmark album',
      estimatedValue: 40,
    });
    expect(row?.artistName).toBe('Y');
    expect(row?.year).toBe('');
    expect(row?.genre).toBe('');
    expect(row?.description).toBe('');
    expect(row?.estimatedValue).toBeNull();
  });

  test('extractAlbumInfoFromText does not treat the first sentence as a description', () => {
    const info = extractAlbumInfoFromText(
      'This is a rare original pressing from 1965. Album: Revolver\nArtist: The Beatles\nYear: 1966'
    );
    expect(info.albumName).toBe('Revolver');
    expect(info.artistName).toBe('The Beatles');
    expect(info.year).toBe('1966');
    expect(info.description).toBe('');
    expect(info.estimatedValue).toBeNull();
  });

  test('vision prompts identify the album from cover art', () => {
    const single = buildSingleAlbumVisionPrompt();
    const shelf = buildShelfVisionPrompt(6);
    expect(single).not.toMatch(/VG\+|estimatedValue|assume VG/i);
    expect(shelf).not.toMatch(/VG\+|estimatedValue|assume VG/i);
    expect(single).toMatch(/Identify the album/i);
    expect(single).toMatch(/cover art/i);
    expect(single).not.toMatch(/only text you can read/i);
    expect(shelf).toMatch(/Identify the next batch/i);
  });

  test('parseVisionSingleAlbum reads fenced JSON with extra braces in prose', () => {
    const text = 'Sure. Here is the cover: {not json} then\n```json\n{"albumName":"Rumours","artistName":"Fleetwood Mac","year":"1977"}\n```';
    const album = parseVisionSingleAlbum(text);
    expect(album.albumName).toBe('Rumours');
    expect(album.artistName).toBe('Fleetwood Mac');
  });
});
