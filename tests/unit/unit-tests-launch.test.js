import {
  shouldAutoOpenGenerate,
  shouldAutoStartReel,
  shouldLoadOfflineDemo,
} from '../../public/shared/unit-tests-launch.js';

function params(obj) {
  return new URLSearchParams(obj);
}

describe('unit-tests-launch', () => {
  describe('shouldAutoOpenGenerate', () => {
    it('returns true when generate=1 and no loaded data', () => {
      expect(shouldAutoOpenGenerate(params({ generate: '1' }), false)).toBe(true);
    });

    it('returns false by default', () => {
      expect(shouldAutoOpenGenerate(params({}), false)).toBe(false);
    });

    it('returns false when data already loaded', () => {
      expect(shouldAutoOpenGenerate(params({ generate: '1' }), true)).toBe(false);
    });
  });

  describe('shouldAutoStartReel', () => {
    it('returns true when reel=1', () => {
      expect(shouldAutoStartReel(params({ reel: '1' }))).toBe(true);
    });

    it('returns false by default', () => {
      expect(shouldAutoStartReel(params({}))).toBe(false);
    });
  });

  describe('shouldLoadOfflineDemo', () => {
    it('returns true for demo=1', () => {
      expect(shouldLoadOfflineDemo(params({ demo: '1' }))).toBe(true);
    });

    it('returns true for storybook=1', () => {
      expect(shouldLoadOfflineDemo(params({ storybook: '1' }))).toBe(true);
    });

    it('returns false by default', () => {
      expect(shouldLoadOfflineDemo(params({}))).toBe(false);
    });
  });
});
