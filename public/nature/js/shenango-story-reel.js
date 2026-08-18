/**
 * Shenango Valley HyperFrames highlight reel — museum / memorial-wall tone.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const REEL_URL = '/nature/data/shenango-story-reel.json';
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

  function t(key) {
    return window.ShenangoContent?.t?.(key) || '';
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
    const el = document.getElementById('svStoryNarrate');
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
      await window.ShenangoContent?.speak?.(text);
    };

    return withTimeout(run(), TTS_TIMEOUT_MS).catch((err) => {
      console.warn('Shenango reel narration failed', err);
      showError('Narration hiccup — the reel continues. Tap once to allow audio.');
    });
  }

  function showError(message) {
    const el = document.getElementById('svStoryError');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }

  function resolveEl(selector) {
    if (!selector) return null;
    if (selector.startsWith('#') || selector.startsWith('.')) return document.querySelector(selector);
    return document.getElementById(selector);
  }

  function clearSpotlight() {
    document.querySelectorAll('.sv-story-spotlight').forEach((el) => {
      el.classList.remove('sv-story-spotlight');
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
      spot.classList.add('sv-story-spotlight');
      scrollToEl(spot);
      return;
    }
    scrollToEl(resolveEl(scene.anchor));
  }

  function setOverlay(scene) {
    const root = document.getElementById('svStoryOverlay');
    if (!root) return;
    if (!scene) {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      return;
    }
    const kicker = document.getElementById('svStoryKicker');
    const title = document.getElementById('svStoryTitle');
    const copy = document.getElementById('svStoryCopy');
    const chip = document.getElementById('svStoryChipImg');
    if (kicker) kicker.textContent = pick(scene.kicker);
    if (title) title.textContent = pick(scene.title);
    if (copy) copy.textContent = pick(scene.copy);
    if (chip && state.config?.portrait) chip.src = state.config.portrait;
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
  }

  function runAction(action) {
    const content = window.ShenangoContent;
    if (!action || !content) return;
    switch (action) {
      case 'openAtlas':
        content.closeSheet?.();
        document.getElementById('svMap')?.scrollIntoView({
          behavior: state.reducedMotion ? 'auto' : 'smooth',
          block: 'start'
        });
        break;
      case 'flipFirstSteel':
        content.flipFirst?.('svSteelGrid');
        break;
      case 'flipFirstAmish':
        content.flipFirst?.('svAmishGrid');
        break;
      case 'flipFirstMusic':
        content.flipFirst?.('svMusicGrid');
        break;
      case 'openMob':
        content.unflipAll?.();
        document.getElementById('svMob')?.scrollIntoView({
          behavior: state.reducedMotion ? 'auto' : 'smooth',
          block: 'start'
        });
        window.ShenangoMap?.setFilter?.('mob');
        content.flipFirst?.('svMobGrid');
        break;
      case 'openEvents':
        content.unflipAll?.();
        document.getElementById('svEvents')?.scrollIntoView({
          behavior: state.reducedMotion ? 'auto' : 'smooth',
          block: 'start'
        });
        break;
      case 'unflipCards':
        content.unflipAll?.();
        break;
      default:
        break;
    }
  }

  function renderProgress(index) {
    const total = state.scenes.length;
    const status = document.getElementById('svStoryStatus');
    const statusText = document.getElementById('svStoryStatusText');
    const dots = document.getElementById('svStoryDots');
    const progress = document.getElementById('svStoryProgress');
    if (status) status.hidden = false;
    if (statusText) statusText.textContent = `${index + 1} / ${total}`;
    if (progress) progress.textContent = `${index + 1} / ${total}`;
    if (dots) {
      dots.innerHTML = state.scenes
        .map((_, i) => {
          const cls = i === index ? ' is-active' : i < index ? ' is-done' : '';
          return `<span class="sv-story-dot${cls}"></span>`;
        })
        .join('');
    }
  }

  function setUiRunning(running) {
    document.body.classList.toggle('sv-story-running', running);
    const play = document.getElementById('svStoryPlay');
    if (play) {
      play.setAttribute('aria-pressed', running ? 'true' : 'false');
      const label = running
        ? t('pauseReel') || 'Pause reel'
        : t('playReel') || 'Play highlight reel';
      play.innerHTML = running
        ? `<i class="bi bi-pause-fill"></i> ${label}`
        : `<i class="bi bi-film"></i> ${label}`;
    }
    if (!running) {
      const status = document.getElementById('svStoryStatus');
      const progress = document.getElementById('svStoryProgress');
      if (status) status.hidden = true;
      if (progress) progress.textContent = '';
    }
  }

  function setPlayEnabled(enabled) {
    const btn = document.getElementById('svStoryPlay');
    if (btn) btn.disabled = !enabled;
  }

  function stopReel() {
    state.running = false;
    state.paused = false;
    state.playbackToken += 1;
    window.ShenangoContent?.stopSpeech?.();
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    clearSpotlight();
    setOverlay(null);
    setUiRunning(false);
  }

  async function playScene(scene, token, index) {
    if (!scene || !state.running || token !== state.playbackToken) return;
    renderProgress(index);
    applySpotlight(scene);
    setOverlay(scene);
    document.getElementById('svStoryChip')?.classList.remove('is-beat');
    void document.getElementById('svStoryChip')?.offsetWidth;
    document.getElementById('svStoryChip')?.classList.add('is-beat');
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
      await sleep(100);
    }
  }

  async function runReel(fromIndex = 0) {
    showError('');
    if (!state.scenes.length) {
      showError('The reel could not load its scenes. Refresh to try again.');
      return;
    }

    state.running = true;
    state.paused = false;
    const token = ++state.playbackToken;
    setUiRunning(true);
    unlockTts();

    for (let i = fromIndex; i < state.scenes.length; i += 1) {
      if (!state.running || token !== state.playbackToken) break;
      await waitWhilePaused(token);
      if (!state.running || token !== state.playbackToken) break;
      state.index = i;
      await playScene(state.scenes[i], token, i);
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
    const play = document.getElementById('svStoryPlay');
    if (state.running && !state.paused) {
      state.paused = true;
      window.ShenangoContent?.stopSpeech?.();
      if (typeof window.stopSpeech === 'function') window.stopSpeech();
      if (play) play.innerHTML = `<i class="bi bi-play-fill"></i> ${t('resumeReel') || 'Resume reel'}`;
      return;
    }
    if (state.running && state.paused) {
      state.paused = false;
      if (play) play.innerHTML = `<i class="bi bi-pause-fill"></i> ${t('pauseReel') || 'Pause reel'}`;
      return;
    }
    runReel(0);
  }

  async function loadConfig() {
    try {
      const res = await fetch(REEL_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.scenes) && data.scenes.length) {
        state.config = data;
        state.scenes = data.scenes;
        return;
      }
      throw new Error('No scenes in reel config');
    } catch (err) {
      console.warn('Shenango story reel config failed', err);
      showError('The guided reel is unavailable right now — the gallery still works.');
    }
  }

  function bindUi() {
    document.getElementById('svStoryPlay')?.addEventListener('click', togglePlay);
    document.getElementById('svStopAudio')?.addEventListener('click', () => {
      if (state.running) stopReel();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.running) stopReel();
    });
  }

  async function init() {
    state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPlayEnabled(false);
    bindUi();
    await loadConfig();
    state.ready = true;
    setPlayEnabled(Boolean(state.scenes.length));
    setUiRunning(false);

    window.ShenangoStoryReel = {
      play: () => runReel(0),
      stop: stopReel,
      toggle: togglePlay,
      isRunning: () => state.running
    };

    if (state.pendingPlay) {
      state.pendingPlay = false;
      runReel(0);
      return;
    }

    if (new URLSearchParams(window.location.search).get('reel') === '1' && state.scenes.length) {
      runReel(0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
