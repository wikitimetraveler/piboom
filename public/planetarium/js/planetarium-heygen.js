/**
 * Alienigena HeyGen live tile for planetarium Carl sessions
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  let heygenRoom = null;
  let heygenSessionId = null;
  let studioFace = null;
  let introOn = false;
  let splashStarted = false;
  let holdingPage = false;
  const HEARD_KEY = 'plan_alien_heard_v1';
  const INTRO_FALLBACK = '/planetarium/assets/video/alienigena-zigzag-intro.mp4';
  const DEMO_RE = /[?&](?:demo=heygen|reel=1)(?:&|$)/;
  const SPLASH_CLIP = 1 / 3;
  const SPLASH_RATE = 0.7;

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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

  function introVideoUrl(face) {
    return String(face?.introVideo || INTRO_FALLBACK).trim() || INTRO_FALLBACK;
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

  function bindSplashClip(video) {
    video.playbackRate = SPLASH_RATE;
    const stopAtThird = () => {
      const dur = Number(video.duration);
      if (!Number.isFinite(dur) || dur <= 0) return;
      if (video.currentTime >= dur * SPLASH_CLIP) {
        video.removeEventListener('timeupdate', stopAtThird);
        stopIntro();
      }
    };
    video.addEventListener('loadedmetadata', () => {
      video.playbackRate = SPLASH_RATE;
    });
    video.addEventListener('timeupdate', stopAtThird);
    video.addEventListener('ended', stopIntro);
  }

  function syncIntroToggle() {
    const btn = document.getElementById('planAlienIntroToggle');
    if (!btn) return;
    btn.setAttribute('aria-pressed', introOn ? 'true' : 'false');
    btn.textContent = introOn ? 'Pause intro' : 'Play intro';
  }

  function closeIntroModal() {
    const modal = document.getElementById('planHeygenDemoModal');
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

  function stopIntro() {
    introOn = false;
    markHeard();
    closeIntroModal();
    releasePage();
    syncIntroToggle();
  }

  function showIntroModal(url, { splash = false } = {}) {
    closeIntroModal();
    const rootEl = document.createElement('div');
    rootEl.id = 'planHeygenDemoModal';
    rootEl.className = splash ? 'plan-heygen-demo-modal plan-heygen-demo-modal--splash' : 'plan-heygen-demo-modal';
    rootEl.setAttribute('role', 'dialog');
    rootEl.setAttribute('aria-modal', 'true');
    rootEl.setAttribute('aria-label', 'Alienigena intro');
    rootEl.innerHTML = splash
      ? '<video class="plan-heygen-demo-video" playsinline autoplay src="' +
        esc(url) +
        '"></video>' +
        '<button type="button" class="plan-heygen-play" hidden>Play</button>' +
        '<button type="button" class="plan-heygen-skip" data-plan-heygen-close>Skip</button>'
      : '<div class="plan-heygen-demo-backdrop" data-plan-heygen-close></div>' +
        '<div class="plan-heygen-demo-panel">' +
        '<header class="d-flex justify-content-between align-items-center mb-2">' +
        '<h2 class="h5 mb-0">Alienigena</h2>' +
        '<button type="button" class="btn-close btn-close-white" data-plan-heygen-close aria-label="Close intro"></button>' +
        '</header>' +
        '<video class="plan-heygen-demo-video" controls playsinline autoplay src="' +
        esc(url) +
        '"></video></div>';
    document.body.appendChild(rootEl);
    rootEl.querySelectorAll('[data-plan-heygen-close]').forEach((el) => {
      el.addEventListener('click', stopIntro);
    });
    const video = rootEl.querySelector('video');
    const playBtn = rootEl.querySelector('.plan-heygen-play');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        playBtn.hidden = true;
        kickPlayback(video);
      });
    }
    if (video) {
      if (splash) bindSplashClip(video);
      else video.addEventListener('ended', stopIntro);
      kickPlayback(video, playBtn);
    }
  }

  function playIntro(opts) {
    const splash = Boolean(opts && opts.splash);
    root.PlanetariumSkySong?.stop?.();
    introOn = true;
    if (splash) holdPage();
    showIntroModal(introVideoUrl(studioFace), { splash });
    syncIntroToggle();
    if (!studioFace) loadStudioFace();
    return true;
  }

  async function toggleIntro() {
    if (introOn) {
      stopIntro();
      return false;
    }
    return playIntro();
  }

  async function loadStudioFace() {
    try {
      const res = await fetch('/data/studio-heygen-face.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      studioFace = data && typeof data === 'object' ? data : null;
      const faceName = String(studioFace?.name || 'Alienigena').trim() || 'Alienigena';
      const label = document.getElementById('planHeygenLabel');
      if (label) label.textContent = faceName + ' · alien presenter';
      return studioFace;
    } catch (_) {
      studioFace = null;
      return null;
    }
  }

  function mediaHost() {
    return document.getElementById('planHeygenMedia');
  }

  function friendlyError(raw) {
    const text = String(raw || '');
    if (/streaming\.new|avatar-realtime|resource_not_found|404/i.test(text)) {
      return 'Live stream is not on this HeyGen plan — Alienigena still speaks.';
    }
    return text;
  }

  function speakTts(text) {
    const line = String(text || '').trim();
    if (!line) return Promise.resolve();
    if (typeof root.speakWithGoogle === 'function') {
      return root.speakWithGoogle(line, 'en-US-Neural2-D', { rate: 0.92 }).catch(() => {});
    }
    return Promise.resolve();
  }

  function clearMedia() {
    const media = mediaHost();
    const video = media?.querySelector('video');
    root.HeygenLiveTile?.destroyHls(video);
    root.HeygenLiveTile?.stopAudio?.();
    if (heygenRoom && typeof heygenRoom.disconnect === 'function') {
      heygenRoom.disconnect().catch(() => {});
    }
    heygenRoom = null;
    if (media) {
      media.replaceChildren();
      media.hidden = true;
    }
    document.getElementById('planHeygenWrap')?.classList.remove('plan-heygen--live');
  }

  async function attachSession(data) {
    const media = mediaHost();
    const wrap = document.getElementById('planHeygenWrap');
    if (!media || !data?.url) return;
    heygenSessionId = data.sessionId || (data.fallback || data.playback === 'poster' ? 'poster' : null);
    if (root.HeygenLiveTile?.isPoster?.(data) || data.playback === 'poster') {
      if (heygenRoom && typeof heygenRoom.disconnect === 'function') {
        await heygenRoom.disconnect().catch(() => {});
      }
      heygenRoom = { kind: 'poster' };
      media.hidden = false;
      wrap?.classList.add('plan-heygen--live');
      root.HeygenLiveTile.attachPoster(media, data.url, 'plan-heygen__video', 'Alienigena');
      if (data.audioUrl) root.HeygenLiveTile.playAudio?.(data.audioUrl);
      return;
    }
    if (root.HeygenLiveTile?.isHls(data)) {
      if (heygenRoom && typeof heygenRoom.disconnect === 'function') {
        await heygenRoom.disconnect().catch(() => {});
      }
      heygenRoom = { kind: 'hls' };
      media.hidden = false;
      wrap?.classList.add('plan-heygen--live');
      root.HeygenLiveTile.attachHls(media, data.url, 'plan-heygen__video');
      return;
    }
    const LK = root.LivekitClient;
    if (!LK) throw new Error('LiveKit client missing on page.');
    const faceRoom = new LK.Room({ adaptiveStream: true, dynacast: true });
    faceRoom.on(LK.RoomEvent.TrackSubscribed, (track) => {
      media.hidden = false;
      wrap?.classList.add('plan-heygen--live');
      const el = track.attach();
      el.className = 'plan-heygen__video';
      media.replaceChildren(el);
    });
    await faceRoom.connect(data.url, data.accessToken);
    heygenRoom = faceRoom;
  }

  async function stopHeygen() {
    if (heygenSessionId && heygenSessionId !== 'poster') {
      await fetch('/api/heygen/streaming/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: heygenSessionId }),
      }).catch(() => {});
    }
    clearMedia();
    heygenSessionId = null;
    const btn = document.getElementById('planHeygenToggle');
    if (btn) btn.textContent = 'Show Alienigena · alien presenter';
    setStatus('');
  }

  function setStatus(msg) {
    const el = document.getElementById('planHeygenStatus');
    if (el) el.textContent = msg || '';
  }

  function facePayload(face, extra) {
    const body = extra && typeof extra === 'object' ? { ...extra } : {};
    const lookId = face?.portraitAvatarId || face?.avatarId;
    if (lookId) body.avatarId = lookId;
    if (face?.voiceId) body.voiceId = face.voiceId;
    return body;
  }

  async function startHeygen() {
    const face = studioFace || (await loadStudioFace());
    const faceName = String(face?.name || 'Alienigena').trim() || 'Alienigena';
    const greeting =
      String(face?.greeting || '').trim() ||
      'Signal acquired. Carl and I are watching the sky with you.';
    const res = await fetch('/api/heygen/streaming/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facePayload(face, { text: greeting })),
    });
    const data = await res.json();
    if (data?.url && (data.fallback || data.playback === 'poster' || root.HeygenLiveTile?.isPoster?.(data))) {
      await attachSession(data);
      const btn = document.getElementById('planHeygenToggle');
      if (btn) btn.textContent = 'Hide Alienigena';
      setStatus(`${faceName} on voice — live lip-sync is not on this HeyGen plan.`);
      if (!data.audioUrl) await speakTts(greeting);
      return;
    }
    if (!res.ok || !data.url) {
      const media = mediaHost();
      const wrap = document.getElementById('planHeygenWrap');
      if (media) {
        media.hidden = false;
        wrap?.classList.add('plan-heygen--live');
        media.innerHTML =
          '<div class="plan-heygen__standin" role="img" aria-label="Alienigena">' +
          '<img src="/planetarium/assets/alienigena-portrait.webp" alt="Alienigena" width="160" height="160"/>' +
          '<small>alien presenter</small></div>';
        heygenRoom = { kind: 'poster' };
        heygenSessionId = 'poster';
        const btn = document.getElementById('planHeygenToggle');
        if (btn) btn.textContent = 'Hide Alienigena';
        setStatus(
          friendlyError(data.error) ||
            (face?.avatarId
              ? 'HeyGen streaming unavailable — Alienigena can still talk through Carl.'
              : `${faceName} needs avatar IDs — see AVATAR-ALIENIGENA.md.`)
        );
        await speakTts(greeting);
        return;
      }
      setStatus(
        friendlyError(data.error) ||
          (face?.avatarId
            ? 'HeyGen streaming unavailable — Alienigena can still talk through Carl.'
              : `${faceName} needs avatar IDs — see AVATAR-ALIENIGENA.md.`)
      );
      return;
    }
    await attachSession(data);
    const btn = document.getElementById('planHeygenToggle');
    if (btn) btn.textContent = 'Hide Alienigena';
    setStatus(`${faceName} live — Carl speaks through this tile.`);
  }

  async function toggleHeygen() {
    if (heygenRoom || heygenSessionId) {
      await stopHeygen();
      return;
    }
    await startHeygen();
  }

  async function speak(text) {
    const clean = String(text || '').trim().slice(0, 900);
    if (!clean || !heygenSessionId) return;
    const res = await fetch('/api/heygen/streaming/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facePayload(studioFace, { sessionId: heygenSessionId, text: clean })),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.audioUrl && root.HeygenLiveTile?.playAudio) {
      root.HeygenLiveTile.playAudio(data.audioUrl);
      return;
    }
    if (data?.url) await attachSession(data);
    if (heygenSessionId === 'poster' || heygenRoom?.kind === 'poster') {
      await speakTts(clean);
    }
  }

  function isLive() {
    return Boolean(heygenSessionId);
  }

  root.PlanetariumHeygen = {
    toggle: toggleHeygen,
    speak,
    stop: stopHeygen,
    isLive,
    playIntro,
    toggleIntro,
    stopIntro,
    hasHeard,
    shouldAutoplayIntro,
  };

  if (typeof document !== 'undefined') {
    function maybeAutoplaySplash() {
      if (splashStarted || introOn) return;
      if (!document.getElementById('planHeygenWrap') && !document.getElementById('planAlienIntroToggle')) {
        releasePage();
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
      if (!document.getElementById('planHeygenWrap') && !document.getElementById('planAlienIntroToggle')) {
        return;
      }
      document.getElementById('planHeygenToggle')?.addEventListener('click', () => {
        toggleHeygen().catch((err) => setStatus(err.message || 'HeyGen failed'));
      });
      document.getElementById('planAlienIntroToggle')?.addEventListener('click', () => {
        toggleIntro().catch((err) => setStatus(err.message || 'Intro failed'));
      });
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && document.getElementById('planHeygenDemoModal')) stopIntro();
      });
      loadStudioFace();
      syncIntroToggle();
      maybeAutoplaySplash();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
