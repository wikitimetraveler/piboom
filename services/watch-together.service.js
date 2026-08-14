/**
 * Development work by David Lane
 */
import { verifyWatchTogetherAccess } from '../lib/watch-together-auth.js';
import { getLivekitConfig } from './studio.service.js';

export const DRIFT_PLAYING_S = 1.0;
export const DRIFT_PAUSED_S = 0.35;
export const ROOM_NAME = 'theater';
export const SOCKET_NAMESPACE = '/watch-together';
export const LIVEKIT_ROOM_NAME = 'watch-together-theater';
export const MAX_VIEWERS = 10;
export const MAX_CHAT = 80;
export const MAX_NAME = 24;
export const MAX_CHAT_TEXT = 280;
const MAX_DRAW_POINTS = 800;

/**
 * @param {string} raw
 * @returns {string | null}
 */
export function extractYouTubeId(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) return value;

  const fromBlob = value.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/|\/v\/)([\w-]{11})/);
  if (fromBlob) return fromBlob[1];

  let candidate = value;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/\//, '')}`;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] || '';
    return /^[\w-]{11}$/.test(id) ? id : null;
  }

  const youtubeHosts = new Set([
    'youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtube-nocookie.com',
  ]);
  if (!youtubeHosts.has(host)) return null;

  const fromQuery = url.searchParams.get('v');
  if (fromQuery && /^[\w-]{11}$/.test(fromQuery)) return fromQuery;

  const parts = url.pathname.split('/').filter(Boolean);
  const prefixed = new Set(['embed', 'shorts', 'live', 'v']);
  if (prefixed.has(parts[0])) {
    const id = parts[1] || '';
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  return null;
}

/**
 * @param {string} raw
 * @returns {{ ok: true, kind: 'youtube' | 'file', youtubeId?: string, src?: string, url: string } | { ok: false, reason: string }}
 */
export function parseMediaUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return { ok: false, reason: 'empty' };

  const youtubeId = extractYouTubeId(url);
  if (youtubeId) {
    return { ok: true, kind: 'youtube', youtubeId, url };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, reason: 'unsupported' };
    }
    return { ok: true, kind: 'file', src: url, url };
  } catch {
    return { ok: false, reason: 'unsupported' };
  }
}

export function createRoomState(now = Date.now()) {
  return {
    media: null,
    playing: false,
    position: 0,
    updatedAt: now,
    chat: [],
    draw: [],
  };
}

export function expectedMediaTime(state, now = Date.now()) {
  const position = Number(state?.position) || 0;
  if (!state?.playing) return Math.max(0, position);
  const elapsed = Math.max(0, (now - Number(state.updatedAt || now)) / 1000);
  return Math.max(0, position + elapsed);
}

export function needsDriftCorrection({ playing, localTime, expectedTime }) {
  const local = Number(localTime);
  const expected = Number(expectedTime);
  if (!Number.isFinite(local) || !Number.isFinite(expected)) return false;
  const threshold = playing ? DRIFT_PLAYING_S : DRIFT_PAUSED_S;
  return Math.abs(local - expected) > threshold;
}

