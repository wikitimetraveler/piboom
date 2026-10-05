/**
 * Development work by David Lane
 */
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

  test('gseCltvPercent adds subordinate liens to the first lien', () => {
    expect(calcMath.gseCltvPercent([725000, 12200, 760000])).toBe(97);
    expect(calcMath.gseCltvPercent(['380000', '', '400000'])).toBe(95);
    expect(calcMath.gseCltvPercent([380000, -5000, 400000])).toBe(95);
    expect(calcMath.gseCltvPercent([380000, 20000, 0])).toBe(0);
  });

  test('gseAmiPercent divides income by area median income', () => {
    expect(calcMath.gseAmiPercent([85000, 109000])).toBe(77.98);
    expect(calcMath.gseAmiPercent(['85000', '100000'])).toBe(85);
    expect(calcMath.gseAmiPercent([85000, ''])).toBe('');
    expect(calcMath.gseAmiPercent([85000, 0])).toBe('');
  });

  test('monthlyPrincipalInterest amortizes a fixed-rate loan', () => {
    expect(calcMath.monthlyPrincipalInterest([300000, 6.5, 360])).toBe(1896.2);
    expect(calcMath.monthlyPrincipalInterest(['200000', '0', '240'])).toBe(833.33);
    expect(calcMath.monthlyPrincipalInterest([0, 6.5, 360])).toBe(0);
    expect(calcMath.monthlyPrincipalInterest([300000, 6.5, 0])).toBe(0);
  });

  test('addBusinessDays skips Sundays and optionally Saturdays', () => {
    expect(calcMath.addBusinessDays(['2026-10-05', 3, false])).toBe('2026-10-08');
    expect(calcMath.addBusinessDays(['2026-10-08', 3, false])).toBe('2026-10-13');
    expect(calcMath.addBusinessDays(['2026-10-08', 3, true])).toBe('2026-10-12');
    expect(calcMath.addBusinessDays(['2026-10-13', -3, true])).toBe('2026-10-09');
    expect(calcMath.addBusinessDays(['2026-10-13', -3, false])).toBe('2026-10-08');
    expect(calcMath.addBusinessDays(['10/13/2026', 3])).toBe('');
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

describe('calcMath integer cents (FHA Streamline)', () => {
  test('dollarsToCents / centsToDollars round-trip 2-decimal dollars', () => {
    expect(calcMath.dollarsToCents(12.34)).toBe(1234);
    expect(calcMath.centsToDollars(1234)).toBe(12.34);
    expect(calcMath.dollarsToCents('')).toBe(0);
  });

  test('floorToDollarCents matches minRoundDown / roundDown on dollars', () => {
    expect(calcMath.floorToDollarCents(12345)).toBe(12300);
    expect(calcMath.minRoundDown([123.45, 200])).toBe(123);
  });

  test('fhaLoanAmountIntegerCents add/sub/copy and floor-to-dollar', () => {
    const out = calcMath.fhaLoanAmountIntegerCents({
      g7: 400000,
      g8: 350000.99,
      g9: 1000,
      g12: 5000.1,
      g13: 2500.2,
      g14: 1000.3,
      d29: 1.75
    });
    expect(out.g15).toBe(500010 + 250020 + 100030);
    expect(out.g18).toBe(out.g15);
    expect(out.g19).toBe(100000);
    expect(out.g20).toBe(out.g15 - out.g19);
    expect(out.g22).toBe(35000099);
    expect(out.g24).toBe(calcMath.floorToDollarCents(Math.min(out.g20, out.g22)));
    expect(out.g24 % 100).toBe(0);
    expect(out.g24).toBeGreaterThan(0);
    expect(out.g28).toBe(out.g24);
    expect(out.g29).toBe(calcMath.floorToDollarCents(out.e29));
    expect(out.g30).toBe(out.g28 + out.g29);
  });

  test('UFMIP uses round_half_up(g24 * 175 / 10000)', () => {
    const e29 = calcMath.roundHalfUpMulDiv(1000000, 175, 10000);
    expect(e29).toBe(17500);
    const out = calcMath.fhaLoanAmountIntegerCents({
      g7: 10000,
      g8: 10000,
      g9: 0,
      g12: 10000,
      g13: 0,
      g14: 0,
      d29: 1.75
    });
    expect(out.pctBps).toBe(175);
    expect(out.g24).toBe(1000000);
    expect(out.e29).toBe(17500);
  });

  test('g33 hundredths is scaled ratio; zero G7 is 0', () => {
    const out = calcMath.fhaLoanAmountIntegerCents({
      g7: 200000,
      g8: 100000,
      g9: 0,
      g12: 100000,
      g13: 0,
      g14: 0,
      d29: 0
    });
    expect(out.g33Hundredths).toBe(50);
    const zeroBase = calcMath.fhaLoanAmountIntegerCents({
      g7: 0,
      g8: 100,
      g9: 0,
      g12: 50,
      g13: 0,
      g14: 0,
      d29: 0
    });
    expect(zeroBase.g33Hundredths).toBe(0);
  });

  test('f32 UFMIP diverges from integer cents on canned G24 × 1.75%', () => {
    const { g24Dollars, d29, integerCents } = calcMath.FHA_F32_UFMIP_DIVERGENCE;
    expect(calcMath.roundHalfUpMulDiv(calcMath.dollarsToCents(g24Dollars), 175, 10000)).toBe(
      integerCents
    );
    const f32Dollars = calcMath.multiplyPercentageF32([g24Dollars, d29]);
    const f32Cents = Math.round(f32Dollars * 100 + Number.EPSILON);
    expect(f32Cents).not.toBe(integerCents);
    expect(f32Cents - integerCents).toBe(1);
  });
});
