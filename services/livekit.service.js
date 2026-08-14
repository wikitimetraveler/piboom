/**
 * Shared LiveKit config, JWT mint, occupancy, and audio-only egress.
 * Development work by David Lane
 */

export const STARBAND_AGENT_NAME = 'StarBand';
export const WOLFMAN_AGENT_NAME = 'WolfmanDave';

/** @type {null | ((opts: object) => Promise<string>)} */
let livekitTokenFactory = null;
/** @type {null | (() => Promise<object>)} */
let livekitEgressClientFactory = null;
/** @type {null | ((roomName: string) => Promise<number>)} */
let livekitOccupancyFactory = null;

export function setLivekitTokenFactory(factory) {
  livekitTokenFactory = typeof factory === 'function' ? factory : null;
}

export function setLivekitEgressClientFactory(factory) {
  livekitEgressClientFactory = typeof factory === 'function' ? factory : null;
}

export function setLivekitOccupancyFactory(factory) {
  livekitOccupancyFactory = typeof factory === 'function' ? factory : null;
}

export function getLivekitConfig() {
  const url = String(process.env.LIVEKIT_URL || '').trim();
  const apiKey = String(process.env.LIVEKIT_API_KEY || '').trim();
  const apiSecret = String(process.env.LIVEKIT_API_SECRET || '').trim();
  return {
    url,
    apiKey,
    apiSecret,
    configured: Boolean(url && apiKey && apiSecret),
  };
}

export function livekitHttpUrl(url) {
  return String(url || '').replace(/^ws/i, 'http');
}

export function notConfiguredError() {
  const err = new Error('LIVEKIT_NOT_CONFIGURED');
  err.code = 'LIVEKIT_NOT_CONFIGURED';
  return err;
}

export function sanitizeParticipantName(raw, { fallback = 'Guest', max = 40 } = {}) {
  const name = String(raw || '')
    .replace(/[\r\n<>]/g, '')
    .trim()
    .slice(0, max);
  return name || fallback;
}

export function sanitizeLivekitIdentity(raw) {
  return String(raw || 'guest')
    .replace(/[^\w.-]/g, '-')
    .slice(0, 64);
}

export function livekitIdentity(name, userId) {
  const base = String(userId || name || 'guest')
    .replace(/[^\w.-]/g, '-')
    .slice(0, 48);
  return `${base}-${Date.now().toString(36)}`.slice(0, 64);
}

function getS3UploadConfig() {
  const bucket = String(process.env.LIVEKIT_EGRESS_S3_BUCKET || '').trim();
  const accessKey = String(process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secret = String(process.env.LIVEKIT_EGRESS_S3_SECRET || process.env.AWS_SECRET_ACCESS_KEY || '').trim();
  const region = String(process.env.LIVEKIT_EGRESS_S3_REGION || process.env.AWS_REGION || '').trim();
  if (!bucket || !accessKey || !secret) return null;
  return { bucket, accessKey, secret, region: region || 'us-east-1' };
}

async function defaultMintAccessToken({
  roomName,
  identity,
  name,
  canPublish,
  canSubscribe,
  canPublishData,
  canUpdateOwnMetadata,
  agentName,
  ttl,
}) {
  const { AccessToken, RoomAgentDispatch, RoomConfiguration } = await import('livekit-server-sdk');
  const { apiKey, apiSecret } = getLivekitConfig();
  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: ttl || '6h',
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: canPublish !== false,
    canSubscribe: canSubscribe !== false,
    canPublishData: canPublishData !== false,
    canUpdateOwnMetadata: canUpdateOwnMetadata !== false,
  });
  if (agentName) {
    token.roomConfig = new RoomConfiguration({
      agents: [new RoomAgentDispatch({ agentName })],
    });
  }
  return token.toJwt();
}

/**
 * Mint a LiveKit JWT for any product room.
 * @param {object} opts
 * @param {string} opts.roomName
 * @param {string} [opts.identity]
 * @param {string} [opts.name]
 * @param {boolean} [opts.canPublish]
 * @param {string | null} [opts.agentName] RoomAgentDispatch name, or omit
 */
