/**
 * Iran HyperFrames-style highlight reel — bilingual guided tour with Nima.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const REEL_URL = '/iran/data/iran-story-reel.json';
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

  const i18n = () => window.IranI18N;
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
    const el = document.getElementById('irNarrate') || document.getElementById('irStoryNarrate');
    return !el || el.checked;
  }

  function speakScene(scene, token) {
    const text = pick(scene.narration);
    if (!text) return Promise.resolve();
    const speech = i18n().speakAsGuide(text, {
      isCancelled: () => !state.running || state.paused || token !== state.playbackToken
    });
    return withTimeout(speech, TTS_TIMEOUT_MS).catch((err) => {
      console.warn('Iran reel narration failed', err);
      showError('Narration hiccup — the reel keeps going. Tap the page once to allow audio.');
    });
  }

  function showError(message) {
    const el = document.getElementById('irStoryError');
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
    document.querySelectorAll('.ir-story-spotlight').forEach((el) => {
      el.classList.remove('ir-story-spotlight');
    });
  }

  function scrollToEl(el) {
    if (!el) return;
    window.IranSections?.expandFor(el);
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
      window.IranSections?.expandFor(spot);
      spot.classList.add('ir-story-spotlight');
      scrollToEl(spot);
      return;
    }
    scrollToEl(resolveEl(scene.anchor));
  }

  function setOverlay(scene) {
    const root = document.getElementById('irStoryOverlay');
    if (!root) return;
    if (!scene) {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      return;
    }
    const kicker = document.getElementById('irStoryKicker');
    const title = document.getElementById('irStoryTitle');
    const copy = document.getElementById('irStoryCopy');
    const chip = document.getElementById('irStoryChipImg');
    if (kicker) kicker.textContent = pick(scene.kicker);
    if (title) title.textContent = pick(scene.title);
    if (copy) copy.textContent = pick(scene.copy);
    if (chip && state.config?.portrait) chip.src = state.config.portrait;
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
  }

  function runAction(action) {
    const content = window.IranContent;
    if (!action || !content) return;
    switch (action) {
      case 'openAtlas':
        window.IranSections?.expand('irMap');
        content.closeSheet?.();
        document.getElementById('irMap')?.scrollIntoView({
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
      case 'focusTehran':
        content.closeSheet?.();
        window.IranSections?.expand('irMap');
        window.IranMap?.focusSite('tehran', { speak: false });
        break;
      case 'focusIsfahan':
        window.IranSections?.expand('irMap');
        window.IranMap?.focusSite('isfahan', { speak: false });
        break;
      case 'focusPersepolis':
        window.IranSections?.expand('irMap');
        window.IranMap?.focusSite('persepolis', { speak: false });
        break;
      case 'flipFirstFood':
        content.flipFirst?.('irFoodGrid');
        break;
      case 'flipFirstMusic':
        content.flipFirst?.('irMusicGrid');
        break;
      case 'flipFirstHookah':
        content.flipFirst?.('irHookahGrid');
        break;
      case 'flipFirstLiving':
        content.flipFirst?.('irLivingGrid');
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
    const status = document.getElementById('irStoryStatus');
    const statusText = document.getElementById('irStoryStatusText');
    const dots = document.getElementById('irStoryDots');
    const progress = document.getElementById('irStoryProgress');
    if (status) status.hidden = false;
    if (statusText) statusText.textContent = `${index + 1} / ${total}`;
    if (progress) progress.textContent = `${index + 1} / ${total}`;
    if (dots) {
      dots.innerHTML = state.scenes
        .map((_, i) => {
          const cls = i === index ? ' is-active' : i < index ? ' is-done' : '';
          return `<span class="ir-story-dot${cls}"></span>`;
        })
        .join('');
    }
  }

  function setUiRunning(running) {
    document.body.classList.toggle('ir-story-running', running);
    const play = document.getElementById('irStoryPlay');
    if (play) {
      play.setAttribute('aria-pressed', running ? 'true' : 'false');
      play.innerHTML = running
        ? `<i class="bi bi-pause-fill"></i> ${t('pauseReel')}`
        : `<i class="bi bi-film"></i> ${t('startTour') || t('playReel')}`;
    }
    if (!running) {
      const status = document.getElementById('irStoryStatus');
      const progress = document.getElementById('irStoryProgress');
      if (status) status.hidden = true;
      if (progress) progress.textContent = '';
    }
  }

  function setPlayEnabled(enabled) {
    const btn = document.getElementById('irStoryPlay');
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
      window.IranContent?.speakFirstPhrase?.();
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
    const play = document.getElementById('irStoryPlay');
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
      console.warn('Iran story reel config failed', err);
      showError('The guided reel is unavailable right now — the page still works.');
    }
  }

  function bindUi() {
    document.getElementById('irStoryPlay')?.addEventListener('click', togglePlay);
    document.getElementById('irStopAudio')?.addEventListener('click', () => {
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

    window.IranStoryReel = {
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
