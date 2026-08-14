/**
 * Watch together realtime — LiveKit first (same keys as Studio), Socket.IO fallback.
 * Data packets carry control intents. Participant metadata carries map location.
 * Volume is never published.
 */
(function (global) {
  'use strict';

  const NS = '/watch-together';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const state = {
    transport: null,
    code: '',
    name: 'Guest',
    userId: null,
    identity: '',
    socket: null,
    room: null,
    camOn: false,
    handlers: {},
  };

  function emit(name, payload) {
    const fn = state.handlers[name];
    if (typeof fn === 'function') fn(payload);
  }

  function parseMeta(raw) {
    try {
      const data = JSON.parse(raw || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch {
      return {};
    }
  }

  function parseCoords(lat, lng) {
    if (lat == null || lng == null || lat === '' || lng === '') return null;
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
    if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
    if (Math.abs(la) < 1e-5 && Math.abs(ln) < 1e-5) return null;
    return { lat: la, lng: ln };
  }

  function viewerFromParticipant(participant) {
    if (!participant) return null;
    const meta = parseMeta(participant.metadata);
    const coords = parseCoords(meta.lat, meta.lng);
    return {
      id: participant.identity,
      name: participant.name || meta.name || 'Guest',
      userId: meta.userId || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    };
  }

  function livekitViewers() {
    const room = state.room;
    if (!room) return [];
    const list = [];
    const local = viewerFromParticipant(room.localParticipant);
    if (local) list.push(local);
    room.remoteParticipants.forEach((p) => {
      const viewer = viewerFromParticipant(p);
      if (viewer) list.push(viewer);
    });
    return list;
  }

  function publishViewers() {
    emit('viewers', livekitViewers());
  }

  async function persistIntent(payload) {
    if (payload.type === 'draw') return null;
    const res = await fetch('/api/watch-together/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        code: state.code,
        name: state.name,
        identity: state.identity,
      }),
    });
    return res.json().catch(() => null);
  }

  async function publishData(payload, reliable) {
    const room = state.room;
    if (!room?.localParticipant) return;
    const bytes = encoder.encode(JSON.stringify(payload));
    await room.localParticipant.publishData(bytes, {
      reliable: reliable !== false,
      topic: 'watch',
    });
  }

  function handleData(payload, participant) {
    let msg;
    try {
      msg = JSON.parse(decoder.decode(payload));
    } catch {
      return;
    }
    if (!msg || !msg.type) return;
    if (participant && participant.identity === state.identity) return;
    if (msg.type === 'chat') emit('chat', msg.message || msg);
    else if (msg.type === 'draw') emit('draw', msg.stroke || msg);
    else if (msg.type === 'clear-draw') emit('clear-draw');
    else if (msg.type === 'playback' && msg.snapshot) emit('playback', msg.snapshot);
    else emit('intent', msg);
  }

  async function setMetadata(extra) {
    const room = state.room;
    if (!room?.localParticipant?.setMetadata) return;
    const current = parseMeta(room.localParticipant.metadata);
    const next = {
      ...current,
      name: state.name,
      userId: state.userId,
      ...extra,
    };
    await room.localParticipant.setMetadata(JSON.stringify(next));
    publishViewers();
  }

  function attachRemoteAudio(track) {
    const host = document.getElementById('wtRemoteAudio');
    if (!host || !track?.attach) return;
    const el = track.attach();
    el.autoplay = true;
    el.playsInline = true;
    host.appendChild(el);
  }

  async function connectLivekit(opts) {
    const LK = global.LivekitClient;
    if (!LK) return false;
    const res = await fetch('/api/watch-together/livekit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: opts.code,
        name: opts.name,
        userId: opts.userId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token || !data.url) return false;

    const room = new LK.Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    room.on(LK.RoomEvent.DataReceived, handleData);
    room.on(LK.RoomEvent.ParticipantConnected, publishViewers);
    room.on(LK.RoomEvent.ParticipantDisconnected, publishViewers);
    room.on(LK.RoomEvent.ParticipantMetadataChanged, publishViewers);
    room.on(LK.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === 'audio') attachRemoteAudio(track);
      emit('track', { action: 'subscribed', track, publication, participant });
    });
    room.on(LK.RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      emit('track', { action: 'unsubscribed', track, publication, participant });
      track.detach?.().forEach((el) => el.remove());
    });
    room.on(LK.RoomEvent.LocalTrackPublished, (publication, participant) => {
      emit('track', {
        action: 'local',
        track: publication.track,
        publication,
        participant: participant || room.localParticipant,
      });
    });
    room.on(LK.RoomEvent.LocalTrackUnpublished, (publication, participant) => {
      emit('track', {
        action: 'unsubscribed',
        track: publication.track,
        publication,
        participant: participant || room.localParticipant,
      });
    });
    await room.connect(data.url, data.token);
    state.room = room;
    state.identity = data.identity || room.localParticipant.identity;
    state.transport = 'livekit';
    const coords = parseCoords(opts.lat, opts.lng);
    await setMetadata(coords || {});
    publishViewers();
    const snapRes = await fetch(
      '/api/watch-together/state?code=' + encodeURIComponent(opts.code)
    );
    const snap = await snapRes.json().catch(() => null);
    if (snap?.ok) emit('state', snap);
    return true;
  }

  function connectSocket(opts) {
    if (!global.io) return false;
    const socket = global.io(NS, { transports: ['websocket', 'polling'] });
    state.socket = socket;
    state.transport = 'socket';
    socket.on('connect', () => {
      socket.emit('watch:join', {
        code: opts.code,
        name: opts.name,
        userId: opts.userId,
        lat: opts.lat,
        lng: opts.lng,
      });
    });
    socket.on('watch:state', (payload) => emit('state', payload || {}));
    socket.on('watch:playback', (payload) => emit('playback', payload));
    socket.on('watch:viewers', (payload) => emit('viewers', payload || []));
    socket.on('watch:chat', (payload) => emit('chat', payload));
    socket.on('watch:draw', (payload) => emit('draw', payload));
    socket.on('watch:clear-draw', () => emit('clear-draw'));
    socket.on('watch:error', (payload) => emit('error', payload));
    return true;
  }

  async function connect(opts) {
    state.code = opts.code;
    state.name = opts.name || 'Guest';
    state.userId = opts.userId || null;
    state.handlers = opts.handlers || {};
    try {
      const ok = await connectLivekit(opts);
      if (ok) return { transport: 'livekit' };
    } catch (err) {
      console.warn('Watch together LiveKit join failed, using Socket.IO', err);
    }
    connectSocket(opts);
    return { transport: state.transport || 'socket' };
  }

  async function send(payload) {
    if (state.transport === 'livekit' && state.room) {
      const reliable = payload.type !== 'draw';
      if (payload.type === 'chat') {
        const saved = await persistIntent(payload);
        const message = saved?.message || {
          name: state.name,
          text: payload.text,
          at: Date.now(),
        };
        await publishData({ type: 'chat', message }, true);
        emit('chat', message);
        return;
      }
      if (payload.type === 'draw') {
        await publishData({ type: 'draw', stroke: payload }, false);
        return;
      }
      if (payload.type === 'clear-draw') {
        await persistIntent(payload);
        await publishData({ type: 'clear-draw' }, true);
        emit('clear-draw');
        return;
      }
      const saved = await persistIntent(payload);
      const snapshot = saved?.snapshot;
      if (snapshot) {
        await publishData({ type: 'playback', snapshot }, true);
        emit('playback', snapshot);
      }
      return;
    }
    if (state.socket) state.socket.emit('watch:intent', payload);
  }

  async function setLocation(lat, lng) {
    const coords = parseCoords(lat, lng);
    if (!coords) return;
    if (state.transport === 'livekit') {
      await setMetadata(coords);
      return;
    }
    if (state.socket) state.socket.emit('watch:location', coords);
  }

  async function setMic(on) {
    if (!state.room?.localParticipant) return false;
    state.micOn = Boolean(on);
    await state.room.localParticipant.setMicrophoneEnabled(state.micOn);
    return state.micOn;
  }

  async function setCamera(on) {
    if (!state.room?.localParticipant) return false;
    state.camOn = Boolean(on);
    await state.room.localParticipant.setCameraEnabled(state.camOn);
    return state.camOn;
  }

  function transport() {
    return state.transport;
  }

  function micOn() {
    return state.micOn;
  }

  function camOn() {
    return state.camOn;
  }

  global.WatchTogetherSync = {
    connect,
    send,
    setLocation,
    setMic,
    setCamera,
    transport,
    micOn,
    camOn,
  };
})(window);
