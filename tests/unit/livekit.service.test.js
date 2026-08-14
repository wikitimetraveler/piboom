/**
 * Development work by David Lane
 */
import {
  getLivekitConfig,
  mintLivekitAccessToken,
  setLivekitTokenFactory,
  setLivekitEgressClientFactory,
  startAudioOnlyRoomEgress,
  stopLivekitEgress,
  sanitizeParticipantName,
  STARBAND_AGENT_NAME,
  WOLFMAN_AGENT_NAME,
} from '../../services/livekit.service.js';

describe('livekit.service', () => {
  const keys = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
  const saved = {};

  beforeEach(() => {
    keys.forEach((key) => {
      saved[key] = process.env[key];
    });
    setLivekitTokenFactory(null);
    setLivekitEgressClientFactory(null);
  });

  afterEach(() => {
    keys.forEach((key) => {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    });
    setLivekitTokenFactory(null);
    setLivekitEgressClientFactory(null);
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

  test('sanitizeParticipantName strips markup', () => {
    expect(sanitizeParticipantName('  <Ada>  ')).toBe('Ada');
    expect(sanitizeParticipantName('')).toBe('Guest');
  });

  test('mintLivekitAccessToken throws when unconfigured', async () => {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    await expect(mintLivekitAccessToken({ roomName: 'studio-A', name: 'Ada' })).rejects.toMatchObject({
      code: 'LIVEKIT_NOT_CONFIGURED',
    });
  });

  test('mintLivekitAccessToken uses injected factory and optional agent', async () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret';
    setLivekitTokenFactory(async (opts) => {
      expect(opts.roomName).toBe('music-wolfman-lobby');
      expect(opts.agentName).toBe(WOLFMAN_AGENT_NAME);
      expect(opts.canPublishData).toBe(true);
      return 'jwt-shared';
    });
    const minted = await mintLivekitAccessToken({
      roomName: 'music-wolfman-lobby',
      name: 'Dave',
      agentName: WOLFMAN_AGENT_NAME,
    });
    expect(minted.token).toBe('jwt-shared');
    expect(minted.agentName).toBe(WOLFMAN_AGENT_NAME);
    expect(minted.url).toBe('wss://example.livekit.cloud');
  });

  test('StarBand agent name is stable for room dispatch', () => {
    expect(STARBAND_AGENT_NAME).toBe('StarBand');
  });

  test('startAudioOnlyRoomEgress uses injected egress client', async () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret';
    setLivekitEgressClientFactory(async () => ({
      startRoomCompositeEgress: async (room, _out, opts) => {
        expect(room).toBe('studio-ABC');
        expect(opts.audioOnly).toBe(true);
        return { egressId: 'EG_1', status: 0 };
      },
    }));
    const started = await startAudioOnlyRoomEgress({ roomName: 'studio-ABC' });
    expect(started.egressId).toBe('EG_1');
    expect(started.audioOnly).toBe(true);
  });

  test('stopLivekitEgress uses injected client', async () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret';
    setLivekitEgressClientFactory(async () => ({
      stopEgress: async (id) => {
        expect(id).toBe('EG_1');
        return { egressId: id, status: 2 };
      },
    }));
    const stopped = await stopLivekitEgress('EG_1');
    expect(stopped.egressId).toBe('EG_1');
  });
});