function clampPosition(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Apply a playback control intent. Volume is never part of room state.
 * @param {object} state
 * @param {{ type?: string, media?: object, position?: number, playing?: boolean }} intent
 * @param {number} [now]
 */
export function applyIntent(state, intent, now = Date.now()) {
  const next = {
    media: state?.media ?? null,
    playing: Boolean(state?.playing),
    position: clampPosition(state?.position),
    updatedAt: Number(state?.updatedAt) || now,
    chat: Array.isArray(state?.chat) ? state.chat : [],
    draw: Array.isArray(state?.draw) ? state.draw : [],
  };
  const type = intent?.type;

  if (type === 'load') {
    next.media = intent.media || null;
    next.playing = false;
    next.position = 0;
    next.updatedAt = now;
    next.draw = [];
    return next;
  }

  if (type === 'play') {
    next.position = intent.position == null
      ? expectedMediaTime(state, now)
      : clampPosition(intent.position);
    next.playing = true;
    next.updatedAt = now;
    return next;
  }

  if (type === 'pause') {
    next.position = intent.position == null
      ? expectedMediaTime(state, now)
      : clampPosition(intent.position);
    next.playing = false;
    next.updatedAt = now;
    return next;
  }

  if (type === 'seek') {
    next.position = clampPosition(intent.position);
    next.updatedAt = now;
    if (typeof intent.playing === 'boolean') next.playing = intent.playing;
    return next;
  }

  return next;
}

export function publicPlaybackState(state) {
  return {
    media: state?.media ?? null,
    playing: Boolean(state?.playing),
    position: clampPosition(state?.position),
    updatedAt: Number(state?.updatedAt) || Date.now(),
  };
}

export function sanitizeName(name) {
  const cleaned = String(name || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Guest';
  return cleaned.slice(0, MAX_NAME);
}

/**
 * Browser GPS for the couches map. Invalid coords are dropped, not guessed.
 * @returns {{ lat: number, lng: number } | null}
 */
export function sanitizeLocation(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return {
    lat: Math.round(la * 1e6) / 1e6,
    lng: Math.round(ln * 1e6) / 1e6,
  };
}

export function publicViewer(record) {
  if (!record) return null;
  return {
    id: record.id,
    name: record.name,
    userId: record.userId || null,
    lat: Number.isFinite(record.lat) ? record.lat : null,
    lng: Number.isFinite(record.lng) ? record.lng : null,
  };
}

export function buildViewerRecord(socketId, payload = {}) {
  const loc = sanitizeLocation(payload.lat, payload.lng);
  const userId = String(payload.userId || '').trim().slice(0, 40);
  return {
    id: socketId,
    name: sanitizeName(payload.name),
    userId: userId || null,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
  };
}

export function sanitizeChatText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_TEXT);
}

export function appendChat(state, message) {
  const chat = [...(Array.isArray(state?.chat) ? state.chat : []), message].slice(-MAX_CHAT);
  return { ...state, chat };
}

export function appendDraw(state, stroke) {
  const draw = [...(Array.isArray(state?.draw) ? state.draw : []), stroke].slice(-MAX_DRAW_POINTS);
  return { ...state, draw };
}

export function clearDraw(state) {
  return { ...state, draw: [] };
}

let room = createRoomState();
/** @type {null | ((opts: object) => Promise<string>)} */
let livekitTokenFactory = null;
/** @type {null | (() => number | Promise<number>)} */
let occupancyReader = null;
const socketViewers = new Map();

export function setWatchTogetherLivekitTokenFactory(factory) {
  livekitTokenFactory = typeof factory === 'function' ? factory : null;
}

export function setWatchTogetherOccupancyReader(reader) {
  occupancyReader = typeof reader === 'function' ? reader : null;
}

export function resetWatchTogetherRoom(now = Date.now()) {
  room = createRoomState(now);
}

export function getWatchTogetherSnapshot() {
  return {
    ...publicPlaybackState(room),
    chat: room.chat.slice(),
    draw: room.draw.slice(),
  };
}

export function getWatchTogetherStatus() {
  return {
    ok: true,
    livekitConfigured: getLivekitConfig().configured,
    livekitRoom: LIVEKIT_ROOM_NAME,
    maxViewers: MAX_VIEWERS,
  };
}

function livekitHttpUrl(url) {
  return String(url || '').replace(/^ws/i, 'http');
}

async function countLivekitParticipants() {
  const config = getLivekitConfig();
  if (!config.configured) return 0;
  try {
    const { RoomServiceClient } = await import('livekit-server-sdk');
    const svc = new RoomServiceClient(livekitHttpUrl(config.url), config.apiKey, config.apiSecret);
    const parts = await svc.listParticipants(LIVEKIT_ROOM_NAME);
    return Array.isArray(parts) ? parts.length : 0;
  } catch {
    return 0;
  }
}

export async function getTheaterOccupancy() {
  if (occupancyReader) return Math.max(0, Number(await occupancyReader()) || 0);
  const live = await countLivekitParticipants();
  return live + socketViewers.size;
}

