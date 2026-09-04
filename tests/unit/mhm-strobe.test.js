/**
 * Development work by David Lane
 */
import '../../public/mountain-high/js/mhm-strobe.js';

const { MhmStrobe } = globalThis;

describe('MhmStrobe', () => {
  test('stays off until toggled and reports reduced-motion helper', () => {
    expect(MhmStrobe.isOn()).toBe(false);
    expect(typeof MhmStrobe.prefersReducedMotion).toBe('function');
    expect(MhmStrobe.prefersReducedMotion()).toBe(false);
  });

  test('setOn turns the flag on, then off', () => {
    expect(MhmStrobe.setOn(true)).toBe(true);
    expect(MhmStrobe.isOn()).toBe(true);
    expect(MhmStrobe.setOn(false)).toBe(false);
    expect(MhmStrobe.isOn()).toBe(false);
  });
});
