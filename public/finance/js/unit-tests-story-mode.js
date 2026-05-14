/**
 * Unit Tests — HyperFrames-style workflow story (TTS via /shared/tts.js).
 * Depends: showAccordionSection on window (set by unit-tests.js), speakNarrationAwaitEnd.
 */
(function () {
  const STORAGE_CH = 'unitTestsStoryChapters';
  const STORAGE_NA = 'unitTestsStoryNarrate';
  const SCENE_MS = 4800;
  const GAP_MS = 280;

  const state = {
    running: false,
    playbackToken: 0,
    scenes: [],
    /** Set when the reel opens the voice drawer; cleared on stop so we only close what we opened. */
    storyOpenedVoiceDrawer: false,
  };

  let speakTok = 0;
  let listenersBound = false;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
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

  function buildScenes() {
    const full = chaptersEnabled();
    const scenes = [];
    scenes.push({
      collapseId: 'collapseTestScenarios',
      scrollEl: () => document.getElementById('headingTestScenarios'),
      kicker: 'Step 1',
      title: 'Test Scenarios',
      copy: 'Run one scenario or coordinate runs from the cards.',
      narration: norm(
        'Step 1, Scenarios. Pick a scenario column, run from the cards, or coordinate runs from the grid.'
      ),
      durationMs: SCENE_MS,
    });
    if (liveScenarioBuilderSceneRelevant()) {
      scenes.push({
        collapseId: 'collapseLiveScenarioBuilder',
        scrollEl: () => document.getElementById('headingLiveScenarioBuilder'),
        kicker: 'Step 1b',
        title: 'Live Scenario Builder',
        copy: 'Edit mock values, preview the result instantly, then apply values into SET rows for one, five, or all test columns.',
        narration: norm(
          'Step one B, Live Scenario Builder. Edit mock values, inspect the live result, then apply those values to set rows across one, five, or all test columns.'
        ),
        durationMs: SCENE_MS,
      });
    }
    scenes.push({
      collapseId: 'collapseTestGrid',
      scrollEl: () => document.getElementById('headingTestGrid'),
      kicker: 'Step 2',
      title: 'Test Grid',
      copy: 'Inspect SET and COMPARE rows, search columns, and review scenario results.',
      narration: norm(
        'Step 2, Test Grid. Review your steps, targets, and scenario columns. Use search and filters after data is loaded.'
      ),
      durationMs: SCENE_MS,
    });
    scenes.push({
      collapseId: 'collapseUnitTestData',
      scrollEl: () => document.getElementById('headingUnitTestData'),
      kicker: 'Step 3',
      title: 'Run tests / Unit Test Data',
      copy: 'Upload or generate a workbook, read QA highlights, then enter a loan GUID and use Run with the sticky bar.',
      narration: norm(
        'Step 3, Run tests. Use QA highlights for formulas, enter a loan GUID, then run from the sticky bar. Upload and generate also live in the Excel Unit Tests bar above.'
      ),
      durationMs: SCENE_MS,
    });
    if (full) {
      scenes.push({
        collapseId: 'collapseOverallSignOff',
        scrollEl: () => document.getElementById('headingOverallSignOff'),
        kicker: 'Step 4',
        title: 'Sign-off',
        copy: 'Collect tester confirmations when the run is accepted.',
        narration: norm('Step 4, Sign-off. Confirm completion when testers agree the suite passed.'),
        durationMs: SCENE_MS,
      });
      scenes.push({
        collapseId: 'collapseTestLibrary',
        scrollEl: () => document.getElementById('headingTestLibrary'),
        kicker: 'Library',
        title: 'Test Library',
        copy: 'Reload saved spreadsheets and optional BR or Tool 8 files.',
        narration: norm('Test Library. Open saved Excel tests and uploaded rule files when you need them.'),
        durationMs: SCENE_MS,
      });
      scenes.push({
        collapseId: 'collapseLearnMode',
        scrollEl: () => document.getElementById('headingLearnMode'),
        kicker: 'Advanced',
        title: 'Learn Mode',
        copy: 'Pair VB parser logic with a worked grid case to generate templates and Node parser suggestions.',
        narration: norm(
          'Advanced, Learn Mode. Add parser logic plus a worked test case to train examples, templates, and optional VB notes.'
        ),
        durationMs: SCENE_MS,
      });
      scenes.push({
        collapseId: 'collapseAIAssistant',
        scrollEl: () => document.getElementById('headingAIAssistant'),
        kicker: 'Advanced',
        title: 'AI Assistant',
        copy: 'Ask about unit tests, scenarios, Encompass APIs, and automation. Use Speak when you want replies read aloud.',
        narration: norm(
          'Advanced, AI Assistant. Ask unit-testing and Encompass questions here. Turn on Speak if you want voice replies.'
        ),
        durationMs: SCENE_MS,
      });
      scenes.push({
        openVoiceDrawer: true,
        scrollEl: () =>
          document.querySelector('#voiceHelp .voice-help-header') || document.getElementById('voiceHelp'),
        kicker: 'Advanced',
        title: 'Voice Shortcuts',
        copy: 'Say commands like "show grid", "run tests", or "open library" to jump sections without clicking.',
        narration: norm(
          'Advanced, Voice Shortcuts. Use spoken commands to open steps, run tests, or ask the assistant—see the list in the drawer.'
        ),
        durationMs: SCENE_MS,
      });
    }
    return scenes;
  }

  /** If no unit-test rows are loaded yet, hydrate the offline demo so the reel has grid/scenario context. */
  async function maybePreloadOfflineDemoForStory() {
    if (typeof window.unitTestsHasLoadedData !== 'function' || typeof window.loadOfflineDemoUnitTest !== 'function') return;
    if (window.unitTestsHasLoadedData()) return;
    await window.loadOfflineDemoUnitTest();
  }

  function clearSpotlights() {
    document.querySelectorAll('.unit-tests-story-spotlight').forEach((el) => {
      el.classList.remove('unit-tests-story-spotlight');
    });
  }

  function setOverlay(scene) {
    const overlay = document.getElementById('unitTestsStoryOverlay');
    const kEl = document.getElementById('unitTestsStorySceneKicker');
    const tEl = document.getElementById('unitTestsStorySceneTitle');
    const cEl = document.getElementById('unitTestsStorySceneCopy');
    if (!overlay || !kEl || !tEl || !cEl) return;
    if (!scene) {
      overlay.classList.add('d-none');
      overlay.classList.remove('unit-tests-story-overlay--floating');
      kEl.textContent = '';
      tEl.textContent = '';
      cEl.textContent = '';
      return;
    }
    overlay.classList.remove('d-none');
    overlay.classList.add('unit-tests-story-overlay--floating');
    kEl.textContent = scene.kicker || '';
    tEl.textContent = scene.title || '';
    cEl.textContent = scene.copy || '';
  }

  function stopNarration() {
    speakTok += 1;
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function stopStoryMode(preserveOverlay) {
    const keep = !!preserveOverlay;
    stopNarration();
    if (state.storyOpenedVoiceDrawer && typeof window.toggleVoiceHelp === 'function') {
      window.toggleVoiceHelp(false);
      state.storyOpenedVoiceDrawer = false;
    }
    state.running = false;
    state.playbackToken += 1;
    clearSpotlights();
    if (!keep) setOverlay(null);
    updateToggle();
  }

  function applyScene(scene) {
    clearSpotlights();
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
    }
    setOverlay(scene);
  }

  async function playbackLoop(token) {
    if (!state.scenes.length) {
      state.running = false;
      updateToggle();
      return;
    }
    let idx = 0;
    while (state.running && token === state.playbackToken && state.scenes.length) {
      stopNarration();
      const scene = state.scenes[idx];
      if (!scene) break;
      applyScene(scene);
      const narrTok = speakTok;
      const text = norm(scene.narration || '');
      const narrPromise =
        narrationEnabled() && text && typeof window.speakNarrationAwaitEnd === 'function'
          ? window.speakNarrationAwaitEnd(text, {
              volume: 0.85,
              isCancelled: () => narrTok !== speakTok,
            })
          : Promise.resolve();
      const minMs = Number(scene.durationMs) || SCENE_MS;
      await Promise.all([narrPromise, sleep(minMs)]);
      if (!state.running || token !== state.playbackToken) break;
      if (idx + 1 >= state.scenes.length) {
        stopStoryMode(true);
        break;
      }
      await sleep(GAP_MS);
      idx += 1;
    }
    if (!state.running) updateToggle();
  }

  function startStory() {
    if (typeof window.laneTtsStopPlayback === 'function') window.laneTtsStopPlayback();
    stopNarration();
    state.scenes = buildScenes();
    if (!state.scenes.length) return;
    state.playbackToken += 1;
    state.running = true;
    state.storyOpenedVoiceDrawer = false;
    const tok = state.playbackToken;
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
    updateToggle();
    void playbackLoop(tok);
  }

  function restartIfRunning() {
    stopNarration();
    state.playbackToken += 1;
    if (!state.running) return;
    state.scenes = buildScenes();
    if (!state.scenes.length) {
      stopStoryMode(false);
      return;
    }
    state.running = true;
    state.storyOpenedVoiceDrawer = false;
    const tok = state.playbackToken;
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
    updateToggle();
    void playbackLoop(tok);
  }

  function updateToggle() {
    const btn = document.getElementById('unitTestsStoryToggle');
    if (!btn) return;
    const has = buildScenes().length > 0;
    btn.disabled = !has && !state.running;
    btn.setAttribute('aria-pressed', state.running ? 'true' : 'false');
    btn.textContent = state.running ? 'Pause highlight reel' : 'Play highlight reel';
  }

  function init() {
    if (listenersBound) return;
    listenersBound = true;
    loadOpts();

    document.getElementById('unitTestsStoryToggle')?.addEventListener('click', async () => {
      if (state.running) {
        stopStoryMode(false);
      } else {
        await maybePreloadOfflineDemoForStory();
        state.scenes = buildScenes();
        if (!state.scenes.length) {
          updateToggle();
          return;
        }
        startStory();
      }
    });

    ['unitTestsStoryChapters', 'unitTestsStoryNarrate'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        persistOpts();
        state.scenes = buildScenes();
        if (!state.scenes.length) stopStoryMode(false);
        else if (state.running) restartIfRunning();
        updateToggle();
      });
    });

    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape' || !state.running) return;
        stopStoryMode(false);
      },
      true
    );

    updateToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
