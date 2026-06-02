/**
 * Development work by David Lane
 */
/**
 * Unit Tests — HyperFrames-style workflow story (TTS via /shared/tts.js).
 * Depends: showAccordionSection, unitTestsStoryScenes on window, speakNarrationAwaitEnd.
 */
(function () {
  const STORAGE_CH = 'unitTestsStoryChapters';
  const STORAGE_NA = 'unitTestsStoryNarrate';
  const SCENE_MS = 4800;
  const GAP_MS = 280;

  const state = {
    running: false,
    paused: false,
    finished: false,
    playbackToken: 0,
    scenes: [],
    sceneIndex: 0,
    resumeIndex: 0,
    storyOpenedVoiceDrawer: false,
  };

  let speakTok = 0;
  let listenersBound = false;
  let focusBeforeStory = null;
  /** @type {null | (() => Element|null)} */
  let storyFloatResolveAnchor = null;
  let storyFloatScrollBound = false;
  let storyFloatReflowScheduled = false;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitWhilePaused(token) {
    while (state.paused && state.running && token === state.playbackToken) {
      await sleep(120);
    }
  }

  function loadOpts() {
    const ch = document.getElementById('unitTestsStoryChapters');
    const na = document.getElementById('unitTestsStoryNarrate');
    try {
      if (ch) {
        const v = localStorage.getItem(STORAGE_CH);
        if (v === '0') ch.checked = false;
        else if (v === '1') ch.checked = true;
        else ch.checked = true;
      }
      if (na) {
        const v = localStorage.getItem(STORAGE_NA);
        if (v === '1') na.checked = true;
        else if (v === '0') na.checked = false;
        else na.checked = true;
      }
    } catch (_) {}
  }

  function persistOpts() {
    const ch = document.getElementById('unitTestsStoryChapters');
    const na = document.getElementById('unitTestsStoryNarrate');
    try {
      if (ch) localStorage.setItem(STORAGE_CH, ch.checked ? '1' : '0');
      if (na) localStorage.setItem(STORAGE_NA, na.checked ? '1' : '0');
    } catch (_) {}
  }

  function chaptersEnabled() {
    const el = document.getElementById('unitTestsStoryChapters');
    return !el || el.checked;
  }

  function narrationEnabled() {
    const el = document.getElementById('unitTestsStoryNarrate');
    return !!(el && el.checked);
  }

  function norm(s) {
    return String(s || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function liveScenarioBuilderSceneRelevant() {
    const card = document.getElementById('liveScenarioBuilderSectionCard');
    const container = document.getElementById('liveScenarioBuilderContainer');
    if (!card || !container) return false;
    if (card.classList.contains('section-card-hidden')) return false;
    if (card.style && card.style.display === 'none') return false;
    return container.style && container.style.display === 'block';
  }

  function resolveScrollEl(meta) {
    if (!meta) return null;
    if (meta.scrollAnchor === 'voiceHelpHeader') {
      return document.querySelector('#voiceHelp .voice-help-header') || document.getElementById('voiceHelp');
    }
    const ids = meta.scrollAnchors || (meta.scrollAnchor ? [meta.scrollAnchor] : []);
    if (meta.id === 'generate') {
      const loaded =
        typeof meta.hasLoadedData === 'boolean'
          ? meta.hasLoadedData
          : typeof window.unitTestsHasLoadedData === 'function' && window.unitTestsHasLoadedData();
      const list = loaded ? meta.scrollWhenLoaded : meta.scrollWhenEmpty;
      if (Array.isArray(list)) {
        for (let i = 0; i < list.length; i++) {
          const el = document.getElementById(list[i]);
          if (el) return el;
        }
      }
    }
    for (let i = 0; i < ids.length; i++) {
      const el = document.getElementById(ids[i]);
      if (el) return el;
    }
    return null;
  }

  function hydrateScene(meta) {
    const scene = Object.assign({}, meta);
    scene.scrollEl = () => resolveScrollEl(meta);
    if (meta.hasGenerateAction) {
      scene.action = async () => {
        if (typeof window.unitTestsStoryGenerateAndLoad === 'function') {
          await window.unitTestsStoryGenerateAndLoad();
        } else if (typeof window.loadOfflineDemoUnitTest === 'function') {
          await window.loadOfflineDemoUnitTest();
        }
        focusGenerateModalIfOpen();
      };
    }
    return scene;
  }

  function focusGenerateModalIfOpen() {
    const modal = document.getElementById('generateFromCustomFieldModal');
    if (!modal || !modal.classList.contains('show')) return;
    const focusable =
      document.getElementById('generateCustomFieldConfirmBtn') ||
      modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable && typeof focusable.focus === 'function') {
      try {
        focusable.focus({ preventScroll: true });
      } catch (_) {
        focusable.focus();
      }
    }
  }

  function buildScenes() {
    const builder = window.unitTestsStoryScenes?.buildUnitTestsStoryScenes;
    if (typeof builder !== 'function') return [];
    const hasLoaded =
      typeof window.unitTestsHasLoadedData === 'function' && window.unitTestsHasLoadedData();
    const metas = builder({
      chaptersEnabled: chaptersEnabled(),
      liveScenarioBuilderVisible: liveScenarioBuilderSceneRelevant(),
      hasLoadedData: hasLoaded,
    });
    return metas.map(hydrateScene);
  }

  function storyClamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function unbindStoryFloatListeners() {
    if (!storyFloatScrollBound) return;
    window.removeEventListener('scroll', onStoryFloatingReflow, true);
    window.removeEventListener('resize', onStoryFloatingReflow);
    storyFloatScrollBound = false;
  }

  function onStoryFloatingReflow() {
    if (!state.running || state.paused) return;
    const overlay = document.getElementById('unitTestsStoryOverlay');
    if (!overlay || overlay.classList.contains('d-none')) return;
    if (storyFloatReflowScheduled) return;
    storyFloatReflowScheduled = true;
    window.requestAnimationFrame(() => {
      storyFloatReflowScheduled = false;
      repositionStoryFloatingNugget();
    });
  }

  function bindStoryFloatListeners() {
    if (storyFloatScrollBound) return;
    window.addEventListener('scroll', onStoryFloatingReflow, true);
    window.addEventListener('resize', onStoryFloatingReflow);
    storyFloatScrollBound = true;
  }

  function clearFloatingOverlayStyles() {
    const overlay = document.getElementById('unitTestsStoryOverlay');
    if (!overlay) return;
    overlay.classList.remove('unit-tests-story-overlay--floating');
    overlay.style.left = '';
    overlay.style.right = '';
    overlay.style.top = '';
    overlay.style.bottom = '';
    overlay.style.transform = '';
    overlay.style.width = '';
    overlay.style.maxWidth = '';
  }

  function positionStoryFloatingNear(anchorEl) {
    const overlay = document.getElementById('unitTestsStoryOverlay');
    if (!overlay || overlay.classList.contains('d-none')) return;

    const pad = 10;
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    overlay.classList.add('unit-tests-story-overlay--floating');

    const anchor = anchorEl instanceof Element ? anchorEl : null;

    function placeFallbackCenter() {
      overlay.style.transform = 'translateX(-50%)';
      overlay.style.left = '50%';
      overlay.style.right = 'auto';
      overlay.style.bottom = 'auto';
      overlay.style.top = `${Math.round(storyClamp(Math.min(vh * 0.2, Math.max(vh * 0.12, pad + 76)), pad, vh * 0.35))}px`;
      overlay.style.width = `${Math.round(Math.min(340, vw - 2 * pad))}px`;
    }

    if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
      placeFallbackCenter();
      return;
    }

    const r = anchor.getBoundingClientRect();
    const narrow = vw <= 576;

    if (narrow) {
      overlay.style.transform = '';
      const w = Math.round(Math.min(340, vw - 18));
      let left = r.left + r.width / 2 - w / 2;
      left = storyClamp(left, pad, vw - w - pad);
      const top = r.bottom + gap;
      overlay.style.left = `${Math.round(left)}px`;
      overlay.style.right = 'auto';
      overlay.style.width = `${w}px`;
      overlay.style.bottom = 'auto';
      overlay.style.top = `${Math.round(top)}px`;

      window.requestAnimationFrame(() => {
        const ob = overlay.getBoundingClientRect();
        if (ob.bottom > vh - pad) {
          const aboveTop = storyClamp(Math.round(r.top - gap - ob.height), pad, vh - ob.height - pad);
          overlay.style.top = `${aboveTop}px`;
        }
      });
      return;
    }

    overlay.style.transform = 'translateY(-50%)';
    overlay.style.bottom = 'auto';
    overlay.style.right = 'auto';
    overlay.style.width = '';

    let leftGuess = Math.round(r.right + gap);
    const midY = r.top + r.height / 2;
    overlay.style.top = `${Math.round(midY)}px`;
    overlay.style.left = `${leftGuess}px`;

    window.requestAnimationFrame(() => {
      const ob = overlay.getBoundingClientRect();
      if (leftGuess + ob.width > vw - pad) {
        leftGuess = Math.round(r.left - gap - ob.width);
      }
      leftGuess = storyClamp(leftGuess, pad, vw - ob.width - pad);
      overlay.style.left = `${leftGuess}px`;

      const ob2 = overlay.getBoundingClientRect();
      const half = ob2.height / 2;
      const centerY = storyClamp(r.top + r.height / 2, pad + half, vh - half - pad);
      overlay.style.top = `${Math.round(centerY)}px`;
    });
  }

  function repositionStoryFloatingNugget() {
    let anchor =
      typeof storyFloatResolveAnchor === 'function' ? storyFloatResolveAnchor() : null;
    if (!anchor || !(anchor instanceof Element)) {
      anchor = document.querySelector('.unit-tests-story-spotlight');
    }
    positionStoryFloatingNear(anchor || null);
  }

  function scheduleRepositionStoryNugget() {
    const slots = [0, 48, 200, 450];
    for (let i = 0; i < slots.length; i++) {
      window.setTimeout(() => repositionStoryFloatingNugget(), slots[i]);
    }
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => repositionStoryFloatingNugget())
    );
  }

  function clearSpotlights() {
    document.querySelectorAll('.unit-tests-story-spotlight').forEach((el) => {
      el.classList.remove('unit-tests-story-spotlight');
    });
  }

  function setOverlayControls({ showStop, showFinished }) {
    document.getElementById('unitTestsStoryStopBtn')?.classList.toggle('d-none', !showStop);
    document.getElementById('unitTestsStoryFinishedActions')?.classList.toggle('d-none', !showFinished);
  }

  function updateStoryProgress(sceneIndex, sceneTotal) {
    const progressEl = document.getElementById('unitTestsStorySceneProgress');
    const bar = document.getElementById('unitTestsStoryProgressBar');
    const fill = document.getElementById('unitTestsStoryProgressFill');
    if (progressEl) {
      if (sceneTotal > 0) {
        progressEl.hidden = false;
        progressEl.textContent = `Scene ${sceneIndex + 1} of ${sceneTotal}`;
      } else {
        progressEl.hidden = true;
        progressEl.textContent = '';
      }
    }
    if (bar && fill) {
      const pct = sceneTotal > 0 ? Math.round(((sceneIndex + 1) / sceneTotal) * 100) : 0;
      bar.setAttribute('aria-valuenow', String(pct));
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-label', `Highlight reel progress, scene ${sceneIndex + 1} of ${sceneTotal}`);
      fill.style.width = `${pct}%`;
      const reduced =
        typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      fill.style.transition = reduced ? 'none' : '';
    }
  }

  function setOverlay(scene, sceneIndex, sceneTotal) {
    const overlay = document.getElementById('unitTestsStoryOverlay');
    const kEl = document.getElementById('unitTestsStorySceneKicker');
    const tEl = document.getElementById('unitTestsStorySceneTitle');
    const cEl = document.getElementById('unitTestsStorySceneCopy');
    if (!overlay || !kEl || !tEl || !cEl) return;
    if (!scene) {
      overlay.classList.add('d-none');
      clearFloatingOverlayStyles();
      updateStoryProgress(0, 0);
      kEl.textContent = '';
      tEl.textContent = '';
      cEl.textContent = '';
      setOverlayControls({ showStop: false, showFinished: false });
      state.finished = false;
      return;
    }
    overlay.classList.remove('d-none');
    updateStoryProgress(sceneIndex, sceneTotal);
    kEl.textContent = scene.kicker || '';
    tEl.textContent = scene.title || '';
    cEl.textContent = scene.copy || '';
    setOverlayControls({ showStop: state.running && !state.finished, showFinished: state.finished });
    if (!state.finished) scheduleRepositionStoryNugget();
  }

  function showFinishedOverlay() {
    state.finished = true;
    state.running = false;
    state.paused = false;
    unbindStoryFloatListeners();
    clearSpotlights();
    const overlay = document.getElementById('unitTestsStoryOverlay');
    const kEl = document.getElementById('unitTestsStorySceneKicker');
    const tEl = document.getElementById('unitTestsStorySceneTitle');
    const cEl = document.getElementById('unitTestsStorySceneCopy');
    if (!overlay || !kEl || !tEl || !cEl) return;
    overlay.classList.remove('d-none');
    clearFloatingOverlayStyles();
    overlay.classList.add('unit-tests-story-overlay--floating');
    positionStoryFloatingNear(document.getElementById('headingTestGrid') || document.getElementById('unitTestsStoryMode'));
    updateStoryProgress(state.scenes.length, state.scenes.length);
    kEl.textContent = 'Complete';
    tEl.textContent = 'Highlight reel finished';
    cEl.textContent = 'Review the Test Grid, run scenarios against a loan GUID, or replay the tour.';
    setOverlayControls({ showStop: false, showFinished: true });
    updateToggle();
  }

  function stopNarration() {
    speakTok += 1;
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function restoreFocusAfterStory() {
    const toggle = document.getElementById('unitTestsStoryToggle');
    if (focusBeforeStory && typeof focusBeforeStory.focus === 'function') {
      try {
        focusBeforeStory.focus({ preventScroll: true });
        return;
      } catch (_) {}
    }
    toggle?.focus({ preventScroll: true });
  }

  function stopStoryMode(preserveOverlay) {
    const keep = !!preserveOverlay;
    stopNarration();
    unbindStoryFloatListeners();
    storyFloatResolveAnchor = null;
    if (state.storyOpenedVoiceDrawer && typeof window.toggleVoiceHelp === 'function') {
      window.toggleVoiceHelp(false);
      state.storyOpenedVoiceDrawer = false;
    }
    state.running = false;
    state.paused = false;
    state.playbackToken += 1;
    clearSpotlights();
    if (!keep) {
      state.finished = false;
      setOverlay(null);
      restoreFocusAfterStory();
    }
    updateToggle();
  }

  function pauseStoryMode() {
    if (!state.running || state.paused) return;
    state.paused = true;
    state.resumeIndex = state.sceneIndex;
    stopNarration();
    unbindStoryFloatListeners();
    updateToggle();
  }

  function resumeStoryMode() {
    if (!state.paused) return;
    state.paused = false;
    state.running = true;
    state.playbackToken += 1;
    const tok = state.playbackToken;
    bindStoryFloatListeners();
    scheduleRepositionStoryNugget();
    updateToggle();
    void playbackLoop(tok, state.resumeIndex);
  }

  async function applyScene(scene) {
    clearSpotlights();
    if (typeof scene.action === 'function') {
      try {
        await scene.action();
      } catch (err) {
        console.warn('unit-tests story scene action failed', err);
      }
    }
    if (scene.openVoiceDrawer) {
      if (typeof window.toggleVoiceHelp === 'function') {
        window.toggleVoiceHelp(true);
        state.storyOpenedVoiceDrawer = true;
      }
    } else if (typeof window.showAccordionSection === 'function' && scene.collapseId) {
      window.showAccordionSection(scene.collapseId);
    }
    const head = typeof scene.scrollEl === 'function' ? scene.scrollEl() : null;
    const reduced =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = reduced ? 'auto' : 'smooth';
    if (head instanceof Element) {
      head.classList.add('unit-tests-story-spotlight');
      head.scrollIntoView({ behavior, block: 'center' });
      storyFloatResolveAnchor = () => head;
    } else {
      storyFloatResolveAnchor = null;
    }
    setOverlay(scene, state.sceneIndex, state.scenes.length);
    bindStoryFloatListeners();
  }

  async function playbackLoop(token, startIdx) {
    if (!state.scenes.length) {
      state.running = false;
      updateToggle();
      return;
    }
    let idx = typeof startIdx === 'number' ? startIdx : 0;
    while (state.running && token === state.playbackToken && state.scenes.length) {
      await waitWhilePaused(token);
      if (!state.running || token !== state.playbackToken) break;

      stopNarration();
      state.sceneIndex = idx;
      const scene = state.scenes[idx];
      if (!scene) break;
      await applyScene(scene);

      await waitWhilePaused(token);
      if (!state.running || token !== state.playbackToken) break;

      const narrTok = speakTok;
      const text = norm(scene.narration || '');
      const narrPromise =
        narrationEnabled() && text && typeof window.speakNarrationAwaitEnd === 'function'
          ? window.speakNarrationAwaitEnd(text, {
              volume: 0.85,
              isCancelled: () => narrTok !== speakTok || state.paused,
            })
          : Promise.resolve();
      const minMs = Number(scene.durationMs) || SCENE_MS;
      await Promise.all([narrPromise, sleep(minMs)]);

      await waitWhilePaused(token);
      if (!state.running || token !== state.playbackToken) break;

      if (idx + 1 >= state.scenes.length) {
        showFinishedOverlay();
        break;
      }
      await sleep(GAP_MS);
      idx += 1;
    }
    if (!state.running && !state.finished) updateToggle();
  }

  function startStory(fromIndex) {
    if (typeof window.laneTtsStopPlayback === 'function') window.laneTtsStopPlayback();
    stopNarration();
    state.scenes = buildScenes();
    if (!state.scenes.length) return;
    if (typeof fromIndex !== 'number') {
      focusBeforeStory = document.activeElement;
    }
    state.finished = false;
    state.paused = false;
    state.playbackToken += 1;
    state.running = true;
    state.storyOpenedVoiceDrawer = false;
    const tok = state.playbackToken;
    const startIdx = typeof fromIndex === 'number' ? fromIndex : 0;
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
    updateToggle();
    void playbackLoop(tok, startIdx);
  }

  function restartIfRunning() {
    stopNarration();
    state.playbackToken += 1;
    if (!state.running && !state.paused) return;
    state.scenes = buildScenes();
    if (!state.scenes.length) {
      stopStoryMode(false);
      return;
    }
    state.finished = false;
    state.running = true;
    state.paused = false;
    state.storyOpenedVoiceDrawer = false;
    const tok = state.playbackToken;
    const idx = state.sceneIndex;
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
    updateToggle();
    void playbackLoop(tok, idx);
  }

  function updateToggle() {
    const btn = document.getElementById('unitTestsStoryToggle');
    if (!btn) return;
    const has = buildScenes().length > 0;
    btn.disabled = !has && !state.running && !state.paused && !state.finished;
    if (state.paused) {
      btn.setAttribute('aria-pressed', 'true');
      btn.textContent = 'Resume highlight reel';
    } else if (state.running) {
      btn.setAttribute('aria-pressed', 'true');
      btn.textContent = 'Pause highlight reel';
    } else {
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = 'Play highlight reel';
    }
    setOverlayControls({
      showStop: state.running && !state.finished,
      showFinished: state.finished,
    });
  }

  function openTestGridFromFinished() {
    if (typeof window.showAccordionSection === 'function') {
      window.showAccordionSection('collapseTestGrid');
    }
    if (typeof window.setActiveWorkflowPill === 'function') {
      window.setActiveWorkflowPill('collapseTestGrid');
    }
    const heading = document.getElementById('headingTestGrid');
    heading?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    state.finished = false;
    setOverlay(null);
    restoreFocusAfterStory();
    updateToggle();
  }

  function init() {
    if (listenersBound) return;
    listenersBound = true;
    loadOpts();

    const overlay = document.getElementById('unitTestsStoryOverlay');
    if (overlay && overlay.parentElement !== document.body) {
      document.body.appendChild(overlay);
    }

    document.getElementById('unitTestsStoryStopBtn')?.addEventListener('click', () => {
      if (state.running || state.paused) stopStoryMode(false);
    });

    document.getElementById('unitTestsStoryReplayBtn')?.addEventListener('click', () => {
      state.finished = false;
      setOverlay(null);
      startStory(0);
    });

    document.getElementById('unitTestsStoryOpenGridBtn')?.addEventListener('click', () => {
      openTestGridFromFinished();
    });

    document.getElementById('unitTestsStoryToggle')?.addEventListener('click', () => {
      if (state.finished) {
        state.finished = false;
        setOverlay(null);
        startStory(0);
        return;
      }
      if (state.paused) {
        resumeStoryMode();
        return;
      }
      if (state.running) {
        pauseStoryMode();
        return;
      }
      state.scenes = buildScenes();
      if (!state.scenes.length) {
        updateToggle();
        return;
      }
      startStory();
    });

    ['unitTestsStoryChapters', 'unitTestsStoryNarrate'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        persistOpts();
        state.scenes = buildScenes();
        if (!state.scenes.length) stopStoryMode(false);
        else if (state.running || state.paused) restartIfRunning();
        updateToggle();
      });
    });

    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && (state.running || state.paused || state.finished)) {
          stopStoryMode(false);
          state.finished = false;
          return;
        }
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const replay = document.getElementById('unitTestsStoryReplayBtn');
        const openGrid = document.getElementById('unitTestsStoryOpenGridBtn');
        if (state.finished && document.activeElement === replay) {
          e.preventDefault();
          replay.click();
        } else if (state.finished && document.activeElement === openGrid) {
          e.preventDefault();
          openGrid.click();
        }
      },
      true
    );

    updateToggle();
  }

  window.unitTestsStoryMode = {
    start: startStory,
    buildScenes,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
