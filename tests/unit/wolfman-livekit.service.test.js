/**
 * Development work by David Lane
 */
import {
  WOLFMAN_AGENT_NAME,
  WOLFMAN_ROOM_NAME,
  getWolfmanStatus,
  mintWolfmanLivekitToken,
} from '../../services/wolfman-livekit.service.js';
import { setLivekitTokenFactory } from '../../services/livekit.service.js';

describe('wolfman-livekit.service', () => {
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

  test('booth uses a dedicated music room and WolfmanDave agent', () => {
    expect(WOLFMAN_ROOM_NAME).toBe('music-wolfman-lobby');
    expect(WOLFMAN_AGENT_NAME).toBe('WolfmanDave');
    expect(getWolfmanStatus().agentName).toBe('WolfmanDave');
  });

  test('mintWolfmanLivekitToken dispatches WolfmanDave', async () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret';
    setLivekitTokenFactory(async (opts) => {
      expect(opts.roomName).toBe(WOLFMAN_ROOM_NAME);
      expect(opts.agentName).toBe(WOLFMAN_AGENT_NAME);
      return 'jwt-wolf';
    });
    const minted = await mintWolfmanLivekitToken({ name: 'Levi' });
    expect(minted.token).toBe('jwt-wolf');
    expect(minted.agentName).toBe(WOLFMAN_AGENT_NAME);
  });
});
