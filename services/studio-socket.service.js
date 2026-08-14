/**
 * Studio Socket.IO namespace — presence, transport, take-filed, listen now-playing
 * Media (voice / video / screen) rides LiveKit. This is the control plane.
 * Development work by David Lane
 */
import { normalizeReelCode, sanitizeDisplayName, livekitRoomName } from './studio.service.js';

export const STUDIO_NS = '/studio';

const rooms = new Map();

function roomState(code) {
  if (!rooms.has(code)) {
    rooms.set(code, {
      code,
      members: new Map(),
      transport: { playing: false, recording: false, playhead: 0 },
    });
  }
  return rooms.get(code);
}

export function studioSocketRoom(code) {
  return `reel:${normalizeReelCode(code) || 'lobby'}`;
}

function presencePayload(state) {
  return {
    code: state.code,
    livekitRoom: livekitRoomName(state.code),
    members: [...state.members.values()],
    transport: state.transport,
  };
}

export function attachStudioRealtime(io) {
  if (!io || typeof io.of !== 'function') {
    throw new Error('Socket.IO server required');
  }
  const nsp = io.of(STUDIO_NS);

  nsp.on('connection', (socket) => {
    let joinedCode = null;

    socket.on('studio:join', (payload = {}) => {
      const code = normalizeReelCode(payload.reelCode || payload.code) || 'lobby';
      const name = sanitizeDisplayName(payload.name);
      if (joinedCode && joinedCode !== code) {
        const prev = roomState(joinedCode);
        prev.members.delete(socket.id);
        socket.leave(studioSocketRoom(joinedCode));
        nsp.to(studioSocketRoom(joinedCode)).emit('studio:presence', presencePayload(prev));
      }
      joinedCode = code;
      const state = roomState(code);
      state.members.set(socket.id, {
        id: socket.id,
        name,
        joinedAt: Date.now(),
      });
      socket.join(studioSocketRoom(code));
      socket.emit('studio:joined', presencePayload(state));
      nsp.to(studioSocketRoom(code)).emit('studio:presence', presencePayload(state));
    });

    socket.on('studio:transport', (payload = {}) => {
      if (!joinedCode) return;
      const state = roomState(joinedCode);
      state.transport = {
        playing: Boolean(payload.playing),
        recording: Boolean(payload.recording),
        playhead: Number(payload.playhead) || 0,
        by: sanitizeDisplayName(payload.name),
      };
      socket.to(studioSocketRoom(joinedCode)).emit('studio:transport', state.transport);
    });

    socket.on('studio:take-filed', (payload = {}) => {
      if (!joinedCode) return;
      nsp.to(studioSocketRoom(joinedCode)).emit('studio:take-filed', {
        trackName: String(payload.trackName || 'Take').slice(0, 80),
        duration: Number(payload.duration) || 0,
        by: sanitizeDisplayName(payload.name),
        at: Date.now(),
      });
    });

    socket.on('studio:chat', (payload = {}) => {
      if (!joinedCode) return;
      const text = String(payload.text || '').trim().slice(0, 400);
      if (!text) return;
      nsp.to(studioSocketRoom(joinedCode)).emit('studio:chat', {
        text,
        by: sanitizeDisplayName(payload.name),
        at: Date.now(),
      });
    });

    socket.on('studio:now-playing', (payload = {}) => {
      if (!joinedCode) return;
      nsp.to(studioSocketRoom(joinedCode)).emit('studio:now-playing', {
        title: String(payload.title || '').slice(0, 120),
        releaseId: String(payload.releaseId || '').slice(0, 64),
        by: sanitizeDisplayName(payload.name),
      });
    });

    socket.on('disconnect', () => {
      if (!joinedCode) return;
      const state = roomState(joinedCode);
      state.members.delete(socket.id);
      nsp.to(studioSocketRoom(joinedCode)).emit('studio:presence', presencePayload(state));
    });
  });

  return nsp;
}

export function getRoomSnapshot(rawCode) {
  const code = normalizeReelCode(rawCode) || 'lobby';
  return presencePayload(roomState(code));
}

export default {
  STUDIO_NS,
  attachStudioRealtime,
  studioSocketRoom,
  getRoomSnapshot,
};
