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
    name: document.getElementById('stName'),
    tracks: document.getElementById('stTracks'),
    addTrack: document.getElementById('stAddTrack'),
    musicMode: document.getElementById('stMusicMode'),
    acousticDesk: document.getElementById('stAcousticDesk'),
    meter: document.getElementById('stMeter'),
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
    stage: document.getElementById('stStage'),
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
    egressId: null,
    analyser: null,
    raf: 0,
    playSources: [],
    playRaf: 0,
    playOriginTime: 0,
    playOriginHead: 0,
  };

  function playerName() {
    state.name = String(els.name?.value || 'Player').trim() || 'Player';
    return state.name;
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
        state.audioCtx = new AC({ sampleRate: 48000, latencyHint: 'playback' });
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
      const kindLabel = track.kind === 'acoustic-guitar' ? 'Acoustic guitar · ' : '';
      row.className = `st-track${track.id === state.armedId ? ' is-armed' : ''}${track.kind === 'acoustic-guitar' ? ' st-track--guitar' : ''}`;
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(track.name)}</strong>
          <div class="st-status">${kindLabel}${track.clips.length} clip${track.clips.length === 1 ? '' : 's'}</div>
        </div>
        <div>
          <button type="button" data-arm="${track.id}">Arm</button>
          <button type="button" data-mute="${track.id}">${track.muted ? 'Unmute' : 'Mute'}</button>
        </div>
        <label class="st-status">Gain
          <input type="range" min="0" max="2" step="0.01" value="${track.gain}" data-gain="${track.id}"/>
        </label>
        <label class="st-status">Pan
          <input type="range" min="-1" max="1" step="0.01" value="${track.pan}" data-pan="${track.id}"/>
        </label>
      `;
      els.tracks.appendChild(row);
    });
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
    const rowH = Math.max(36, h / Math.max(state.tracks.length, 1) - 8);

    state.tracks.forEach((track, index) => {
      const y = 8 + index * (rowH + 8);
      ctx.fillStyle = '#151515';
      ctx.fillRect(0, y, w, rowH);
      track.clips.forEach((clip) => {
        const x = clip.offset * px;
        const cw = Math.max(2, clip.duration * px);
        ctx.fillStyle = track.id === state.armedId ? '#ff9d4d' : '#3a3a3a';
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
      ctx.fillStyle = '#666';
      ctx.font = '11px Outfit, sans-serif';
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
    state.pcmSource = source;
    state.analyser = ctx.createAnalyser();
    state.analyser.fftSize = 2048;
    source.connect(state.analyser);
    pumpMeter();
  }

  function pumpMeter() {
    if (!state.analyser || !els.meter) return;
    const data = new Uint8Array(state.analyser.frequencyBinCount);
    const loop = () => {
      state.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      els.meter.style.width = `${Math.min(100, rms * 280)}%`;
      if (state.recording || state.mediaStream) state.raf = requestAnimationFrame(loop);
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
    disconnectNodes([state.pcmNode, state.pcmSilent, state.pcmSource, state.captureTap, state.analyser]);
    state.pcmNode = null;
    state.pcmSilent = null;
    state.pcmSource = null;
    state.captureTap = null;
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach((track) => track.stop());
      state.mediaStream = null;
    }
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
      state.recorder = new MediaRecorder(state.mediaStream, { mimeType: mime });
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
        if (!clip.buffer) return;
        const when = startAt + Math.max(0, clip.offset - origin);
        const offset = Math.max(0, origin - clip.offset);
        if (!bounce && offset >= clip.buffer.duration) return;
        const src = ctx.createBufferSource();
        src.buffer = clip.buffer;
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
      state.socket.emit('studio:join', { reelCode: state.reel, name: playerName() });
    });
    state.socket.on('disconnect', () => {
      els.socketStatus.textContent = 'Socket down';
      els.socketStatus.classList.remove('is-live');
    });
    state.socket.on('studio:presence', (payload) => {
      const names = (payload.members || []).map((m) => m.name).join(', ');
      els.presence.textContent = names ? `In the reel: ${names}` : 'No one in the reel yet.';
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
  }

  async function joinLivekit(opts) {
    const enableMic = Boolean(opts && opts.enableMic);
    const LK = window.LivekitClient;
    if (!LK) {
      els.livekitStatus.textContent = 'LiveKit client missing';
      return;
    }
    const res = await fetch('/api/studio/livekit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reelCode: state.reel, name: playerName() }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) {
      els.livekitStatus.textContent = 'LiveKit keys needed';
      appendReed('LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET. Local record still works.');
      return;
    }
    if (state.livekitRoom) await state.livekitRoom.disconnect();
    const room = new LK.Room(
      window.LivekitTalkAudio
        ? window.LivekitTalkAudio.roomOptions()
        : {
            adaptiveStream: true,
            dynacast: true,
            audioCaptureDefaults: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              voiceIsolation: true,
              channelCount: 1,
            },
          }
    );
    room.on(LK.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (window.LivekitTalkAudio?.skipAttach(track, participant)) return;
      attachTile(participant.identity, track, participant.name || participant.identity, {
        local: Boolean(participant?.isLocal),
      });
    });
    room.on(LK.RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
    });
    await room.connect(data.url, data.token);
    state.livekitRoom = room;
    els.livekitStatus.textContent = `LiveKit ${data.roomName}`;
    els.livekitStatus.classList.add('is-live');
    state.micOn = false;
    await room.localParticipant.setMicrophoneEnabled(false);
    attachLocalPreview();
    syncMicButton();
    appendReed('Joined muted so guitar and speakers stay off the room. Click Mic when you want to talk.');
    if (enableMic) {
      state.micOn = true;
      await room.localParticipant.setMicrophoneEnabled(true, window.LivekitTalkAudio?.capture);
      syncMicButton();
    }
  }

  function attachTile(id, track, label, opts) {
    const local = Boolean(opts && opts.local) || id === 'local';
    if (local && track.kind === 'audio') return;
    const tileId = `tile-${String(id).replace(/[^\w-]/g, '')}`;
    let tile = document.getElementById(tileId);
    if (!tile) {
      tile = document.createElement('div');
      tile.className = 'st-tile';
      tile.id = tileId;
      const caption = document.createElement('span');
      caption.textContent = label;
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
    state.micOn = !state.micOn;
    await state.livekitRoom.localParticipant.setMicrophoneEnabled(
      state.micOn,
      state.micOn ? window.LivekitTalkAudio?.capture : undefined
    );
    syncMicButton();
  }

  async function toggleCam() {
    if (!state.livekitRoom) await joinLivekit();
    if (!state.livekitRoom) return;
    state.camOn = !state.camOn;
    await state.livekitRoom.localParticipant.setCameraEnabled(state.camOn);
    attachLocalPreview();
  }

  async function toggleShare() {
    if (!state.livekitRoom) await joinLivekit();
    if (!state.livekitRoom) return;
    state.shareOn = !state.shareOn;
    await state.livekitRoom.localParticipant.setScreenShareEnabled(state.shareOn);
    attachLocalPreview();
  }

  async function toggleAudioEgress() {
    if (state.egressId) {
      await fetch('/api/studio/egress/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ egressId: state.egressId }),
      });
      state.egressId = null;
      appendReed('Mic archive stopped.');
      return;
    }
    const res = await fetch('/api/studio/egress/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reelCode: state.reel }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      appendReed(data.error || 'Audio egress needs LiveKit (and S3 dest in production).');
      return;
    }
    state.egressId = data.egressId;
    appendReed('Archiving room mics only — audio-only LiveKit egress.');
  }

  async function toggleReedFace() {
    const LK = window.LivekitClient;
    if (state.heygenRoom) {
      await fetch('/api/heygen/streaming/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.heygenSessionId }),
      }).catch(() => {});
      await state.heygenRoom.disconnect();
      state.heygenRoom = null;
      state.heygenSessionId = null;
      if (els.heygenTile) {
        els.heygenTile.innerHTML = '';
        els.heygenTile.hidden = true;
      }
      appendReed('HeyGen face closed.');
      return;
    }
    const res = await fetch('/api/heygen/streaming/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok || !data.url || !data.accessToken) {
      appendReed(data.error || 'HeyGen streaming needs HEYGEN_API_KEY and HEYGEN_STREAMING_AVATAR_ID.');
      return;
    }
    if (!LK) {
      appendReed('LiveKit client missing');
      return;
    }
    const faceRoom = new LK.Room({ adaptiveStream: true, dynacast: true });
    faceRoom.on(LK.RoomEvent.TrackSubscribed, (track) => {
      if (!els.heygenTile) return;
      els.heygenTile.hidden = false;
      const el = track.attach();
      el.style.maxWidth = '100%';
      els.heygenTile.appendChild(el);
    });
    await faceRoom.connect(data.url, data.accessToken);
    state.heygenRoom = faceRoom;
    state.heygenSessionId = data.sessionId;
    appendReed('Reed face is a HeyGen LiveKit tile — separate from the StarBand room.');
    if (data.sessionId) {
      fetch('/api/heygen/streaming/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: data.sessionId,
          text: 'Console is up. Arm a track when you are ready.',
        }),
      }).catch(() => {});
    }
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
    addTrack('Acoustic Guitar Neck', { kind: 'acoustic-guitar', pan: -0.34, gain: 0.92, arm: true });
    addTrack('Acoustic Guitar Body', { kind: 'acoustic-guitar', pan: 0.34, gain: 1 });
    addTrack('Vocal', { gain: 0.88 });
    addTrack('Harmony', { gain: 0.8 });
    if (els.musicMode) els.musicMode.checked = true;
    if (els.acousticDesk) els.acousticDesk.checked = true;
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
    fetch('/api/studio/health')
      .then((res) => res.json())
      .then((status) => {
        if (!status.livekitConfigured) els.livekitStatus.textContent = 'LiveKit unset';
        else els.livekitStatus.textContent = 'LiveKit ready';
      })
      .catch(() => {});
    appendReed('Reed: Acoustic desk is on. Neck is brighter at the twelfth fret, Body is warmer at the soundhole. Takes are PCM, not phone-call Opus. Headphones on, arm Neck, then stack Body while the mix plays.');
  }

  els.addTrack?.addEventListener('click', () => addTrack());
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
    const arm = event.target.getAttribute('data-arm');
    const mute = event.target.getAttribute('data-mute');
    if (arm) state.armedId = arm;
    if (mute) {
      const track = state.tracks.find((t) => t.id === mute);
      if (track) track.muted = !track.muted;
    }
    renderTracks();
    drawTimeline();
  });
  els.tracks?.addEventListener('input', (event) => {
    const gainId = event.target.getAttribute('data-gain');
    const panId = event.target.getAttribute('data-pan');
    if (gainId) {
      const track = state.tracks.find((t) => t.id === gainId);
      if (track) track.gain = Number(event.target.value);
    }
    if (panId) {
      const track = state.tracks.find((t) => t.id === panId);
      if (track) track.pan = Number(event.target.value);
    }
  });

  boot();
})();
