/**
 * Lebanon HyperFrames-style highlight reel — bilingual guided tour with Karim.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const REEL_URL = '/lebanon/data/lebanon-story-reel.json';
  const GAP_MS = 320;
  const TTS_TIMEOUT_MS = 20000;

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

  const i18n = () => window.LebanonI18N;
  const pick = (value) => (i18n() ? i18n().pick(value) : String(value?.en || value || ''));
  const t = (key) => (i18n() ? i18n().t(key) : '');

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

  /* ------------------------------------------------------------ narration */

  function narrationOn() {
    if (typeof i18n()?.narrationEnabled === 'function') return i18n().narrationEnabled();
    const el = document.getElementById('lbNarrate') || document.getElementById('lbStoryNarrate');
    return !el || el.checked;
  }

  function speakScene(scene, token) {
    const text = pick(scene.narration);
    if (!text) return Promise.resolve();
    const speech = i18n().speakAsGuide(text, {
      isCancelled: () => !state.running || state.paused || token !== state.playbackToken
    });
    return withTimeout(speech, TTS_TIMEOUT_MS).catch((err) => {
      console.warn('Lebanon reel narration failed', err);
      showError('Narration hiccup — the reel keeps going. Tap the page once to allow audio.');
    });
  }

  function showError(message) {
    const el = document.getElementById('lbStoryError');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }

  /* --------------------------------------------------------------- staging */

  function resolveEl(selector) {
    if (!selector) return null;
    if (selector.startsWith('#') || selector.startsWith('.')) return document.querySelector(selector);
    return document.getElementById(selector);
  }

  function clearSpotlight() {
    document.querySelectorAll('.lb-story-spotlight').forEach((el) => {
      el.classList.remove('lb-story-spotlight');
    });
  }

  function scrollToEl(el) {
    if (!el) return;
    window.LebanonSections?.expandFor(el);
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
      window.LebanonSections?.expandFor(spot);
      spot.classList.add('lb-story-spotlight');
      scrollToEl(spot);
      return;
    }
    scrollToEl(resolveEl(scene.anchor));
  }

  function setOverlay(scene) {
    const root = document.getElementById('lbStoryOverlay');
    if (!root) return;
    if (!scene) {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      return;
    }
    const kicker = document.getElementById('lbStoryKicker');
    const title = document.getElementById('lbStoryTitle');
    const copy = document.getElementById('lbStoryCopy');
    const chip = document.getElementById('lbStoryChipImg');
    if (kicker) kicker.textContent = pick(scene.kicker);
    if (title) title.textContent = pick(scene.title);
    if (copy) copy.textContent = pick(scene.copy);
    if (chip && state.config?.portrait) chip.src = state.config.portrait;
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
  }

  function runAction(action) {
    const content = window.LebanonContent;
    if (!action || !content) return;
    switch (action) {
      case 'openAtlas':
        window.LebanonSections?.expand('lbMap');
        content.closeSheet?.();
        document.getElementById('lbMap')?.scrollIntoView({
          behavior: state.reducedMotion ? 'auto' : 'smooth',
          block: 'start'
        });
        break;
      case 'openFirstEra':
        content.openFirstEra?.();
        break;
      case 'openKingdomEra': {
        const eras = content.getData?.()?.eras || [];
        const id =
          eras.find((e) => e.id === 'contemporary')?.id ||
          eras.find((e) => e.id === 'mid-20th')?.id ||
          eras[eras.length - 1]?.id;
        if (id) content.openEra?.(id);
        break;
      }
      case 'focusBeirut':
        content.closeSheet?.();
        window.LebanonSections?.expand('lbMap');
        window.LebanonMap?.focusSite('beirut', { speak: false });
        break;
      case 'focusByblos':
        window.LebanonSections?.expand('lbMap');
        window.LebanonMap?.focusSite('byblos', { speak: false });
        break;
      case 'focusBaalbek':
        window.LebanonSections?.expand('lbMap');
        window.LebanonMap?.focusSite('baalbek', { speak: false });
        break;
      case 'flipFirstFood':
        content.flipFirst?.('lbFoodGrid');
        break;
      case 'flipFirstMusic':
        content.flipFirst?.('lbMusicGrid');
        break;
      case 'flipFirstHookah':
        content.flipFirst?.('lbHookahGrid');
        break;
      case 'flipFirstLiving':
        content.flipFirst?.('lbLivingGrid');
        break;
      case 'unflipCards':
        content.unflipAll?.();
        break;
      case 'speakFirstPhrase':
        // Narration is already speaking this scene; the phrase plays after it.
        break;
      default:
        break;
    }
  }

  /* ------------------------------------------------------------ reel state */

  function renderProgress(index) {
    const total = state.scenes.length;
    const status = document.getElementById('lbStoryStatus');
    const statusText = document.getElementById('lbStoryStatusText');
    const dots = document.getElementById('lbStoryDots');
    const progress = document.getElementById('lbStoryProgress');
    if (status) status.hidden = false;
    if (statusText) statusText.textContent = `${index + 1} / ${total}`;
    if (progress) progress.textContent = `${index + 1} / ${total}`;
    if (dots) {
      dots.innerHTML = state.scenes
        .map((_, i) => {
          const cls = i === index ? ' is-active' : i < index ? ' is-done' : '';
          return `<span class="lb-story-dot${cls}"></span>`;
        })
        .join('');
    }
  }

  function setUiRunning(running) {
    document.body.classList.toggle('lb-story-running', running);
    const play = document.getElementById('lbStoryPlay');
    if (play) {
      play.setAttribute('aria-pressed', running ? 'true' : 'false');
      play.innerHTML = running
        ? `<i class="bi bi-pause-fill"></i> ${t('pauseReel')}`
        : `<i class="bi bi-film"></i> ${t('startTour') || t('playReel')}`;
    }
    if (!running) {
      const status = document.getElementById('lbStoryStatus');
      const progress = document.getElementById('lbStoryProgress');
      if (status) status.hidden = true;
      if (progress) progress.textContent = '';
    }
  }

  function setPlayEnabled(enabled) {
    const btn = document.getElementById('lbStoryPlay');
    if (btn) btn.disabled = !enabled;
  }

  function stopReel() {
    state.running = false;
    state.paused = false;
    state.playbackToken += 1;
    i18n()?.stop();
    clearSpotlight();
    setOverlay(null);
    setUiRunning(false);
  }

  async function playScene(scene, token, index) {
    if (!scene || !state.running || token !== state.playbackToken) return;
    renderProgress(index);
    applySpotlight(scene);
    setOverlay(scene);
    runAction(scene.action);

    const started = Date.now();
    const minMs = state.reducedMotion
      ? Math.min(Number(scene.durationMs) || 6000, 2400)
      : Number(scene.durationMs) || 6000;

    if (narrationOn()) await speakScene(scene, token);

    if (scene.action === 'speakFirstPhrase' && state.running && token === state.playbackToken) {
      window.LebanonContent?.speakFirstPhrase?.();
    }

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
      showError('The reel could not load its scenes. Refresh the page to try again.');
      return;
    }

    state.running = true;
    state.paused = false;
    const token = ++state.playbackToken;
    setUiRunning(true);
    i18n()?.unlockAudio();

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
    const play = document.getElementById('lbStoryPlay');
    if (state.running && !state.paused) {
      state.paused = true;
      i18n()?.stop();
      if (play) play.innerHTML = `<i class="bi bi-play-fill"></i> ${t('resumeReel')}`;
      return;
    }
    if (state.running && state.paused) {
      state.paused = false;
      if (play) play.innerHTML = `<i class="bi bi-pause-fill"></i> ${t('pauseReel')}`;
      return;
    }
    runReel(0);
  }

  /* ------------------------------------------------------------------ init */

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
      console.warn('Lebanon story reel config failed', err);
      showError('The guided reel is unavailable right now — the page still works.');
    }
  }

  function bindUi() {
    document.getElementById('lbStoryPlay')?.addEventListener('click', togglePlay);
    document.getElementById('lbStopAudio')?.addEventListener('click', () => {
      if (state.running) stopReel();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.running) stopReel();
    });
    i18n()?.onChange(() => {
      if (state.running) stopReel();
      setUiRunning(false);
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

    window.LebanonStoryReel = {
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
