/**
 * Development work by David Lane
 */
import '../../public/studio/js/studio-booth.js';

const { StarBandBooth } = globalThis;

describe('StarBandBooth', () => {
  test('clampBpm stays in 40–220 and defaults to 92', () => {
    expect(StarBandBooth.clampBpm(92)).toBe(92);
    expect(StarBandBooth.clampBpm(12)).toBe(40);
    expect(StarBandBooth.clampBpm(400)).toBe(220);
    expect(StarBandBooth.clampBpm('nope')).toBe(92);
  });

  test('beatSec is 60 / bpm', () => {
    expect(StarBandBooth.beatSec(120)).toBeCloseTo(0.5, 5);
    expect(StarBandBooth.beatSec(60)).toBeCloseTo(1, 5);
  });

  test('countInBeats is 4 per bar and 0 when off', () => {
    expect(StarBandBooth.countInBeats(0)).toBe(0);
    expect(StarBandBooth.countInBeats(1)).toBe(4);
    expect(StarBandBooth.countInBeats(2)).toBe(8);
  });

  test('clickHz is higher on the downbeat', () => {
    expect(StarBandBooth.clickHz(true)).toBeGreaterThan(StarBandBooth.clickHz(false));
    expect(StarBandBooth.isCountDownbeat(0)).toBe(true);
    expect(StarBandBooth.isCountDownbeat(1)).toBe(false);
    expect(StarBandBooth.isCountDownbeat(4)).toBe(true);
  });
});
