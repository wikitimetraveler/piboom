/**
 * Bud Master HeyGen — welcome popup + optional streaming face
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const DEMO_RE = /[?&](?:demo=heygen|short=1)(?:&|$)/;
  const DEMO_URL = '/data/mountain-high-heygen-demo.json';
  const FACE_URL = '/data/mountain-high-heygen-face.json';
  const HEARD_KEY = 'mhm_bud_heard_v1';
  const INTRO_FALLBACK = '/mountain-high/assets/video/hippie-botanist-intro.mp4';
  const TOGGLE_SELECTOR = '#mhmBudToggle, #mhmMeetJill';
  let cachedDemo = null;
  let face = null;
  let heygenRoom = null;
  let heygenSessionId = null;
  let introOn = false;
  let splashStarted = false;
  let holdingPage = false;

  function hasHeard() {
    try {
      return root.localStorage.getItem(HEARD_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function markHeard() {
    try {
      root.localStorage.setItem(HEARD_KEY, '1');
    } catch (_) {
      /* ignore */
    }
  }

  function shouldAutoplayIntro() {
    const search = typeof location !== 'undefined' ? location.search : '';
    return DEMO_RE.test(search) || !hasHeard();
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadDemo() {
    if (cachedDemo) return cachedDemo;
    try {
      const res = await fetch(DEMO_URL, { cache: 'no-store' });
      cachedDemo = await res.json();
    } catch (_) {
      cachedDemo = null;
    }
    return cachedDemo;
  }

  async function loadFace() {
    try {
      const res = await fetch(FACE_URL, { cache: 'no-store' });
      face = res.ok ? await res.json() : null;
    } catch (_) {
      face = null;
    }
    return face;
  }

  function closeModal() {
    const modal = document.getElementById('mhmHeygenDemoModal');
    const video = modal?.querySelector('video');
    if (video) {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (_) {
        /* ignore */
      }
    }
    modal?.remove();
  }

  function stopSpeech() {
    try {
      root.speechSynthesis?.cancel();
    } catch (_) {
      /* ignore */
    }
  }

  function syncToggles() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll(TOGGLE_SELECTOR).forEach((btn) => {
      btn.setAttribute('aria-pressed', introOn ? 'true' : 'false');
      const icon = introOn ? 'bi-pause-fill' : 'bi-play-fill';
      const label = btn.querySelector('.mhm-guide-action-label');
      const iconEl = btn.querySelector('i');
      if (iconEl) iconEl.className = `bi ${icon}`;
      if (label) {
        label.textContent = 'Bud Master';
      } else {
        const span = btn.querySelector('span');
        if (span) span.textContent = ' Bud Master';
      }
      btn.title = introOn ? 'Pause Bud Master intro' : 'Play Bud Master intro';
      btn.setAttribute('aria-label', btn.title);
    });
  }

  function holdPage() {
    holdingPage = true;
    document.documentElement.classList.add('is-intro-splash');
    document.body.classList.add('is-intro-splash');
  }

  function releasePage() {
    holdingPage = false;
    document.documentElement.classList.remove('is-intro-splash');
    document.body.classList.remove('is-intro-splash');
  }

  function kickPlayback(video, playBtn) {
    if (!video || typeof video.play !== 'function') return;
    video.playbackRate = 1;
    try {
      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => {
          if (playBtn) playBtn.hidden = false;
        });
      }
    } catch (_) {
      if (playBtn) playBtn.hidden = false;
    }
  }

  function introVideoUrl(demo) {
    return String(
      demo?.heygenVideoLocalShort || demo?.heygenVideoUrlShort || INTRO_FALLBACK
    ).trim() || INTRO_FALLBACK;
  }

  function stopIntro() {
    introOn = false;
    markHeard();
    closeModal();
    stopSpeech();
    releasePage();
    syncToggles();
  }

  function showModal(demo, videoUrl) {
    closeModal();
    const url = videoUrl || INTRO_FALLBACK;
    const rootEl = document.createElement('div');
    rootEl.id = 'mhmHeygenDemoModal';
    rootEl.className = 'mhm-heygen-demo-modal mhm-heygen-demo-modal--splash';
    rootEl.setAttribute('role', 'dialog');
    rootEl.setAttribute('aria-modal', 'true');
    rootEl.setAttribute('aria-label', demo?.title || 'Meet Bud Master');
    rootEl.innerHTML = `<video class="mhm-heygen-demo-video" playsinline autoplay src="${esc(url)}"></video>
        <button type="button" class="mhm-heygen-play" hidden>Play</button>
        <button type="button" class="mhm-heygen-skip" data-mhm-heygen-close>Close</button>`;
    document.body.appendChild(rootEl);
    rootEl.addEventListener('click', (ev) => {
      if (!ev.target.closest('[data-mhm-heygen-close]')) return;
      ev.preventDefault();
      ev.stopPropagation();
      stopIntro();
    });
    const video = rootEl.querySelector('video');
    const playBtn = rootEl.querySelector('.mhm-heygen-play');
    if (playBtn) {
      playBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        playBtn.hidden = true;
        kickPlayback(video);
      });
    }
    if (video) {
      video.addEventListener('ended', stopIntro);
      kickPlayback(video, playBtn);
    }
  }

  function playIntro(opts) {
    const splash = Boolean(opts && opts.splash);
    root.MhmSong?.stop?.();
    introOn = true;
    if (splash) holdPage();
    showModal(cachedDemo, introVideoUrl(cachedDemo));
    syncToggles();
    if (!cachedDemo) loadDemo();
    return true;
  }

  async function toggleIntro() {
    if (introOn) {
      stopIntro();
      return false;
    }
    return playIntro();
  }

  function setStatus(msg) {
    if (!root.MHM_DEV) return;
    const el = document.getElementById('mhmHeygenStatus');
    if (el) {
      el.textContent = msg || '';
      el.hidden = !msg;
    }
  }

  function mediaHost() {
    return document.getElementById('mhmHeygenMedia');
  }

  function facePayload(extra) {
    const body = extra && typeof extra === 'object' ? { ...extra } : {};
    if (face?.avatarId) body.avatarId = face.avatarId;
    if (face?.voiceId) body.voiceId = face.voiceId;
    return body;
  }

  async function attachSession(data) {
    const media = mediaHost();
    if (!media || !data?.url) return;
    heygenSessionId = data.sessionId;
    if (root.HeygenLiveTile?.isPoster?.(data) || data.playback === 'poster') {
      if (heygenRoom && typeof heygenRoom.disconnect === 'function') {
        await heygenRoom.disconnect().catch(() => {});
      }
      heygenRoom = { kind: 'poster' };
      media.hidden = false;
      root.HeygenLiveTile.attachPoster(media, data.url, 'mhm-heygen__video', 'Bud Master');
      if (data.audioUrl) root.HeygenLiveTile.playAudio?.(data.audioUrl);
      return;
    }
    if (root.HeygenLiveTile?.isHls(data)) {
      if (heygenRoom && typeof heygenRoom.disconnect === 'function') {
        await heygenRoom.disconnect().catch(() => {});
      }
      heygenRoom = { kind: 'hls' };
      media.hidden = false;
      root.HeygenLiveTile.attachHls(media, data.url, 'mhm-heygen__video');
      return;
    }
    const LK = root.LivekitClient;
    if (!LK) {
      setStatus('LiveKit client missing.');
      return;
    }
    const room = new LK.Room({ adaptiveStream: true, dynacast: true });
    room.on(LK.RoomEvent.TrackSubscribed, (track) => {
      media.hidden = false;
      const el = track.attach();
      el.className = 'mhm-heygen__video';
      media.replaceChildren(el);
    });
    await room.connect(data.url, data.accessToken);
    heygenRoom = room;
  }

  async function stopStream() {
    if (heygenSessionId) {
      await fetch('/api/heygen/streaming/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: heygenSessionId }),
      }).catch(() => {});
    }
    const media = mediaHost();
    const video = media?.querySelector('video');
    root.HeygenLiveTile?.destroyHls(video);
    if (heygenRoom && typeof heygenRoom.disconnect === 'function') {
      await heygenRoom.disconnect().catch(() => {});
    }
    heygenRoom = null;
    heygenSessionId = null;
    if (media) {
      media.replaceChildren();
      media.hidden = true;
    }
    const btn = document.getElementById('mhmHeygenLive');
    if (btn) btn.textContent = 'Live Bud Master';
    setStatus('');
  }

  async function startStream() {
    const greeting = face?.greeting || 'Hey — Bud Master here. Flip a type or ask about a lockout.';
    const res = await fetch('/api/heygen/streaming/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facePayload({ text: greeting })),
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      setStatus(data.error || 'HeyGen streaming needs HEYGEN_API_KEY — TTS still works.');
      return;
    }
    await attachSession(data);
    const btn = document.getElementById('mhmHeygenLive');
    if (btn) btn.textContent = 'Hide Bud Master';
    setStatus(
      data.fallback || data.playback === 'poster'
        ? 'Bud Master on voice — live stream is not on this HeyGen plan.'
        : 'Bud Master live on HeyGen.'
    );
  }

  async function toggleStream() {
    if (heygenRoom || heygenSessionId) {
      await stopStream();
      return;
    }
    await startStream();
  }

  async function speak(text) {
    const clean = String(text || '').trim().slice(0, 900);
    if (!clean || !heygenSessionId) return;
    const res = await fetch('/api/heygen/streaming/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facePayload({ sessionId: heygenSessionId, text: clean })),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.url) await attachSession(data);
  }

  root.MhmHeygen = {
    playIntro,
    toggleIntro,
    stopIntro,
    hasHeard,
    shouldAutoplayIntro,
    toggleStream,
    speak,
    stop: stopStream,
  };

  function maybeAutoplaySplash() {
    if (splashStarted || introOn) return;
    if (typeof document !== 'undefined' && document.body?.dataset?.age && document.body.dataset.age !== 'ok') {
      return;
    }
    if (!shouldAutoplayIntro()) {
      releasePage();
      return;
    }
    splashStarted = true;
    playIntro({ splash: true });
  }

  function boot() {
    if (typeof document === 'undefined') return;
    loadFace();
    loadDemo();
    document.querySelectorAll(TOGGLE_SELECTOR).forEach((btn) => {
      if (btn._mhmBudBound) return;
      btn._mhmBudBound = true;
      btn.addEventListener('click', () => toggleIntro().catch(() => {}));
    });
    syncToggles();
    document.getElementById('mhmHeygenLive')?.addEventListener('click', () =>
      toggleStream().catch((err) => setStatus(err.message || 'HeyGen failed'))
    );
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && document.getElementById('mhmHeygenDemoModal')) stopIntro();
    });
    maybeAutoplaySplash();
    root.addEventListener('mhm-age-ok', maybeAutoplaySplash);
    root.addEventListener('mhm-age-confirmed', maybeAutoplaySplash);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
