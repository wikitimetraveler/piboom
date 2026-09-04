/**
 * Sage HeyGen — welcome popup + optional streaming face
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const DEMO_RE = /[?&](?:demo=heygen|short=1)(?:&|$)/;
  const DEMO_URL = '/data/mountain-high-heygen-demo.json';
  const FACE_URL = '/data/mountain-high-heygen-face.json';
  let cachedDemo = null;
  let face = null;
  let heygenRoom = null;
  let heygenSessionId = null;

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
    document.getElementById('mhmHeygenDemoModal')?.remove();
  }

  function showModal(demo, videoUrl) {
    closeModal();
    const script = demo?.heygenScriptShort || '';
    const bodyInner = videoUrl
      ? `<video class="mhm-heygen-demo-video" controls playsinline autoplay src="${esc(videoUrl)}"></video>`
      : `<div>
          <p><strong>Sage’s HeyGen clip isn’t cached yet.</strong> Streaming face still works if the key is set. TTS reads the script now.</p>
          ${script ? `<p>${esc(script)}</p>` : ''}
        </div>`;
    const rootEl = document.createElement('div');
    rootEl.id = 'mhmHeygenDemoModal';
    rootEl.className = 'mhm-heygen-demo-modal';
    rootEl.setAttribute('role', 'dialog');
    rootEl.setAttribute('aria-modal', 'true');
    rootEl.innerHTML = `
      <div class="mhm-heygen-demo-backdrop"></div>
      <div class="mhm-heygen-demo-panel">
        <header class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h5 mb-0">${esc(demo?.title || 'Meet Sage')}</h2>
          <button type="button" class="btn-close btn-close-white" data-mhm-heygen-close aria-label="Close"></button>
        </header>
        ${bodyInner}
        <p class="small mt-2 mb-0">${esc(demo?.brand?.attribution || 'HeyGen')} · ${esc(demo?.brand?.developmentBy || 'David E Lane')}</p>
      </div>`;
    document.body.appendChild(rootEl);
    rootEl.querySelector('[data-mhm-heygen-close]')?.addEventListener('click', closeModal);
    rootEl.querySelector('.mhm-heygen-demo-backdrop')?.addEventListener('click', closeModal);
    if (!videoUrl && script && typeof root.MhmSpeakSage === 'function') {
      root.MhmSpeakSage(script);
    }
  }

  async function playIntro() {
    const demo = await loadDemo();
    const videoUrl = demo?.heygenVideoLocalShort || demo?.heygenVideoUrlShort || null;
    showModal(demo, videoUrl);
    return Boolean(videoUrl);
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
      root.HeygenLiveTile.attachPoster(media, data.url, 'mhm-heygen__video', 'Sage');
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
    if (btn) btn.textContent = 'Live Sage';
    setStatus('');
  }

  async function startStream() {
    const greeting = face?.greeting || 'Hey — Sage here. Flip a type or ask about a lockout.';
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
    if (btn) btn.textContent = 'Hide Sage';
    setStatus(
      data.fallback || data.playback === 'poster'
        ? 'Sage on voice — live stream is not on this HeyGen plan.'
        : 'Sage live on HeyGen.'
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

  root.MhmHeygen = { playIntro, toggleStream, speak, stop: stopStream };

  function boot() {
    loadFace();
    document.getElementById('mhmMeetSage')?.addEventListener('click', () => playIntro());
    document.getElementById('mhmHeygenLive')?.addEventListener('click', () =>
      toggleStream().catch((err) => setStatus(err.message || 'HeyGen failed'))
    );
    if (DEMO_RE.test(location.search) && document.body.dataset.age === 'ok') {
      playIntro();
    }
    root.addEventListener('mhm-age-ok', () => {
      if (DEMO_RE.test(location.search)) playIntro();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
