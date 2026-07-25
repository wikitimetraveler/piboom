/**
 * Glazed HyperFrames-style highlight reel — Pip guide + existing avatar assets
 * Development work by David Lane
 */
(function () {
  'use strict';

  const REEL_URLS = ['/data/donuts-story-reel.json', '/donuts/data/donuts-story-reel.json'];
  const STORAGE_NA = 'glazedStoryNarrate';
  const GAP_MS = 320;
  /** Young playful Pip — Neural2-H (not matron Standard-F); same portrait as Hear welcome. */
  const DEFAULT_VOICE = 'en-US-Neural2-H';
  const DEFAULT_OPTS = {
    pitch: 6.5,
    speakingRate: 1.12,
    preferFemale: true,
    gender: 'female',
    youngFemale: true
  };
  const TTS_TIMEOUT_MS = 9000;

  /** Embedded fallback so Play works even if /data JSON 404s in prod */
  const FALLBACK_CONFIG = {
    portrait: '/donuts/assets/pip-baker-portrait.png',
    voice: DEFAULT_VOICE,
    pitch: DEFAULT_OPTS.pitch,
    speakingRate: DEFAULT_OPTS.speakingRate,
    scenes: [
      {
        id: 'open',
        kicker: 'HyperFrame',
        title: 'Meet Glazed',
        copy: 'I’m Pip — flip a treat, hear the history, and find Savy on Harbor.',
        narration: 'Hey! I’m Pip. Welcome to Glazed — a playful tour of Savy Donuts and Smoothies on Harbor.',
        anchor: 'gzHero',
        spotlight: '.gz-hero-orb',
        action: 'explodeHero',
        durationMs: 5200
      },
      {
        id: 'pip',
        kicker: 'Your guide',
        title: 'Pip at the counter',
        copy: 'Hear my HeyGen welcome anytime — or keep touring with me.',
        narration: 'That’s me in the dock. Tap Hear welcome for my HeyGen intro, or stick with the reel.',
        anchor: 'gzGuide',
        spotlight: '#gzGuide',
        durationMs: 4800
      },
      {
        id: 'dozen',
        kicker: 'Baker’s dozen',
        title: 'Today’s case',
        copy: 'Flip any donut for history and where it began — no recipes on these cards.',
        narration: 'Here’s the baker’s dozen. Flip a card for the history and where that style began.',
        anchor: 'gzCase',
        spotlight: '#gzGrid .gz-card',
        action: 'flipFirstDonut',
        durationMs: 6200
      },
      {
        id: 'smoothies',
        kicker: 'Cold cups',
        title: 'Smoothie board',
        copy: 'Pair a donut with something icy from the Savy counter energy.',
        narration: 'And the smoothie board — cold cups ready to pair with a warm glaze.',
        anchor: 'gzSmoothies',
        spotlight: '#gzSmoothieGrid .gz-card',
        action: 'unflipCards',
        durationMs: 5000
      },
      {
        id: 'shop',
        kicker: 'Harbor',
        title: 'Find Savy',
        copy: 'Real counter on South Harbor near Kent — pin it and go.',
        narration: 'Find Savy on South Harbor near Kent — come taste the real thing.',
        anchor: 'gzShop',
        spotlight: '#gzShopMap',
        durationMs: 5200
      },
      {
        id: 'ask',
        kicker: 'Chat',
        title: 'Ask Pip',
        copy: 'Questions about pairings or the case? I’m in the dock and the chat bubble.',
        narration: 'Ask me anything about the case, smoothies, or finding Savy. See you at the counter!',
        anchor: 'gzGuide',
        spotlight: '#gzAskPip',
        durationMs: 4800
      }
    ]
  };

  const state = {
    ready: false,
    running: false,
    paused: false,
    playbackToken: 0,
    scenes: [],
    index: 0,
    config: null,
    reducedMotion: false,
    pendingPlay: false
  };

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve('__timeout__'), ms);
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
    // Always young playful Pip — never matron Standard-F / male narrator defaults.
    const voice = DEFAULT_VOICE;
    const opts = {
      voice: DEFAULT_VOICE,
      pitch: DEFAULT_OPTS.pitch,
      speakingRate: DEFAULT_OPTS.speakingRate,
      preferFemale: true,
      youngFemale: true,
      gender: 'female',
      volume: 0.9,
      isCancelled: () => !state.running || state.paused
    };

    const speakPromise = (async () => {
      try {
        if (typeof window.speakNarrationAwaitEnd === 'function') {
          await window.speakNarrationAwaitEnd(clean, opts);
          return;
        }
        if (typeof window.speakWithGoogle === 'function') {
          await window.speakWithGoogle(clean, voice, opts);
          await sleep(Math.min(8000, 800 + clean.length * 45));
          return;
        }
        if (typeof window.gzSpeakPip === 'function') {
          window.gzSpeakPip(clean);
          await sleep(Math.min(8000, 800 + clean.length * 45));
        }
      } catch (err) {
        console.warn('Glazed reel narration failed', err);
        const errEl = document.getElementById('gzStoryError');
        if (errEl) {
          errEl.hidden = false;
          errEl.textContent = 'Narration hiccup — reel keeps going (try unmute / tap the page once).';
        }
      }
    })();

    return withTimeout(speakPromise, TTS_TIMEOUT_MS).then(() => undefined);
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

  function setPlayEnabled(on) {
    ['gzStoryPlay', 'gzStoryPlayHero'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !on;
    });
  }

  function renderProgress(index) {
    const total = state.scenes.length;
    const n = index + 1;
    const status = document.getElementById('gzStoryStatus');
    const statusText = document.getElementById('gzStoryStatusText');
    const dots = document.getElementById('gzStoryDots');
    const progress = document.getElementById('gzStoryProgress');
    if (status) status.hidden = false;
    if (statusText) statusText.textContent = `Playing ${n}/${total}…`;
    if (progress) progress.textContent = `${n} / ${total}`;
    if (dots) {
      dots.innerHTML = state.scenes
        .map((_, i) => `<span class="gz-story-dot${i === index ? ' is-active' : i < index ? ' is-done' : ''}"></span>`)
        .join('');
    }
  }

  function clearProgress() {
    const status = document.getElementById('gzStoryStatus');
    const progress = document.getElementById('gzStoryProgress');
    if (status) status.hidden = true;
    if (progress) progress.textContent = '';
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
    if (!running) clearProgress();
  }

  function stopReel(opts) {
    const finished = opts && opts.finished;
    state.running = false;
    state.paused = false;
    state.playbackToken += 1;
    stopAudio();
    clearSpotlight();
    setOverlay(null);
    setUiRunning(false);
    if (finished && typeof window.GlazedCollapsePipDock === 'function') {
      window.GlazedCollapsePipDock();
    }
  }

  async function playScene(scene, token, index) {
    if (!scene || !state.running || token !== state.playbackToken) return;
    renderProgress(index);
    applySpotlight(scene);
    setOverlay(scene);
    const progress = document.getElementById('gzStoryProgress');
    if (progress) progress.textContent = `${index + 1} / ${state.scenes.length}`;
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
    const errEl = document.getElementById('gzStoryError');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    if (!state.scenes.length) {
      console.warn('Glazed story reel: no scenes loaded');
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = 'Reel couldn’t load scenes. Refresh once — local fallback should kick in.';
      }
      return;
    }
    state.running = true;
    state.paused = false;
    const token = ++state.playbackToken;
    setUiRunning(true);
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
    typeof window.GlazedExpandPipDock === 'function' && window.GlazedExpandPipDock();

    for (let i = fromIndex; i < state.scenes.length; i += 1) {
      if (!state.running || token !== state.playbackToken) break;
      await waitWhilePaused(token);
      if (!state.running || token !== state.playbackToken) break;
      state.index = i;
      await playScene(state.scenes[i], token, i);
      if (!state.running || token !== state.playbackToken) break;
      await sleep(GAP_MS);
    }

    if (token === state.playbackToken) stopReel({ finished: true });
  }

  function togglePlay() {
    if (!state.ready) {
      state.pendingPlay = true;
      return;
    }
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

  async function waitForCase(timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (document.querySelector('#gzGrid .gz-card')) return true;
      await sleep(120);
    }
    return Boolean(document.querySelector('#gzGrid .gz-card'));
  }

  async function fetchReelJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadConfig() {
    for (const url of REEL_URLS) {
      try {
        const data = await fetchReelJson(url);
        if (Array.isArray(data.scenes) && data.scenes.length) {
          state.config = {
            ...data,
            voice: data.voice || DEFAULT_VOICE,
            pitch: data.pitch ?? DEFAULT_OPTS.pitch,
            speakingRate: data.speakingRate ?? DEFAULT_OPTS.speakingRate
          };
          state.scenes = data.scenes;
          return;
        }
      } catch (err) {
        console.warn('Glazed story reel fetch failed', url, err);
      }
    }
    state.config = { ...FALLBACK_CONFIG };
    state.scenes = FALLBACK_CONFIG.scenes.slice();
    const errEl = document.getElementById('gzStoryError');
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = 'Using offline reel scenes (catalog JSON slow or missing). Tour still plays.';
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
    setPlayEnabled(false);
    bindUi();
    await loadConfig();
    state.ready = true;
    setPlayEnabled(true);

    const panel = document.getElementById('gzStoryPanel');
    if (panel) panel.hidden = !state.scenes.length;

    window.GlazedStoryReel = {
      play: () => runReel(0),
      stop: stopReel,
      toggle: togglePlay,
      isRunning: () => state.running
    };

    if (state.pendingPlay) {
      state.pendingPlay = false;
      await waitForCase();
      runReel(0);
      return;
    }

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
