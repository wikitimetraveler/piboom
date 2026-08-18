/**
 * Development work by David Lane
 */
import {
  getLivekitConfig,
  getLivekitStatusExtras,
  listRoomParticipantCount,
  mintLivekitAccessToken,
  setLivekitTokenFactory,
  setLivekitEgressClientFactory,
  setLivekitOccupancyFactory,
  startAudioOnlyRoomEgress,
  stopLivekitEgress,
  sanitizeParticipantName,
  STARBAND_AGENT_NAME,
  WOLFMAN_AGENT_NAME,
} from '../../services/livekit.service.js';

describe('livekit.service', () => {
  const keys = [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'LIVEKIT_EGRESS_S3_BUCKET',
    'LIVEKIT_EGRESS_S3_ACCESS_KEY',
    'LIVEKIT_EGRESS_S3_SECRET',
    'LIVEKIT_EGRESS_S3_REGION',
  ];
  const saved = {};

  beforeEach(() => {
    keys.forEach((key) => {
      saved[key] = process.env[key];
    });
    setLivekitTokenFactory(null);
    setLivekitEgressClientFactory(null);
    setLivekitOccupancyFactory(null);
  });

  afterEach(() => {
    keys.forEach((key) => {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    });
    setLivekitTokenFactory(null);
    setLivekitEgressClientFactory(null);
    setLivekitOccupancyFactory(null);
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

  test('getLivekitConfig strips wrapping quotes from env values', () => {
    process.env.LIVEKIT_URL = '"wss://example.livekit.cloud"';
    process.env.LIVEKIT_API_KEY = "'key'";
    process.env.LIVEKIT_API_SECRET = 'secret';
    const config = getLivekitConfig();
    expect(config.configured).toBe(true);
    expect(config.url).toBe('wss://example.livekit.cloud');
    expect(config.apiKey).toBe('key');
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

  test('startAudioOnlyRoomEgress refuses when S3 dest is missing', async () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret';
    delete process.env.LIVEKIT_EGRESS_S3_BUCKET;
    delete process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY;
    delete process.env.LIVEKIT_EGRESS_S3_SECRET;
    await expect(startAudioOnlyRoomEgress({ roomName: 'studio-ABC' })).rejects.toMatchObject({
      code: 'LIVEKIT_EGRESS_DEST_REQUIRED',
    });
  });

  test('startAudioOnlyRoomEgress uses injected egress client when S3 is set', async () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret';
    process.env.LIVEKIT_EGRESS_S3_BUCKET = 'lk-audio';
    process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY = 'ak';
    process.env.LIVEKIT_EGRESS_S3_SECRET = 'sk';
    process.env.LIVEKIT_EGRESS_S3_REGION = 'us-east-1';
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
    expect(started.s3Configured).toBe(true);
  });

  test('getLivekitStatusExtras reports egress S3 flag', () => {
    delete process.env.LIVEKIT_EGRESS_S3_BUCKET;
    expect(getLivekitStatusExtras().egressS3Configured).toBe(false);
    process.env.LIVEKIT_EGRESS_S3_BUCKET = 'lk-audio';
    process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY = 'ak';
    process.env.LIVEKIT_EGRESS_S3_SECRET = 'sk';
    expect(getLivekitStatusExtras().egressS3Configured).toBe(true);
  });

  test('listRoomParticipantCount fails closed when occupancy cannot be read', async () => {
    setLivekitOccupancyFactory(async () => {
      throw new Error('network');
    });
    await expect(listRoomParticipantCount('watch-together-theater')).rejects.toMatchObject({
      code: 'LIVEKIT_OCCUPANCY_UNAVAILABLE',
    });
  });

  test('listRoomParticipantCount returns a real zero when the room is empty', async () => {
    setLivekitOccupancyFactory(async () => 0);
    await expect(listRoomParticipantCount('watch-together-theater')).resolves.toBe(0);
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
