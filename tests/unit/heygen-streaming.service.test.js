/**
 * Development work by David Lane
 */
import {
  createHeygenStreamingSession,
  speakHeygenStreamingSession,
  stopHeygenStreamingSession,
} from '../../services/heygen.service.js';

describe('heygen streaming session', () => {
  const originalFetch = global.fetch;
  const saved = {};

  beforeEach(() => {
    saved.HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    saved.HEYGEN_STREAMING_AVATAR_ID = process.env.HEYGEN_STREAMING_AVATAR_ID;
    saved.HEYGEN_STREAMING_VOICE_ID = process.env.HEYGEN_STREAMING_VOICE_ID;
    saved.HEYGEN_STREAMING_POLL_MS = process.env.HEYGEN_STREAMING_POLL_MS;
    process.env.HEYGEN_API_KEY = 'test-key';
    process.env.HEYGEN_STREAMING_AVATAR_ID = 'avatar_test';
    process.env.HEYGEN_STREAMING_VOICE_ID = 'voice_test';
    process.env.HEYGEN_STREAMING_POLL_MS = '0';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (saved.HEYGEN_API_KEY === undefined) delete process.env.HEYGEN_API_KEY;
    else process.env.HEYGEN_API_KEY = saved.HEYGEN_API_KEY;
    if (saved.HEYGEN_STREAMING_AVATAR_ID === undefined) delete process.env.HEYGEN_STREAMING_AVATAR_ID;
    else process.env.HEYGEN_STREAMING_AVATAR_ID = saved.HEYGEN_STREAMING_AVATAR_ID;
    if (saved.HEYGEN_STREAMING_VOICE_ID === undefined) delete process.env.HEYGEN_STREAMING_VOICE_ID;
    else process.env.HEYGEN_STREAMING_VOICE_ID = saved.HEYGEN_STREAMING_VOICE_ID;
    if (saved.HEYGEN_STREAMING_POLL_MS === undefined) delete process.env.HEYGEN_STREAMING_POLL_MS;
    else process.env.HEYGEN_STREAMING_POLL_MS = saved.HEYGEN_STREAMING_POLL_MS;
  });

  test('createHeygenStreamingSession maps HLS url from Avatar Realtime', async () => {
    global.fetch = async (url, opts) => {
      expect(String(url)).toContain('/v3/avatar-realtime');
      expect(String(url)).not.toContain('/v1/streaming');
      const body = JSON.parse(opts.body);
      expect(body.type).toBe('text_stream');
      expect(body.avatar_id).toBe('avatar_test');
      expect(body.voice_id).toBe('voice_test');
      expect(body.text).toBe('Ready.');
      expect(body.max_duration_seconds).toBeUndefined();
      expect(Object.keys(body).sort()).toEqual(['avatar_id', 'text', 'type', 'voice_id']);
      return {
        ok: true,
        json: async () => ({
          data: {
            stream_id: 'sess-1',
            status: 'streaming',
            hls_url: 'https://cdn.heygen.com/live/sess-1.m3u8',
          },
        }),
      };
    };
    const session = await createHeygenStreamingSession();
    expect(session.sessionId).toBe('sess-1');
    expect(session.url).toBe('https://cdn.heygen.com/live/sess-1.m3u8');
    expect(session.playback).toBe('hls');
    expect(session.accessToken).toBeNull();
  });

  test('createHeygenStreamingSession polls until HLS is ready', async () => {
    let gets = 0;
    global.fetch = async (url, opts) => {
      const path = String(url);
      if (opts?.method === 'POST') {
        expect(path).toContain('/v3/avatar-realtime');
        return {
          ok: true,
          json: async () => ({ data: { stream_id: 'sess-poll', status: 'pending' } }),
        };
      }
      gets += 1;
      expect(path).toContain('/v3/avatar-realtime/sess-poll');
      if (gets === 1) {
        return {
          ok: true,
          json: async () => ({ data: { stream_id: 'sess-poll', status: 'pending' } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            stream_id: 'sess-poll',
            status: 'streaming',
            hls_url: 'https://cdn.heygen.com/live/sess-poll.m3u8',
          },
        }),
      };
    };
    const session = await createHeygenStreamingSession();
    expect(session.sessionId).toBe('sess-poll');
    expect(session.url).toContain('sess-poll.m3u8');
    expect(gets).toBe(2);
  });

  test('createHeygenStreamingSession requires an avatar id', async () => {
    delete process.env.HEYGEN_STREAMING_AVATAR_ID;
    delete process.env.HEYGEN_AVATAR_ID;
    await expect(createHeygenStreamingSession()).rejects.toMatchObject({
      code: 'HEYGEN_STREAMING_AVATAR_REQUIRED',
    });
  });

  test('createHeygenStreamingSession requires a voice id', async () => {
    delete process.env.HEYGEN_STREAMING_VOICE_ID;
    delete process.env.HEYGEN_VOICE_ID;
    await expect(createHeygenStreamingSession()).rejects.toMatchObject({
      code: 'HEYGEN_STREAMING_VOICE_REQUIRED',
    });
  });

  test('createHeygenStreamingSession uses explicit avatarId, voiceId, and text', async () => {
    global.fetch = async (url, opts) => {
      expect(String(url)).toContain('/v3/avatar-realtime');
      const body = JSON.parse(opts.body);
      expect(body.avatar_id).toBe('zed_look_explicit');
      expect(body.voice_id).toBe('voice_zed_explicit');
      expect(body.text).toBe('Signal acquired.');
      return {
        ok: true,
        json: async () => ({
          data: {
            stream_id: 'sess-zed',
            status: 'streaming',
            hls_url: 'https://cdn.heygen.com/live/sess-zed.m3u8',
          },
        }),
      };
    };
    const session = await createHeygenStreamingSession({
      avatarId: 'zed_look_explicit',
      voiceId: 'voice_zed_explicit',
      text: 'Signal acquired.',
    });
    expect(session.sessionId).toBe('sess-zed');
    expect(session.avatarId).toBe('zed_look_explicit');
  });

  test('createHeygenStreamingSession falls back to a look poster when realtime 404s', async () => {
    global.fetch = async (url, opts) => {
      const path = String(url);
      if (path.includes('/v3/avatar-realtime') && opts?.method === 'POST') {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: { code: 'resource_not_found', message: 'Not found.' } }),
        };
      }
      if (path.includes('/v3/avatars/looks/avatar_test')) {
        return {
          ok: true,
          json: async () => ({
            data: { id: 'avatar_test', preview_image_url: 'https://files.heygen.ai/zed.webp' },
          }),
        };
      }
      if (path.includes('/v3/voices/speech')) {
        return {
          ok: true,
          json: async () => ({ data: { audio_url: 'https://files.heygen.ai/zed.wav' } }),
        };
      }
      throw new Error(`unexpected fetch ${path}`);
    };
    const session = await createHeygenStreamingSession();
    expect(session.playback).toBe('poster');
    expect(session.fallback).toBe(true);
    expect(session.url).toBe('https://files.heygen.ai/zed.webp');
    expect(session.sessionId).toBe('poster-avatar_test');
    expect(session.audioUrl).toBe('https://files.heygen.ai/zed.wav');
  });

  test('speakHeygenStreamingSession posts a text delta', async () => {
    global.fetch = async (url, opts) => {
      expect(String(url)).toContain('/v3/avatar-realtime/sess-1/text');
      expect(JSON.parse(opts.body)).toEqual({ delta: 'Hello sky', final: false });
      return { ok: true, json: async () => ({ data: { ok: true, buffered_bytes: 9 } }) };
    };
    const result = await speakHeygenStreamingSession('sess-1', 'Hello sky');
    expect(result.data.ok).toBe(true);
  });

  test('speakHeygenStreamingSession recreates after 410', async () => {
    global.fetch = async (url, opts) => {
      const path = String(url);
      if (path.includes('/text')) {
        return {
          ok: false,
          status: 410,
          json: async () => ({ error: { message: 'stream closed' } }),
        };
      }
      const body = JSON.parse(opts.body);
      expect(body.text).toBe('Carl has the sky on this one.');
      return {
        ok: true,
        json: async () => ({
          data: {
            stream_id: 'sess-2',
            status: 'streaming',
            hls_url: 'https://cdn.heygen.com/live/sess-2.m3u8',
          },
        }),
      };
    };
    const result = await speakHeygenStreamingSession('sess-old', 'Carl has the sky on this one.', {
      avatarId: 'zed',
      voiceId: 'voice',
    });
    expect(result.data.recreated).toBe(true);
    expect(result.session.sessionId).toBe('sess-2');
    expect(result.session.url).toContain('sess-2.m3u8');
  });

  test('createHeygenStreamingSession falls back to poster voice when realtime avatar is missing', async () => {
    global.fetch = async (url, opts) => {
      const path = String(url);
      if (path.includes('/v3/avatar-realtime') && opts?.method === 'POST') {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: { code: 'resource_not_found', message: 'Not found.' } }),
        };
      }
      if (path.includes('/v3/avatars/looks/')) {
        return {
          ok: true,
          json: async () => ({ data: { preview_image_url: 'https://cdn.example/zed.webp' } }),
        };
      }
      if (path.includes('/v3/voices/speech')) {
        expect(JSON.parse(opts.body).text).toBe('Signal acquired.');
        return {
          ok: true,
          json: async () => ({ data: { audio_url: 'https://cdn.example/zed.wav', duration: 1.2 } }),
        };
      }
      throw new Error(`unexpected fetch ${path}`);
    };
    const session = await createHeygenStreamingSession({ text: 'Signal acquired.' });
    expect(session.playback).toBe('poster');
    expect(session.fallback).toBe(true);
    expect(session.url).toBe('https://cdn.example/zed.webp');
    expect(session.audioUrl).toBe('https://cdn.example/zed.wav');
    expect(session.sessionId).toBe('poster-avatar_test');
  });

  test('speakHeygenStreamingSession uses Starfish speech for poster sessions', async () => {
    global.fetch = async (url, opts) => {
      expect(String(url)).toContain('/v3/voices/speech');
      expect(JSON.parse(opts.body)).toMatchObject({
        text: 'Carl has the sky on this one.',
        voice_id: 'voice_zed',
      });
      return {
        ok: true,
        json: async () => ({ data: { audio_url: 'https://cdn.example/line.wav' } }),
      };
    };
    const result = await speakHeygenStreamingSession('poster-zed', 'Carl has the sky on this one.', {
      avatarId: 'zed',
      voiceId: 'voice_zed',
    });
    expect(result.data.fallback).toBe(true);
    expect(result.session.audioUrl).toContain('line.wav');
    expect(result.session.playback).toBe('poster');
  });

  test('stopHeygenStreamingSession skips poster sessions', async () => {
    global.fetch = async () => {
      throw new Error('should not call HeyGen for poster stop');
    };
    const data = await stopHeygenStreamingSession('poster-zed');
    expect(data.skipped).toBe(true);
    expect(data.poster).toBe(true);
  });

  test('stopHeygenStreamingSession cancels the realtime session', async () => {
    global.fetch = async (url, opts) => {
      expect(String(url)).toContain('/v3/avatar-realtime/sess-1/cancel');
      expect(opts.method).toBe('POST');
      return { ok: true, json: async () => ({ data: { cancelled: true } }) };
    };
    const data = await stopHeygenStreamingSession('sess-1');
    expect(data.cancelled).toBe(true);
  });
});
