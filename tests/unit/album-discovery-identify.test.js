/**
 * @jest-environment node
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createRes } from '../helpers/music-research-mocks.js';

const mbGet = jest.fn();
const identifySingleAlbumFromImage = jest.fn();

await jest.unstable_mockModule('../../services/musicbrainz.service.js', () => ({
  mbGet,
  MUSICBRAINZ_USER_AGENT: 'test-agent'
}));

await jest.unstable_mockModule('../../services/album-discovery-vision.service.js', () => ({
  clampMaxAlbums: (value, fallback = 6) => {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(6, Math.max(1, n));
  },
  identifySingleAlbumFromImage,
  identifyShelfAlbumsFromImage: jest.fn(),
  identifyStackAlbumsFromImages: jest.fn(),
}));

await jest.unstable_mockModule('../../services/openai-vision-model.js', () => ({
  resolveOpenAiVisionModel: () => 'gpt-4o'
}));

await jest.unstable_mockModule('openai', () => ({
  default: class OpenAI {
    constructor() {}
  }
}));

const { identifyAlbumFromImage } = await import('../../controllers/album-discovery.controller.js');

describe('identifyAlbumFromImage', () => {
  beforeEach(() => {
    mbGet.mockReset();
    identifySingleAlbumFromImage.mockReset();
  });

  test('identifies from the photo and confirms the catalog release', async () => {
    identifySingleAlbumFromImage.mockResolvedValue({
      aiResponse: '{"albumName":"Abbey Road","artistName":"The Beatles"}',
      album: {
        albumName: 'Abbey Road',
        artistName: 'The Beatles',
        year: '',
        confidence: 'high'
      }
    });
    mbGet.mockResolvedValue({
      data: {
        'release-groups': [
          {
            id: 'rg-abbey',
            title: 'Abbey Road',
            'first-release-date': '1969-09-26',
            tags: [{ name: 'rock' }],
            'artist-credit': [{ name: 'The Beatles' }]
          }
        ]
      }
    });

    const res = createRes();
    await identifyAlbumFromImage({ body: { imageData: 'data:image/jpeg;base64,abc' } }, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        albumName: 'Abbey Road',
        artistName: 'The Beatles',
        year: '1969',
        matched: true,
        musicBrainzId: 'rg-abbey'
      })
    );
  });

  test('still returns the photo identify when MusicBrainz is down', async () => {
    identifySingleAlbumFromImage.mockResolvedValue({
      aiResponse: '{}',
      album: {
        albumName: 'Rumours',
        artistName: 'Fleetwood Mac',
        year: '',
        confidence: 'medium'
      }
    });
    mbGet.mockRejectedValue(new Error('MusicBrainz 503'));

    const res = createRes();
    await identifyAlbumFromImage({ body: { imageData: 'data:image/jpeg;base64,abc' } }, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        albumName: 'Rumours',
        artistName: 'Fleetwood Mac',
        matched: false
      })
    );
  });

  test('returns not-found when the cover cannot be identified', async () => {
    identifySingleAlbumFromImage.mockResolvedValue({
      aiResponse: '{}',
      album: null
    });

    const res = createRes();
    await identifyAlbumFromImage({ body: { imageData: 'data:image/jpeg;base64,abc' } }, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/could not identify/i)
      })
    );
  });
});
