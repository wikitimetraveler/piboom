/**
 * Wolfman Dave LiveKit booth — shared room + agent dispatch.
 * Development work by David Lane
 */
import {
  WOLFMAN_AGENT_NAME,
  getLivekitConfig,
  getLivekitStatusExtras,
  mintLivekitAccessToken,
} from './livekit.service.js';

export const WOLFMAN_ROOM_NAME = 'music-wolfman-lobby';
export { WOLFMAN_AGENT_NAME };

export function getWolfmanStatus() {
  return {
    ok: true,
    ...getLivekitStatusExtras(),
    roomName: WOLFMAN_ROOM_NAME,
    agentName: WOLFMAN_AGENT_NAME,
  };
}

export async function mintWolfmanLivekitToken({ identity, name } = {}) {
  const config = getLivekitConfig();
  if (!config.configured) {
    const err = new Error('LIVEKIT_NOT_CONFIGURED');
    err.code = 'LIVEKIT_NOT_CONFIGURED';
    throw err;
  }
  return mintLivekitAccessToken({
    roomName: WOLFMAN_ROOM_NAME,
    identity,
    name,
    agentName: WOLFMAN_AGENT_NAME,
  });
}

export default {
  WOLFMAN_ROOM_NAME,
  WOLFMAN_AGENT_NAME,
  getWolfmanStatus,
  mintWolfmanLivekitToken,
};
