/**
 * Development work by David Lane
 */
import {
  normalizeReelCode,
  createReelCode,
  livekitRoomName,
  sanitizeDisplayName,
  getLivekitConfig,
  mintLivekitToken,
  setLivekitTokenFactory,
  getStudioStatus,
} from '../../services/studio.service.js';

describe('studio.service', () => {
  const keys = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
  const saved = {};

  beforeEach(() => {
    keys.forEach((key) => {
      saved[key] = process.env[key];
    });
    setLivekitTokenFactory(null);
  });

  afterEach(() => {
    keys.forEach((key) => {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    });
    setLivekitTokenFactory(null);
  });

  test('normalizeReelCode uppercases and strips junk', () => {
    expect(normalizeReelCode('ab-12!!')).toBe('AB12');
    expect(normalizeReelCode('')).toBe('');
  });

  test('createReelCode is 6 unambiguous chars', () => {
    const code = createReelCode();
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  });

  test('livekitRoomName prefixes studio-', () => {
    expect(livekitRoomName('ab12')).toBe('studio-AB12');
    expect(livekitRoomName('')).toBe('studio-lobby');
  });

  test('sanitizeDisplayName strips markup and falls back', () => {
    expect(sanitizeDisplayName('  <Ada>  ')).toBe('Ada');
    expect(sanitizeDisplayName('')).toBe('Player');
  });

  test('getLivekitConfig requires url key and secret', () => {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    expect(getLivekitConfig().configured).toBe(false);
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret';
    expect(getLivekitConfig().configured).toBe(true);
  });

  test('mintLivekitToken throws when unconfigured', async () => {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    await expect(mintLivekitToken({ reelCode: 'ABC123', name: 'Ada' })).rejects.toMatchObject({
      code: 'LIVEKIT_NOT_CONFIGURED',
    });
  });

  test('mintLivekitToken uses injected factory', async () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret';
    setLivekitTokenFactory(async (opts) => {
      expect(opts.roomName).toBe('studio-ABC123');
      expect(opts.name).toBe('Ada');
      return 'jwt-test';
    });
    const minted = await mintLivekitToken({ reelCode: 'ABC123', name: 'Ada' });
    expect(minted.token).toBe('jwt-test');
    expect(minted.url).toBe('wss://example.livekit.cloud');
    expect(minted.roomName).toBe('studio-ABC123');
  });

  test('getStudioStatus reports livekit flag', () => {
    delete process.env.LIVEKIT_URL;
    expect(getStudioStatus().ok).toBe(true);
    expect(getStudioStatus().livekitConfigured).toBe(false);
  });
});
