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

  test('gseLtvPercent', () => {
    expect(calcMath.gseLtvPercent([380000, 400000])).toBe(95);
    expect(calcMath.gseLtvPercent([100, 0])).toBe(0);
  });

  test('gseConformingBand', () => {
    expect(calcMath.gseConformingBand([500000, 806500])).toBe('within-limit');
    expect(calcMath.gseConformingBand([900000, 806500])).toBe('above-limit');
    expect(calcMath.gseConformingBand([500000, 0])).toBe('unknown');
  });

  test('gseScenarioRiskLevel', () => {
    expect(calcMath.gseScenarioRiskLevel([38, 6, 80])).toBe('low');
    expect(calcMath.gseScenarioRiskLevel([43, 2, 91])).toBe('medium');
    expect(calcMath.gseScenarioRiskLevel([46, 1, 96])).toBe('high');
  });

  test('calculateDTI uses ctx additional grossMonthly override when present', () => {
    const value = calcMath.calculateDTI([3000, 5000], { additionalData: { grossMonthly: 10000 } });
    expect(value).toBe(30);
  });

  test('calculateDTI returns empty string when income is zero', () => {
    expect(calcMath.calculateDTI([1000, 0], {})).toBe('');
  });

  test('divideRounded returns empty string when dividing by zero', () => {
    expect(calcMath.divideRounded([1000, 0])).toBe('');
  });

  test('divideRounded keeps permissive parsing by default', () => {
    expect(calcMath.divideRounded(['12abc', 3], {})).toBe(4);
  });

  test('divideRounded returns null in strict mode for mixed numeric strings', () => {
    const value = calcMath.divideRounded(['12abc', 3], { meta: { strictNumericParsing: true } });
    expect(value).toBeNull();
  });

  test('divideRounded returns null in strict mode for divide-by-zero', () => {
    const value = calcMath.divideRounded([1000, 0], { meta: { strictNumericParsing: true } });
    expect(value).toBeNull();
  });

  test('calculateDTI returns null in strict mode when income is zero', () => {
    const value = calcMath.calculateDTI([1000, 0], { meta: { strictNumericParsing: true } });
    expect(value).toBeNull();
  });
});