export async function mintLivekitAccessToken({
  roomName,
  identity,
  name,
  canPublish = true,
  canSubscribe = true,
  canPublishData = true,
  canUpdateOwnMetadata = true,
  agentName = null,
  ttl = '6h',
} = {}) {
  const config = getLivekitConfig();
  if (!config.configured) throw notConfiguredError();
  const safeRoom = String(roomName || '').trim();
  if (!safeRoom) {
    const err = new Error('LIVEKIT_ROOM_REQUIRED');
    err.code = 'LIVEKIT_ROOM_REQUIRED';
    throw err;
  }
  const participantName = sanitizeParticipantName(name);
  const participantId = sanitizeLivekitIdentity(identity || livekitIdentity(participantName));
  const factory = livekitTokenFactory || defaultMintAccessToken;
  const jwt = await factory({
    roomName: safeRoom,
    identity: participantId,
    name: participantName,
    canPublish,
    canSubscribe,
    canPublishData,
    canUpdateOwnMetadata,
    agentName: agentName || null,
    ttl,
  });
  return {
    token: jwt,
    url: config.url,
    roomName: safeRoom,
    identity: participantId,
    name: participantName,
    agentName: agentName || null,
  };
}

export async function listRoomParticipantCount(roomName) {
  if (livekitOccupancyFactory) {
    return Math.max(0, Number(await livekitOccupancyFactory(roomName)) || 0);
  }
  const config = getLivekitConfig();
  if (!config.configured) return 0;
  try {
    const { RoomServiceClient } = await import('livekit-server-sdk');
    const svc = new RoomServiceClient(livekitHttpUrl(config.url), config.apiKey, config.apiSecret);
    const parts = await svc.listParticipants(roomName);
    return Array.isArray(parts) ? parts.length : 0;
  } catch {
    return 0;
  }
}

async function getEgressClient() {
  if (livekitEgressClientFactory) return livekitEgressClientFactory();
  const config = getLivekitConfig();
  const { EgressClient } = await import('livekit-server-sdk');
  return new EgressClient(livekitHttpUrl(config.url), config.apiKey, config.apiSecret);
}

function audioFilepath(roomName) {
  const safe = String(roomName || 'room').replace(/[^\w.-]/g, '-');
  return `livekit-audio/${safe}/${Date.now()}.ogg`;
}

/**
 * Server-side audio-only room composite. Never captures a YouTube iframe.
 * Needs LiveKit Cloud egress destination (S3 env) in production.
 */
export async function startAudioOnlyRoomEgress({ roomName, filepath } = {}) {
  const config = getLivekitConfig();
  if (!config.configured) throw notConfiguredError();
  const safeRoom = String(roomName || '').trim();
  if (!safeRoom) {
    const err = new Error('LIVEKIT_ROOM_REQUIRED');
    err.code = 'LIVEKIT_ROOM_REQUIRED';
    throw err;
  }
  const { EncodedFileOutput, EncodedFileType, S3Upload } = await import('livekit-server-sdk');
  const outputOpts = {
    fileType: EncodedFileType.OGG,
    filepath: filepath || audioFilepath(safeRoom),
    disableManifest: true,
  };
  const s3 = getS3UploadConfig();
  if (s3) {
    outputOpts.output = {
      case: 's3',
      value: new S3Upload({
        accessKey: s3.accessKey,
        secret: s3.secret,
        bucket: s3.bucket,
        region: s3.region,
      }),
    };
  }
  const file = new EncodedFileOutput(outputOpts);
  const client = await getEgressClient();
  const info = await client.startRoomCompositeEgress(safeRoom, { file }, { audioOnly: true });
  return {
    egressId: info?.egressId || info?.egress_id || null,
    roomName: safeRoom,
    audioOnly: true,
    filepath: outputOpts.filepath,
    s3Configured: Boolean(s3),
    status: info?.status ?? null,
  };
}

export async function stopLivekitEgress(egressId) {
  const config = getLivekitConfig();
  if (!config.configured) throw notConfiguredError();
  const id = String(egressId || '').trim();
  if (!id) {
    const err = new Error('EGRESS_ID_REQUIRED');
    err.code = 'EGRESS_ID_REQUIRED';
    throw err;
  }
  const client = await getEgressClient();
  const info = await client.stopEgress(id);
  return {
    egressId: info?.egressId || info?.egress_id || id,
    status: info?.status ?? 'stopping',
  };
}

export function getLivekitStatusExtras() {
  const livekit = getLivekitConfig();
  return {
    livekitConfigured: livekit.configured,
    livekitUrl: livekit.configured ? livekit.url : null,
    egressS3Configured: Boolean(getS3UploadConfig()),
  };
}

export default {
  STARBAND_AGENT_NAME,
  WOLFMAN_AGENT_NAME,
  getLivekitConfig,
  livekitHttpUrl,
  mintLivekitAccessToken,
  setLivekitTokenFactory,
  setLivekitEgressClientFactory,
  setLivekitOccupancyFactory,
  listRoomParticipantCount,
  startAudioOnlyRoomEgress,
  stopLivekitEgress,
  sanitizeParticipantName,
  sanitizeLivekitIdentity,
  livekitIdentity,
  getLivekitStatusExtras,
};