export async function assertTheaterHasSeat() {
  const occupied = await getTheaterOccupancy();
  if (occupied >= MAX_VIEWERS) {
    const err = new Error('THEATER_FULL');
    err.code = 'THEATER_FULL';
    err.max = MAX_VIEWERS;
    throw err;
  }
}

export function livekitIdentity(name, userId) {
  const base = String(userId || name || 'guest')
    .replace(/[^\w.-]/g, '-')
    .slice(0, 48);
  return `${base}-${Date.now().toString(36)}`.slice(0, 64);
}

async function defaultMintWatchTogetherToken({ roomName, identity, name }) {
  const { AccessToken } = await import('livekit-server-sdk');
  const { apiKey, apiSecret } = getLivekitConfig();
  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: '6h',
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });
  return token.toJwt();
}

export async function mintWatchTogetherLivekitToken({ identity, name, userId } = {}) {
  const config = getLivekitConfig();
  if (!config.configured) {
    const err = new Error('LIVEKIT_NOT_CONFIGURED');
    err.code = 'LIVEKIT_NOT_CONFIGURED';
    throw err;
  }
  await assertTheaterHasSeat();
  const participantName = sanitizeName(name);
  const participantId = String(identity || livekitIdentity(participantName, userId))
    .replace(/[^\w.-]/g, '-')
    .slice(0, 64);
  const factory = livekitTokenFactory || defaultMintWatchTogetherToken;
  const jwt = await factory({
    roomName: LIVEKIT_ROOM_NAME,
    identity: participantId,
    name: participantName,
  });
  return {
    token: jwt,
    url: config.url,
    roomName: LIVEKIT_ROOM_NAME,
    identity: participantId,
    name: participantName,
  };
}

/**
 * Apply a client intent to the shared clock. Volume is ignored.
 * @returns {{ ok: boolean, reason?: string, kind?: string, snapshot?: object, message?: object, stroke?: object }}
 */
export function handleWatchIntent(intent, actor = {}) {
  const type = intent?.type;
  const name = sanitizeName(actor.name);

  if (type === 'load') {
    const parsed = parseMediaUrl(intent.url);
    if (!parsed.ok) return { ok: false, reason: parsed.reason || 'unsupported' };
    room = applyIntent(room, { type: 'load', media: parsed });
    return { ok: true, kind: 'playback', snapshot: getWatchTogetherSnapshot() };
  }

  if (type === 'play' || type === 'pause' || type === 'seek') {
    room = applyIntent(room, intent);
    return { ok: true, kind: 'playback', snapshot: getWatchTogetherSnapshot() };
  }

  if (type === 'chat') {
    const text = sanitizeChatText(intent.text);
    if (!text) return { ok: false, reason: 'empty' };
    const message = {
      id: `${Date.now()}-${String(actor.id || 'x').slice(-4)}`,
      name,
      text,
      at: Date.now(),
    };
    room = appendChat(room, message);
    return { ok: true, kind: 'chat', message, snapshot: getWatchTogetherSnapshot() };
  }

  if (type === 'draw') {
    const stroke = {
      id: typeof intent.id === 'string' ? intent.id.slice(0, 40) : `${Date.now()}`,
      phase: intent.phase === 'start' || intent.phase === 'end' ? intent.phase : 'move',
      x: Number(intent.x),
      y: Number(intent.y),
      color: '#ff3d4d',
    };
    if (!Number.isFinite(stroke.x) || !Number.isFinite(stroke.y)) {
      return { ok: false, reason: 'bad-point' };
    }
    room = appendDraw(room, stroke);
    return { ok: true, kind: 'draw', stroke, snapshot: getWatchTogetherSnapshot() };
  }

  if (type === 'clear-draw') {
    room = clearDraw(room);
    return { ok: true, kind: 'clear-draw', snapshot: getWatchTogetherSnapshot() };
  }

  return { ok: false, reason: 'unknown' };
}

/**
 * Socket.IO fallback when LiveKit keys are not set. Control intents only — never volume.
 * @param {import('socket.io').Server} io
 */
