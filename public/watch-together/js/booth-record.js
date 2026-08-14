/**
 * Development work by David Lane
 */
/**
 * Watch together couch recorder — mixes LiveKit mics in this tab and downloads a take.
 * YouTube is never captured. Optional face-grid video is opt-in via ?video=1.
 */
(function (global) {
  'use strict';

  const state = {
    recording: false,
    ctx: null,
    dest: null,
    silent: null,
    recorder: null,
    chunks: [],
    mime: '',
    includeVideo: false,
    canvas: null,
    canvasStream: null,
    raf: 0,
    nodes: new Map(),
  };

  function isAudioTrack(track, publication) {
    const trackKind = track?.kind;
    const pubKind = publication?.kind;
    if (trackKind === 'video' || pubKind === 'video') return false;
    return trackKind === 'audio' || pubKind === 'audio';
  }

  function trackKey(track, publication, participant) {
    const sid = publication?.trackSid || publication?.sid || track?.sid;
    if (sid) return String(sid);
    const mediaId = track?.mediaStreamTrack?.id;
    if (mediaId) return String(mediaId);
    const identity = participant?.identity;
    if (identity) return String(identity) + ':audio';
    return '';
  }

  function wantsFaceVideo(search) {
    const raw = search == null
      ? (typeof global.location?.search === 'string' ? global.location.search : '')
      : String(search);
    const q = raw.charAt(0) === '?' ? raw.slice(1) : raw;
    try {
      return new URLSearchParams(q).get('video') === '1';
    } catch {
      return false;
    }
  }

  function createMixGraph() {
    const ids = new Set();
    return {
      attach(payload) {
        if (!isAudioTrack(payload?.track, payload?.publication)) return false;
        const id = trackKey(payload.track, payload.publication, payload.participant);
        if (!id || ids.has(id)) return false;
        ids.add(id);
        return true;
      },
      detach(payload) {
        const id = trackKey(payload?.track, payload?.publication, payload?.participant);
        if (!id || !ids.has(id)) return false;
        ids.delete(id);
        return true;
      },
      has(id) {
        return ids.has(id);
      },
      size() {
        return ids.size;
      },
      ids() {
        return Array.from(ids);
      },
    };
  }

  const graph = createMixGraph();

  function mediaTrackOf(track) {
    return track?.mediaStreamTrack || (track?.kind === 'audio' && track?.mediaStreamTrack) || null;
  }

  function ensureAudio() {
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) throw new Error('no-audio-context');
    if (!state.ctx) state.ctx = new AC();
    if (state.ctx.state === 'suspended') state.ctx.resume();
    return state.ctx;
  }

  function connectNode(id, track) {
    const media = mediaTrackOf(track);
    if (!state.ctx || !state.dest || !media || media.readyState === 'ended') return;
    disconnectNode(id);
    try {
      const source = state.ctx.createMediaStreamSource(new MediaStream([media]));
      source.connect(state.dest);
      state.nodes.set(id, source);
    } catch (err) {
      console.warn('Watch together record attach failed', err);
    }
  }

  function disconnectNode(id) {
    const source = state.nodes.get(id);
    if (!source) return;
    try {
      source.disconnect();
    } catch {
      /* ignore */
    }
    state.nodes.delete(id);
  }

  function pickMime(includeVideo) {
    const MR = global.MediaRecorder;
    if (!MR || typeof MR.isTypeSupported !== 'function') {
      return includeVideo ? 'video/webm' : 'audio/webm';
    }
    const video = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];
    const audio = ['audio/webm;codecs=opus', 'audio/webm'];
    const list = includeVideo ? video : audio;
    for (let i = 0; i < list.length; i += 1) {
      if (MR.isTypeSupported(list[i])) return list[i];
    }
    return includeVideo ? 'video/webm' : 'audio/webm';
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function stampName(ext) {
    const d = new Date();
    return (
      'watch-together-' +
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      '.' +
      ext
    );
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
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

  function stopFaceGrid() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    if (state.canvasStream) {
      state.canvasStream.getTracks().forEach((t) => t.stop());
      state.canvasStream = null;
    }
    if (state.canvas && state.canvas.parentNode) state.canvas.parentNode.removeChild(state.canvas);
    state.canvas = null;
  }

  function startFaceGrid() {
    stopFaceGrid();
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.appendChild(canvas);
    const ctx2d = canvas.getContext('2d');
    function draw() {
      ctx2d.fillStyle = '#0b0c10';
      ctx2d.fillRect(0, 0, canvas.width, canvas.height);
      const videos = Array.from(document.querySelectorAll('.wt-face video'));
      const n = videos.length;
      if (n) {
        const cols = Math.ceil(Math.sqrt(n));
        const rows = Math.ceil(n / cols);
        const cw = canvas.width / cols;
        const ch = canvas.height / rows;
        videos.forEach((video, i) => {
          if (!video.videoWidth) return;
          const col = i % cols;
          const row = Math.floor(i / cols);
          ctx2d.drawImage(video, col * cw, row * ch, cw, ch);
        });
      }
      state.raf = requestAnimationFrame(draw);
    }
    draw();
    state.canvas = canvas;
    state.canvasStream = canvas.captureStream(24);
    return state.canvasStream;
  }

  function teardownMix() {
    state.nodes.forEach((_, id) => disconnectNode(id));
    stopFaceGrid();
    if (state.silent) {
      try {
        state.silent.stop();
      } catch {
        /* ignore */
      }
      state.silent = null;
    }
    state.dest = null;
  }

  function handleTrack(payload) {
    const action = payload?.action;
    if (action === 'unsubscribed') {
      const id = trackKey(payload.track, payload.publication, payload.participant);
      graph.detach(payload);
      if (id) disconnectNode(id);
      return;
    }
    if (!isAudioTrack(payload?.track, payload?.publication)) return;
    graph.attach(payload);
    const id = trackKey(payload.track, payload.publication, payload.participant);
    if (state.recording && id) connectNode(id, payload.track);
  }

  function attachListed(list) {
    (list || []).forEach((item) => handleTrack(item));
  }

  async function start(opts) {
    if (state.recording) return true;
    if (typeof global.MediaRecorder !== 'function') {
      throw new Error('Recording is not supported in this browser.');
    }
    const includeVideo = Boolean(opts?.includeVideo) || wantsFaceVideo();
    const ctx = ensureAudio();
    state.dest = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    const mute = ctx.createGain();
    mute.gain.value = 0;
    osc.connect(mute);
    mute.connect(state.dest);
    osc.start();
    state.silent = osc;
    state.recording = true;

    const listed =
      typeof global.WatchTogetherSync?.listAudioTracks === 'function'
        ? global.WatchTogetherSync.listAudioTracks()
        : [];
    attachListed(listed);

    let mixStream = state.dest.stream;
    if (includeVideo) {
      const canvasStream = startFaceGrid();
      mixStream = new MediaStream([
        ...state.dest.stream.getAudioTracks(),
        ...canvasStream.getVideoTracks(),
      ]);
    }

    state.includeVideo = includeVideo;
    state.mime = pickMime(includeVideo);
    state.chunks = [];
    try {
      const recorder = new global.MediaRecorder(mixStream, { mimeType: state.mime });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) state.chunks.push(event.data);
      };
      state.recorder = recorder;
      recorder.start(1000);
    } catch (err) {
      state.recording = false;
      teardownMix();
      throw err;
    }
    return true;
  }

  function stopRecorder() {
    return new Promise((resolve) => {
      const recorder = state.recorder;
      if (!recorder || recorder.state === 'inactive') {
        resolve();
        return;
      }
      recorder.addEventListener('stop', () => resolve(), { once: true });
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });
  }

  async function stop() {
    if (!state.recording && !state.recorder) return null;
    await stopRecorder();
    state.recording = false;
    const chunks = state.chunks.slice();
    const mime = state.mime || 'audio/webm';
    const includeVideo = state.includeVideo;
    state.recorder = null;
    state.chunks = [];
    teardownMix();
    if (!chunks.length) return null;
    const blob = new Blob(chunks, { type: mime });
    if (!includeVideo) {
      try {
        const bounceCtx = new (global.AudioContext || global.webkitAudioContext)();
        const audioBuf = await bounceCtx.decodeAudioData(await blob.arrayBuffer());
        const wav = encodeWav(audioBuf);
        bounceCtx.close?.();
        downloadBlob(wav, stampName('wav'));
        return wav;
      } catch (err) {
        console.warn('Watch together wav bounce failed', err);
      }
    }
    downloadBlob(blob, stampName(includeVideo ? 'webm' : 'webm'));
    return blob;
  }

  function recording() {
    return state.recording;
  }

  global.WatchTogetherBooth = {
    isAudioTrack,
    trackKey,
    wantsFaceVideo,
    createMixGraph,
    handleTrack,
    start,
    stop,
    recording,
  };
})(window);
