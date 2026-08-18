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
  test('clampMaxAlbums bounds 1–5', () => {
    expect(clampMaxAlbums(0)).toBe(1);
    expect(clampMaxAlbums(3)).toBe(3);
    expect(clampMaxAlbums(99)).toBe(5);
    expect(clampMaxAlbums('bad', 5)).toBe(5);
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

  test('vision prompts ask for jacket text only', () => {
    const single = buildSingleAlbumVisionPrompt();
    const shelf = buildShelfVisionPrompt(5);
    expect(single).not.toMatch(/VG\+|estimatedValue|assume VG/i);
    expect(shelf).not.toMatch(/VG\+|estimatedValue|assume VG/i);
    expect(single).toMatch(/only text you can read/i);
    expect(single).toMatch(/Do not guess/i);
  });
});
