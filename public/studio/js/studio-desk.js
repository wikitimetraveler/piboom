/**
 * Studio desk — Web Audio timeline + LiveKit media + Socket.IO control
 * Development work by David Lane
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  const els = {
    reelCode: document.getElementById('stReelCode'),
    socketStatus: document.getElementById('stSocketStatus'),
    livekitStatus: document.getElementById('stLivekitStatus'),
    livekitChip: document.getElementById('stLivekitChip'),
    socketChip: document.getElementById('stSocketChip'),
    micChip: document.getElementById('stMicChip'),
    archiveChip: document.getElementById('stArchiveChip'),
    name: document.getElementById('stName'),
    tracks: document.getElementById('stTracks'),
    addTrack: document.getElementById('stAddTrack'),
    musicMode: document.getElementById('stMusicMode'),
    acousticDesk: document.getElementById('stAcousticDesk'),
    tuneKey: document.getElementById('stTuneKey'),
    tuneHard: document.getElementById('stTuneHard'),
    tuner: document.getElementById('stTuner'),
    tunerNote: document.getElementById('stTunerNote'),
    tunerNeedle: document.getElementById('stTunerNeedle'),
    tunerCents: document.getElementById('stTunerCents'),
    meter: document.getElementById('stMeter'),
    meterWrap: document.getElementById('stMeterWrap'),
    meterPeak: document.getElementById('stMeterPeak'),
    micPreamp: document.getElementById('stMicPreamp'),
    micPreampVal: document.getElementById('stMicPreampVal'),
    monitor: document.getElementById('stMonitor'),
    monitorLevel: document.getElementById('stMonitorLevel'),
    monitorVal: document.getElementById('stMonitorVal'),
    timeline: document.getElementById('stTimeline'),
    record: document.getElementById('stRecord'),
    stop: document.getElementById('stStop'),
    play: document.getElementById('stPlay'),
    bounce: document.getElementById('stBounce'),
    release: document.getElementById('stRelease'),
    transportLabel: document.getElementById('stTransportLabel'),
    joinLive: document.getElementById('stJoinLive'),
    mic: document.getElementById('stMic'),
    cam: document.getElementById('stCam'),
    share: document.getElementById('stShare'),
    egress: document.getElementById('stEgress'),
    heygenFace: document.getElementById('stHeygenFace'),
    heygenTile: document.getElementById('stHeygenTile'),
    heygenMedia: document.getElementById('stHeygenMedia'),
    stage: document.getElementById('stStage'),
    onStage: document.getElementById('stOnStage'),
    presence: document.getElementById('stPresence'),
    reedLog: document.getElementById('stReedLog'),
    reedForm: document.getElementById('stReedForm'),
    reedInput: document.getElementById('stReedInput'),
  };

  const state = {
    reel: (params.get('reel') || sessionStorage.getItem('studioReel') || '').toUpperCase(),
    name: 'Player',
    tracks: [],
    armedId: null,
    playhead: 0,
    recording: false,
    countingIn: false,
    countInCancelled: false,
    countInTimer: 0,
    countInTimers: [],
    countBeatLabel: '',
    clickNodes: [],
    monitorNode: null,
    livePeaks: [],
    lastLivePeakAt: 0,
    meterPeak: 0,
    tunerBuf: null,
    tunerCents: 0,
    playing: false,
    audioCtx: null,
    mediaStream: null,
    recorder: null,
    chunks: [],
    recordStartedAt: 0,
    recordClockOrigin: 0,
    recordArmed: null,
    pcmChunks: [],
    pcmNode: null,
    pcmSource: null,
    pcmSilent: null,
    micSource: null,
    preampNode: null,
    limitNode: null,
    captureDest: null,
    captureTap: null,
    graphNodes: [],
    roomIr: null,
    roomIrRate: 0,
    socket: null,
    livekitRoom: null,
    micOn: false,
    camOn: false,
    shareOn: false,
    lastBounce: null,
    heygenRoom: null,
    heygenSessionId: null,
    studioFace: null,
    egressId: null,
    analyser: null,
    raf: 0,
    playSources: [],
    playRaf: 0,
    playOriginTime: 0,
    playOriginHead: 0,
    health: { livekitConfigured: false, egressS3Configured: false },
    lkState: 'unset',
    sawAgent: false,
    agentTimer: 0,
  };

  function isVoiceTrack(track) {
    return window.StarBandAutotune?.isVoiceTrack(track)
      || /vocal|harmony|voice|vox/i.test(String(track?.name || ''));
  }

  function tuneOpts() {
    const raw = String(els.tuneKey?.value || 'chromatic');
    const hard = els.tuneHard ? els.tuneHard.checked : true;
    if (raw === 'chromatic') {
      return { root: 0, scale: 'chromatic', amount: 0.92, speed: hard ? 'hard' : 'natural' };
    }
    const [name, scale] = raw.split(':');
    const key = (window.StarBandAutotune?.KEYS || []).find((item) => item.id === name);
    return {
      root: key ? key.root : 0,
      scale: scale || 'major',
      amount: 0.92,
      speed: hard ? 'hard' : 'natural',
    };
  }

  function tuneSignature() {
    const opts = tuneOpts();
    return `${opts.root}|${opts.scale}|${opts.amount}|${opts.speed}`;
  }

  function bufferForClip(track, clip) {
    if (!clip?.buffer) return null;
    if (!isVoiceTrack(track) || !track.autotune) return clip.buffer;
    const api = window.StarBandAutotune;
    if (!api?.correctBuffer) return clip.buffer;
    const sig = tuneSignature();
    if (clip.tunedBuffer && clip.tunedSig === sig) return clip.tunedBuffer;
    clip.tunedBuffer = api.correctBuffer(clip.buffer, tuneOpts());
    clip.tunedSig = sig;
    return clip.tunedBuffer;
  }

  const LK_CHIP_LABELS = {
    unset: 'Unset',
    ready: 'Ready',
    joining: 'Joining',
    live: 'Live',
    reconnecting: 'Reconnecting',
    down: 'Down',
  };

  const IDENTITY_KEY = 'stLivekitIdentity';
  const PREAMP_KEY = 'stMicPreampDb';
  const PREAMP_DEFAULT_DB = 10;
  const PREAMP_MIN_DB = 0;
  const PREAMP_MAX_DB = 18;

  function stableIdentity(name) {
    try {
      const existing = sessionStorage.getItem(IDENTITY_KEY);
      if (existing) return existing;
      const base = String(name || 'player').replace(/[^\w.-]/g, '-').slice(0, 48);
      const id = (base + '-' + Math.random().toString(36).slice(2, 10)).slice(0, 64);
      sessionStorage.setItem(IDENTITY_KEY, id);
      return id;
    } catch {
      return '';
    }
  }

  function setLkChip(next, line) {
    if (next) state.lkState = next;
    const chip = els.livekitChip;
    if (chip) {
      const key = state.lkState;
      chip.dataset.state = key;
      const room = state.livekitRoom?.name || '';
      chip.textContent = key === 'live' && room ? `Live · ${room}` : (LK_CHIP_LABELS[key] || key);
    }
    if (line != null && els.livekitStatus) els.livekitStatus.textContent = line;
    applyArchiveGate();
  }

  function setSocketChip(live) {
    if (!els.socketChip) return;
    els.socketChip.dataset.state = live ? 'live' : 'down';
    els.socketChip.textContent = live ? 'Socket live' : 'Socket down';
  }

  function syncMicChip() {
    if (!els.micChip) return;
    const music = Boolean(els.musicMode?.checked);
    els.micChip.dataset.state = music ? 'ready' : (state.micOn ? 'live' : 'ready');
    els.micChip.textContent = music
      ? 'Music input · local takes'
      : (state.micOn ? 'Talk mic · live' : 'Talk mic · echo cancel');
  }

  function applyArchiveGate() {
    const s3 = Boolean(state.health.egressS3Configured);
    const live = state.lkState === 'live' || state.lkState === 'reconnecting';
    if (els.egress) {
      els.egress.disabled = !s3 || !live;
      els.egress.title = s3
        ? 'Archive mics only — not the timeline, not a WAV bounce.'
        : 'Archive needs S3 dest (LIVEKIT_EGRESS_S3_*). Use Record for the timeline and Bounce for a local WAV.';
    }
    if (els.archiveChip) {
      els.archiveChip.dataset.state = s3 ? 'ready' : 'unset';
      els.archiveChip.textContent = s3 ? 'Archive ready' : 'Archive needs S3';
    }
  }

  function playerName() {
    state.name = String(els.name?.value || 'Player').trim() || 'Player';
    return state.name;
  }

  function clampPreampDb(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return PREAMP_DEFAULT_DB;
    return Math.max(PREAMP_MIN_DB, Math.min(PREAMP_MAX_DB, n));
  }

  function micPreampDb() {
    return clampPreampDb(els.micPreamp?.value);
  }

  function micPreampGain() {
    return 10 ** (micPreampDb() / 20);
  }

  function syncPreampLabel() {
    if (!els.micPreampVal) return;
    const db = micPreampDb();
    els.micPreampVal.textContent = db === 0 ? '0 dB' : `+${db} dB`;
  }

  function applyMicPreamp() {
    const gain = micPreampGain();
    if (state.preampNode) state.preampNode.gain.value = gain;
    const lp = state.livekitRoom?.localParticipant;
    if (state.micOn && lp && window.LivekitTalkAudio?.applyLocalMicGain) {
      window.LivekitTalkAudio.applyLocalMicGain(lp, gain);
    }
    try {
      localStorage.setItem(PREAMP_KEY, String(micPreampDb()));
    } catch (_) {
      /* ignore */
    }
    syncPreampLabel();
  }

  function boothBpm() {
    const api = window.StarBandBooth;
    return api ? api.clampBpm(els.bpm?.value) : 92;
  }

  function countInBeatCount() {
    const api = window.StarBandBooth;
    return api ? api.countInBeats(els.countIn?.value) : 0;
  }

  function beatInterval() {
    const api = window.StarBandBooth;
    return api ? api.beatSec(boothBpm()) : 60 / boothBpm();
  }

  function monitorGain() {
    if (!els.monitor?.checked) return 0;
    const n = Number(els.monitorLevel?.value);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.28;
  }

  function syncMonitorLabel() {
    if (!els.monitorVal) return;
    els.monitorVal.textContent = `${Math.round(monitorGain() * 100)}%`;
  }

  function applyMonitor() {
    if (state.monitorNode) state.monitorNode.gain.value = monitorGain();
    syncMonitorLabel();
  }

  function syncTransportLabel() {
    if (!els.transportLabel) return;
    const head = `Playhead ${formatTime(state.playhead)}`;
    if (state.countingIn) {
      els.transportLabel.textContent = `${head} · Count-in ${state.countBeatLabel || ''}`.trim();
      return;
    }
    if (state.recording) {
      els.transportLabel.textContent = `${head} · REC`;
      return;
    }
    els.transportLabel.textContent = `${head} · Record = timeline · Bounce = WAV in this tab`;
  }

  function syncBoothUi() {
    const lamp = els.recLamp;
    if (lamp) {
      if (state.countingIn) {
        lamp.dataset.state = 'count';
        lamp.textContent = state.countBeatLabel || 'Count';
      } else if (state.recording) {
        lamp.dataset.state = 'rec';
        lamp.textContent = 'REC';
      } else {
        lamp.dataset.state = 'idle';
        lamp.textContent = 'Idle';
      }
    }
    document.body.classList.toggle('is-recording', Boolean(state.recording));
    document.body.classList.toggle('is-count-in', Boolean(state.countingIn));
    if (els.record) {
      const hot = state.recording || state.countingIn;
      els.record.setAttribute('aria-pressed', hot ? 'true' : 'false');
      els.record.textContent = state.countingIn ? 'Count-in' : (state.recording ? 'Recording' : 'Record');
    }
    syncTransportLabel();
  }

  function stopClicks() {
    (state.clickNodes || []).forEach((node) => {
      try {
        if (typeof node.stop === 'function') node.stop();
      } catch (_) {
        /* already ended */
      }
      try {
        node.disconnect();
      } catch (_) {
        /* already disconnected */
      }
    });
    state.clickNodes = [];
  }

  function clearCountTimers() {
    (state.countInTimers || []).forEach((id) => clearTimeout(id));
    state.countInTimers = [];
    if (state.countInTimer) {
      clearTimeout(state.countInTimer);
      state.countInTimer = 0;
    }
  }

  function fireClick(ctx, when, accent) {
    const api = window.StarBandBooth;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = api ? api.clickHz(accent) : (accent ? 1320 : 880);
    const peak = accent ? 0.2 : 0.12;
    const dur = accent ? 0.05 : 0.035;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.02);
    state.clickNodes.push(osc, gain);
  }

  function scheduleClickRun(ctx, origin, beats) {
    const api = window.StarBandBooth;
    const interval = beatInterval();
    for (let i = 0; i < beats; i += 1) {
      const accent = api ? api.isCountDownbeat(i) : i % 4 === 0;
      fireClick(ctx, origin + i * interval, accent);
    }
  }

  function pulseCountLamp(ctx, origin, beats, interval) {
    for (let i = 0; i < beats; i += 1) {
      const delay = Math.max(0, (origin + i * interval - ctx.currentTime) * 1000);
      const beat = (i % 4) + 1;
      const id = window.setTimeout(() => {
        if (!state.countingIn || state.countInCancelled) return;
        state.countBeatLabel = String(beat);
        syncBoothUi();
      }, delay);
      state.countInTimers.push(id);
    }
  }

  function waitForAudioTime(ctx, when) {
    return new Promise((resolve) => {
      const tick = () => {
        if (state.countInCancelled) {
          resolve(false);
          return;
        }
        if (ctx.currentTime >= when - 0.01) {
          resolve(true);
          return;
        }
        state.countInTimer = window.setTimeout(tick, 16);
      };
      tick();
    });
  }

  function formatTime(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${rem.toFixed(2).padStart(5, '0')}`;
  }

  function acousticOn() {
    return els.acousticDesk ? els.acousticDesk.checked : true;
  }

  function ensureAudio() {
    if (!state.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      try {
        state.audioCtx = new AC({ sampleRate: 48000, latencyHint: 'interactive' });
      } catch (_) {
        state.audioCtx = new AC();
      }
    }
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
    return state.audioCtx;
  }

  function acousticProfile(track) {
    const name = String(track.name || '').toLowerCase();
    if (track.kind === 'acoustic-guitar' && /neck/.test(name)) {
      return {
        hpf: 120,
        notch: { f: 250, q: 0.85, g: -2 },
        presence: { f: 3400, q: 0.85, g: 2.6 },
        air: { f: 10500, g: 2.2 },
        compress: { threshold: -18, ratio: 2.4, attack: 0.012, release: 0.22, knee: 14 },
        send: 0.14,
      };
    }
    if (track.kind === 'acoustic-guitar') {
      return {
        hpf: 70,
        notch: { f: 430, q: 1.05, g: -2.8 },
        body: { f: 155, q: 0.8, g: 2.4 },
        presence: { f: 900, q: 0.7, g: 1.4 },
        air: { f: 7800, g: -1.6 },
        compress: { threshold: -16, ratio: 2.2, attack: 0.018, release: 0.28, knee: 16 },
        send: 0.18,
      };
    }
    if (/vocal|harmony/.test(name)) {
      return {
        hpf: 85,
        notch: { f: 320, q: 0.9, g: -1.4 },
        presence: { f: 2700, q: 1, g: 1.8 },
        air: { f: 11000, g: 1.6 },
        compress: { threshold: -14, ratio: 2.8, attack: 0.008, release: 0.16, knee: 12 },
        send: 0.11,
      };
    }
    return { hpf: 45, send: 0.08 };
  }

  function addBiquad(ctx, type, freq, q, gainDb) {
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    if (Number.isFinite(q)) filter.Q.value = q;
    if (Number.isFinite(gainDb)) filter.gain.value = gainDb;
    return filter;
  }

  function getRoomImpulse(ctx) {
    if (state.roomIr && state.roomIrRate === ctx.sampleRate) return state.roomIr;
    const seconds = 1.05;
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const ir = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = ir.getChannelData(ch);
      const skew = ch * 0.0063;
      let lp = 0;
      const early = [0.011 + skew, 0.017 + skew, 0.023 + skew, 0.031 + skew, 0.044 + skew];
      const gains = [0.55, 0.32, 0.22, 0.16, 0.1];
      for (let i = 0; i < length; i += 1) {
        const t = i / rate;
        let sample = 0;
        for (let e = 0; e < early.length; e += 1) {
          if (i === Math.floor(early[e] * rate)) sample += gains[e];
        }
        sample += (Math.random() * 2 - 1) * Math.exp(-t * 3.6) * 0.2;
        lp = lp * 0.58 + sample * 0.42;
        data[i] = lp;
      }
    }
    state.roomIr = ir;
    state.roomIrRate = rate;
    return ir;
  }

  function createMixBus(ctx, nodes) {
    const master = ctx.createGain();
    master.gain.value = 1;
    nodes.push(master);
    const rumble = addBiquad(ctx, 'highpass', 38, 0.7);
    master.connect(rumble);
    nodes.push(rumble);
    let output = rumble;
    if (acousticOn()) {
      const glue = ctx.createDynamicsCompressor();
      glue.threshold.value = -10;
      glue.knee.value = 12;
      glue.ratio.value = 2.6;
      glue.attack.value = 0.02;
      glue.release.value = 0.32;
      rumble.connect(glue);
      nodes.push(glue);
      const makeup = ctx.createGain();
      makeup.gain.value = 1.08;
      glue.connect(makeup);
      nodes.push(makeup);
      output = makeup;
    }
    let roomIn = null;
    if (acousticOn() && ctx.createConvolver) {
      const conv = ctx.createConvolver();
      conv.buffer = getRoomImpulse(ctx);
      conv.normalize = true;
      const wet = ctx.createGain();
      wet.gain.value = 0.85;
      conv.connect(wet);
      wet.connect(master);
      nodes.push(conv, wet);
      roomIn = conv;
    }
    return { master, roomIn, output };
  }

  function connectChain(ctx, input, track, master, roomIn, nodes) {
    let node = input;
    const hook = (next) => {
      node.connect(next);
      nodes.push(next);
      node = next;
      return next;
    };
    const profile = acousticOn() ? acousticProfile(track) : { send: 0 };
    if (profile.hpf) hook(addBiquad(ctx, 'highpass', profile.hpf, 0.7));
    if (profile.notch) hook(addBiquad(ctx, 'peaking', profile.notch.f, profile.notch.q, profile.notch.g));
    if (profile.body) hook(addBiquad(ctx, 'peaking', profile.body.f, profile.body.q, profile.body.g));
    if (profile.presence) hook(addBiquad(ctx, 'peaking', profile.presence.f, profile.presence.q, profile.presence.g));
    if (profile.air) hook(addBiquad(ctx, 'highshelf', profile.air.f, 0.7, profile.air.g));
    if (profile.compress) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = profile.compress.threshold;
      comp.ratio.value = profile.compress.ratio;
      comp.attack.value = profile.compress.attack;
      comp.release.value = profile.compress.release;
      comp.knee.value = profile.compress.knee;
      hook(comp);
    }
    hook((() => {
      const gain = ctx.createGain();
      gain.gain.value = track.gain;
      return gain;
    })());
    if (typeof ctx.createStereoPanner === 'function') {
      const pan = ctx.createStereoPanner();
      pan.pan.value = track.pan;
      hook(pan);
    }
    node.connect(master);
    if (roomIn && profile.send > 0) {
      const send = ctx.createGain();
      send.gain.value = profile.send;
      node.connect(send);
      send.connect(roomIn);
      nodes.push(send);
    }
  }

  function addTrack(name, opts = {}) {
    const track = {
      id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      name: name || `Track ${state.tracks.length + 1}`,
      kind: opts.kind || 'audio',
      clips: [],
      gain: Number.isFinite(opts.gain) ? opts.gain : 1,
      pan: Number.isFinite(opts.pan) ? opts.pan : 0,
      muted: false,
      autotune: opts.autotune != null
        ? Boolean(opts.autotune)
        : isVoiceTrack({ name, kind: opts.kind || 'audio' }),
    };
    state.tracks.push(track);
    if (!state.armedId || opts.arm) state.armedId = track.id;
    renderTracks();
    drawTimeline();
    return track;
  }

  function renderTracks() {
    if (!els.tracks) return;
    els.tracks.innerHTML = '';
    state.tracks.forEach((track) => {
      const row = document.createElement('div');
      const armed = track.id === state.armedId;
      const kindLabel = track.kind === 'acoustic-guitar'
        ? 'Acoustic guitar · '
        : isVoiceTrack(track)
          ? 'Voice · '
          : '';
      row.className = `st-track${armed ? ' is-armed' : ''}${track.kind === 'acoustic-guitar' ? ' st-track--guitar' : ''}${isVoiceTrack(track) ? ' st-track--vocal' : ''}`;
      row.setAttribute('data-track', track.id);
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-pressed', armed ? 'true' : 'false');
      row.innerHTML = `
        <div class="st-track-head">
          <button type="button" class="st-track-pick" data-arm="${track.id}" aria-pressed="${armed ? 'true' : 'false'}">
            <strong>${escapeHtml(track.name)}</strong>
            <span class="st-status">${kindLabel}${track.clips.length} clip${track.clips.length === 1 ? '' : 's'}${armed ? ' · recording here' : ''}</span>
          </button>
          <div class="st-track-keys">
            <button type="button" class="st-arm" data-arm="${track.id}" aria-pressed="${armed ? 'true' : 'false'}">${armed ? 'Armed' : 'Arm'}</button>
            <button type="button" class="st-mute" data-mute="${track.id}">${track.muted ? 'Unmute' : 'Mute'}</button>
          </div>
        </div>
        <label class="st-fader">Gain
          <input type="range" min="0" max="2" step="0.01" value="${track.gain}" data-gain="${track.id}"/>
        </label>
        <label class="st-fader">Pan
          <input type="range" min="-1" max="1" step="0.01" value="${track.pan}" data-pan="${track.id}"/>
        </label>
        ${isVoiceTrack(track) ? `<label class="st-fader st-fader--check">Autotune
          <input type="checkbox" data-autotune="${track.id}" ${track.autotune ? 'checked' : ''}/>
        </label>` : ''}
      `;
      row.querySelectorAll('[data-arm]').forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          armTrack(track.id);
        });
      });
      row.querySelector('[data-mute]')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        track.muted = !track.muted;
        renderTracks();
        drawTimeline();
      });
      els.tracks.appendChild(row);
    });
  }

  function armTrack(trackId, announce) {
    const track = state.tracks.find((t) => t.id === trackId);
    if (!track) return;
    state.armedId = track.id;
    renderTracks();
    drawTimeline();
    if (announce !== false) {
      appendReed(`Armed ${track.name}. Record files on this track.`);
    }
  }

  function timelineRowHeight(canvas) {
    return Math.max(36, canvas.height / Math.max(state.tracks.length, 1) - 8);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function drawTimeline() {
    const canvas = els.timeline;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);
    const seconds = Math.max(12, ...state.tracks.flatMap((t) => t.clips.map((c) => c.offset + c.duration)), state.playhead + 2);
    const px = w / seconds;
    const rowH = timelineRowHeight(canvas);

    state.tracks.forEach((track, index) => {
      const y = 8 + index * (rowH + 8);
      ctx.fillStyle = '#151515';
      ctx.fillRect(0, y, w, rowH);
      track.clips.forEach((clip) => {
        const x = clip.offset * px;
        const cw = Math.max(2, clip.duration * px);
        ctx.fillStyle = track.id === state.armedId ? '#d4a017' : '#3a3220';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, y + 4, cw, rowH - 8);
        ctx.globalAlpha = 1;
        if (clip.peaks) {
          ctx.strokeStyle = '#111';
          ctx.beginPath();
          const mid = y + rowH / 2;
          clip.peaks.forEach((peak, i) => {
            const pxPos = x + (i / clip.peaks.length) * cw;
            ctx.moveTo(pxPos, mid - peak * (rowH / 2 - 6));
            ctx.lineTo(pxPos, mid + peak * (rowH / 2 - 6));
          });
          ctx.stroke();
        }
      });
      ctx.fillStyle = track.id === state.armedId ? '#e8c872' : '#8a7a58';
      ctx.font = '11px Cinzel, Times New Roman, serif';
      ctx.fillText(track.name, 8, y + 14);
    });

    const playX = state.playhead * px;
    ctx.strokeStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, h);
    ctx.stroke();
    if (els.transportLabel) els.transportLabel.textContent = `Playhead ${formatTime(state.playhead)}`;
  }

  function peaksFromBuffer(buffer) {
    const data = buffer.getChannelData(0);
    const buckets = 80;
    const size = Math.floor(data.length / buckets) || 1;
    const peaks = [];
    for (let i = 0; i < buckets; i += 1) {
      let max = 0;
      for (let j = 0; j < size; j += 1) {
        max = Math.max(max, Math.abs(data[i * size + j] || 0));
      }
      peaks.push(max);
    }
    return peaks;
  }

  async function openMicStream() {
    const music = !!els.musicMode?.checked;
    const audio = {
      echoCancellation: !music,
      noiseSuppression: !music,
      autoGainControl: !music,
      voiceIsolation: false,
      channelCount: { ideal: 1 },
      sampleRate: { ideal: 48000 },
      sampleSize: { ideal: 16 },
      latency: { ideal: 0 },
      googEchoCancellation: !music,
      googNoiseSuppression: !music,
      googAutoGainControl: !music,
      googHighpassFilter: false,
      googTypingNoiseDetection: false,
    };
    try {
      return await navigator.mediaDevices.getUserMedia({ audio });
    } catch (_) {
      return navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: !music,
          noiseSuppression: !music,
          autoGainControl: !music,
        },
      });
    }
  }

  async function armMic() {
    const ctx = ensureAudio();
    teardownCapture();
    state.mediaStream = await openMicStream();
    const source = ctx.createMediaStreamSource(state.mediaStream);
    const preamp = ctx.createGain();
    preamp.gain.value = micPreampGain();
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -6;
    limit.knee.value = 8;
    limit.ratio.value = 12;
    limit.attack.value = 0.003;
    limit.release.value = 0.18;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const dest = ctx.createMediaStreamDestination();
    source.connect(preamp);
    preamp.connect(limit);
    limit.connect(analyser);
    limit.connect(dest);
    state.micSource = source;
    state.preampNode = preamp;
    state.limitNode = limit;
    state.pcmSource = limit;
    state.captureDest = dest;
    state.analyser = analyser;
    pumpMeter();
  }

  function updateTuner(rms) {
    const face = els.tuner;
    const api = window.StarBandAutotune;
    if (!face || !state.analyser || !api?.readPitch) return;
    const n = state.analyser.fftSize || 2048;
    if (!state.tunerBuf || state.tunerBuf.length !== n) state.tunerBuf = new Float32Array(n);
    const buf = state.tunerBuf;
    if (typeof state.analyser.getFloatTimeDomainData === 'function') {
      state.analyser.getFloatTimeDomainData(buf);
    } else {
      const bytes = new Uint8Array(n);
      state.analyser.getByteTimeDomainData(bytes);
      for (let i = 0; i < n; i += 1) buf[i] = (bytes[i] - 128) / 128;
    }
    const reading = rms < 0.012 ? { voiced: false, note: '—', cents: 0, inTune: false } : api.readPitch(buf, state.audioCtx.sampleRate, {
      root: 0,
      scale: 'chromatic',
    });
    const cents = reading.voiced ? reading.cents : 0;
    state.tunerCents += (cents - state.tunerCents) * 0.28;
    const deg = state.tunerCents * 0.8;
    if (els.tunerNeedle) els.tunerNeedle.style.transform = `rotate(${deg}deg)`;
    if (els.tunerNote) els.tunerNote.textContent = reading.voiced ? reading.note : '—';
    if (els.tunerCents) {
      els.tunerCents.textContent = reading.voiced
        ? (reading.inTune ? 'In tune' : `${cents > 0 ? '+' : ''}${Math.round(cents)} cents`)
        : 'Live pitch · guitar stays dry';
    }
    face.dataset.state = !reading.voiced ? 'idle' : (reading.inTune ? 'in' : 'out');
  }

  function pumpMeter() {
    if (!state.analyser || !els.meter) return;
    const data = new Uint8Array(state.analyser.frequencyBinCount);
    const wrap = els.meterWrap || els.meter.parentElement;
    const loop = () => {
      if (!state.analyser) return;
      state.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      els.meter.style.width = `${Math.min(100, rms * 280)}%`;
      if (rms > state.meterPeak) state.meterPeak = rms;
      else state.meterPeak *= 0.985;
      if (els.meterPeak) {
        els.meterPeak.style.left = `${Math.min(100, state.meterPeak * 280)}%`;
      }
      if (wrap) wrap.classList.toggle('is-hot', rms > 0.22);
      updateTuner(rms);
      if (state.recording || state.countingIn || state.mediaStream) state.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  function mixEnd() {
    const ends = state.tracks.flatMap((t) => t.clips.map((c) => c.offset + c.duration));
    return ends.length ? Math.max(...ends) : 0;
  }

  function disconnectNodes(nodes) {
    (nodes || []).forEach((node) => {
      try {
        node.disconnect();
      } catch (_) {
        /* already disconnected */
      }
    });
  }

  function stopSources() {
    (state.playSources || []).forEach((src) => {
      try {
        src.stop();
      } catch (_) {
        /* already ended */
      }
    });
    state.playSources = [];
    disconnectNodes(state.graphNodes);
    state.graphNodes = [];
    if (state.playRaf) {
      cancelAnimationFrame(state.playRaf);
      state.playRaf = 0;
    }
  }

  function teardownCapture() {
    if (state.pcmNode) {
      try {
        state.pcmNode.onaudioprocess = null;
      } catch (_) {
        /* ignore */
      }
    }
    disconnectNodes([
      state.pcmNode,
      state.pcmSilent,
      state.pcmSource,
      state.preampNode,
      state.limitNode,
      state.micSource,
      state.captureDest,
      state.captureTap,
      state.analyser,
    ]);
    state.pcmNode = null;
    state.pcmSilent = null;
    state.pcmSource = null;
    state.preampNode = null;
    state.limitNode = null;
    state.micSource = null;
    state.captureTap = null;
    if (state.captureDest) {
      try {
        state.captureDest.stream.getTracks().forEach((track) => track.stop());
      } catch (_) {
        /* ignore */
      }
    }
    state.captureDest = null;
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach((track) => track.stop());
      state.mediaStream = null;
    }
    state.analyser = null;
    if (els.tuner) els.tuner.dataset.state = 'idle';
    if (els.tunerNote) els.tunerNote.textContent = '—';
    if (els.tunerCents) els.tunerCents.textContent = 'Live pitch · guitar stays dry';
    if (els.tunerNeedle) els.tunerNeedle.style.transform = 'rotate(0deg)';
    state.tunerCents = 0;
  }

  function tickClock() {
    if (!state.audioCtx) return;
    if (state.recording) {
      state.playhead = state.recordStartedAt + Math.max(0, state.audioCtx.currentTime - state.recordClockOrigin);
    } else if (state.playing) {
      state.playhead = state.playOriginHead + Math.max(0, state.audioCtx.currentTime - state.playOriginTime);
      const end = mixEnd();
      if (end > 0 && state.playhead >= end) {
        state.playhead = end;
        stopSources();
        state.playing = false;
        emitTransport();
        drawTimeline();
        return;
      }
    } else {
      return;
    }
    drawTimeline();
    state.playRaf = requestAnimationFrame(tickClock);
  }

  function startPcmCapture(ctx) {
    state.pcmChunks = [];
    const silent = ctx.createGain();
    silent.gain.value = 0;
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      state.pcmChunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    state.pcmSource.connect(processor);
    processor.connect(silent);
    silent.connect(ctx.destination);
    state.pcmNode = processor;
    state.pcmSilent = silent;
  }

  function bufferFromPcm(ctx, trimStart = 0) {
    const total = state.pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const skip = Math.max(0, Math.min(Math.max(0, total - 1), trimStart | 0));
    const length = Math.max(1, total - skip);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const dest = buffer.getChannelData(0);
    let offset = 0;
    let remainingSkip = skip;
    state.pcmChunks.forEach((chunk) => {
      if (remainingSkip >= chunk.length) {
        remainingSkip -= chunk.length;
        return;
      }
      const start = remainingSkip;
      remainingSkip = 0;
      dest.set(chunk.subarray(start), offset);
      offset += chunk.length - start;
    });
    return buffer;
  }

  function fileTake(armed, audioBuf, blob) {
    armed.clips.push({
      offset: state.recordStartedAt,
      duration: audioBuf.duration,
      buffer: audioBuf,
      peaks: peaksFromBuffer(audioBuf),
      blob: blob || null,
    });
    state.playhead = state.recordStartedAt + audioBuf.duration;
    state.socket?.emit('studio:take-filed', {
      name: playerName(),
      trackName: armed.name,
      duration: audioBuf.duration,
    });
    appendReed(`Take filed on ${armed.name} (${formatTime(audioBuf.duration)}). Hit Play to hear the acoustic desk.`);
    if (isVoiceTrack(armed) && armed.autotune && window.StarBandAutotune?.correctBuffer) {
      try {
        const clip = armed.clips[armed.clips.length - 1];
        clip.tunedBuffer = window.StarBandAutotune.correctBuffer(clip.buffer, tuneOpts());
        clip.tunedSig = tuneSignature();
        appendReed(`Autotune on ${armed.name}. Guitar stays dry.`);
      } catch (err) {
        appendReed(`Autotune skipped: ${err.message}`);
      }
    }
    renderTracks();
    drawTimeline();
  }

  async function startRecord() {
    if (state.recording) return;
    stopSources();
    state.playing = false;
    const armed = state.tracks.find((t) => t.id === state.armedId) || addTrack();
    state.armedId = armed.id;
    state.recordArmed = armed;
    const ctx = ensureAudio();
    if (ctx.state === 'suspended') await ctx.resume();
    await armMic();
    state.recordStartedAt = state.playhead;
    const t0 = ctx.currentTime + 0.03;
    state.recordClockOrigin = t0;
    state.pcmTrimStart = 0;
    state.recording = true;
    try {
      startPcmCapture(ctx);
      state.pcmTrimStart = Math.max(0, Math.round((t0 - ctx.currentTime) * ctx.sampleRate));
    } catch (err) {
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')
        ? 'audio/webm;codecs=pcm'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      state.chunks = [];
      state.recorder = new MediaRecorder(state.captureDest?.stream || state.mediaStream, { mimeType: mime });
      state.recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) state.chunks.push(event.data);
      };
      state.recorder.onstop = async () => {
        try {
          const blob = new Blob(state.chunks, { type: mime });
          const arrayBuf = await blob.arrayBuffer();
          const audioBuf = await ensureAudio().decodeAudioData(arrayBuf.slice(0));
          fileTake(armed, audioBuf, blob);
        } catch (decodeErr) {
          appendReed(`Could not decode that take: ${decodeErr.message}`);
        }
        state.recording = false;
        emitTransport();
      };
      state.recorder.start();
    }
    if (mixEnd() > state.playhead + 0.05) {
      try {
        await schedulePlayback({ overdub: true, from: state.playhead, startAt: t0 });
      } catch (playErr) {
        appendReed(`Overdub: ${playErr.message}`);
      }
    }
    emitTransport();
    tickClock();
  }

  async function finishRecording() {
    if (!state.recording) return;
    const armed = state.recordArmed;
    const usedRecorder = !!state.recorder;
    state.recording = false;
    if (usedRecorder) {
      try {
        state.recorder.stop();
      } catch (_) {
        /* already stopped */
      }
      state.recorder = null;
      teardownCapture();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 95));
    try {
      if (armed && state.pcmChunks.length) {
        fileTake(armed, bufferFromPcm(ensureAudio(), state.pcmTrimStart || 0));
      }
    } catch (err) {
      appendReed(`Could not file that take: ${err.message}`);
    }
    teardownCapture();
    state.recordArmed = null;
    emitTransport();
  }

  async function stopRecordOrPlay() {
    const wasRecording = state.recording;
    stopSources();
    state.playing = false;
    if (wasRecording) await finishRecording();
    else emitTransport();
    drawTimeline();
  }

  function scheduleClips(ctx, { origin, startAt, bounce }, master, roomIn, nodes) {
    const sources = [];
    state.tracks.forEach((track) => {
      if (track.muted) return;
      track.clips.forEach((clip) => {
        const playBuf = bufferForClip(track, clip);
        if (!playBuf) return;
        const when = startAt + Math.max(0, clip.offset - origin);
        const offset = Math.max(0, origin - clip.offset);
        if (!bounce && offset >= playBuf.duration) return;
        const src = ctx.createBufferSource();
        src.buffer = playBuf;
        nodes.push(src);
        connectChain(ctx, src, track, master, roomIn, nodes);
        if (bounce) src.start(clip.offset);
        else src.start(when, offset);
        sources.push(src);
      });
    });
    return sources;
  }

  async function schedulePlayback({ overdub = false, from = null, startAt = null } = {}) {
    const end = mixEnd();
    if (end <= 0.02) {
      if (!overdub) appendReed('Nothing to play yet. Record a take first.');
      return;
    }
    const ctx = ensureAudio();
    if (ctx.state === 'suspended') await ctx.resume();
    if (!overdub) {
      stopSources();
      state.playing = false;
    }
    let origin = from == null ? state.playhead : from;
    if (!overdub && origin >= end - 0.05) origin = 0;
    state.playhead = origin;
    const nodes = [];
    const bus = createMixBus(ctx, nodes);
    bus.output.connect(ctx.destination);
    const when = Math.max(ctx.currentTime, startAt == null ? ctx.currentTime + 0.05 : startAt);
    state.playOriginTime = when;
    state.playOriginHead = origin;
    state.graphNodes = nodes;
    state.playSources = scheduleClips(ctx, { origin, startAt: when, bounce: false }, bus.master, bus.roomIn, nodes);
    if (!state.playSources.length) {
      if (!overdub) {
        appendReed('Playhead is past the takes. Click the timeline or hit Play again to start from zero.');
        state.playhead = 0;
        drawTimeline();
      }
      return;
    }
    state.playing = true;
    if (!overdub) {
      emitTransport();
      tickClock();
    }
  }

  async function playMix() {
    if (state.recording || state.playing) return;
    await schedulePlayback();
  }

  function encodeWav(buffer) {
    const channels = buffer.numberOfChannels;
    const rate = buffer.sampleRate;
    const length = buffer.length * channels * 2 + 44;
    const view = new DataView(new ArrayBuffer(length));
    function writeStr(offset, str) {
      for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
    }
    writeStr(0, 'RIFF');
    view.setUint32(4, length - 8, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, length - 44, true);
    let offset = 44;
    for (let i = 0; i < buffer.length; i += 1) {
      for (let ch = 0; ch < channels; ch += 1) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i] || 0));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  async function bounceWav() {
    const duration = Math.max(
      0.5,
      ...state.tracks.flatMap((t) => t.clips.map((c) => c.offset + c.duration))
    );
    const sampleRate = state.audioCtx?.sampleRate || 48000;
    const offline = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
    const nodes = [];
    const bus = createMixBus(offline, nodes);
    bus.output.connect(offline.destination);
    scheduleClips(offline, { origin: 0, startAt: 0, bounce: true }, bus.master, bus.roomIn, nodes);
    const rendered = await offline.startRendering();
    const blob = encodeWav(rendered);
    state.lastBounce = blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studio-${state.reel || 'bounce'}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function releaseBounce() {
    if (!state.lastBounce) await bounceWav();
    if (!state.lastBounce) return;
    const body = new FormData();
    body.append('audio', state.lastBounce, `studio-${state.reel || 'bounce'}.wav`);
    body.append('title', `Reel ${state.reel || 'mix'}`);
    body.append('artist', playerName());
    body.append('reelCode', state.reel || '');
    const res = await fetch('/api/studio/releases', { method: 'POST', body });
    const data = await res.json();
    if (data.ok) {
      state.socket?.emit('studio:now-playing', {
        name: playerName(),
        title: data.release.title,
        releaseId: data.release.id,
      });
      appendReed('Released to the listening room. Password is reel1 unless STUDIO_LISTEN_PASSWORD is set.');
    }
  }

  function emitTransport() {
    state.socket?.emit('studio:transport', {
      name: playerName(),
      playing: state.playing,
      recording: state.recording,
      playhead: state.playhead,
    });
  }

  function connectSocket() {
    if (!window.io) {
      els.socketStatus.textContent = 'Socket offline';
      return;
    }
    state.socket = window.io('/studio');
    state.socket.on('connect', () => {
      els.socketStatus.textContent = 'Socket live';
      els.socketStatus.classList.add('is-live');
      setSocketChip(true);
      state.socket.emit('studio:join', { reelCode: state.reel, name: playerName() });
    });
    state.socket.on('disconnect', () => {
      els.socketStatus.textContent = 'Socket down';
      els.socketStatus.classList.remove('is-live');
      setSocketChip(false);
    });
    state.socket.on('studio:presence', (payload) => {
      const names = (payload.members || []).map((m) => m.name).join(', ');
      els.presence.textContent = names ? `On the reel: ${names}` : 'On the reel: no one yet.';
    });
    state.socket.on('studio:take-filed', (payload) => {
      appendReed(`${payload.by} filed ${payload.trackName} (${formatTime(payload.duration)})`);
    });
  }

  function appendReed(text) {
    if (!els.reedLog) return;
    const p = document.createElement('p');
    p.textContent = text;
    els.reedLog.appendChild(p);
    els.reedLog.scrollTop = els.reedLog.scrollHeight;
  }

  function syncMicButton() {
    if (!els.mic) return;
    els.mic.textContent = state.micOn ? 'Mic on' : 'Mic off';
    els.mic.setAttribute('aria-pressed', state.micOn ? 'true' : 'false');
    syncMicChip();
  }

  function isAgentParticipant(participant) {
    if (!participant) return false;
    const kind = participant.kind || participant.participantInfo?.kind;
    if (kind === 'agent' || kind === 4) return true;
    return /starband|agent/i.test(String(participant.identity || participant.name || ''));
  }

  function refreshOnStage() {
    const room = state.livekitRoom;
    if (!els.onStage) return;
    if (!room) {
      els.onStage.textContent = 'On stage: —';
      return;
    }
    const names = [];
    const local = room.localParticipant;
    if (local) names.push(`${local.name || playerName()} (you)`);
    room.remoteParticipants?.forEach((p) => {
      names.push(isAgentParticipant(p) ? 'Reed (voice)' : (p.name || p.identity));
    });
    els.onStage.textContent = names.length ? `On stage: ${names.join(', ')}` : 'On stage: —';
  }

  function markAgentIfPresent(participant) {
    if (!isAgentParticipant(participant)) return;
    state.sawAgent = true;
    if (state.agentTimer) {
      clearTimeout(state.agentTimer);
      state.agentTimer = 0;
    }
    appendReed('Voice Reed is on stage.');
    refreshOnStage();
  }

  function scheduleAgentWatch() {
    state.sawAgent = false;
    if (state.agentTimer) clearTimeout(state.agentTimer);
    state.livekitRoom?.remoteParticipants?.forEach((p) => {
      if (isAgentParticipant(p)) state.sawAgent = true;
    });
    if (state.sawAgent) return;
    state.agentTimer = window.setTimeout(() => {
      if (state.sawAgent || state.lkState !== 'live') return;
      appendReed('Voice Reed offline — text Reed still works.');
    }, 8000);
  }

  async function joinLivekit(opts) {
    const enableMic = Boolean(opts && opts.enableMic);
    const LK = window.LivekitClient;
    if (!LK) {
      setLkChip('unset', 'LiveKit client missing');
      return;
    }
    setLkChip('joining', 'Joining…');
    const res = await fetch('/api/studio/livekit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reelCode: state.reel,
        name: playerName(),
        identity: stableIdentity(playerName()),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) {
      setLkChip('unset', 'LiveKit keys needed');
      appendReed('LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET in local .env. Local record still works.');
      return;
    }
    if (state.livekitRoom) await state.livekitRoom.disconnect();
    const room = new LK.Room(
      window.LivekitTalkAudio
        ? window.LivekitTalkAudio.roomOptions({
            audioCaptureDefaults: Object.assign({}, window.LivekitTalkAudio.captureHot || window.LivekitTalkAudio.capture),
          })
        : {
            adaptiveStream: true,
            dynacast: true,
            audioCaptureDefaults: {
              echoCancellation: true,
              noiseSuppression: false,
              autoGainControl: true,
              voiceIsolation: false,
              channelCount: 1,
            },
          }
    );
    room.on(LK.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (window.LivekitTalkAudio?.skipAttach(track, participant)) return;
      attachTile(participant.identity, track, participant.name || participant.identity, {
        local: Boolean(participant?.isLocal),
        agent: isAgentParticipant(participant),
      });
      markAgentIfPresent(participant);
    });
    room.on(LK.RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
    });
    room.on(LK.RoomEvent.ParticipantConnected, (participant) => {
      markAgentIfPresent(participant);
      refreshOnStage();
    });
    room.on(LK.RoomEvent.ParticipantDisconnected, refreshOnStage);
    if (LK.RoomEvent.Reconnecting) {
      room.on(LK.RoomEvent.Reconnecting, () => setLkChip('reconnecting', 'Reconnecting…'));
    }
    if (LK.RoomEvent.Reconnected) {
      room.on(LK.RoomEvent.Reconnected, () => setLkChip('live', data.roomName));
    }
    if (LK.RoomEvent.Disconnected) {
      room.on(LK.RoomEvent.Disconnected, () => {
        setLkChip('down', 'LiveKit dropped. Local record still works.');
        refreshOnStage();
      });
    }
    if (LK.RoomEvent.ActiveSpeakersChanged) {
      room.on(LK.RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const ids = new Set((speakers || []).map((p) => p?.identity).filter(Boolean));
        document.querySelectorAll('.st-tile').forEach((tile) => {
          tile.classList.toggle('is-speaking', ids.has(tile.dataset.identity));
        });
      });
    }
    await room.connect(data.url, data.token);
    state.livekitRoom = room;
    els.livekitStatus.textContent = `LiveKit ${data.roomName}`;
    els.livekitStatus.classList.add('is-live');
    setLkChip('live', data.roomName);
    state.micOn = false;
    attachLocalPreview();
    syncMicButton();
    syncMicChip();
    refreshOnStage();
    scheduleAgentWatch();
    appendReed('Joined muted so guitar and speakers stay off the room. Click Mic when you want to talk. Text Reed still works without the voice worker.');
    if (enableMic) {
      await setRoomMic(true);
    }
  }

  async function setRoomMic(on) {
    const lp = state.livekitRoom?.localParticipant;
    if (!lp) return false;
    if (window.LivekitTalkAudio?.setTalkMic) {
      const ok = await window.LivekitTalkAudio.setTalkMic(lp, on, on
        ? { hot: true, gain: micPreampGain() }
        : undefined);
      state.micOn = Boolean(ok);
      syncMicButton();
      return state.micOn;
    }
    await lp.setMicrophoneEnabled(on);
    state.micOn = on;
    syncMicButton();
    return on;
  }

  function attachTile(id, track, label, opts) {
    const local = Boolean(opts && opts.local) || id === 'local';
    if (local && track.kind === 'audio') return;
    const tileId = `tile-${String(id).replace(/[^\w-]/g, '')}`;
    let tile = document.getElementById(tileId);
    if (!tile) {
      tile = document.createElement('div');
      tile.className = 'st-tile' + (opts && opts.agent ? ' is-agent' : '');
      tile.id = tileId;
      tile.dataset.identity = String(id);
      const caption = document.createElement('span');
      caption.textContent = opts && opts.agent ? 'Reed (voice)' : label;
      tile.appendChild(caption);
      els.stage.appendChild(tile);
    }
    const el = track.attach();
    if (el) {
      if (window.LivekitTalkAudio) {
        window.LivekitTalkAudio.prepareAttachedMedia(el, local);
      } else {
        el.playsInline = true;
        if (local) el.muted = true;
      }
      tile.prepend(el);
    }
    refreshOnStage();
  }

  function attachLocalPreview() {
    const room = state.livekitRoom;
    if (!room) return;
    room.localParticipant.trackPublications.forEach((pub) => {
      if (!pub.track || pub.track.kind === 'audio') return;
      attachTile('local', pub.track, `${playerName()} (you)`, { local: true });
    });
  }

  async function toggleMic() {
    if (!state.livekitRoom) return joinLivekit({ enableMic: true });
    try {
      await setRoomMic(!state.micOn);
      appendReed(state.micOn ? 'Mic on — they can hear you.' : 'Mic off.');
    } catch (err) {
      state.micOn = false;
      syncMicButton();
      appendReed('Mic did not start. Allow the microphone, then try Mic on again.');
      throw err;
    }
  }

  function permissionDenied(err) {
    const name = err?.name || '';
    const msg = String(err?.message || '');
    return name === 'NotAllowedError' || /permission|notallowed|denied/i.test(name + msg);
  }

  async function toggleCam() {
    if (!state.livekitRoom) await joinLivekit();
    if (!state.livekitRoom) return;
    const next = !state.camOn;
    try {
      await state.livekitRoom.localParticipant.setCameraEnabled(next);
      state.camOn = next;
      if (els.cam) els.cam.setAttribute('aria-pressed', next ? 'true' : 'false');
      attachLocalPreview();
    } catch (err) {
      state.camOn = false;
      if (els.cam) els.cam.setAttribute('aria-pressed', 'false');
      appendReed(
        permissionDenied(err)
          ? 'Camera permission denied. Allow the camera, then click Cam again.'
          : (err?.message || 'Camera did not start.')
      );
    }
  }

  async function toggleShare() {
    if (!state.livekitRoom) await joinLivekit();
    if (!state.livekitRoom) return;
    const next = !state.shareOn;
    try {
      await state.livekitRoom.localParticipant.setScreenShareEnabled(next);
      state.shareOn = next;
      if (els.share) els.share.setAttribute('aria-pressed', next ? 'true' : 'false');
      attachLocalPreview();
    } catch (err) {
      state.shareOn = false;
      if (els.share) els.share.setAttribute('aria-pressed', 'false');
      appendReed(
        permissionDenied(err)
          ? 'Screen share permission denied.'
          : (err?.message || 'Screen share did not start.')
      );
    }
  }

  async function toggleAudioEgress() {
    if (!state.health.egressS3Configured) {
      appendReed('Archive needs S3 dest (LIVEKIT_EGRESS_S3_*). Use Record for the timeline and Bounce for a local WAV.');
      return;
    }
    if (state.egressId) {
      await fetch('/api/studio/egress/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ egressId: state.egressId }),
      });
      state.egressId = null;
      if (els.archiveChip) {
        els.archiveChip.dataset.state = 'ready';
        els.archiveChip.textContent = 'Archive ready';
      }
      appendReed('Mic archive stopped. The timeline was never captured.');
      return;
    }
    const res = await fetch('/api/studio/egress/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reelCode: state.reel }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      appendReed(
        data.error === 'LIVEKIT_EGRESS_DEST_REQUIRED'
          ? 'Archive needs S3 dest (LIVEKIT_EGRESS_S3_*). Use Record for the timeline and Bounce for a local WAV.'
          : (data.error || 'Audio egress needs LiveKit and an S3 dest.')
      );
      return;
    }
    state.egressId = data.egressId;
    if (els.archiveChip) {
      els.archiveChip.dataset.state = 'live';
      els.archiveChip.textContent = 'Archiving mics';
    }
    appendReed('Archiving room mics only — not the timeline, not a WAV bounce.');
  }

  async function loadStudioFace() {
    try {
      const res = await fetch('/data/studio-heygen-face.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      state.studioFace = data && typeof data === 'object' ? data : null;
      const faceName = String(state.studioFace?.name || 'Alienigena').trim() || 'Alienigena';
      if (els.heygenFace) els.heygenFace.textContent = `${faceName} face`;
      const caption = document.querySelector('.st-heygen-caption');
      if (caption) caption.textContent = `Face tile · ${faceName} (HeyGen live, not StarBand)`;
      return state.studioFace;
    } catch (_) {
      state.studioFace = null;
      return null;
    }
  }

  async function toggleReedFace() {
    const LK = window.LivekitClient;
    if (state.heygenRoom || state.heygenSessionId) {
      await fetch('/api/heygen/streaming/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.heygenSessionId }),
      }).catch(() => {});
      if (state.heygenRoom && typeof state.heygenRoom.disconnect === 'function') {
        await state.heygenRoom.disconnect();
      }
      const host = els.heygenMedia || els.heygenTile;
      window.HeygenLiveTile?.destroyHls(host?.querySelector('video'));
      state.heygenRoom = null;
      state.heygenSessionId = null;
      if (els.heygenTile) {
        if (els.heygenMedia) els.heygenMedia.innerHTML = '';
        else els.heygenTile.innerHTML = '';
        els.heygenTile.hidden = true;
      }
      appendReed('HeyGen face closed.');
      return;
    }
    const face = state.studioFace || (await loadStudioFace());
    const faceName = String(face?.name || 'Alienigena').trim() || 'Alienigena';
    const greeting = String(face?.greeting || '').trim()
      || 'Signal acquired. Console is live — arm a track when you are ready.';
    const body = { text: greeting };
    if (face?.avatarId) body.avatarId = face.avatarId;
    if (face?.voiceId) body.voiceId = face.voiceId;
    const res = await fetch('/api/heygen/streaming/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data?.url && (data.fallback || data.playback === 'poster' || window.HeygenLiveTile?.isPoster?.(data))) {
      const host = els.heygenMedia || els.heygenTile;
      if (!els.heygenTile || !host) return;
      els.heygenTile.hidden = false;
      window.HeygenLiveTile.attachPoster(host, data.url, 'st-heygen-video', faceName);
      state.heygenRoom = { kind: 'poster' };
      state.heygenSessionId = data.sessionId || 'poster';
      appendReed(`${faceName} is on voice — live stream is not on this HeyGen plan.`);
      return;
    }
    if (!res.ok || !data.url) {
      const missingCatalog = !face?.avatarId;
      const raw = String(data.error || '');
      const sunset = /streaming\.new|avatar-realtime|404/i.test(raw);
      appendReed(
        sunset
          ? `${faceName} live stream is not on this HeyGen plan — Reed still talks here.`
          : (data.error
          || (missingCatalog
            ? `${faceName} needs HeyGen IDs — see AVATAR-ALIENIGENA.md or set HEYGEN_STREAMING_AVATAR_ID.`
            : 'HeyGen streaming needs HEYGEN_API_KEY and a streaming avatar id.'))
      );
      return;
    }
    const host = els.heygenMedia || els.heygenTile;
    if (!els.heygenTile || !host) return;
    els.heygenTile.hidden = false;
    if (window.HeygenLiveTile?.isHls(data)) {
      window.HeygenLiveTile.attachHls(host, data.url, 'st-heygen-video');
      state.heygenRoom = { kind: 'hls' };
      state.heygenSessionId = data.sessionId;
      appendReed(`${faceName} is a HeyGen live tile — separate from the StarBand room.`);
      return;
    }
    if (!LK) {
      appendReed('LiveKit client missing');
      return;
    }
    const faceRoom = new LK.Room({ adaptiveStream: true, dynacast: true });
    faceRoom.on(LK.RoomEvent.TrackSubscribed, (track) => {
      const el = track.attach();
      el.style.maxWidth = '100%';
      host.appendChild(el);
    });
    await faceRoom.connect(data.url, data.accessToken);
    state.heygenRoom = faceRoom;
    state.heygenSessionId = data.sessionId;
    appendReed(`${faceName} is a HeyGen live tile — separate from the StarBand room.`);
  }

  async function askReed(event) {
    event.preventDefault();
    const message = String(els.reedInput.value || '').trim();
    if (!message) return;
    els.reedInput.value = '';
    appendReed(`You: ${message}`);
    const res = await fetch('/api/studio/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sessionId: `studio-${state.reel || 'lobby'}`,
        userId: playerName(),
      }),
    });
    const data = await res.json();
    appendReed(`${data.guideName || 'Reed'}: ${data.reply || data.error || '…'}`);
  }

  async function boot() {
    addTrack('Acoustic Guitar Neck', { kind: 'acoustic-guitar', pan: -0.34, gain: 0.92, arm: true, autotune: false });
    addTrack('Acoustic Guitar Body', { kind: 'acoustic-guitar', pan: 0.34, gain: 1, autotune: false });
    addTrack('Vocal', { kind: 'vocal', gain: 0.88, autotune: true });
    addTrack('Harmony', { kind: 'vocal', gain: 0.8, autotune: true });
    if (els.musicMode) els.musicMode.checked = true;
    if (els.acousticDesk) els.acousticDesk.checked = true;
    try {
      const saved = localStorage.getItem(PREAMP_KEY);
      if (saved != null && els.micPreamp) els.micPreamp.value = String(clampPreampDb(saved));
    } catch (_) {
      /* ignore */
    }
    syncPreampLabel();
    if (!state.reel) {
      try {
        const res = await fetch('/api/studio/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Reel 1' }),
        });
        const data = await res.json();
        state.reel = data.session?.code || 'LOBBY';
      } catch (_) {
        state.reel = 'LOBBY';
      }
      const url = new URL(window.location.href);
      url.searchParams.set('reel', state.reel);
      window.history.replaceState({}, '', url);
    }
    sessionStorage.setItem('studioReel', state.reel);
    els.reelCode.textContent = state.reel;
    connectSocket();
    loadStudioFace().catch(() => {});
    fetch('/api/studio/health')
      .then((res) => res.json())
      .then((status) => {
        state.health = status || {};
        if (!status.livekitConfigured) setLkChip('unset', 'LiveKit unset');
        else setLkChip('ready', 'LiveKit ready');
        applyArchiveGate();
        syncMicChip();
      })
      .catch(() => setLkChip('unset', 'LiveKit unset'));
    appendReed('Reed: Acoustic desk is on. Mic preamp is +10 dB — raise it if the meter is tiny. Autotune is on your voice only — Vocal and Harmony. Guitar stays dry. Headphones on, arm Neck, then stack Body, then sing.');
  }

  els.addTrack?.addEventListener('click', () => addTrack());
  els.tuneKey?.addEventListener('change', () => {
    state.tracks.forEach((track) => {
      if (!isVoiceTrack(track)) return;
      track.clips.forEach((clip) => {
        clip.tunedBuffer = null;
        clip.tunedSig = '';
      });
    });
  });
  els.tuneHard?.addEventListener('change', () => {
    state.tracks.forEach((track) => {
      if (!isVoiceTrack(track)) return;
      track.clips.forEach((clip) => {
        clip.tunedBuffer = null;
        clip.tunedSig = '';
      });
    });
  });
  els.musicMode?.addEventListener('change', syncMicChip);
  els.micPreamp?.addEventListener('input', applyMicPreamp);
  els.record?.addEventListener('click', () => startRecord().catch((err) => appendReed(`Mic: ${err.message}`)));
  els.stop?.addEventListener('click', () => stopRecordOrPlay().catch((err) => appendReed(err.message)));
  els.play?.addEventListener('click', () => {
    playMix().catch((err) => appendReed(`Play: ${err.message}`));
  });
  els.timeline?.addEventListener('click', (event) => {
    if (state.recording) return;
    const rect = els.timeline.getBoundingClientRect();
    const seconds = Math.max(
      12,
      ...state.tracks.flatMap((t) => t.clips.map((c) => c.offset + c.duration)),
      state.playhead + 2
    );
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const scaleY = els.timeline.height / rect.height;
    const rowH = timelineRowHeight(els.timeline);
    const index = Math.floor((y * scaleY - 8) / (rowH + 8));
    if (index >= 0 && index < state.tracks.length) {
      armTrack(state.tracks[index].id);
    }
    if (state.playing) stopRecordOrPlay().catch((err) => appendReed(err.message));
    state.playhead = Math.max(0, Math.min(seconds, (x / rect.width) * seconds));
    drawTimeline();
  });
  els.bounce?.addEventListener('click', () => bounceWav().catch((err) => appendReed(err.message)));
  els.release?.addEventListener('click', () => releaseBounce().catch((err) => appendReed(err.message)));
  els.joinLive?.addEventListener('click', () => joinLivekit().catch((err) => appendReed(err.message)));
  els.mic?.addEventListener('click', () => toggleMic().catch((err) => appendReed(err.message)));
  els.cam?.addEventListener('click', () => toggleCam().catch((err) => appendReed(err.message)));
  els.share?.addEventListener('click', () => toggleShare().catch((err) => appendReed(err.message)));
  els.egress?.addEventListener('click', () => toggleAudioEgress().catch((err) => appendReed(err.message)));
  els.heygenFace?.addEventListener('click', () => toggleReedFace().catch((err) => appendReed(err.message)));
  els.reedForm?.addEventListener('submit', askReed);
  els.tracks?.addEventListener('click', (event) => {
    const node = event.target && event.target.nodeType === 1 ? event.target : event.target?.parentElement;
    if (!node || typeof node.closest !== 'function') return;
    if (node.closest('[data-mute], input, select, .st-fader')) return;
    const row = node.closest('[data-track]');
    if (!row) return;
    armTrack(row.getAttribute('data-track'));
  });
  els.tracks?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const node = event.target && event.target.nodeType === 1 ? event.target : event.target?.parentElement;
    if (!node || typeof node.closest !== 'function') return;
    const row = node.closest('[data-track]');
    if (!row || node.closest('input, select, .st-fader, [data-mute]')) return;
    event.preventDefault();
    armTrack(row.getAttribute('data-track'));
  });
  els.tracks?.addEventListener('input', (event) => {
    const gainId = event.target.getAttribute('data-gain');
    const panId = event.target.getAttribute('data-pan');
    const autotuneId = event.target.getAttribute('data-autotune');
    if (gainId) {
      const track = state.tracks.find((t) => t.id === gainId);
      if (track) track.gain = Number(event.target.value);
    }
    if (panId) {
      const track = state.tracks.find((t) => t.id === panId);
      if (track) track.pan = Number(event.target.value);
    }
    if (autotuneId) {
      const track = state.tracks.find((t) => t.id === autotuneId);
      if (track && isVoiceTrack(track)) {
        track.autotune = event.target.checked;
        track.clips.forEach((clip) => {
          clip.tunedBuffer = null;
          clip.tunedSig = '';
        });
      }
    }
  });

  boot();
})();
