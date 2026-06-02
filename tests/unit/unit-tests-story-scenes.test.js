import { buildUnitTestsStoryScenes } from '../../public/shared/unit-tests-story-scenes.js';

describe('unit-tests-story-scenes', () => {
  it('includes 8 scenes when chapters are on and live builder is off', () => {
    const scenes = buildUnitTestsStoryScenes({
      chaptersEnabled: true,
      liveScenarioBuilderVisible: false,
    });
    expect(scenes.length).toBeGreaterThanOrEqual(8);
    expect(scenes.some((s) => s.id === 'voiceShortcuts')).toBe(true);
  });

  it('includes 3 core scenes when chapters are off', () => {
    const scenes = buildUnitTestsStoryScenes({
      chaptersEnabled: false,
      liveScenarioBuilderVisible: false,
    });
    expect(scenes).toHaveLength(3);
    expect(scenes.map((s) => s.id)).toEqual(['generate', 'testGrid', 'runTests']);
  });

  it('inserts Live Scenario Builder when visible', () => {
    const scenes = buildUnitTestsStoryScenes({
      chaptersEnabled: false,
      liveScenarioBuilderVisible: true,
    });
    expect(scenes.map((s) => s.id)).toEqual([
      'generate',
      'testGrid',
      'liveScenarioBuilder',
      'runTests',
    ]);
  });
});
