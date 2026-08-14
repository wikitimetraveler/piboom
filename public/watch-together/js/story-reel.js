/**
 * Watch together — 60s director cut (HyperFrames-style).
 * Development work by David Lane
 */
(function () {
  'use strict';

  const REEL_URL = '/watch-together/data/watch-together-story-reel.json';
  const GAP_MS = 280;
  const TTS_TIMEOUT_MS = 18000;

  const state = {
    ready: false,
    running: false,
    paused: false,
    playbackToken: 0,
    scenes: [],
    config: null,
    reducedMotion: false,
    pendingPlay: false,
  };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(resolve, ms);
    });
    return Promise.race([promise, timeout]).then((result) => {
      clearTimeout(timer);
      return result;
    });
  }

  async function waitWhilePaused(token) {
    while (state.paused && state.running && token === state.playbackToken) {
      await sleep(120);
    }
  }

  function narrationOn() {
    const el = document.getElementById('wtStoryNarrate');
    return !el || el.checked;
  }

  function unlockTts() {
    try {
      window.ensureAudioUnlock?.();
      window.primeSpeechSynthesis?.();
    } catch {
      /* ignore */
    }
  }

  function speakScene(scene, token) {
    if (!narrationOn()) return Promise.resolve();
    const text = String(scene.narration || '').trim();
    if (!text) return Promise.resolve();
    unlockTts();
    const cancelled = () => !state.running || state.paused || token !== state.playbackToken;
    const voice = state.config?.voice || 'en-US-Neural2-D';
    const run = async () => {
      if (typeof window.speakWithGoogle === 'function') {
        try {
          await window.speakWithGoogle(text, voice, {
            pitch: state.config?.pitch,
            speakingRate: state.config?.speakingRate,
            isCancelled: cancelled,
          });
          return;
        } catch {
          /* fall through */
        }
      }
      if (typeof window.speakNarrationAwaitEnd === 'function') {
        await window.speakNarrationAwaitEnd(text, { isCancelled: cancelled });
      }
    };
    return withTimeout(run(), TTS_TIMEOUT_MS).catch(() => {});
  }

  function resolveEl(selector) {
    if (!selector) return null;
    if (selector.startsWith('#') || selector.startsWith('.')) return document.querySelector(selector);
    return document.getElementById(selector);
  }

  function clearSpotlight() {
    document.querySelectorAll('.wt-spotlight').forEach((el) => el.classList.remove('wt-spotlight'));
  }

  function applySpotlight(scene) {
    clearSpotlight();
    const spot = resolveEl(scene.spotlight) || resolveEl(scene.anchor);
    if (!spot) return;
    spot.classList.add('wt-spotlight');
    try {
      spot.scrollIntoView({
        behavior: state.reducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    } catch {
      spot.scrollIntoView(true);
    }
  }

  function setOverlay(scene) {
    const root = document.getElementById('wtStoryOverlay');
    if (!root) return;
    if (!scene) {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      return;
    }
    const kicker = document.getElementById('wtStoryKicker');
    const title = document.getElementById('wtStoryTitle');
    const copy = document.getElementById('wtStoryCopy');
    const progress = document.getElementById('wtStoryProgress');
    if (kicker) kicker.textContent = scene.kicker || '';
    if (title) title.textContent = scene.title || '';
    if (copy) copy.textContent = scene.copy || '';
    if (progress) {
      const i = state.scenes.findIndex((s) => s.id === scene.id);
      progress.textContent = i >= 0 ? `${i + 1} / ${state.scenes.length}` : '';
    }
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
  }

  function setUiRunning(running) {
    document.body.classList.toggle('wt-reel-running', running);
    const play = document.getElementById('wtStoryPlay');
    if (!play) return;
    play.setAttribute('aria-pressed', running ? 'true' : 'false');
    play.textContent = running ? 'Pause the cut' : 'Play the 60s cut';
  }

  function stopReel() {
    state.running = false;
    state.paused = false;
    state.playbackToken += 1;
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    clearSpotlight();
    setOverlay(null);
    setUiRunning(false);
  }

  async function playScene(scene, token) {
    if (!scene || !state.running || token !== state.playbackToken) return;
    applySpotlight(scene);
    setOverlay(scene);
    const started = Date.now();
    const minMs = state.reducedMotion
      ? Math.min(Number(scene.durationMs) || 6000, 2200)
      : Number(scene.durationMs) || 6000;
    await speakScene(scene, token);
    while (Date.now() - started < minMs) {
      if (!state.running || token !== state.playbackToken) break;
      await waitWhilePaused(token);
      if (!state.running || token !== state.playbackToken) break;
      await sleep(100);
    }
  }

  async function runReel(fromIndex) {
    if (!state.scenes.length) return;
    state.running = true;
    state.paused = false;
    const token = ++state.playbackToken;
    setUiRunning(true);
    unlockTts();
    for (let i = fromIndex; i < state.scenes.length; i += 1) {
      if (!state.running || token !== state.playbackToken) break;
      await waitWhilePaused(token);
      if (!state.running || token !== state.playbackToken) break;
      await playScene(state.scenes[i], token);
      if (!state.running || token !== state.playbackToken) break;
      await sleep(GAP_MS);
    }
    if (token === state.playbackToken) stopReel();
  }

  function togglePlay() {
    if (!state.ready) {
      state.pendingPlay = true;
      return;
    }
    const play = document.getElementById('wtStoryPlay');
    if (state.running && !state.paused) {
      state.paused = true;
      if (typeof window.stopSpeech === 'function') window.stopSpeech();
      if (play) play.textContent = 'Resume the cut';
      return;
    }
    if (state.running && state.paused) {
      state.paused = false;
      if (play) play.textContent = 'Pause the cut';
      return;
    }
    runReel(0);
  }

  function dismissIntro() {
    const intro = document.getElementById('wtIntro');
    if (!intro) return;
    intro.classList.add('is-gone');
    intro.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => intro.remove(), 420);
  }

  async function init() {
    state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('wtStoryPlay')?.addEventListener('click', togglePlay);
    document.getElementById('wtIntroSkip')?.addEventListener('click', dismissIntro);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.running) stopReel();
    });

    try {
      const res = await fetch(REEL_URL, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data.scenes)) {
        state.config = data;
        state.scenes = data.scenes;
      }
    } catch {
      /* landing still works */
    }

    state.ready = true;
    const wantsReel = new URLSearchParams(window.location.search).get('reel') === '1';
    if (wantsReel) dismissIntro();
    else if (!state.reducedMotion) {
      window.setTimeout(dismissIntro, 4200);
    } else {
      dismissIntro();
    }

    if (state.pendingPlay || wantsReel) {
      state.pendingPlay = false;
      if (state.scenes.length) runReel(0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
