/**
 * Watch together realtime — LiveKit first (same keys as Studio), Socket.IO fallback.
 * Data packets carry control intents. Participant metadata carries map location.
 * Volume is never published.
 */
(function (global) {
  'use strict';

  const NS = '/watch-together';
  const BLUR_KEY = 'wtCamBlur';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function readBlurPref() {
    try {
      const raw = localStorage.getItem(BLUR_KEY);
      if (raw === '1' || raw === 'true') return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function persistBlurPref(on) {
    try {
      localStorage.setItem(BLUR_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  const state = {
    transport: null,
    code: '',
    name: 'Guest',
    userId: null,
    identity: '',
    socket: null,
    room: null,
    micOn: false,
    camOn: false,
    blurOn: readBlurPref(),
    localVideoTrack: null,
    localAudioTrack: null,
    audioUnlockBound: false,
    micError: '',
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
    const code = state.code || global.WatchTogetherGate?.getStoredCode?.() || '';
    try {
      const res = await fetch('/api/watch-together/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          code,
          name: state.name,
          identity: state.identity,
          userId: state.userId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object') return data;
      return { ok: false, error: res.ok ? 'bad-intent' : 'server-error' };
    } catch {
      return { ok: false, error: 'network' };
    }
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

  let voiceCtx = null;
  let meterRaf = 0;

  function voiceContext() {
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    if (!voiceCtx) voiceCtx = new AC();
    if (voiceCtx.state === 'suspended') {
      const resume = voiceCtx.resume();
      if (resume && typeof resume.catch === 'function') resume.catch(() => {});
    }
    return voiceCtx;
  }

  function playAudioEl(el) {
    if (!el) return;
    el.muted = false;
    el.volume = 1;
    const play = el.play?.();
    if (play && typeof play.catch === 'function') play.catch(() => {});
  }

  function attachRemoteAudio(track) {
    if (!track?.attach) return;
    const host = document.getElementById('wtRemoteAudio') || document.body;
    const already = Array.from(track.attachedElements || []);
    if (already.length) {
      already.forEach((el) => {
        if (el.parentNode !== host) host.appendChild(el);
        playAudioEl(el);
      });
      return;
    }
    const el = track.attach();
    el.autoplay = true;
    el.playsInline = true;
    el.muted = false;
    el.volume = 1;
    if (el.parentNode !== host) host.appendChild(el);
    playAudioEl(el);
  }

  function attachExistingRemoteVideo(room) {
    const participants = room?.remoteParticipants;
    if (!participants || typeof participants.forEach !== 'function') return;
    participants.forEach((participant) => {
      const pubs = participant.videoTrackPublications || participant.trackPublications;
      if (!pubs || typeof pubs.forEach !== 'function') return;
      pubs.forEach((pub) => {
        const track = pub?.track;
        if (track && (track.kind === 'video' || pub.kind === 'video')) {
          emit('track', { action: 'subscribed', track, publication: pub, participant });
        }
      });
    });
  }

  function attachExistingRemoteAudio(room) {
    const participants = room?.remoteParticipants;
    if (!participants || typeof participants.forEach !== 'function') return;
    participants.forEach((participant) => {
      const pubs = participant.audioTrackPublications || participant.trackPublications;
      if (!pubs || typeof pubs.forEach !== 'function') return;
      pubs.forEach((pub) => {
        const track = pub?.track;
        if (track && (track.kind === 'audio' || pub.kind === 'audio')) {
          attachRemoteAudio(track);
        }
      });
    });
  }

  async function resumeRemoteAudio() {
    const ctx = voiceContext();
    try {
      await ctx?.resume?.();
    } catch {
      /* ignore */
    }
    try {
      await state.room?.startAudio?.();
    } catch {
      /* autoplay still blocked until a click */
    }
    const host = document.getElementById('wtRemoteAudio');
    if (!host) return;
    host.querySelectorAll('audio').forEach(playAudioEl);
  }

  function stopMicMeter() {
    if (meterRaf) cancelAnimationFrame(meterRaf);
    meterRaf = 0;
  }

  function startMicMeter(track) {
    stopMicMeter();
    const ctx = voiceContext();
    const media = track?.mediaStreamTrack;
    if (!ctx || !media) return;
    let src;
    try {
      src = ctx.createMediaStreamSource(new MediaStream([media]));
    } catch {
      return;
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      emit('talk-level', { rms: Math.sqrt(sum / data.length) });
      meterRaf = requestAnimationFrame(tick);
    };
    tick();
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
    if (res.status === 409 || data.error === 'theater-full') {
      const err = new Error('THEATER_FULL');
      err.code = 'THEATER_FULL';
      err.max = Number(data.max) || 10;
      throw err;
    }
    if (res.status === 503 || data.error === 'LIVEKIT_NOT_CONFIGURED') {
      emit('error', { reason: 'livekit-missing' });
      return false;
    }
    if (!res.ok || !data.token || !data.url) return false;

    const talk = global.LivekitTalkAudio;
    const room = new LK.Room(
      talk
        ? talk.roomOptions({
            publishDefaults: { dtx: false },
            videoCaptureDefaults: {
              facingMode: 'user',
              resolution: LK.VideoPresets?.h360?.resolution,
            },
          })
        : {
            adaptiveStream: true,
            dynacast: true,
            audioCaptureDefaults: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              voiceIsolation: true,
            },
            publishDefaults: { dtx: false },
            videoCaptureDefaults: {
              facingMode: 'user',
              resolution: LK.VideoPresets?.h360?.resolution,
            },
          }
    );
    room.on(LK.RoomEvent.DataReceived, handleData);
    room.on(LK.RoomEvent.ParticipantConnected, publishViewers);
    room.on(LK.RoomEvent.ParticipantDisconnected, publishViewers);
    room.on(LK.RoomEvent.ParticipantMetadataChanged, publishViewers);
    room.on(LK.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (talk?.skipAttach(track, participant) || participant?.isLocal) return;
      if (track.kind === 'audio' || publication?.kind === 'audio') {
        attachRemoteAudio(track);
      }
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
    if (LK.RoomEvent.AudioPlaybackStatusChanged) {
      room.on(LK.RoomEvent.AudioPlaybackStatusChanged, () => {
        if (room.canPlaybackAudio) void resumeRemoteAudio();
      });
    }
    await room.connect(data.url, data.token);
    state.room = room;
    state.identity = data.identity || room.localParticipant.identity;
    state.transport = 'livekit';
    attachExistingRemoteAudio(room);
    attachExistingRemoteVideo(room);
    void resumeRemoteAudio();
    if (!state.audioUnlockBound) {
      state.audioUnlockBound = true;
      document.addEventListener('pointerdown', () => {
        void resumeRemoteAudio();
      });
    }
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
      if (err?.code === 'THEATER_FULL') {
        emit('error', { reason: 'theater-full', max: err.max || 10 });
        return { transport: 'full' };
      }
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
        const message = {
          ...(saved?.message || {
            name: state.name,
            text: payload.text,
            at: Date.now(),
          }),
          spoken: Boolean(payload.fromVoice),
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
        return;
      }
      if (saved && saved.ok === false) {
        emit('error', { reason: saved.error || saved.reason || 'bad-intent' });
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
    const lp = state.room.localParticipant;
    const want = Boolean(on);
    void resumeRemoteAudio();
    try {
      await lp.setMicrophoneEnabled(want, want ? global.LivekitTalkAudio?.capture : undefined);
      await unmuteMic(microphonePublication());
      state.micOn = want;
      state.micError = '';
      if (want) startMicMeter(microphoneTrack());
      else stopMicMeter();
      await resumeRemoteAudio();
      return want;
    } catch (err) {
      console.warn('Watch together mic failed', err);
      state.micOn = false;
      state.micError = err?.name || err?.message || 'mic-failed';
      return false;
    }
  }

  function microphonePublication() {
    const LK = global.LivekitClient;
    const lp = state.room?.localParticipant;
    if (!lp || !LK?.Track?.Source) return null;
    if (typeof lp.getTrackPublication === 'function') {
      return lp.getTrackPublication(LK.Track.Source.Microphone) || null;
    }
    return null;
  }

  function microphoneTrack() {
    return microphonePublication()?.track || null;
  }

  async function unmuteMic(pub) {
    if (!pub) return;
    try {
      if (pub.isMuted && typeof pub.unmute === 'function') await pub.unmute();
    } catch {
      /* ignore */
    }
    const media = pub.track?.mediaStreamTrack;
    if (media) media.enabled = true;
  }

  function cameraPublication() {
    const LK = global.LivekitClient;
    const lp = state.room?.localParticipant;
    if (!lp || !LK?.Track?.Source) return null;
    if (typeof lp.getTrackPublication === 'function') {
      return lp.getTrackPublication(LK.Track.Source.Camera) || null;
    }
    return null;
  }

  function cameraTrack() {
    return cameraPublication()?.track || state.localVideoTrack || null;
  }

  function trackIsLive(track) {
    const media = track?.mediaStreamTrack || track;
    return Boolean(track) && media?.readyState !== 'ended';
  }

  function processorName(track) {
    const proc = typeof track?.getProcessor === 'function' ? track.getProcessor() : null;
    return proc?.name || '';
  }

  async function syncBlurProcessor(track) {
    if (!track || typeof track.setProcessor !== 'function') return false;
    const current = processorName(track);
    if (state.blurOn) {
      if (current === 'wt-background-blur') return true;
      const factory = global.WatchTogetherCamBlur;
      if (!factory?.createProcessor) return false;
      try {
        await track.setProcessor(
          factory.createProcessor({
            onFail: () => {
              state.blurOn = false;
              persistBlurPref(false);
              emit('blur', { on: false, error: 'unavailable' });
            },
          })
        );
        return true;
      } catch (err) {
        console.warn('Watch together blur failed', err);
        state.blurOn = false;
        persistBlurPref(false);
        emit('blur', { on: false, error: 'unavailable' });
        return false;
      }
    }
    if (current && typeof track.stopProcessor === 'function') {
      try {
        await track.stopProcessor();
      } catch (err) {
        console.warn('Watch together blur stop failed', err);
      }
    }
    return false;
  }

  async function stopCamera() {
    const lp = state.room?.localParticipant;
    const track = cameraTrack();
    if (track && typeof track.stopProcessor === 'function') {
      try {
        await track.stopProcessor();
      } catch {
        /* ignore */
      }
    }
    try {
      await lp.setCameraEnabled(false);
    } catch {
      if (track && typeof lp?.unpublishTrack === 'function') {
        try {
          await lp.unpublishTrack(track);
        } catch {
          /* ignore */
        }
      }
    }
    try {
      track?.stop?.();
    } catch {
      /* ignore */
    }
    state.localVideoTrack = null;
    state.camOn = false;
  }

  function emitLocalVideo(track) {
    const lp = state.room?.localParticipant;
    if (!track || !lp) return;
    emit('track', {
      action: 'local',
      track,
      publication: cameraPublication(),
      participant: lp,
    });
  }

  async function createCameraTrack() {
    const LK = global.LivekitClient;
    if (typeof LK.createLocalVideoTrack !== 'function') {
      throw new Error('no-local-video');
    }
    const attempts = [];
    if (LK.VideoPresets?.h360?.resolution) {
      attempts.push({ facingMode: 'user', resolution: LK.VideoPresets.h360.resolution });
    }
    attempts.push({ facingMode: 'user' });
    let lastErr;
    for (const opts of attempts) {
      try {
        return await LK.createLocalVideoTrack(opts);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('camera');
  }

  async function startCamera() {
    const lp = state.room.localParticipant;
    let track = cameraTrack();
    if (trackIsLive(track)) {
      state.camOn = true;
      emitLocalVideo(track);
      return true;
    }
    try {
      await lp.setCameraEnabled(true);
      track = cameraTrack();
    } catch (err) {
      console.warn('Watch together setCameraEnabled failed', err);
    }
    if (!trackIsLive(track)) {
      try {
        track = await createCameraTrack();
        state.localVideoTrack = track;
        await lp.publishTrack(track);
      } catch (err) {
        console.warn('Watch together cam publish failed', err);
        return false;
      }
    }
    if (!trackIsLive(track)) return false;
    state.camOn = true;
    emitLocalVideo(track);
    return true;
  }

  async function setCamera(on) {
    if (!state.room?.localParticipant) return false;
    try {
      if (!on) {
        await stopCamera();
        return false;
      }
      return await startCamera();
    } catch (err) {
      console.warn('Watch together cam failed', err);
      state.camOn = false;
      return false;
    }
  }

  async function setBlur(on) {
    state.blurOn = Boolean(on);
    persistBlurPref(state.blurOn);
    const track = cameraTrack();
    if (state.camOn && track) {
      const ok = await syncBlurProcessor(track);
      if (state.blurOn && !ok) return false;
    }
    emit('blur', { on: state.blurOn });
    return state.blurOn;
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

  function blurOn() {
    return state.blurOn;
  }

  function collectAudioFromParticipant(participant, isLocal, out) {
    if (!participant) return;
    const pubs = participant.audioTrackPublications || participant.trackPublications;
    if (!pubs || typeof pubs.forEach !== 'function') return;
    pubs.forEach((pub) => {
      const track = pub?.track;
      if (!track) return;
      if (track.kind !== 'audio' && pub.kind !== 'audio') return;
      out.push({
        action: isLocal ? 'local' : 'subscribed',
        track,
        publication: pub,
        participant,
      });
    });
  }

  function listAudioTracks() {
    const room = state.room;
    const out = [];
    if (!room) return out;
    collectAudioFromParticipant(room.localParticipant, true, out);
    const remotes = room.remoteParticipants;
    if (remotes && typeof remotes.forEach === 'function') {
      remotes.forEach((participant) => collectAudioFromParticipant(participant, false, out));
    }
    return out;
  }

  function identity() {
    return state.identity;
  }

  global.WatchTogetherSync = {
    connect,
    send,
    setLocation,
    setMic,
    setCamera,
    setBlur,
    resumeRemoteAudio,
    listAudioTracks,
    transport,
    micOn,
    camOn,
    blurOn,
    micError: () => state.micError || '',
    identity,
  };
})(window);
