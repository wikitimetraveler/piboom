/**
 * Development work by David Lane
 */
import {
  extractYouTubeId,
  parseMediaUrl,
  youtubeThumbnailUrl,
  sanitizeYoutubeSearchQuery,
  mapYouTubeSearchHits,
  searchWatchTogetherYouTube,
  createRoomState,
  expectedMediaTime,
  needsDriftCorrection,
  applyIntent,
  sanitizeLocation,
  buildViewerRecord,
  handleWatchIntent,
  resetWatchTogetherRoom,
  getWatchTogetherSnapshot,
  getWatchTogetherStatus,
  mintWatchTogetherLivekitToken,
  setWatchTogetherLivekitTokenFactory,
  setWatchTogetherOccupancyReader,
  hostKeyFromActor,
  LIVEKIT_ROOM_NAME,
  MAX_VIEWERS,
  DRIFT_PLAYING_S,
  DRIFT_PAUSED_S,
} from '../../services/watch-together.service.js';

describe('watch-together.service', () => {
  test('extractYouTubeId reads watch, short, embed, and raw ids', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=GAKZMVzXGBA')).toBe('GAKZMVzXGBA');
    expect(extractYouTubeId('https://youtu.be/dQw4w9wgGcQ')).toBe('dQw4w9wgGcQ');
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9wgGcQ')).toBe('dQw4w9wgGcQ');
    expect(extractYouTubeId('dQw4w9wgGcQ')).toBe('dQw4w9wgGcQ');
    expect(extractYouTubeId('www.youtube.com/watch?v=dQw4w9wgGcQ')).toBe('dQw4w9wgGcQ');
    expect(extractYouTubeId('youtu.be/dQw4w9wgGcQ?si=abc')).toBe('dQw4w9wgGcQ');
  });

  test('youtubeThumbnailUrl builds a public still and rejects junk ids', () => {
    expect(youtubeThumbnailUrl('dQw4w9wgGcQ')).toBe(
      'https://i.ytimg.com/vi/dQw4w9wgGcQ/hqdefault.jpg'
    );
    expect(youtubeThumbnailUrl('dQw4w9wgGcQ', 'maxresdefault')).toBe(
      'https://i.ytimg.com/vi/dQw4w9wgGcQ/maxresdefault.jpg'
    );
    expect(youtubeThumbnailUrl('nope')).toBeNull();
  });

  test('sanitizeYoutubeSearchQuery trims and caps length', () => {
    expect(sanitizeYoutubeSearchQuery('  Casablanca  ')).toBe('Casablanca');
    expect(sanitizeYoutubeSearchQuery('x')).toBe('x');
    expect(sanitizeYoutubeSearchQuery('a'.repeat(90)).length).toBe(80);
  });

  test('mapYouTubeSearchHits keeps embeddable videos and drops junk', () => {
    const hits = mapYouTubeSearchHits([
      { id: { videoId: 'dQw4w9wgGcQ' }, snippet: { title: 'Never Gonna', channelTitle: 'Rick' } },
      { id: {}, snippet: { title: 'Missing id' } },
      { id: { videoId: 'abcdefghijk' }, snippet: { title: '' } },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0].url).toBe('https://www.youtube.com/watch?v=dQw4w9wgGcQ');
    expect(hits[0].title).toBe('Never Gonna');
  });

  test('searchWatchTogetherYouTube rejects a tiny query without hitting YouTube', async () => {
    const result = await searchWatchTogetherYouTube('a');
    expect(result).toEqual({ ok: false, reason: 'empty' });
  });

  test('searchWatchTogetherYouTube retries without embeddable filter when YouTube errors', async () => {
    const prev = process.env.GOOGLE_API_KEY;
    process.env.GOOGLE_API_KEY = prev || 'test-youtube-key';
    const calls = [];
    const fetcher = async (url) => {
      calls.push(String(url));
      if (url.includes('videoEmbeddable')) {
        return { ok: false, json: async () => ({ error: { message: 'bad filter' } }) };
      }
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: { videoId: 'dQw4w9wgGcQ' },
              snippet: { title: 'Never Gonna', channelTitle: 'Rick' },
            },
          ],
        }),
      };
    };
    try {
      const result = await searchWatchTogetherYouTube('never gonna', fetcher);
      expect(result.ok).toBe(true);
      expect(result.videos).toHaveLength(1);
      expect(result.videos[0].videoId).toBe('dQw4w9wgGcQ');
      expect(calls).toHaveLength(2);
    } finally {
      if (prev == null) delete process.env.GOOGLE_API_KEY;
      else process.env.GOOGLE_API_KEY = prev;
    }
  });

  test('parseMediaUrl prefers YouTube over a generic file URL', () => {
    const parsed = parseMediaUrl('https://www.youtube.com/watch?v=dQw4w9wgGcQ');
    expect(parsed).toEqual({
      ok: true,
      kind: 'youtube',
      youtubeId: 'dQw4w9wgGcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9wgGcQ',
    });
  });

  test('parseMediaUrl accepts a direct https video URL', () => {
    const parsed = parseMediaUrl('https://example.com/clip.mp4');
    expect(parsed.ok).toBe(true);
    expect(parsed.kind).toBe('file');
    expect(parsed.src).toBe('https://example.com/clip.mp4');
  });

  test('expectedMediaTime advances only while playing', () => {
    const paused = { playing: false, position: 10, updatedAt: 1_000 };
    expect(expectedMediaTime(paused, 5_000)).toBe(10);
    const playing = { playing: true, position: 10, updatedAt: 1_000 };
    expect(expectedMediaTime(playing, 3_000)).toBe(12);
  });

  test('needsDriftCorrection uses 1.0s playing and 0.35s paused', () => {
    expect(DRIFT_PLAYING_S).toBe(1);
    expect(DRIFT_PAUSED_S).toBe(0.35);
    expect(needsDriftCorrection({ playing: true, localTime: 10, expectedTime: 10.9 })).toBe(false);
    expect(needsDriftCorrection({ playing: true, localTime: 10, expectedTime: 11.1 })).toBe(true);
    expect(needsDriftCorrection({ playing: false, localTime: 10, expectedTime: 10.3 })).toBe(false);
    expect(needsDriftCorrection({ playing: false, localTime: 10, expectedTime: 10.4 })).toBe(true);
  });

  test('applyIntent never stores volume', () => {
    const next = applyIntent(createRoomState(1_000), { type: 'play', position: 4, volume: 99 }, 2_000);
    expect(next.playing).toBe(true);
    expect(next.position).toBe(4);
    expect(next.volume).toBeUndefined();
  });

  test('applyIntent load resets playback and uses parsed media', () => {
    const next = applyIntent(createRoomState(1_000), {
      type: 'load',
      media: { kind: 'youtube', youtubeId: 'dQw4w9wgGcQ' },
    }, 2_000);
    expect(next.playing).toBe(false);
    expect(next.position).toBe(0);
    expect(next.media.youtubeId).toBe('dQw4w9wgGcQ');
  });

  test('sanitizeLocation drops invalid GPS and keeps valid points', () => {
    expect(sanitizeLocation(41.2, -80.5)).toEqual({ lat: 41.2, lng: -80.5 });
    expect(sanitizeLocation(91, -80)).toBeNull();
    expect(sanitizeLocation('n/a', '-80')).toBeNull();
  });

  test('buildViewerRecord keeps name, login id, and location for the map', () => {
    const viewer = buildViewerRecord('sock-1', {
      name: 'Karti',
      userId: 'demo-analyst-1',
      lat: 41.233,
      lng: -80.493,
    });
    expect(viewer).toEqual({
      id: 'sock-1',
      name: 'Karti',
      userId: 'demo-analyst-1',
      lat: 41.233,
      lng: -80.493,
    });
  });

  test('handleWatchIntent load updates the shared clock without volume', () => {
    resetWatchTogetherRoom(1_000);
    const result = handleWatchIntent(
      { type: 'load', url: 'https://youtu.be/dQw4w9wgGcQ', volume: 11 },
      { name: 'Karti' }
    );
    expect(result.ok).toBe(true);
    expect(result.kind).toBe('playback');
    expect(result.snapshot.media.youtubeId).toBe('dQw4w9wgGcQ');
    expect(result.snapshot.playing).toBe(false);
    expect(result.snapshot.volume).toBeUndefined();
    expect(getWatchTogetherSnapshot().media.youtubeId).toBe('dQw4w9wgGcQ');
    expect(getWatchTogetherSnapshot().host).toBeNull();
  });

  test('hostKeyFromActor prefers login id then identity then name', () => {
    expect(hostKeyFromActor({ userId: 'demo-1', id: 'lk-x', name: 'Karti' })).toBe('demo-1');
    expect(hostKeyFromActor({ id: 'lk-x', name: 'Karti' })).toBe('lk-x');
    expect(hostKeyFromActor({ name: 'Karti' })).toBe('Karti');
  });

  test('projector baton is disabled so anyone can load and seek', () => {
    resetWatchTogetherRoom(1_000);
    const claimed = handleWatchIntent({ type: 'host-claim' }, { name: 'Ada', id: 'a1' });
    expect(claimed.ok).toBe(true);
    expect(claimed.snapshot.host).toBeNull();
    const first = handleWatchIntent(
      { type: 'load', url: 'https://youtu.be/dQw4w9wgGcQ' },
      { name: 'Ada', id: 'a1' }
    );
    expect(first.ok).toBe(true);
    const second = handleWatchIntent(
      { type: 'play', position: 3 },
      { name: 'Bo', id: 'b1' }
    );
    expect(second.ok).toBe(true);
    expect(second.snapshot.playing).toBe(true);
    const seek = handleWatchIntent({ type: 'seek', position: 40 }, { name: 'Bo', id: 'b1' });
    expect(seek.ok).toBe(true);
  });

  test('LiveKit room name is dedicated to the theater', () => {
    expect(LIVEKIT_ROOM_NAME).toBe('watch-together-theater');
  });

  test('theater holds up to 10 people', () => {
    expect(MAX_VIEWERS).toBe(10);
    expect(getWatchTogetherStatus().maxViewers).toBe(10);
  });

  test('mintWatchTogetherLivekitToken throws when the theater is full', async () => {
    const keys = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
    const saved = {};
    keys.forEach((key) => {
      saved[key] = process.env[key];
    });
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret';
    setWatchTogetherOccupancyReader(() => 10);
    setWatchTogetherLivekitTokenFactory(async () => 'jwt-watch');
    try {
      await expect(mintWatchTogetherLivekitToken({ name: 'Sam' })).rejects.toMatchObject({
        code: 'THEATER_FULL',
      });
    } finally {
      setWatchTogetherOccupancyReader(null);
      setWatchTogetherLivekitTokenFactory(null);
      keys.forEach((key) => {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      });
    }
  });

  test('mintWatchTogetherLivekitToken throws when unconfigured', async () => {
    const keys = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
    const saved = {};
    keys.forEach((key) => {
      saved[key] = process.env[key];
      delete process.env[key];
    });
    setWatchTogetherLivekitTokenFactory(null);
    await expect(mintWatchTogetherLivekitToken({ name: 'Karti' })).rejects.toMatchObject({
      code: 'LIVEKIT_NOT_CONFIGURED',
    });
    expect(getWatchTogetherStatus().livekitConfigured).toBe(false);
    keys.forEach((key) => {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    });
  });

  test('mintWatchTogetherLivekitToken uses injected factory', async () => {
    const keys = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
    const saved = {};
    keys.forEach((key) => {
      saved[key] = process.env[key];
    });
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret';
    setWatchTogetherLivekitTokenFactory(async (opts) => {
      expect(opts.roomName).toBe('watch-together-theater');
      expect(opts.name).toBe('Karti');
      return 'jwt-watch';
    });
    try {
      const minted = await mintWatchTogetherLivekitToken({ name: 'Karti' });
      expect(minted.token).toBe('jwt-watch');
      expect(minted.url).toBe('wss://example.livekit.cloud');
      expect(minted.roomName).toBe('watch-together-theater');
    } finally {
      setWatchTogetherLivekitTokenFactory(null);
      keys.forEach((key) => {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      });
    }
  });
});
