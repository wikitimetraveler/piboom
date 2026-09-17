/**
 * Dinosaur Hall HyperFrames highlight reel — museum tone + Google TTS.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const REEL_URL = '/nature/data/dinosaur-story-reel.json';
  const GAP_MS = 320;
  const TTS_TIMEOUT_MS = 22000;

  const state = {
    ready: false,
    running: false,
    paused: false,
    playbackToken: 0,
    scenes: [],
    config: null,
    index: 0,
    reducedMotion: false,
    pendingPlay: false
  };

  function pick(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    return String(value.en || '');
  }

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
    const el = document.getElementById('dhStoryNarrate');
    return !el || el.checked;
  }

  function unlockTts() {
    try {
      window.ensureAudioUnlock?.();
      window.primeSpeechSynthesis?.();
    } catch (_) {
      /* ignore */
    }
  }

  function speakScene(scene, token) {
    if (!narrationOn()) return Promise.resolve();
    const text = pick(scene.narration);
    if (!text) return Promise.resolve();
    unlockTts();
    const cancelled = () => !state.running || state.paused || token !== state.playbackToken;

    const run = async () => {
      if (typeof window.speakWithGoogle === 'function') {
        try {
          await window.speakWithGoogle(text, {
            lang: 'en-US',
            gender: 'male',
            voice: state.config?.voice,
            pitch: state.config?.pitch,
            speakingRate: state.config?.speakingRate,
            isCancelled: cancelled
          });
          return;
        } catch (_) {
          /* fall through */
        }
      }
      if (typeof window.speakText === 'function') {
        await window.speakText(text);
      } else if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(u);
        await new Promise((resolve) => {
          u.onend = resolve;
          u.onerror = resolve;
        });
      }
    };

    return withTimeout(run(), TTS_TIMEOUT_MS).catch((err) => {
      console.warn('Dinosaur reel narration failed', err);
      showError('Narration hiccup — the reel continues. Tap once to allow audio.');
    });
  }

  function showError(message) {
    const el = document.getElementById('dhStoryError');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }

  function resolveEl(selector) {
    if (!selector) return null;
    if (selector.startsWith('#') || selector.startsWith('.') || selector.startsWith('[')) {
      return document.querySelector(selector);
    }
    return document.getElementById(selector);
  }

  function clearSpotlight() {
    document.querySelectorAll('.dh-story-spotlight').forEach((el) => {
      el.classList.remove('dh-story-spotlight');
    });
  }

  function scrollToEl(el) {
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: state.reducedMotion ? 'auto' : 'smooth', block: 'center' });
    } catch (_) {
      el.scrollIntoView(true);
    }
  }

  function applySpotlight(scene) {
    clearSpotlight();
    const spot = resolveEl(scene.spotlight) || resolveEl(scene.anchor);
    if (spot) {
      spot.classList.add('dh-story-spotlight');
      scrollToEl(spot);
      return;
    }
    scrollToEl(resolveEl(scene.anchor));
  }

  function setOverlay(scene) {
    const root = document.getElementById('dhStoryOverlay');
    if (!root) return;
    if (!scene) {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      return;
    }
    const kicker = document.getElementById('dhStoryKicker');
    const title = document.getElementById('dhStoryTitle');
    const copy = document.getElementById('dhStoryCopy');
    const chip = document.getElementById('dhStoryChipImg');
    if (kicker) kicker.textContent = pick(scene.kicker);
    if (title) title.textContent = pick(scene.title);
    if (copy) copy.textContent = pick(scene.copy);
    if (chip && state.config?.portrait) chip.src = state.config.portrait;
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
  }

  function runAction(action) {
    const hall = window.DinosaurHall;
    const scene = window.DinosaurHallScene;
    if (!action) return;
    switch (action) {
      case 'setEraTriassic':
        hall?.setEra?.('triassic');
        break;
      case 'setEraJurassic':
        hall?.setEra?.('jurassic');
        break;
      case 'setEraCretaceous':
        hall?.setEra?.('cretaceous');
        break;
      case 'selectPteranodon':
        hall?.setEra?.('cretaceous');
        hall?.selectSpecies?.('pteranodon', { silent: true });
        break;
      case 'openCompare':
        document.getElementById('dhCompare')?.scrollIntoView({
          behavior: state.reducedMotion ? 'auto' : 'smooth',
          block: 'start'
        });
        hall?.runCompare?.();
        break;
      case 'openQuiz':
        document.getElementById('dhQuiz')?.scrollIntoView({
          behavior: state.reducedMotion ? 'auto' : 'smooth',
          block: 'start'
        });
        break;
      default:
        break;
    }
    void scene;
  }

  function renderProgress(index) {
    const total = state.scenes.length;
    const status = document.getElementById('dhStoryStatus');
    const statusText = document.getElementById('dhStoryStatusText');
    const dots = document.getElementById('dhStoryDots');
    const progress = document.getElementById('dhStoryProgress');
    if (status) status.hidden = false;
    if (statusText) statusText.textContent = `${index + 1} / ${total}`;
    if (progress) progress.textContent = `${index + 1} / ${total}`;
    if (dots) {
      dots.innerHTML = state.scenes
        .map((_, i) => {
          const cls = i === index ? ' is-active' : i < index ? ' is-done' : '';
          return `<span class="dh-story-dot${cls}"></span>`;
        })
        .join('');
    }
  }

  function setUiRunning(running) {
    document.body.classList.toggle('dh-story-running', running);
    const play = document.getElementById('dhStoryPlay');
    if (play) {
      play.setAttribute('aria-pressed', running ? 'true' : 'false');
      play.innerHTML = running
        ? '<i class="bi bi-pause-fill"></i> Pause reel'
        : '<i class="bi bi-film"></i> Play highlight reel';
    }
    if (!running) {
      const status = document.getElementById('dhStoryStatus');
      const progress = document.getElementById('dhStoryProgress');
      if (status) status.hidden = true;
      if (progress) progress.textContent = '';
    }
  }

  function stopReel() {
    state.running = false;
    state.paused = false;
    state.playbackToken += 1;
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    try {
      window.speechSynthesis?.cancel?.();
    } catch (_) {
      /* ignore */
    }
    clearSpotlight();
    setOverlay(null);
    setUiRunning(false);
  }

  async function playScene(scene, token, index) {
    if (!scene || !state.running || token !== state.playbackToken) return;
    renderProgress(index);
    applySpotlight(scene);
    setOverlay(scene);
    document.getElementById('dhStoryChip')?.classList.remove('is-beat');
    void document.getElementById('dhStoryChip')?.offsetWidth;
    document.getElementById('dhStoryChip')?.classList.add('is-beat');
    runAction(scene.action);

    const started = Date.now();
    const minMs = state.reducedMotion
      ? Math.min(Number(scene.durationMs) || 6000, 2400)
      : Number(scene.durationMs) || 6000;

    await speakScene(scene, token);

    while (Date.now() - started < minMs) {
      if (!state.running || token !== state.playbackToken) break;
      await waitWhilePaused(token);
      if (!state.running || token !== state.playbackToken) break;
      await sleep(80);
    }
    await sleep(GAP_MS);
  }

  async function playReel() {
    if (!state.ready || !state.scenes.length) return;
    if (state.running) {
      state.paused = !state.paused;
      if (!state.paused) setUiRunning(true);
      else {
        const play = document.getElementById('dhStoryPlay');
        if (play) play.innerHTML = '<i class="bi bi-play-fill"></i> Resume reel';
      }
      return;
    }

    unlockTts();
    state.running = true;
    state.paused = false;
    state.playbackToken += 1;
    const token = state.playbackToken;
    setUiRunning(true);
    showError('');

    for (let i = 0; i < state.scenes.length; i += 1) {
      if (!state.running || token !== state.playbackToken) break;
      state.index = i;
      await playScene(state.scenes[i], token, i);
    }

    if (token === state.playbackToken) stopReel();
  }

  async function loadReel() {
    state.reducedMotion = Boolean(
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    try {
      const res = await fetch(REEL_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.config = await res.json();
      state.scenes = state.config.scenes || [];
      state.ready = state.scenes.length > 0;
    } catch (err) {
      console.warn('Dinosaur reel load failed', err);
      state.ready = false;
      showError('Highlight reel unavailable.');
    }

    const play = document.getElementById('dhStoryPlay');
    if (play) {
      play.disabled = !state.ready;
      play.addEventListener('click', () => playReel());
    }

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && state.running) {
        ev.preventDefault();
        stopReel();
      }
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get('reel') === '1') {
      const start = () => {
        if (window.DinosaurHall) playReel();
        else state.pendingPlay = true;
      };
      if (document.readyState === 'complete') setTimeout(start, 400);
      else window.addEventListener('load', () => setTimeout(start, 400));
    }
  }

  window.addEventListener('dinosaur-hall-ready', () => {
    if (state.pendingPlay) {
      state.pendingPlay = false;
      playReel();
    }
  });

  window.DinosaurHallReel = {
    play: playReel,
    stop: stopReel,
    isReady: () => state.ready
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadReel);
  } else {
    loadReel();
  }
})();
