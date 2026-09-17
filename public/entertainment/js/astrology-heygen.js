/**
 * Rose HeyGen intro modal + speak (Google TTS + optional streaming).
 * Disaster pattern: fetch /api/astrology/demo for spokenScript, then speak.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const API_DEMO = '/api/astrology/demo';
  const STATIC_DEMO = '/data/rose-heygen-demo.json';
  const DEMO_RE = /[?&](?:demo=heygen)(?:&|$)/;
  const HEARD_KEY = 'astro_rose_heard_v1';
  const MODAL_ID = 'astroHeygenModal';
  const DEFAULT_GOOGLE_VOICE = 'en-US-Neural2-F';
  const DEFAULT_GOOGLE_VOICE_VI = 'vi-VN-Neural2-A';

  let cachedDemo = null;
  let cachedDemoLang = '';
  let speakOn = false;
  let heygenSessionId = null;
  let heygenRoom = null;
  let activeVideo = null;
  let googleVoice = DEFAULT_GOOGLE_VOICE;

  function pageLang() {
    return root.AstrologyI18N?.lang?.() === 'vi' ? 'vi' : 'en';
  }

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

  function spokenScript(demo) {
    const lang = pageLang();
    if (lang === 'vi') {
      return String(demo?.spokenScriptVi || demo?.spokenScript || demo?.heygenScriptShortVi || '').trim();
    }
    return String(demo?.spokenScriptEn || demo?.spokenScript || demo?.heygenScriptShort || demo?.script || '').trim();
  }

  async function loadDemo() {
    const lang = pageLang();
    if (cachedDemo && cachedDemoLang === lang) return cachedDemo;
    try {
      const res = await fetch(`${API_DEMO}?lang=${encodeURIComponent(lang)}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        cachedDemo = json?.data || json;
        cachedDemoLang = lang;
        googleVoice =
          json?.googleVoice ||
          cachedDemo?.googleVoice ||
          (lang === 'vi' ? DEFAULT_GOOGLE_VOICE_VI : DEFAULT_GOOGLE_VOICE);
        return cachedDemo;
      }
    } catch (_) {
      /* fall through */
    }
    try {
      const res = await fetch(STATIC_DEMO, { cache: 'no-store' });
      cachedDemo = res.ok ? await res.json() : null;
      cachedDemoLang = lang;
      if (cachedDemo && lang === 'vi') {
        cachedDemo.spokenScript = cachedDemo.heygenScriptShortVi || ROSE_FALLBACK_VI();
        cachedDemo.allowIntroVideo = false;
        googleVoice = DEFAULT_GOOGLE_VOICE_VI;
      } else {
        googleVoice = DEFAULT_GOOGLE_VOICE;
      }
    } catch (_) {
      cachedDemo = null;
    }
    return cachedDemo;
  }

  function ROSE_FALLBACK_VI() {
    return (
      root.AstrologyI18N?.t?.('greetingFallback') ||
      'Tôi là Rose. Cho tôi ngày sinh, hoặc để tôi trải bài.'
    );
  }

  async function resolveVideoUrl(demo) {
    const url = String(demo?.heygenVideoLocalShort || demo?.heygenVideoUrlShort || '').trim();
    if (!url) return null;
    if (/^https?:/i.test(url)) return url;
    try {
      const head = await fetch(url, { method: 'HEAD' });
      return head.ok ? url : null;
    } catch (_) {
      return null;
    }
  }

  function closeModal() {
    activeVideo?.pause();
    activeVideo = null;
    document.getElementById(MODAL_ID)?.remove();
  }

  function speakTts(text) {
    const clean = String(text || '').trim().slice(0, 900);
    if (!clean) return Promise.resolve();
    if (typeof root.primeSpeechSynthesis === 'function') {
      try {
        root.primeSpeechSynthesis();
      } catch (_) {
        /* ignore */
      }
    }
    if (typeof root.speakWithGoogle === 'function') {
      return root
        .speakWithGoogle(clean, googleVoice, { speakingRate: 0.94, volume: 0.9, preferFemale: true })
        .catch(() => speakBrowser(clean));
    }
    if (typeof root.speakNarrationAwaitEnd === 'function') {
      return root
        .speakNarrationAwaitEnd(clean, {
          speakingRate: 0.94,
          volume: 0.9,
          voice: googleVoice,
          preferFemale: true,
        })
        .catch(() => speakBrowser(clean));
    }
    return speakBrowser(clean);
  }

  function speakBrowser(text) {
    if (!root.speechSynthesis) return Promise.resolve();
    try {
      root.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(String(text || '').slice(0, 900));
      utter.rate = 0.92;
      utter.pitch = 0.95;
      root.speechSynthesis.speak(utter);
    } catch (_) {
      /* ignore */
    }
    return Promise.resolve();
  }

  function mediaHost() {
    return document.getElementById('astroHeygenMedia');
  }

  function clearMedia() {
    const media = mediaHost();
    const video = media?.querySelector('video');
    root.HeygenLiveTile?.destroyHls?.(video);
    root.HeygenLiveTile?.stopAudio?.();
    if (heygenRoom && typeof heygenRoom.disconnect === 'function') {
      heygenRoom.disconnect().catch(() => {});
    }
    heygenRoom = null;
    if (media) {
      media.replaceChildren();
      media.hidden = true;
    }
    document.getElementById('astroRoseDock')?.classList.remove('astro-rose-dock--live');
  }

  async function attachSession(data) {
    const media = mediaHost();
    if (!media || !data?.url) return;
    heygenSessionId = data.sessionId || (data.fallback || data.playback === 'poster' ? 'poster' : null);
    if (root.HeygenLiveTile?.isPoster?.(data) || data.playback === 'poster') {
      heygenRoom = { kind: 'poster' };
      media.hidden = false;
      document.getElementById('astroRoseDock')?.classList.add('astro-rose-dock--live');
      root.HeygenLiveTile.attachPoster(media, data.url, 'astro-heygen__video', 'Rose');
      if (data.audioUrl) root.HeygenLiveTile.playAudio?.(data.audioUrl);
      return;
    }
    if (root.HeygenLiveTile?.isHls?.(data)) {
      heygenRoom = { kind: 'hls' };
      media.hidden = false;
      document.getElementById('astroRoseDock')?.classList.add('astro-rose-dock--live');
      root.HeygenLiveTile.attachHls(media, data.url, 'astro-heygen__video');
      return;
    }
    const LK = root.LivekitClient;
    if (!LK) return;
    const faceRoom = new LK.Room({ adaptiveStream: true, dynacast: true });
    faceRoom.on(LK.RoomEvent.TrackSubscribed, (track) => {
      media.hidden = false;
      document.getElementById('astroRoseDock')?.classList.add('astro-rose-dock--live');
      const el = track.attach();
      el.className = 'astro-heygen__video';
      media.replaceChildren(el);
    });
    await faceRoom.connect(data.url, data.accessToken);
    heygenRoom = faceRoom;
  }

  function showModal(demo, videoUrl) {
    closeModal();
    const title =
      demo?.spokenTitle ||
      demo?.title ||
      root.AstrologyI18N?.t?.('meetRose') ||
      'Meet Rose';
    const script = spokenScript(demo);
    const portrait = demo?.avatar?.portrait || '/entertainment/assets/rose-guide-portrait-256.png';
    const body = videoUrl
      ? `<video id="astroHeygenVideo" controls playsinline autoplay preload="auto" src="${esc(videoUrl)}"></video>`
      : `<div class="astro-heygen-script">
          <img src="${esc(portrait)}" width="96" height="96" alt=""/>
          <p>${esc(script)}</p>
        </div>`;
    const rootEl = document.createElement('div');
    rootEl.id = MODAL_ID;
    rootEl.className = 'astro-heygen-modal';
    rootEl.setAttribute('role', 'dialog');
    rootEl.setAttribute('aria-modal', 'true');
    rootEl.setAttribute('aria-label', title);
    rootEl.innerHTML = `
      <div class="astro-heygen-backdrop" data-heygen-close></div>
      <div class="astro-heygen-panel">
        <header class="d-flex justify-content-between align-items-center gap-2 mb-2">
          <h2 class="h5 mb-0">${esc(title)}</h2>
          <button type="button" class="btn-close btn-close-white" data-heygen-close aria-label="Close"></button>
        </header>
        <div>${body}</div>
        <footer class="mt-3 d-flex flex-wrap gap-2">
          <button type="button" class="astro-ask" id="astroHeygenCta">${esc(
            demo?.ctaLabel || root.AstrologyI18N?.t?.('askReading') || 'Ask Rose for a reading'
          )}</button>
          <p class="mb-0 small" style="color:var(--as-muted)">${esc(demo?.brand?.attribution || '')} · ${esc(demo?.brand?.developmentBy || '')}</p>
        </footer>
      </div>`;
    document.body.appendChild(rootEl);
    activeVideo = rootEl.querySelector('#astroHeygenVideo');
    rootEl.querySelectorAll('[data-heygen-close]').forEach((el) => el.addEventListener('click', closeModal));
    rootEl.querySelector('#astroHeygenCta')?.addEventListener('click', () => {
      closeModal();
      document.getElementById('astroReadBtn')?.click();
    });
    document.addEventListener('keydown', function onKey(event) {
      if (event.key === 'Escape' && document.getElementById(MODAL_ID)) {
        closeModal();
        document.removeEventListener('keydown', onKey);
      }
    });
    return Boolean(videoUrl);
  }

  async function playIntro() {
    cachedDemo = null;
    cachedDemoLang = '';
    const demo = await loadDemo();
    const allowVideo = demo?.allowIntroVideo !== false && demo?.videoReady !== false;
    const videoUrl = allowVideo ? await resolveVideoUrl(demo) : null;
    showModal(demo, videoUrl);
    markHeard();
    if (!videoUrl) await speakTts(spokenScript(demo));
    return Boolean(videoUrl);
  }

  async function stopStream() {
    if (heygenSessionId && heygenSessionId !== 'poster') {
      await fetch('/api/heygen/streaming/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: heygenSessionId }),
      }).catch(() => {});
    }
    clearMedia();
    heygenSessionId = null;
  }

  async function startStream() {
    const demo = await loadDemo();
    const greeting =
      spokenScript(demo) ||
      root.AstrologyI18N?.t?.('greetingFallback') ||
      "I'm Rose. Give me a birthday, or let me deal the cards.";
    const res = await fetch('/api/heygen/streaming/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatarId: demo?.heygenAvatarId || undefined,
        voiceId: demo?.heygenVoiceId || undefined,
        text: greeting.slice(0, 400),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      await speakTts(greeting);
      return false;
    }
    try {
      await attachSession(data);
    } catch (_) {
      await speakTts(greeting);
      return false;
    }
    return true;
  }

  async function setSpeak(on) {
    speakOn = Boolean(on);
    const btn = document.getElementById('astroRoseSpeaks');
    if (btn) {
      btn.setAttribute('aria-pressed', String(speakOn));
      btn.textContent = speakOn
        ? root.AstrologyI18N?.t?.('roseSpeaking') || 'Rose speaking…'
        : root.AstrologyI18N?.t?.('roseSpeaks') || 'Rose speaks';
    }
    if (speakOn) {
      await startStream();
    } else {
      await stopStream();
      try {
        root.speechSynthesis?.cancel();
      } catch (_) {
        /* ignore */
      }
    }
  }

  /**
   * Speak parlor lines. Always uses Google TTS (disaster briefing pattern).
   * When "Rose speaks" streaming is on, also pushes text to the live avatar.
   */
  async function speak(text) {
    const clean = String(text || '').trim().slice(0, 1800);
    if (!clean) return;
    if (typeof root.isAgentSpeechMuted === 'function' && root.isAgentSpeechMuted()) return;
    const profile = root.AstrologyI18N?.voiceProfile?.();
    if (profile?.voice) googleVoice = profile.voice;
    if (speakOn && heygenSessionId && heygenSessionId !== 'poster') {
      const demo = cachedDemo;
      const res = await fetch('/api/heygen/streaming/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: heygenSessionId,
          text: clean.slice(0, 900),
          avatarId: demo?.heygenAvatarId || undefined,
          voiceId: demo?.heygenVoiceId || undefined,
        }),
      });
      if (res.ok) return;
    }
    await speakTts(clean);
  }

  function stopSpeaking() {
    if (typeof root.stopSpeech === 'function') root.stopSpeech();
    try {
      root.speechSynthesis?.cancel();
    } catch (_) {
      /* ignore */
    }
  }

  function boot() {
    document.getElementById('astroMeetRose')?.addEventListener('click', () => {
      playIntro();
    });
    document.getElementById('astroRoseSpeaks')?.addEventListener('click', () => {
      setSpeak(!speakOn);
    });
    document.getElementById('astroRoseStop')?.addEventListener('click', () => {
      stopSpeaking();
      if (speakOn) setSpeak(false);
    });
    root.AstrologyI18N?.onChange?.(() => {
      cachedDemo = null;
      cachedDemoLang = '';
      googleVoice = pageLang() === 'vi' ? DEFAULT_GOOGLE_VOICE_VI : DEFAULT_GOOGLE_VOICE;
    });
    if (DEMO_RE.test(String(location.search || ''))) playIntro();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  root.AstrologyHeygen = {
    playIntro,
    speak,
    setSpeak,
    stopSpeaking,
    loadDemo,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
