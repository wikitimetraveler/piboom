/**
 * @jest-environment node
 */
import {
  HISTORIAN_DEMO_SHORT_SCRIPT,
  HISTORIAN_INTRO_SCRIPT,
  getHistorianDemoShort,
  getHistorianIntro,
  getHyperFramesScenes
} from '../../services/music-heygen.service.js';

describe('music-heygen.service', () => {
  test('getHistorianDemoShort returns booth popup script', () => {
    const payload = getHistorianDemoShort();
    expect(payload.title).toBe('Music Research Demo');
    expect(payload.script).toBe(HISTORIAN_DEMO_SHORT_SCRIPT);
    expect(payload.script).toMatch(/Music Research/);
    expect(payload.script).toMatch(/Historian/);
    expect(payload.script.length).toBeLessThan(HISTORIAN_INTRO_SCRIPT.length);
  });

  test('getHistorianIntro returns full welcome script', () => {
    const payload = getHistorianIntro();
    expect(payload.title).toBe('Music Historian — Welcome');
    expect(payload.script).toBe(HISTORIAN_INTRO_SCRIPT);
    expect(payload.script).toMatch(/Time Machine/);
    expect(payload.script).toMatch(/Pilgrimage Atlas/);
  });

  test('getHyperFramesScenes returns six beats', () => {
    const scenes = getHyperFramesScenes();
    expect(scenes).toHaveLength(6);
    expect(scenes[0].kicker).toBe('Music Research');
    expect(scenes[4].kicker).toBe('Historian');
  });
});
