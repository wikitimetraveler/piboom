import { jest } from '@jest/globals';
import '../../public/shared/calcEngineLibrary.js';

const { calcMath } = globalThis;

describe('calcEngineLibrary helpers', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-01T00:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('sumRounded returns a rounded sum', () => {
    expect(calcMath.sumRounded([1.005, 2.005])).toBe(3.01);
  });

  test('ageBasedRetFactor returns 1.0 for age over threshold', () => {
    expect(calcMath.ageBasedRetFactor(['1960-01-01'])).toBe(1.0);
  });

  test('ageBasedRetFactor returns 0.7 for missing or invalid dates', () => {
    expect(calcMath.ageBasedRetFactor([''])).toBe(0.7);
    expect(calcMath.ageBasedRetFactor(['not-a-date'])).toBe(0.7);
  });

  test('minAssetsPass returns PASS/FAIL based on threshold', () => {
    expect(calcMath.minAssetsPass([300000, 150000, 100000, 20000])).toBe('PASS');
    expect(calcMath.minAssetsPass([100000, 100000, 100000, 20000])).toBe('FAIL');
  });

  test('messagesC31C32 returns missing data messages', () => {
    const message = calcMath.messagesC31C32(['', '', 10000, 10000, 10000]);
    expect(message).toContain('Confirmation Required');
    expect(message).toContain('Missing data entry: 12-month account history required');
  });
});
