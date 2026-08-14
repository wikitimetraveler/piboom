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
    socket: null,
    livekitRoom: null,
    micOn: false,
    camOn: false,
    shareOn: false,
    lastBounce: null,
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

  function ensureAudio() {
    if (!state.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = new AC();
    }
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
    return state.audioCtx;
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

  async function armMic() {
    const ctx = ensureAudio();
    const constraints = {
      audio: {
        echoCancellation: !els.musicMode?.checked,
        noiseSuppression: !els.musicMode?.checked,
        autoGainControl: !els.musicMode?.checked,
        channelCount: 1,
      },
    };
    state.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    const source = ctx.createMediaStreamSource(state.mediaStream);
    state.analyser = ctx.createAnalyser();
    state.analyser.fftSize = 256;
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

  function stopSources() {
    (state.playSources || []).forEach((src) => {
      try {
        src.stop();
      } catch (_) {
        /* already ended */
      }
    });
    state.playSources = [];
    if (state.playRaf) {
      cancelAnimationFrame(state.playRaf);
      state.playRaf = 0;
    }
  }

  function tickPlayhead() {
    if (!state.playing || !state.audioCtx) return;
    const elapsed = Math.max(0, state.audioCtx.currentTime - state.playOriginTime);
    state.playhead = state.playOriginHead + elapsed;
    const end = mixEnd();
    if (end > 0 && state.playhead >= end) {
      state.playhead = end;
      stopSources();
      state.playing = false;
      emitTransport();
      drawTimeline();
      return;
    }
    drawTimeline();
    state.playRaf = requestAnimationFrame(tickPlayhead);
  }

  async function startRecord() {
    if (state.recording) return;
    stopSources();
    state.playing = false;
    const armed = state.tracks.find((t) => t.id === state.armedId) || addTrack();
    state.armedId = armed.id;
    await armMic();
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
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
        armed.clips.push({
          offset: state.recordStartedAt,
          duration: audioBuf.duration,
          buffer: audioBuf,
          peaks: peaksFromBuffer(audioBuf),
          blob,
        });
        state.playhead = state.recordStartedAt + audioBuf.duration;
        state.socket?.emit('studio:take-filed', {
          name: playerName(),
          trackName: armed.name,
          duration: audioBuf.duration,
        });
        appendReed(`Take filed on ${armed.name} (${formatTime(audioBuf.duration)}). Hit Play to hear it.`);
      } catch (err) {
        appendReed(`Could not decode that take: ${err.message}`);
      }
      state.recording = false;
      emitTransport();
      renderTracks();
      drawTimeline();
    };
    state.recordStartedAt = state.playhead;
    state.recording = true;
    state.recorder.start();
    emitTransport();
    drawTimeline();
  }

  function stopRecordOrPlay() {
    if (state.recorder && state.recording) {
      state.recorder.stop();
    }
    stopSources();
    state.playing = false;
    state.recording = false;
    emitTransport();
    drawTimeline();
  }

  async function playMix() {
    if (state.playing) return;
    const end = mixEnd();
    if (end <= 0.02) {
      appendReed('Nothing to play yet. Record a take first.');
      return;
    }
    const ctx = ensureAudio();
    if (ctx.state === 'suspended') await ctx.resume();
    stopRecordOrPlay();
    if (state.playhead >= end - 0.05) state.playhead = 0;
    const origin = state.playhead;
    state.playing = true;
    const startAt = ctx.currentTime + 0.05;
    state.playOriginTime = startAt;
    state.playOriginHead = origin;
    state.playSources = [];
    state.tracks.forEach((track) => {
      if (track.muted) return;
      track.clips.forEach((clip) => {
        if (!clip.buffer) return;
        const when = startAt + Math.max(0, clip.offset - origin);
        const offset = Math.max(0, origin - clip.offset);
        if (offset >= clip.buffer.duration) return;
        const src = ctx.createBufferSource();
        src.buffer = clip.buffer;
        const gain = ctx.createGain();
        gain.gain.value = track.gain;
        src.connect(gain);
        if (typeof ctx.createStereoPanner === 'function') {
          const pan = ctx.createStereoPanner();
          pan.pan.value = track.pan;
          gain.connect(pan);
          pan.connect(ctx.destination);
        } else {
          gain.connect(ctx.destination);
        }
        src.start(when, offset);
        state.playSources.push(src);
      });
    });
    if (!state.playSources.length) {
      state.playing = false;
      appendReed('Playhead is past the takes. Click the timeline or hit Play again to start from zero.');
      state.playhead = 0;
      drawTimeline();
      return;
    }
    emitTransport();
    tickPlayhead();
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
    state.tracks.forEach((track) => {
      if (track.muted) return;
      track.clips.forEach((clip) => {
        const src = offline.createBufferSource();
        src.buffer = clip.buffer;
        const gain = offline.createGain();
        gain.gain.value = track.gain;
        src.connect(gain);
        if (typeof offline.createStereoPanner === 'function') {
          const pan = offline.createStereoPanner();
          pan.pan.value = track.pan;
          gain.connect(pan);
          pan.connect(offline.destination);
        } else {
          gain.connect(offline.destination);
        }
        src.start(clip.offset);
      });
    });
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

  async function joinLivekit() {
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
    const room = new LK.Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: !els.musicMode?.checked,
        noiseSuppression: !els.musicMode?.checked,
        autoGainControl: !els.musicMode?.checked,
      },
    });
    room.on(LK.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      attachTile(participant.identity, track, participant.name || participant.identity);
    });
    room.on(LK.RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
    });
    await room.connect(data.url, data.token);
    state.livekitRoom = room;
    els.livekitStatus.textContent = `LiveKit ${data.roomName}`;
    els.livekitStatus.classList.add('is-live');
    state.micOn = true;
    await room.localParticipant.setMicrophoneEnabled(true);
    attachLocalPreview();
  }

  function attachTile(id, track, label) {
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
      el.playsInline = true;
      tile.prepend(el);
    }
  }

  function attachLocalPreview() {
    const room = state.livekitRoom;
    if (!room) return;
    room.localParticipant.trackPublications.forEach((pub) => {
      if (pub.track) attachTile('local', pub.track, `${playerName()} (you)`);
    });
  }

  async function toggleMic() {
    if (!state.livekitRoom) return joinLivekit();
    state.micOn = !state.micOn;
    await state.livekitRoom.localParticipant.setMicrophoneEnabled(state.micOn);
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
    addTrack('Acoustic Guitar Neck', { kind: 'acoustic-guitar', pan: -0.28, arm: true });
    addTrack('Acoustic Guitar Body', { kind: 'acoustic-guitar', pan: 0.28 });
    addTrack('Vocal');
    addTrack('Harmony');
    if (els.musicMode) els.musicMode.checked = true;
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
    appendReed('Reed: Two acoustic guitar lanes are up — Neck and Body. Music input is on. Arm Neck, point a mic at the twelfth fret, then stack Body on the soundhole.');
  }

  els.addTrack?.addEventListener('click', () => addTrack());
  els.record?.addEventListener('click', () => startRecord().catch((err) => appendReed(`Mic: ${err.message}`)));
  els.stop?.addEventListener('click', stopRecordOrPlay);
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
    if (state.playing) stopRecordOrPlay();
    state.playhead = Math.max(0, Math.min(seconds, (x / rect.width) * seconds));
    drawTimeline();
  });
  els.bounce?.addEventListener('click', () => bounceWav().catch((err) => appendReed(err.message)));
  els.release?.addEventListener('click', () => releaseBounce().catch((err) => appendReed(err.message)));
  els.joinLive?.addEventListener('click', () => joinLivekit().catch((err) => appendReed(err.message)));
  els.mic?.addEventListener('click', () => toggleMic().catch((err) => appendReed(err.message)));
  els.cam?.addEventListener('click', () => toggleCam().catch((err) => appendReed(err.message)));
  els.share?.addEventListener('click', () => toggleShare().catch((err) => appendReed(err.message)));
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
