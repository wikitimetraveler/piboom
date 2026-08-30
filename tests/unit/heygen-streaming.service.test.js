/**
 * Development work by David Lane
 */
import { createHeygenStreamingSession } from '../../services/heygen.service.js';

describe('heygen streaming session', () => {
  const originalFetch = global.fetch;
  const saved = {};

  beforeEach(() => {
    saved.HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    saved.HEYGEN_STREAMING_AVATAR_ID = process.env.HEYGEN_STREAMING_AVATAR_ID;
    process.env.HEYGEN_API_KEY = 'test-key';
    process.env.HEYGEN_STREAMING_AVATAR_ID = 'avatar_test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (saved.HEYGEN_API_KEY === undefined) delete process.env.HEYGEN_API_KEY;
    else process.env.HEYGEN_API_KEY = saved.HEYGEN_API_KEY;
    if (saved.HEYGEN_STREAMING_AVATAR_ID === undefined) delete process.env.HEYGEN_STREAMING_AVATAR_ID;
    else process.env.HEYGEN_STREAMING_AVATAR_ID = saved.HEYGEN_STREAMING_AVATAR_ID;
  });

  test('createHeygenStreamingSession maps LiveKit url and token', async () => {
    global.fetch = async (url, opts) => {
      expect(String(url)).toContain('/v1/streaming.new');
      const body = JSON.parse(opts.body);
      expect(body.avatar_name).toBe('avatar_test');
      return {
        ok: true,
        json: async () => ({
          data: {
            session_id: 'sess-1',
            url: 'wss://heygen.livekit.cloud',
            access_token: 'lk-token',
          },
        }),
      };
    };
    const session = await createHeygenStreamingSession();
    expect(session.sessionId).toBe('sess-1');
    expect(session.url).toBe('wss://heygen.livekit.cloud');
    expect(session.accessToken).toBe('lk-token');
  });

  test('createHeygenStreamingSession requires an avatar id', async () => {
    delete process.env.HEYGEN_STREAMING_AVATAR_ID;
    delete process.env.HEYGEN_AVATAR_ID;
    await expect(createHeygenStreamingSession()).rejects.toMatchObject({
      code: 'HEYGEN_STREAMING_AVATAR_REQUIRED',
    });
  });

  test('createHeygenStreamingSession uses explicit avatarId and voiceId over env', async () => {
    delete process.env.HEYGEN_STREAMING_AVATAR_ID;
    delete process.env.HEYGEN_STREAMING_VOICE_ID;
    global.fetch = async (url, opts) => {
      expect(String(url)).toContain('/v1/streaming.new');
      const body = JSON.parse(opts.body);
      expect(body.avatar_name).toBe('zed_look_explicit');
      expect(body.voice).toEqual({ voice_id: 'voice_zed_explicit' });
      return {
        ok: true,
        json: async () => ({
          data: {
            session_id: 'sess-zed',
            url: 'wss://heygen.livekit.cloud',
            access_token: 'lk-zed',
          },
        }),
      };
    };
    const session = await createHeygenStreamingSession({
      avatarId: 'zed_look_explicit',
      voiceId: 'voice_zed_explicit',
    });
    expect(session.sessionId).toBe('sess-zed');
    expect(session.avatarId).toBe('zed_look_explicit');
  });
});
