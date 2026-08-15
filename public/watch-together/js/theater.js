/**
 * Development work by David Lane
 */
/**
 * Watch together theater — YouTube IFrame API playback + control-intent sync.
 * Volume is local only. Viewer GPS is shown on the couches map.
 */
(function () {
  'use strict';

  const DRIFT_PLAYING_S = 1.0;
  const DRIFT_PAUSED_S = 0.35;

  const els = {
    gateHost: () => document.getElementById('wtGateHost'),
    url: () => document.getElementById('wtUrl'),
    load: () => document.getElementById('wtLoad'),
    pick: () => document.getElementById('wtPick'),
    picker: () => document.getElementById('wtPicker'),
    pickQ: () => document.getElementById('wtPickQ'),
    pickGo: () => document.getElementById('wtPickGo'),
    pickChips: () => document.getElementById('wtPickChips'),
    pickGrid: () => document.getElementById('wtPickGrid'),
    pickArtist: () => document.getElementById('wtPickArtist'),
    yt: () => document.getElementById('wtYt'),
    file: () => document.getElementById('wtFile'),
    empty: () => document.getElementById('wtEmpty'),
    poster: () => document.getElementById('wtPoster'),
    draw: () => document.getElementById('wtDraw'),
    play: () => document.getElementById('wtPlay'),
    seek: () => document.getElementById('wtSeek'),
    volume: () => document.getElementById('wtVolume'),
    fill: () => document.getElementById('wtFill'),
    cinema: () => document.getElementById('wtCinema'),
    theater: () => document.querySelector('.wt-theater'),
    stageMain: () => document.querySelector('.wt-stage-main'),
    drawBtn: () => document.getElementById('wtDrawBtn'),
    clearDraw: () => document.getElementById('wtClearDraw'),
    viewers: () => document.getElementById('wtViewers'),
    log: () => document.getElementById('wtLog'),
    chatForm: () => document.getElementById('wtChatForm'),
    chatText: () => document.getElementById('wtChatText'),
    chatMic: () => document.getElementById('wtChatMic'),
    tap: () => document.getElementById('wtTap'),
    status: () => document.getElementById('wtStatus'),
    mic: () => document.getElementById('wtMic'),
    cam: () => document.getElementById('wtCam'),
    blur: () => document.getElementById('wtBlur'),
    record: () => document.getElementById('wtRecord'),
    archive: () => document.getElementById('wtArchive'),
    faces: () => document.getElementById('wtFaces'),
    facesEmpty: () => document.getElementById('wtFacesEmpty'),
  };

  let ytPlayer = null;
  let ytApiReady = null;
  let loadedYtId = null;
  let ytLoadGen = 0;
  let room = { media: null, playing: false, position: 0, updatedAt: 0 };
  let applyingRemote = false;
  let ignoreStateUntil = 0;
  let drawing = false;
  let strokeId = '';
  let localVolume = 80;
  let selfName = 'Guest';

  function setStatus(text) {
    const el = els.status();
    if (el) el.textContent = text || '';
  }

  function loggedInUser() {
    if (typeof window.getLoggedInUser === 'function') return window.getLoggedInUser();
    return null;
  }

  function displayName() {
    const entered = window.WatchTogetherGate?.getName?.();
    if (entered) return entered;
    const user = loggedInUser();
    if (user?.name) return String(user.name).trim();
    return 'Guest';
  }

  function userId() {
    const user = loggedInUser();
    return user?.id || null;
  }

  function expectedTime(state, now) {
    const position = Number(state?.position) || 0;
    if (!state?.playing) return position;
    return Math.max(0, position + Math.max(0, (now - Number(state.updatedAt || now)) / 1000));
  }

  function needsDrift(playing, localTime, expected) {
    const threshold = playing ? DRIFT_PLAYING_S : DRIFT_PAUSED_S;
    return Math.abs(localTime - expected) > threshold;
  }

  function loadYouTubeIframeApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (ytApiReady) return ytApiReady;
    ytApiReady = new Promise((resolve, reject) => {
      const done = () => {
        if (window.YT?.Player) resolve();
      };
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prev === 'function') prev();
        done();
      };
      if (!document.querySelector('script[src*="iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = () => reject(new Error('YouTube player script blocked'));
        document.head.appendChild(tag);
      }
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (window.YT?.Player) {
          window.clearInterval(timer);
          resolve();
        } else if (Date.now() - started > 12000) {
          window.clearInterval(timer);
          reject(new Error('YouTube player did not load'));
        }
      }, 80);
    });
    return ytApiReady;
  }

  function extractYouTubeId(raw) {
    const value = String(raw || '').trim();
    if (!value) return null;
    if (/^[\w-]{11}$/.test(value)) return value;
    const fromBlob = value.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/|\/v\/)([\w-]{11})/);
    if (fromBlob) return fromBlob[1];
    return null;
  }

  function localTime() {
    if (room.media?.kind === 'youtube' && ytPlayer?.getCurrentTime) {
      try {
        return Number(ytPlayer.getCurrentTime()) || 0;
      } catch {
        return 0;
      }
    }
    const video = els.file();
    if (room.media?.kind === 'file' && video) return Number(video.currentTime) || 0;
    return 0;
  }

  function emitIntent(payload) {
    window.WatchTogetherSync?.send(payload);
  }

  function emitClock(payload) {
    emitIntent(payload);
  }

  async function loadUrl(raw) {
    const url = String(raw || '').trim();
    if (!url) {
      setStatus('Paste a YouTube link or a video URL.');
      return;
    }
    const youtubeId = extractYouTubeId(url);
    let media;
    if (youtubeId) {
      media = { kind: 'youtube', youtubeId, url };
    } else {
      try {
        const href = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) ? url : 'https://' + url;
        const parsed = new URL(href);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('unsupported');
        }
        media = { kind: 'file', src: parsed.href, url: parsed.href };
      } catch {
        setStatus('That does not look like a YouTube link or video URL.');
        return;
      }
    }
    setStatus('Loading…');
    room = {
      ...room,
      media,
      playing: false,
      position: 0,
      updatedAt: Date.now(),
    };
    try {
      await ensureMedia(media);
      applyPlayback(room, true);
      setStatus('Loaded. Press play.');
    } catch (err) {
      setStatus(err?.message || 'Player did not start.');
      return;
    }
    emitClock({ type: 'load', url: media.url });
  }

  async function loadFromInput() {
    await loadUrl(els.url()?.value);
  }

  function setPickerOpen(on) {
    const picker = els.picker();
    const btn = els.pick();
    if (picker) picker.hidden = !on;
    btn?.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function renderArtist(artist) {
    const el = els.pickArtist();
    if (!el) return;
    el.replaceChildren();
    if (!artist?.name) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const name = document.createElement('strong');
    name.textContent = artist.name;
    el.append(name);
    if (artist.description) {
      el.append(document.createTextNode(' — ' + artist.description));
    }
    if (artist.musicbrainzUrl) {
      const mb = document.createElement('a');
      mb.href = artist.musicbrainzUrl;
      mb.target = '_blank';
      mb.rel = 'noopener noreferrer';
      mb.textContent = 'MusicBrainz';
      el.append(document.createTextNode(' · '), mb);
    }
  }

  function renderPicker(videos, message) {
    const grid = els.pickGrid();
    if (!grid) return;
    grid.replaceChildren();
    if (message) {
      const note = document.createElement('p');
      note.className = 'wt-pick-empty';
      note.textContent = message;
      grid.appendChild(note);
      return;
    }
    (videos || []).forEach((video) => {
      const card = document.createElement('article');
      card.className = 'wt-pick-card';
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'wt-pick-play';
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = video.thumbnail || youtubeThumb(video.videoId);
      const cap = document.createElement('span');
      cap.textContent = video.title;
      play.append(img, cap);
      play.addEventListener('click', () => {
        const input = els.url();
        if (input) input.value = video.url;
        setPickerOpen(false);
        loadUrl(video.url).catch((err) => setStatus(err.message));
      });
      const yt = document.createElement('a');
      yt.className = 'wt-pick-yt';
      yt.href = video.url || 'https://www.youtube.com/watch?v=' + video.videoId;
      yt.target = '_blank';
      yt.rel = 'noopener noreferrer';
      yt.textContent = 'YouTube';
      card.append(play, yt);
      grid.appendChild(card);
    });
  }

  async function searchPicker(query) {
    const typed = String(query || els.pickQ()?.value || '').trim();
    if (els.pickQ() && query) els.pickQ().value = typed;
    if (typed.length < 2) {
      renderArtist(null);
      renderPicker([], 'Type an artist, or tap Live.');
      return;
    }
    renderPicker([], 'Looking up the artist, then YouTube…');
    try {
      const res = await fetch('/api/watch-together/youtube-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: typed }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.error === 'no-key' || res.status === 503) {
        renderArtist(null);
        renderPicker([], 'YouTube search is not configured. Paste a link instead.');
        return;
      }
      if (!data.ok) {
        renderArtist(data.artist || null);
        renderPicker([], 'YouTube search failed. Paste a watch link instead.');
        return;
      }
      renderArtist(data.artist || null);
      if (!data.videos || !data.videos.length) {
        renderPicker([], 'Nothing embeddable for that. Try another name or paste a link.');
        return;
      }
      renderPicker(data.videos);
    } catch {
      renderArtist(null);
      renderPicker([], 'Search failed. Paste a link instead.');
    }
  }

  function youtubeThumb(id, size) {
    const videoId = String(id || '').trim();
    if (!/^[\w-]{11}$/.test(videoId)) return '';
    const file = size || 'hqdefault';
    return 'https://i.ytimg.com/vi/' + videoId + '/' + file + '.jpg';
  }

  function setPoster(youtubeId) {
    const img = els.poster();
    if (!img) return;
    const id = String(youtubeId || '').trim();
    if (!/^[\w-]{11}$/.test(id)) {
      img.hidden = true;
      img.removeAttribute('src');
      delete img.dataset.size;
      return;
    }
    img.hidden = false;
    img.alt = '';
    delete img.dataset.size;
    img.onerror = function () {
      if (img.dataset.size === 'hq') return;
      img.dataset.size = 'hq';
      img.src = youtubeThumb(id, 'hqdefault');
    };
    img.src = youtubeThumb(id, 'maxresdefault');
  }

  function showMedia(kind) {
    const yt = els.yt();
    const file = els.file();
    const empty = els.empty();
    const ytReady = kind === 'youtube' && youtubeIframeReady();
    if (yt) yt.hidden = kind !== 'youtube' || !ytReady;
    if (file) file.hidden = kind !== 'file';
    if (empty) empty.hidden = Boolean(kind);
    setPoster(kind === 'youtube' ? room.media?.youtubeId : '');
  }

  function applyLocalVolume() {
    if (ytPlayer?.setVolume) {
      try {
        ytPlayer.setVolume(localVolume);
      } catch {
        /* ignore */
      }
    }
    const video = els.file();
    if (video) video.volume = Math.min(1, Math.max(0, localVolume / 100));
  }

  function hasMedia(media) {
    if (!media || !media.kind) return false;
    if (media.kind === 'youtube') return Boolean(media.youtubeId);
    if (media.kind === 'file') return Boolean(media.src);
    return false;
  }

  function isStalePlayback(incoming) {
    if (!hasMedia(room.media)) return false;
    const incomingAt = Number(incoming?.updatedAt) || 0;
    const localAt = Number(room.updatedAt) || 0;
    return incomingAt > 0 && localAt > 0 && incomingAt < localAt;
  }

  function destroyYt() {
    ytLoadGen += 1;
    if (ytPlayer?.destroy) {
      try {
        ytPlayer.destroy();
      } catch {
        /* ignore */
      }
    }
    ytPlayer = null;
    loadedYtId = null;
    const yt = els.yt();
    if (yt) yt.innerHTML = '';
  }

  function youtubeErrorMessage(code) {
    if (code === 101 || code === 150) return 'That video blocks embedding. Try another link.';
    if (code === 100) return 'YouTube could not find that video.';
    if (code === 2) return 'That YouTube id is not valid.';
    return 'YouTube could not play that video.';
  }

  async function loadYoutube(videoId) {
    if (ytPlayer && loadedYtId === videoId) {
      showMedia('youtube');
      return;
    }
    await loadYouTubeIframeApi();
    const yt = els.yt();
    if (!yt) return;
    if (ytPlayer && loadedYtId === videoId) {
      showMedia('youtube');
      return;
    }
    const gen = (ytLoadGen += 1);
    yt.hidden = true;
    if (ytPlayer?.destroy) {
      try {
        ytPlayer.destroy();
      } catch {
        /* ignore */
      }
    }
    ytPlayer = null;
    loadedYtId = null;
    yt.innerHTML = '';
    const host = document.createElement('div');
    host.id = 'wtYtPlayer';
    yt.appendChild(host);
    showMedia('youtube');
    void yt.offsetWidth;
    applyingRemote = true;
    await new Promise((resolve) => {
      const player = new window.YT.Player('wtYtPlayer', {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          fs: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady() {
            if (gen !== ytLoadGen) {
              resolve();
              return;
            }
            ytPlayer = player;
            loadedYtId = videoId;
            const iframe = player.getIframe?.();
            if (iframe) {
              iframe.setAttribute('allowfullscreen', '1');
              iframe.setAttribute(
                'allow',
                'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share'
              );
            }
            applyLocalVolume();
            applyingRemote = false;
            showMedia('youtube');
            applyPlayback(room, true);
            resolve();
          },
          onError(event) {
            if (gen !== ytLoadGen) {
              resolve();
              return;
            }
            setStatus(youtubeErrorMessage(Number(event?.data)));
            applyingRemote = false;
            resolve();
          },
          onStateChange(event) {
            if (gen !== ytLoadGen) return;
            if (applyingRemote || Date.now() < ignoreStateUntil || !window.YT) return;
            const YT = window.YT;
            if (event.data === YT.PlayerState.PLAYING) {
              emitClock({ type: 'play', position: localTime() });
            } else if (event.data === YT.PlayerState.PAUSED) {
              emitClock({ type: 'pause', position: localTime() });
            }
          },
        },
      });
      if (gen === ytLoadGen) {
        ytPlayer = player;
        loadedYtId = videoId;
      }
    });
  }

  function loadFile(src) {
    destroyYt();
    const video = els.file();
    if (!video) return;
    video.src = src;
    applyLocalVolume();
    showMedia('file');
  }

  async function ensureMedia(media) {
    if (!hasMedia(media)) {
      destroyYt();
      const video = els.file();
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
      showMedia(null);
      room.media = null;
      return;
    }
    if (media.kind === 'youtube' && loadedYtId === media.youtubeId && ytPlayer) {
      room.media = media;
      showMedia('youtube');
      return;
    }
    const sameFile =
      media.kind === 'file' && room.media?.kind === 'file' && room.media?.src === media.src;
    room.media = media;
    if (sameFile) {
      showMedia('file');
      return;
    }
    if (media.kind === 'youtube' && media.youtubeId) {
      await loadYoutube(media.youtubeId);
      return;
    }
    if (media.kind === 'file' && media.src) loadFile(media.src);
  }

  function adoptPlayback(incoming, forceSeek) {
    if (!incoming || isStalePlayback(incoming)) return Promise.resolve();
    if (!hasMedia(incoming.media) && hasMedia(room.media)) return Promise.resolve();
    room = {
      media: incoming.media || null,
      playing: Boolean(incoming.playing),
      position: Number(incoming.position) || 0,
      updatedAt: Number(incoming.updatedAt) || Date.now(),
      host: incoming.host === undefined ? room.host || null : incoming.host,
    };
    return ensureMedia(room.media).then(() => applyPlayback(room, forceSeek));
  }

  function youtubeIframeReady() {
    try {
      const src = String(ytPlayer?.getIframe?.()?.src || '');
      return /youtube\.com|youtube-nocookie\.com/.test(src);
    } catch {
      return false;
    }
  }

  function applyPlayback(state, forceSeek) {
    const target = expectedTime(state, Date.now());
    const playing = Boolean(state.playing);
    applyingRemote = true;
    ignoreStateUntil = Date.now() + 700;
    try {
      if (state.media?.kind === 'youtube' && ytPlayer && youtubeIframeReady()) {
        if (forceSeek || needsDrift(playing, localTime(), target)) {
          ytPlayer.seekTo(target, true);
        }
        if (playing) ytPlayer.playVideo();
        else ytPlayer.pauseVideo();
      }
      const video = els.file();
      if (state.media?.kind === 'file' && video) {
        if (forceSeek || needsDrift(playing, localTime(), target)) {
          video.currentTime = target;
        }
        if (playing) {
          const play = video.play();
          if (play && typeof play.catch === 'function') {
            play.catch(() => {
              const tap = els.tap();
              if (tap) tap.hidden = false;
            });
          }
        } else {
          video.pause();
        }
      }
    } catch {
      const tap = els.tap();
      if (tap) tap.hidden = false;
    }
    applyingRemote = false;
    const seek = els.seek();
    if (seek) seek.value = String(Math.floor(target));
    const playBtn = els.play();
    if (playBtn) playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    playBtn && (playBtn.textContent = playing ? '❚❚' : '▶');
  }

  async function applyState(state) {
    await adoptPlayback(state, true);
    if (Array.isArray(state.chat)) {
      const log = els.log();
      if (log) {
        log.replaceChildren();
        state.chat.forEach(appendChat);
      }
    }
    if (Array.isArray(state.draw)) replayDraw(state.draw);
    renderViewers(state.viewers || []);
    window.WatchTogetherMap?.updateViewers(state.viewers || []);
  }

  function renderViewers(viewers) {
    const host = els.viewers();
    if (!host) return;
    host.replaceChildren();
    const list = viewers || [];
    const count = document.createElement('span');
    count.className = 'wt-chip wt-chip-count';
    count.textContent = list.length + ' / 10';
    host.appendChild(count);
    list.forEach((viewer) => {
      const chip = document.createElement('span');
      chip.className = 'wt-chip';
      chip.textContent = viewer.name || 'Guest';
      host.appendChild(chip);
    });
  }

  function faceTileId(participant) {
    return 'wt-face-' + String(participant?.identity || 'local').replace(/[^\w-]/g, '');
  }

  function syncFacesEmpty() {
    const empty = els.facesEmpty();
    const host = els.faces();
    if (!empty || !host) return;
    empty.hidden = Boolean(host.querySelector('.wt-face'));
  }

  function attachFace(participant, track, isLocal) {
    if (!track || track.kind !== 'video') return;
    const host = els.faces();
    if (!host) return;
    const id = faceTileId(participant);
    let tile = document.getElementById(id);
    if (!tile) {
      tile = document.createElement('div');
      tile.className = 'wt-face';
      tile.id = id;
      const caption = document.createElement('span');
      caption.textContent = isLocal
        ? (participant?.name || selfName || 'You') + ' (you)'
        : participant?.name || 'Couch';
      tile.appendChild(caption);
      host.appendChild(tile);
    }
    const media = track.attach();
    if (media) {
      media.muted = Boolean(isLocal);
      media.autoplay = true;
      media.playsInline = true;
      media.setAttribute('playsinline', 'true');
      tile.querySelectorAll('video').forEach((el) => el.remove());
      tile.prepend(media);
      const play = media.play?.();
      if (play && typeof play.catch === 'function') play.catch(() => {});
    }
    syncFacesEmpty();
  }

  function detachFace(participant, track) {
    track?.detach?.().forEach((el) => el.remove());
    const tile = document.getElementById(faceTileId(participant));
    if (tile && !tile.querySelector('video')) tile.remove();
    syncFacesEmpty();
  }

  function handleMediaTrack(payload) {
    window.WatchTogetherBooth?.handleTrack?.(payload);
    const track = payload?.track;
    const participant = payload?.participant;
    if (!track || track.kind !== 'video') return;
    if (payload.action === 'unsubscribed') {
      detachFace(participant, track);
      return;
    }
    attachFace(participant, track, payload.action === 'local');
  }

  function appendChat(message) {
    const log = els.log();
    if (!log || !message) return;
    const row = document.createElement('div');
    row.className = 'wt-msg';
    const who = document.createElement('strong');
    who.textContent = message.name || 'Guest';
    const body = document.createElement('span');
    body.textContent = message.text || '';
    row.append(who, body);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function syncCamButton(on) {
    const cam = els.cam();
    if (!cam) return;
    cam.setAttribute('aria-pressed', on ? 'true' : 'false');
    cam.textContent = on ? 'Cam on' : 'Cam';
  }

  function syncBlurButton(on) {
    const blur = els.blur();
    if (!blur) return;
    blur.setAttribute('aria-pressed', on ? 'true' : 'false');
    blur.textContent = on ? 'Blur on' : 'Blur';
  }

  function syncRecordButton(on) {
    const rec = els.record();
    if (!rec) return;
    rec.setAttribute('aria-pressed', on ? 'true' : 'false');
    rec.textContent = on ? 'Stop' : 'Record';
  }

  function syncMicButtons(on) {
    const pressed = on ? 'true' : 'false';
    const mic = els.mic();
    const chatMic = els.chatMic();
    if (mic) {
      mic.setAttribute('aria-pressed', pressed);
      mic.textContent = on ? 'Mic on' : 'Mic';
    }
    if (chatMic) {
      chatMic.setAttribute('aria-pressed', pressed);
      chatMic.textContent = on ? 'Live' : 'Talk';
    }
  }

  async function toggleMic() {
    const next = !window.WatchTogetherSync?.micOn();
    const on = await window.WatchTogetherSync?.setMic(next);
    syncMicButtons(Boolean(on));
    if (next && !on) {
      setStatus('Mic did not start. Allow the microphone, then click Mic or Talk.');
      return false;
    }
    if (on) setStatus('Mic on · they can hear you.');
    else setStatus('Mic off · type in chat instead.');
    return on;
  }

  function canvasPoint(event) {
    const canvas = els.draw();
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function sizeCanvas() {
    const canvas = els.draw();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
  }

  function drawDot(stroke) {
    const canvas = els.draw();
    if (!canvas || !stroke) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#ff3d4d';
    ctx.fillStyle = '#ff3d4d';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const x = Number(stroke.x) * canvas.width;
    const y = Number(stroke.y) * canvas.height;
    if (stroke.phase === 'start') {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
      return;
    }
    ctx.lineTo(x, y);
    ctx.stroke();
    if (stroke.phase === 'end') ctx.beginPath();
  }

  function replayDraw(strokes) {
    const canvas = els.draw();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
    (strokes || []).forEach(drawDot);
  }

  function bindDraw() {
    const canvas = els.draw();
    if (!canvas) return;
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);

    function send(phase, event) {
      const pt = canvasPoint(event);
      if (!pt) return;
      emitIntent({ type: 'draw', id: strokeId, phase, x: pt.x, y: pt.y });
      drawDot({ ...pt, phase });
    }

    canvas.addEventListener('pointerdown', (event) => {
      if (!canvas.classList.contains('is-on')) return;
      drawing = true;
      strokeId = String(Date.now());
      canvas.setPointerCapture(event.pointerId);
      send('start', event);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!drawing) return;
      send('move', event);
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!drawing) return;
      drawing = false;
      send('end', event);
    });
  }

  async function getLocation() {
    if (window.collectionUtils?.requestDeviceLocation) {
      return window.collectionUtils.requestDeviceLocation();
    }
    if (!navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  async function connect() {
    const code = window.WatchTogetherGate.getStoredCode();
    selfName = displayName();
    const result = await window.WatchTogetherSync.connect({
      code,
      name: selfName,
      userId: userId(),
      lat: null,
      lng: null,
      handlers: {
        state: (payload) => applyState(payload || {}),
        playback: (payload) => {
          adoptPlayback(payload, true);
        },
        viewers: (viewers) => {
          renderViewers(viewers || []);
          window.WatchTogetherMap?.updateViewers(viewers || []);
        },
        chat: appendChat,
        draw: drawDot,
        clearDraw: () => replayDraw([]),
        'clear-draw': () => replayDraw([]),
        track: handleMediaTrack,
        blur: (payload) => {
          syncBlurButton(Boolean(payload?.on));
          if (payload?.error) {
            setStatus('Background blur could not start. Try Chrome or Edge.');
          }
        },
        error: (err) => {
          if (err?.reason === 'theater-full') {
            setStatus('Theater is full — 10 people already here.');
            return;
          }
          if (err?.reason === 'livekit-missing') {
            setStatus('Camera needs LiveKit keys on the server. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET on Render, then redeploy.');
            return;
          }
          if (err?.reason === 'unsupported' || err?.reason === 'empty') {
            setStatus('That does not look like a YouTube link.');
            return;
          }
          if (err?.reason && err.reason !== 'invalid-code') setStatus(String(err.reason));
        },
      },
    });
    const live = result?.transport === 'livekit';
    const mic = els.mic();
    const chatMic = els.chatMic();
    const cam = els.cam();
    const blur = els.blur();
    const rec = els.record();
    const archive = els.archive();
    if (mic) mic.hidden = !live;
    if (chatMic) chatMic.hidden = !live;
    if (cam) cam.hidden = !live;
    if (blur) blur.hidden = !live;
    if (rec) rec.hidden = !live;
    if (archive) archive.hidden = !live;
    if (live) {
      try {
        syncBlurButton(window.WatchTogetherSync.blurOn());
        const camOn = await window.WatchTogetherSync.setCamera(true);
        syncCamButton(camOn);
        syncBlurButton(window.WatchTogetherSync.blurOn());
        const micOn = await window.WatchTogetherSync.setMic(true);
        syncMicButtons(micOn);
        if (!camOn) {
          setStatus('Click Cam so the other couches can see you.');
          const retryCam = () => {
            document.removeEventListener('pointerdown', retryCam);
            window.WatchTogetherSync.setCamera(true).then((ok) => {
              syncCamButton(ok);
              if (ok && !hasMedia(room.media)) setStatus('Camera on.');
            });
          };
          document.addEventListener('pointerdown', retryCam, { once: true });
        } else if (!hasMedia(room.media)) {
          if (micOn) {
            setStatus('Mic on · they can hear you. Load a movie when you want.');
          } else {
            setStatus('Click Talk in chat so the other couches can hear you.');
          }
        }
      } catch (err) {
        setStatus(err?.message || 'Click Cam, then Talk, so they can see and hear you.');
      }
    } else if (result?.transport === 'full') {
      setStatus('Theater is full — 10 people already here.');
    } else {
      setStatus('On the shared clock. Typed chat only — add LiveKit keys on Render for camera and voice.');
    }
    getLocation().then((loc) => {
      if (loc?.lat != null && loc?.lng != null) {
        window.WatchTogetherSync.setLocation(loc.lat, loc.lng);
      }
    });
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function isFillScreen() {
    const stage = els.stageMain();
    return Boolean(stage && fullscreenElement() === stage);
  }

  function syncFillButton() {
    const btn = els.fill();
    if (!btn) return;
    const on = isFillScreen();
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.textContent = on ? 'Exit fill' : 'Fill screen';
  }

  async function toggleFillScreen() {
    const stage = els.stageMain();
    if (!stage) return;
    try {
      if (isFillScreen()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else {
        if (stage.requestFullscreen) await stage.requestFullscreen();
        else if (stage.webkitRequestFullscreen) stage.webkitRequestFullscreen();
        else setStatus('This browser cannot fill the screen.');
      }
    } catch (err) {
      setStatus(err?.message || 'Fill screen was blocked.');
    }
    syncFillButton();
  }

  const CINEMA_KEY = 'dc_watch_together_cinema_v2';

  function readCinema() {
    try {
      const raw = sessionStorage.getItem(CINEMA_KEY);
      if (raw === null) return true;
      return raw === '1';
    } catch {
      return true;
    }
  }

  function isCinema() {
    return Boolean(els.theater()?.classList.contains('is-cinema'));
  }

  function setCinema(on) {
    const theater = els.theater();
    const btn = els.cinema();
    if (theater) theater.classList.toggle('is-cinema', Boolean(on));
    document.body.classList.toggle('wt-cinema-on', Boolean(on));
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'Exit chat left' : 'Chat left';
    }
    try {
      sessionStorage.setItem(CINEMA_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  function bindControls() {
    els.load()?.addEventListener('click', () => {
      loadFromInput().catch((err) => setStatus(err.message));
    });
    els.pick()?.addEventListener('click', () => {
      const next = Boolean(els.picker()?.hidden);
      setPickerOpen(next);
    });
    els.pickGo()?.addEventListener('click', () => {
      searchPicker().catch((err) => setStatus(err.message));
    });
    els.pickQ()?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchPicker().catch((err) => setStatus(err.message));
      }
    });
    els.pickChips()?.addEventListener('click', (event) => {
      const chip = event.target?.closest?.('button[data-q]');
      if (!chip) return;
      const suffix = chip.getAttribute('data-q') || '';
      const typed = String(els.pickQ()?.value || '').trim();
      const q = typed && !typed.toLowerCase().includes(suffix.toLowerCase())
        ? `${typed} ${suffix}`.trim()
        : suffix;
      if (els.pickQ()) els.pickQ().value = q;
      searchPicker(q).catch((err) => setStatus(err.message));
    });
    els.url()?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        els.load()?.click();
      }
    });
    els.play()?.addEventListener('click', () => {
      emitClock({ type: room.playing ? 'pause' : 'play', position: localTime() });
    });
    const seekNow = (event) => {
      emitClock({
        type: 'seek',
        position: Number(event.target.value) || 0,
        playing: room.playing,
      });
    };
    els.seek()?.addEventListener('input', seekNow);
    els.seek()?.addEventListener('change', seekNow);
    els.volume()?.addEventListener('input', (event) => {
      localVolume = Number(event.target.value) || 0;
      applyLocalVolume();
    });
    els.fill()?.addEventListener('click', () => {
      toggleFillScreen().catch((err) => setStatus(err.message));
    });
    els.cinema()?.addEventListener('click', () => {
      setCinema(!isCinema());
    });
    setCinema(readCinema());
    document.addEventListener('fullscreenchange', syncFillButton);
    document.addEventListener('webkitfullscreenchange', syncFillButton);
    document.addEventListener('keydown', (event) => {
      const tag = String(event.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || event.target?.isContentEditable) return;
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        toggleFillScreen().catch(() => {});
        return;
      }
      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        setCinema(!isCinema());
      }
    });
    els.drawBtn()?.addEventListener('click', () => {
      const canvas = els.draw();
      const on = !canvas?.classList.contains('is-on');
      canvas?.classList.toggle('is-on', on);
      els.drawBtn()?.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    els.clearDraw()?.addEventListener('click', () => emitIntent({ type: 'clear-draw' }));
    els.mic()?.addEventListener('click', () => toggleMic());
    els.chatMic()?.addEventListener('click', () => toggleMic());
    els.cam()?.addEventListener('click', async () => {
      const next = !window.WatchTogetherSync?.camOn();
      const on = await window.WatchTogetherSync?.setCamera(next);
      syncCamButton(Boolean(on));
      if (next && !on) {
        setStatus('Camera did not start. Allow the camera in the browser, then click Cam again.');
      }
    });
    els.blur()?.addEventListener('click', async () => {
      const next = !window.WatchTogetherSync?.blurOn();
      const on = await window.WatchTogetherSync?.setBlur(next);
      syncBlurButton(Boolean(on));
      if (on) setStatus('Background blur on.');
      else setStatus('Background blur off.');
    });
    els.record()?.addEventListener('click', async () => {
      const booth = window.WatchTogetherBooth;
      if (!booth) return;
      try {
        if (booth.recording()) {
          await booth.stop();
          syncRecordButton(false);
          setStatus('Take saved.');
          return;
        }
        await booth.start();
        syncRecordButton(true);
        setStatus('Recording couches · movie is not in the file.');
      } catch (err) {
        syncRecordButton(false);
        setStatus(err?.message || 'Could not record.');
      }
    });
    let archiveId = null;
    els.archive()?.addEventListener('click', async () => {
      const btn = els.archive();
      const code = window.WatchTogetherGate?.getStoredCode?.() || '';
      try {
        if (archiveId) {
          await fetch('/api/watch-together/egress/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, egressId: archiveId }),
          });
          archiveId = null;
          if (btn) btn.setAttribute('aria-pressed', 'false');
          setStatus('Mic archive stopped. The movie was never captured.');
          return;
        }
        const res = await fetch('/api/watch-together/egress/audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setStatus(data.error || 'Could not archive mics.');
          return;
        }
        archiveId = data.egressId;
        if (btn) btn.setAttribute('aria-pressed', 'true');
        setStatus('Archiving couch mics on the server · YouTube is not in the file.');
      } catch (err) {
        setStatus(err?.message || 'Could not archive mics.');
      }
    });
    els.chatForm()?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = els.chatText();
      const text = String(input?.value || '').trim();
      if (!text) return;
      emitIntent({ type: 'chat', text });
      if (input) input.value = '';
    });
    els.tap()?.addEventListener('click', () => {
      els.tap().hidden = true;
      window.WatchTogetherSync?.resumeRemoteAudio?.();
      applyPlayback(room, true);
    });
    const video = els.file();
    if (video) {
      video.addEventListener('play', () => {
        if (!applyingRemote && Date.now() >= ignoreStateUntil) emitClock({ type: 'play', position: localTime() });
      });
      video.addEventListener('pause', () => {
        if (!applyingRemote && Date.now() >= ignoreStateUntil) emitClock({ type: 'pause', position: localTime() });
      });
      video.addEventListener('seeked', () => {
        if (!applyingRemote && Date.now() >= ignoreStateUntil) {
          emitClock({ type: 'seek', position: localTime(), playing: !video.paused });
        }
      });
    }
    setInterval(() => {
      if (!room.media) return;
      const target = expectedTime(room, Date.now());
      if (needsDrift(room.playing, localTime(), target)) applyPlayback(room, true);
      const seek = els.seek();
      if (seek && document.activeElement !== seek) seek.value = String(Math.floor(localTime()));
      const play = els.play();
      if (play) play.textContent = room.playing ? '❚❚' : '▶';
    }, 400);
  }

  function requireUnlock() {
    const gate = window.WatchTogetherGate;
    if (gate?.getName?.()) return Promise.resolve();
    return new Promise((resolve) => {
      const host = els.gateHost();
      if (!host || !gate?.buildNamePrompt) {
        resolve();
        return;
      }
      const overlay = gate.buildNamePrompt({
        suggested: loggedInUser()?.name || '',
        onUnlock: resolve,
      });
      host.appendChild(overlay);
      overlay.querySelector('#wtGateName')?.focus();
    });
  }

  async function start() {
    bindDraw();
    bindControls();
    await requireUnlock();
    selfName = displayName();
    window.WatchTogetherGate.setName(selfName);
    await window.WatchTogetherMap?.init();
    connect();
  }

  start();
})();
