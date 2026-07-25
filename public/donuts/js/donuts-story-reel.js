/**
 * Glazed HyperFrames-style highlight reel — Pip guide + existing avatar assets
 * Development work by David Lane
 */
(function () {
  'use strict';

  const REEL_URL = '/data/donuts-story-reel.json';
  const STORAGE_NA = 'glazedStoryNarrate';
  const GAP_MS = 320;
  const DEFAULT_VOICE = 'en-US-Neural2-H';
  const DEFAULT_OPTS = { pitch: 1.6, speakingRate: 1.06, preferFemale: true, gender: 'female' };

  const state = {
    running: false,
    paused: false,
    playbackToken: 0,
    scenes: [],
    index: 0,
    config: null,
    reducedMotion: false
  };

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitWhilePaused(token) {
    while (state.paused && state.running && token === state.playbackToken) {
      await sleep(120);
    }
  }

  function narrationOn() {
    const el = document.getElementById('gzStoryNarrate');
    return !el || el.checked;
  }

  function loadNarratePref() {
    const el = document.getElementById('gzStoryNarrate');
    if (!el) return;
    try {
      const v = localStorage.getItem(STORAGE_NA);
      if (v === '0') el.checked = false;
      else if (v === '1') el.checked = true;
      else el.checked = true;
    } catch (_) {
      el.checked = true;
    }
  }

  function persistNarratePref() {
    const el = document.getElementById('gzStoryNarrate');
    if (!el) return;
    try {
      localStorage.setItem(STORAGE_NA, el.checked ? '1' : '0');
    } catch (_) {}
  }

  function stopAudio() {
    if (typeof window.gzStopPipSpeak === 'function') window.gzStopPipSpeak();
    else if (typeof window.stopSpeech === 'function') window.stopSpeech();
    else if (typeof window.stopSpeaking === 'function') window.stopSpeaking();
  }

  function speakText(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return Promise.resolve();
    const voice = state.config?.voice || DEFAULT_VOICE;
    const opts = {
      pitch: state.config?.pitch ?? DEFAULT_OPTS.pitch,
      speakingRate: state.config?.speakingRate ?? DEFAULT_OPTS.speakingRate,
      preferFemale: true,
      gender: 'female',
      isCancelled: () => !state.running || state.paused
    };
    if (typeof window.speakNarrationAwaitEnd === 'function') {
      return window.speakNarrationAwaitEnd(clean, { ...opts, voice });
    }
    if (typeof window.gzSpeakPip === 'function') {
      window.gzSpeakPip(clean);
      return sleep(Math.min(12000, 900 + clean.length * 55));
    }
    if (typeof window.speakWithGoogle === 'function') {
      window.speakWithGoogle(clean, voice, opts);
      return sleep(Math.min(12000, 900 + clean.length * 55));
    }
    return Promise.resolve();
  }

  function clearSpotlight() {
    document.querySelectorAll('.gz-story-spotlight').forEach((el) => {
      el.classList.remove('gz-story-spotlight');
    });
  }

  function resolveEl(selectorOrId) {
    if (!selectorOrId) return null;
    if (selectorOrId.startsWith('#') || selectorOrId.startsWith('.')) {
      return document.querySelector(selectorOrId);
    }
    return document.getElementById(selectorOrId);
  }

  function scrollToEl(el) {
    if (!el) return;
    try {
      el.scrollIntoView({
        behavior: state.reducedMotion ? 'auto' : 'smooth',
        block: 'center'
      });
    } catch (_) {
      el.scrollIntoView(true);
    }
  }

  function setOverlay(scene) {
    const root = document.getElementById('gzStoryOverlay');
    const kicker = document.getElementById('gzStoryKicker');
    const title = document.getElementById('gzStoryTitle');
    const copy = document.getElementById('gzStoryCopy');
    const chip = document.getElementById('gzStoryChipImg');
    if (!root) return;
    if (!scene) {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      return;
    }
    if (kicker) kicker.textContent = scene.kicker || '';
    if (title) title.textContent = scene.title || '';
    if (copy) copy.textContent = scene.copy || '';
    if (chip && state.config?.portrait) chip.src = state.config.portrait;
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
  }

  function applySpotlight(scene) {
    clearSpotlight();
    const spot = resolveEl(scene.spotlight) || resolveEl(scene.anchor);
    if (spot) {
      spot.classList.add('gz-story-spotlight');
      scrollToEl(spot);
    } else {
      scrollToEl(resolveEl(scene.anchor));
    }
  }

  function runAction(action) {
    if (!action) return;
    if (action === 'explodeHero') {
      document.getElementById('gzHeroDonut')?.click();
      return;
    }
    if (action === 'flipFirstDonut') {
      const card = document.querySelector('#gzGrid .gz-card');
      if (card && !card.classList.contains('is-flipped')) card.click();
      return;
    }
    if (action === 'unflipCards') {
      document.querySelectorAll('.gz-card.is-flipped').forEach((c) => {
        c.classList.remove('is-flipped');
        c.setAttribute('aria-pressed', 'false');
      });
    }
  }

  function setUiRunning(running) {
    document.body.classList.toggle('gz-story-running', running);
    const play = document.getElementById('gzStoryPlay');
    const stop = document.getElementById('gzStoryStop');
    if (play) {
      play.setAttribute('aria-pressed', running ? 'true' : 'false');
      play.innerHTML = running
        ? '<i class="bi bi-pause-fill"></i> Pause reel'
        : '<i class="bi bi-film"></i> Play highlight reel';
    }
    if (stop) stop.hidden = !running;
  }

  function stopReel() {
    state.running = false;
    state.paused = false;
    state.playbackToken += 1;
    stopAudio();
    clearSpotlight();
    setOverlay(null);
    setUiRunning(false);
  }

  async function playScene(scene, token) {
    if (!scene || !state.running || token !== state.playbackToken) return;
    applySpotlight(scene);
    setOverlay(scene);
    runAction(scene.action);
    document.getElementById('gzGuide')?.classList.toggle('is-speaking', narrationOn());

    const started = Date.now();
    const minMs = state.reducedMotion
      ? Math.min(Number(scene.durationMs) || 4800, 2200)
      : Number(scene.durationMs) || 4800;

    if (narrationOn() && scene.narration) {
      await speakText(scene.narration);
    }

    while (Date.now() - started < minMs) {
      if (!state.running || token !== state.playbackToken) break;
      await waitWhilePaused(token);
      if (!state.running || token !== state.playbackToken) break;
      await sleep(100);
    }

    document.getElementById('gzGuide')?.classList.remove('is-speaking');
  }

  async function runReel(fromIndex = 0) {
    if (!state.scenes.length) return;
    state.running = true;
    state.paused = false;
    const token = ++state.playbackToken;
    setUiRunning(true);
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();

    for (let i = fromIndex; i < state.scenes.length; i += 1) {
      if (!state.running || token !== state.playbackToken) break;
      await waitWhilePaused(token);
      if (!state.running || token !== state.playbackToken) break;
      state.index = i;
      await playScene(state.scenes[i], token);
      if (!state.running || token !== state.playbackToken) break;
      await sleep(GAP_MS);
    }

    if (token === state.playbackToken) stopReel();
  }

  function togglePlay() {
    if (state.running && !state.paused) {
      state.paused = true;
      stopAudio();
      const play = document.getElementById('gzStoryPlay');
      if (play) play.innerHTML = '<i class="bi bi-play-fill"></i> Resume reel';
      return;
    }
    if (state.running && state.paused) {
      state.paused = false;
      const play = document.getElementById('gzStoryPlay');
      if (play) play.innerHTML = '<i class="bi bi-pause-fill"></i> Pause reel';
      return;
    }
    runReel(0);
  }

  async function waitForCase(timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (document.querySelector('#gzGrid .gz-card')) return true;
      await sleep(120);
    }
    return Boolean(document.querySelector('#gzGrid .gz-card'));
  }

  async function loadConfig() {
    try {
      const res = await fetch(REEL_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.config = await res.json();
      state.scenes = Array.isArray(state.config.scenes) ? state.config.scenes : [];
    } catch (err) {
      console.warn('Glazed story reel failed to load', err);
      state.config = { portrait: '/donuts/assets/pip-baker-portrait.png' };
      state.scenes = [];
    }
  }

  function bindUi() {
    document.getElementById('gzStoryPlay')?.addEventListener('click', togglePlay);
    document.getElementById('gzStoryPlayHero')?.addEventListener('click', () => {
      if (!state.running) {
        document.getElementById('gzGuide')?.scrollIntoView({
          behavior: state.reducedMotion ? 'auto' : 'smooth',
          block: 'center'
        });
      }
      togglePlay();
    });
    document.getElementById('gzStoryStop')?.addEventListener('click', stopReel);
    document.getElementById('gzStoryNarrate')?.addEventListener('change', persistNarratePref);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.running) stopReel();
    });
  }

  async function init() {
    state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    loadNarratePref();
    bindUi();
    await loadConfig();

    const panel = document.getElementById('gzStoryPanel');
    if (panel) panel.hidden = !state.scenes.length;

    window.GlazedStoryReel = {
      play: () => runReel(0),
      stop: stopReel,
      toggle: togglePlay,
      isRunning: () => state.running
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('reel') === '1' && state.scenes.length) {
      await waitForCase();
      runReel(0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
