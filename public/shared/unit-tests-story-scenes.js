/**
 * Pure highlight-reel scene list for Unit Test tool (browser + Jest).
 * DOM scroll/action wiring lives in unit-tests-story-mode.js.
 */

const SCENE_MS = 4800;

function norm(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {{
 *   chaptersEnabled?: boolean,
 *   liveScenarioBuilderVisible?: boolean,
 *   hasLoadedData?: boolean,
 * }} [options]
 */
export function buildUnitTestsStoryScenes(options = {}) {
  const chaptersEnabled = options.chaptersEnabled !== false;
  const liveScenarioBuilderVisible = !!options.liveScenarioBuilderVisible;
  const hasLoadedData = !!options.hasLoadedData;

  /** @type {Array<Record<string, unknown>>} */
  const scenes = [];

  scenes.push({
    id: 'generate',
    kicker: 'Step 1',
    title: 'Generate & load',
    copy: 'Load from Excel or generate from a calculated custom field. Preview SET and COMPARE steps, then generate and load into the grid.',
    narration: norm(
      'Step one, Generate and load. Load tests from Excel, or generate from a calculated custom field. Preview set and compare steps, then generate and load.'
    ),
    durationMs: 6400,
    hasGenerateAction: true,
    scrollWhenLoaded: ['headingTestGrid', 'generateFromCustomFieldBtn', 'unitTestsCommandBar'],
    scrollWhenEmpty: [
      'generateCustomFieldConfirmBtn',
      'generateFromCustomFieldModal',
      'generateFromCustomFieldBtn',
      'unitTestsCommandBar',
    ],
    hasLoadedData,
  });

  scenes.push({
    id: 'testGrid',
    collapseId: 'collapseTestGrid',
    scrollAnchor: 'headingTestGrid',
    kicker: 'Next',
    title: 'Step 2 — Test Grid',
    copy: 'All cells are editable. Date fields get a date picker; numbers and booleans use type-aware editors. Review SET and COMPARE rows and scenario columns.',
    narration: norm(
      'Next, Step two, Test Grid. All cells are editable. Date fields get a date picker. For numbers and booleans, use type-aware editors. Review set and compare rows and scenario columns.'
    ),
    durationMs: SCENE_MS,
  });

  if (liveScenarioBuilderVisible) {
    scenes.push({
      id: 'liveScenarioBuilder',
      collapseId: 'collapseLiveScenarioBuilder',
      scrollAnchor: 'headingLiveScenarioBuilder',
      kicker: 'Next',
      title: 'Live Scenario Builder',
      copy: 'Edit mock values, preview the result instantly, then apply values into SET rows for one, five, or all test columns.',
      narration: norm(
        'Next, Live Scenario Builder. Edit mock values, inspect the live result, then apply those values to set rows across one, five, or all test columns.'
      ),
      durationMs: SCENE_MS,
    });
  }

  scenes.push({
    id: 'runTests',
    collapseId: 'collapseUnitTestData',
    scrollAnchors: ['runScenarioSelect', 'unitTestsScenarioPills', 'headingUnitTestData'],
    kicker: 'Next',
    title: 'Step 3 — Run tests',
    copy: 'Enter a Loan GUID from your Encompass pipeline. Run tests to SET values, GET results, and COMPARE—pass/fail shading shows in the grid.',
    narration: norm(
      'Next, Step three, Run tests. Enter a loan GUID from your Encompass pipeline. Run tests to set values, get results, and compare. Pass means the calculated value matches; fail means it does not.'
    ),
    durationMs: SCENE_MS,
  });

  if (chaptersEnabled) {
    scenes.push({
      id: 'signOff',
      collapseId: 'collapseOverallSignOff',
      scrollAnchor: 'headingOverallSignOff',
      kicker: 'Next',
      title: 'Step 4 — Sign-off',
      copy: 'Collect tester confirmations when the run is accepted.',
      narration: norm('Next, Step four, Sign-off. Confirm completion when testers agree the suite passed.'),
      durationMs: SCENE_MS,
    });
    scenes.push({
      id: 'testLibrary',
      collapseId: 'collapseTestLibrary',
      scrollAnchor: 'headingTestLibrary',
      kicker: 'Next',
      title: 'Export & Test Library',
      copy: 'Export tests to Excel or CSV for sharing. Reload saved spreadsheets from the Test Library.',
      narration: norm(
        'Next, Export and Test Library. Export tests to Excel or CSV for sharing, and reload saved spreadsheets from the library when you need them.'
      ),
      durationMs: SCENE_MS,
    });
    scenes.push({
      id: 'learnMode',
      collapseId: 'collapseLearnMode',
      scrollAnchor: 'headingLearnMode',
      kicker: 'Next',
      title: 'Learn Mode',
      copy: 'Pair VB parser logic with a worked grid case to generate templates and Node parser suggestions.',
      narration: norm(
        'Next, Learn Mode. Add parser logic plus a worked test case to train examples, templates, and optional VB notes.'
      ),
      durationMs: SCENE_MS,
    });
    scenes.push({
      id: 'aiAssistant',
      collapseId: 'collapseAIAssistant',
      scrollAnchor: 'headingAIAssistant',
      kicker: 'Next',
      title: 'AI Assistant',
      copy: 'Ask about unit tests, scenarios, Encompass APIs, and automation. Use Speak when you want replies read aloud.',
      narration: norm(
        'Next, AI Assistant. Ask unit-testing and Encompass questions here. Turn on Speak if you want voice replies.'
      ),
      durationMs: SCENE_MS,
    });
    scenes.push({
      id: 'voiceShortcuts',
      openVoiceDrawer: true,
      scrollAnchor: 'voiceHelpHeader',
      kicker: 'Next',
      title: 'Voice Shortcuts',
      copy: 'Say commands like "show grid", "run tests", or "open library" to jump sections without clicking.',
      narration: norm(
        'Next, Voice Shortcuts. Use spoken commands to open steps, run tests, or ask the assistant—see the list in the drawer.'
      ),
      durationMs: SCENE_MS,
    });
  }

  return scenes;
}

export { SCENE_MS };
