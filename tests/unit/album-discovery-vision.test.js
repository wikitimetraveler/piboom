import {
  clampMaxAlbums,
  parseVisionAlbumsFromText,
  parseVisionSingleAlbum,
  normalizeAlbumEntry,
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
  });

  test('parseVisionSingleAlbum accepts single object', () => {
    const text = '{"albumName":"Dark Side of the Moon","artistName":"Pink Floyd","year":"1973"}';
    const album = parseVisionSingleAlbum(text);
    expect(album.albumName).toBe('Dark Side of the Moon');
    expect(album.artistName).toBe('Pink Floyd');
  });

  test('normalizeAlbumEntry rejects incomplete rows', () => {
    expect(normalizeAlbumEntry({ albumName: 'X' })).toBeNull();
    expect(normalizeAlbumEntry({ albumName: 'X', artistName: 'Y' })?.artistName).toBe('Y');
  });
});