export function attachWatchTogetherSockets(io) {
  if (!io || typeof io.of !== 'function') return;
  if (io._watchTogetherAttached) return;
  io._watchTogetherAttached = true;

  const nsp = io.of(SOCKET_NAMESPACE);

  function viewerList() {
    return [...socketViewers.values()].map(publicViewer).filter(Boolean);
  }

  function emitRoom(socket) {
    const payload = {
      ...getWatchTogetherSnapshot(),
      viewers: viewerList(),
    };
    if (socket) socket.emit('watch:state', payload);
    else nsp.to(ROOM_NAME).emit('watch:state', payload);
  }

  nsp.on('connection', (socket) => {
    socket.on('watch:join', async (payload = {}) => {
      const code = typeof payload.code === 'string' ? payload.code : '';
      if (!verifyWatchTogetherAccess(code).valid) {
        socket.emit('watch:error', { reason: 'invalid-code' });
        socket.disconnect(true);
        return;
      }
      try {
        await assertTheaterHasSeat();
      } catch (err) {
        if (err?.code === 'THEATER_FULL') {
          socket.emit('watch:error', { reason: 'theater-full', max: MAX_VIEWERS });
          socket.disconnect(true);
          return;
        }
        throw err;
      }
      const viewer = buildViewerRecord(socket.id, payload);
      socketViewers.set(socket.id, viewer);
      socket.data.joined = true;
      socket.data.name = viewer.name;
      socket.join(ROOM_NAME);
      emitRoom(socket);
      nsp.to(ROOM_NAME).emit('watch:viewers', viewerList());
    });

    socket.on('watch:location', (payload = {}) => {
      if (!socket.data.joined) return;
      const current = socketViewers.get(socket.id);
      if (!current) return;
      const loc = sanitizeLocation(payload.lat, payload.lng);
      if (!loc) return;
      socketViewers.set(socket.id, { ...current, lat: loc.lat, lng: loc.lng });
      nsp.to(ROOM_NAME).emit('watch:viewers', viewerList());
    });

    socket.on('watch:intent', (intent = {}) => {
      if (!socket.data.joined) return;
      const result = handleWatchIntent(intent, {
        name: socket.data.name,
        id: socket.id,
      });
      if (!result.ok) {
        if (result.reason && result.reason !== 'empty' && result.reason !== 'unknown') {
          socket.emit('watch:error', { reason: result.reason });
        }
        return;
      }
      if (result.kind === 'playback') {
        nsp.to(ROOM_NAME).emit('watch:playback', publicPlaybackState(result.snapshot));
        return;
      }
      if (result.kind === 'chat') {
        nsp.to(ROOM_NAME).emit('watch:chat', result.message);
        return;
      }
      if (result.kind === 'draw') {
        socket.to(ROOM_NAME).emit('watch:draw', result.stroke);
        return;
      }
      if (result.kind === 'clear-draw') {
        nsp.to(ROOM_NAME).emit('watch:clear-draw');
      }
    });

    socket.on('disconnect', () => {
      if (!socketViewers.has(socket.id)) return;
      socketViewers.delete(socket.id);
      nsp.to(ROOM_NAME).emit('watch:viewers', viewerList());
    });
  });
}

export default {
  DRIFT_PLAYING_S,
  DRIFT_PAUSED_S,
  extractYouTubeId,
  parseMediaUrl,
  createRoomState,
  expectedMediaTime,
  needsDriftCorrection,
  applyIntent,
  publicPlaybackState,
  sanitizeLocation,
  publicViewer,
  buildViewerRecord,
  handleWatchIntent,
  getWatchTogetherSnapshot,
  getWatchTogetherStatus,
  mintWatchTogetherLivekitToken,
  setWatchTogetherLivekitTokenFactory,
  setWatchTogetherOccupancyReader,
  getTheaterOccupancy,
  resetWatchTogetherRoom,
  LIVEKIT_ROOM_NAME,
  MAX_VIEWERS,
  attachWatchTogetherSockets,
};
