// Calculation Engine Library
// ============================================================================
// @author David Lane
// Pure calculation helpers (no DOM). Attaches to global for browser use.
// ============================================================================
(function (global) {
  const STRICT_NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

  const isStrictNumericParsing = (ctx) => Boolean(ctx?.meta?.strictNumericParsing);

  const toNumber = (v, ctx, options = {}) => {
    const { invalidValue = 0 } = options;
    if (typeof v === 'number') return Number.isFinite(v) ? v : invalidValue;
    if (v === null || v === undefined) return invalidValue;

    const raw = String(v).trim();
    if (!raw) return invalidValue;

    if (isStrictNumericParsing(ctx)) {
      if (!STRICT_NUMBER_RE.test(raw)) return invalidValue;
      const n = Number(raw);
      return Number.isFinite(n) ? n : invalidValue;
    }

    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : invalidValue;
  };

  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  const dollarsToCents = (value) => {
    const n = toNumber(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100 + Number.EPSILON);
  };

  const centsToDollars = (cents) => {
    const c = typeof cents === 'number' ? cents : toNumber(cents);
    if (!Number.isFinite(c)) return 0;
    return c / 100;
  };

  const floorToDollarCents = (cents) => {
    const c = typeof cents === 'number' ? cents : toNumber(cents);
    if (!Number.isFinite(c)) return 0;
    return Math.trunc(c / 100) * 100;
  };

  const roundHalfUpMulDiv = (a, b, denom) => {
    const aa = typeof a === 'number' ? a : toNumber(a);
    const bb = typeof b === 'number' ? b : toNumber(b);
    const dd = typeof denom === 'number' ? denom : toNumber(denom);
    if (!(dd > 0) || !Number.isFinite(aa) || !Number.isFinite(bb)) return 0;
    const q = Math.trunc(aa / dd);
    const r = aa % dd;
    const hi = q * bb;
    const lo = Math.trunc((r * bb + Math.trunc(dd / 2)) / dd);
    return hi + lo;
  };

  const calcMath = {
    // Legacy behaviors preserved
    sumInputs(values = []) {
      const nums = values.map(toNumber);
      return nums.reduce((acc, val) => acc + val, 0);
    },

    subtractInputs(values = []) {
      const nums = values.map(toNumber);
      if (!nums.length) return 0;
      return nums.slice(1).reduce((acc, val) => acc - val, nums[0]);
    },

    truncateAndSumInputs(values = []) {
      const nums = values.map(toNumber).map(Math.trunc);
      return nums.reduce((acc, val) => acc + val, 0);
    },

    minInputs(values = []) {
      const nums = values.map(toNumber);
      if (!nums.length) return '';
      const min = Math.min(...nums);
      return Number.isFinite(min) ? min : '';
    },

    maxUFMPamount(values = []) {
      const a = toNumber(values[0]);
      const b = toNumber(values[1]);
      const adjusted = a - Math.round((a * b) / (1 + b) * 100) / 100;
      return Math.trunc(adjusted) * b;
    },

    newUfmipFactor(values = []) {
      const comparisonDate = new Date('2009-05-31');
      const raw = values[0];
      if (!raw) return 0;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return 0;
      return d < comparisonDate ? 0.01 : 0.0175;
    },

    // Additional reusable helpers from the provided sample
    sumRounded(values = []) {
      const total = values.map(toNumber).reduce((a, b) => a + b, 0);
      return round2(total);
    },

    subtractRounded(values = []) {
      const a = toNumber(values[0]);
      const b = toNumber(values[1]);
      return round2(a - b);
    },

    copyValue(values = []) {
      return round2(toNumber(values[0]));
    },

    minRoundDown(values = []) {
      const nums = values.map(toNumber);
      if (!nums.length) return '';
      const min = Math.min(...nums);
      return Number.isFinite(min) ? Math.floor(min) : '';
    },

    roundDown(values = []) {
      return Math.floor(toNumber(values[0]));
    },

    multiplyPercentage(values = []) {
      const base = toNumber(values[0]);
      const pct = toNumber(values[1]);
      return round2(base * (pct / 100));
    },

    divideRounded(values = [], ctx) {
      const strict = isStrictNumericParsing(ctx);
      const invalidValue = strict ? null : 0;
      const a = toNumber(values[0], ctx, { invalidValue });
      const b = toNumber(values[1], ctx, { invalidValue });
      if (a === null || b === null) return null;
      if (b === 0) return strict ? null : '';
      return round2(a / b);
    },

    annualToMonthly(values = []) {
      const annual = toNumber(values[0]);
      return round2(annual / 12);
    },

    calculateDTI(values = [], ctx) {
      const strict = isStrictNumericParsing(ctx);
      const invalidValue = strict ? null : 0;
      const payment = toNumber(values[0], ctx, { invalidValue });
      let income = toNumber(values[1], ctx, { invalidValue });
      const gm = ctx?.additionalData?.grossMonthly;
      const grossMonthly = gm !== undefined ? toNumber(gm, ctx, { invalidValue }) : 0;
      if (payment === null || income === null || grossMonthly === null) return null;
      if (grossMonthly > 0) income = grossMonthly;
      if (income === 0) return strict ? null : '';
      return round2((payment / income) * 100);
    },

    calculateMinIncome(values = []) {
      const totalPayment = toNumber(values[0]);
      return round2(totalPayment / 0.43);
    },

    ageBasedRetFactor(values = []) {
      const raw = values[0];
      if (!raw) return 0.7;
      const dob = new Date(raw);
      if (Number.isNaN(dob.getTime())) return 0.7;
      const today = new Date();
      const ageYears = (today - dob) / (365.25 * 24 * 60 * 60 * 1000);
      return ageYears > 56.9 ? 1.0 : 0.7;
    },

    multiplyRounded(values = []) {
      const a = toNumber(values[0]);
      const b = toNumber(values[1]);
      return round2(a * b);
    },

    minAssetsPass(values = []) {
      const liquid = toNumber(values[0]);
      const other = toNumber(values[1]);
      const retirement = toNumber(values[2]);
      const required = toNumber(values[3]);
      const threshold = 500000;
      const pass = liquid + other + retirement - required >= threshold;
      return pass ? 'PASS' : 'FAIL';
    },

    supportablePaymentRounded(values = []) {
      const netAssets = toNumber(values[0]);
      const factor = (0.0025 * 1.233354) / (1.233354 - 1);
      return round2(netAssets * factor);
    },

    messagesC31C32(values = []) {
      const nonBorrower = String(values[0] ?? '').trim();
      const hist12mo = String(values[1] ?? '').trim();
      const liquid = toNumber(values[2]);
      const other = toNumber(values[3]);
      const retirement = toNumber(values[4]);

      const msgs = [];
      if (!nonBorrower) msgs.push('Confirmation Required');
      else if (nonBorrower === 'Yes') msgs.push('Guidelines do not accept assets from non-borrowers');
      else if (liquid + other + retirement < 500000) msgs.push('A minimum of $500,000 is required');

      if (!hist12mo) msgs.push('Missing data entry: 12-month account history required');
      else if (hist12mo === 'No') msgs.push('Most recent 12-month account history is required');

      return msgs.join(' | ') || '';
    },

    /**
     * GSE scenario support (Fannie/Freddie research tool): LTV% from loan amount and purchase price.
     * @param {number[]} values [loanAmount, purchasePrice]
     */
    gseLtvPercent(values = []) {
      const loan = toNumber(values[0]);
      const price = toNumber(values[1]);
      if (price <= 0) return 0;
      return round2((loan / price) * 100);
    },

    /**
     * GSE scenario support: CLTV% from first lien + subordinate liens over purchase price.
     * @param {number[]} values [loanAmount, subordinateFinancing, purchasePrice]
     */
    gseCltvPercent(values = []) {
      const loan = toNumber(values[0]);
      const sub = Math.max(0, toNumber(values[1]));
      const price = toNumber(values[2]);
      if (price <= 0) return 0;
      return round2(((loan + sub) / price) * 100);
    },

    /**
     * GSE scenario support: borrower qualifying income as a percent of area median income (AMI).
     * Returns '' when AMI is blank or zero so the optional field stays empty.
     * @param {number[]} values [annualIncome, areaMedianIncome]
     */
    gseAmiPercent(values = []) {
      const income = toNumber(values[0]);
      const ami = toNumber(values[1]);
      if (!(ami > 0)) return '';
      return round2((income / ami) * 100);
    },

    /**
     * Compare loan amount to one conforming limit for the subject unit count (FHFA / county).
     * @param {number[]} values [loanAmount, conformingLimit]
     * @returns {'within-limit'|'above-limit'|'unknown'}
     */
    gseConformingBand(values = []) {
      const loan = toNumber(values[0]);
      const limit = toNumber(values[1]);
      if (!(limit > 0)) return 'unknown';
      return loan <= limit ? 'within-limit' : 'above-limit';
    },

    /**
     * Coarse risk tier for UI coloring only (not underwriting).
     * @param {number[]} values [dti, reservesMonths, ltv]
     */
    gseScenarioRiskLevel(values = []) {
      const dti = toNumber(values[0]);
      const reserves = toNumber(values[1]);
      const ltv = toNumber(values[2]);
      let pts = 0;
      if (dti >= 45) pts += 2;
      else if (dti >= 40) pts += 1;
      if (reserves < 2) pts += 2;
      else if (reserves < 4) pts += 1;
      if (ltv > 95) pts += 2;
      else if (ltv > 90) pts += 1;
      if (pts >= 4) return 'high';
      if (pts >= 2) return 'medium';
      return 'low';
    },

    /**
     * Fully amortizing monthly principal + interest.
     * @param {number[]} values [loanAmount, annualRatePercent, termMonths]
     */
    monthlyPrincipalInterest(values = []) {
      const loan = toNumber(values[0]);
      const rate = toNumber(values[1]);
      const term = Math.trunc(toNumber(values[2]));
      if (!(loan > 0) || !(term > 0)) return 0;
      const r = rate / 100 / 12;
      if (r === 0) return round2(loan / term);
      const growth = Math.pow(1 + r, term);
      return round2((loan * r * growth) / (growth - 1));
    },

    /**
     * Shift a calendar date by business days (negative counts backward). Sundays never count;
     * Saturdays count only when the third value is true. Federal holidays are not modeled.
     * @param {Array} values [isoDate 'YYYY-MM-DD', days, saturdayCounts]
     * @returns {string} ISO date or '' for invalid input
     */
    addBusinessDays(values = []) {
      const m = String(values[0] ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return '';
      const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      if (Number.isNaN(dt.getTime())) return '';
      const days = Math.trunc(toNumber(values[1]));
      const saturdayCounts = values[2] === true || values[2] === 'true';
      const step = days < 0 ? -1 : 1;
      let left = Math.abs(days);
      while (left > 0) {
        dt.setUTCDate(dt.getUTCDate() + step);
        const dow = dt.getUTCDay();
        if (dow === 0 || (dow === 6 && !saturdayCounts)) continue;
        left -= 1;
      }
      return dt.toISOString().slice(0, 10);
    },

    /**
     * Unit Test COMPARE: parse Encompass-style date strings to UTC midnight ms (calendar day).
     * @param {*} value
     * @returns {number|null}
     */
    parseUnitTestDateMs(value) {
      if (value === null || value === undefined) return null;
      const raw = String(value).trim();
      if (!raw) return null;
      const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (slash) {
        const m = Number(slash[1]);
        const d = Number(slash[2]);
        const y = Number(slash[3]);
        const dt = new Date(y, m - 1, d);
        return Number.isNaN(dt.getTime()) ? null : dt.setHours(0, 0, 0, 0);
      }
      const isoDay = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoDay) {
        const dt = new Date(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]));
        return Number.isNaN(dt.getTime()) ? null : dt.setHours(0, 0, 0, 0);
      }
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return null;
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
    },

    /**
     * Unit Test COMPARE: numeric tolerance (default 2-decimal money-style).
     * @param {*} actual
     * @param {*} expected
     * @param {{ epsilon?: number }} [opts]
     */
    approxEqual(actual, expected, opts = {}) {
      const epsilon = opts.epsilon ?? 0.005;
      const a = toNumber(actual, null, { invalidValue: NaN });
      const b = toNumber(expected, null, { invalidValue: NaN });
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return Math.abs(a - b) <= epsilon;
    },

    /**
     * Nearest-cent conversion (half-up via Math.round). Integer cents are the
     * exact money representation — GPU f32 dollar floats are not.
     * @param {*} value dollars
     * @returns {number} integer cents
     */
    dollarsToCents,

    /**
     * @param {*} cents integer cents
     * @returns {number} dollars (binary64 of n/100; exact for integer cents)
     */
    centsToDollars,

    /**
     * Floor to whole-dollar cents (matches minRoundDown / roundDown on dollars).
     * @param {number} cents
     */
    floorToDollarCents,

    /**
     * round_half_up(a * b / denom) for nonnegative ints without i32 overflow.
     * Splits a = q*denom + r so (q*b) and (r*b) stay in range for FHA-scale cents.
     */
    roundHalfUpMulDiv,

    /**
     * f32 stand-in for multiplyPercentage (WebGPU default float). Heuristic only.
     */
    multiplyPercentageF32(values = []) {
      const base = Math.fround(toNumber(values[0]));
      const pct = Math.fround(toNumber(values[1]));
      const prod = Math.fround(Math.fround(base * pct) / Math.fround(100));
      const asCents = Math.fround(prod * Math.fround(100));
      return Math.fround(Math.round(asCents) / 100);
    },

    /**
     * Canned G24 × 1.75% where integer cents and f32 rounded cents disagree by 1¢.
     * Not HUD policy — documents why dollar f32 is unsafe at FHA scale.
     */
    FHA_F32_UFMIP_DIVERGENCE: {
      g24Dollars: 300000.27,
      d29: 1.75,
      integerCents: 525000
    },

    /**
     * FHA Streamline loan-amount chain in integer cents (and g33 in ratio hundredths).
     * UFMIP: round_half_up(g24Cents * pctBps / 10000) with 1.75% → 175 bps.
     * Not HUD-certified; matches the DAG in createFHACalculatorConfig.
     * @param {{ g7?:*, g8?:*, g9?:*, g12?:*, g13?:*, g14?:*, d29?:* }} input dollars
     */
    fhaLoanAmountIntegerCents(input = {}) {
      const g7 = dollarsToCents(input.g7);
      const g8 = dollarsToCents(input.g8);
      const g9 = dollarsToCents(input.g9);
      const g12 = dollarsToCents(input.g12);
      const g13 = dollarsToCents(input.g13);
      const g14 = dollarsToCents(input.g14);
      const pctBps = dollarsToCents(input.d29);
      const g15 = g12 + g13 + g14;
      const g18 = g15;
      const g19 = g9;
      const g20 = g18 - g19;
      const g22 = g8;
      const g24 = floorToDollarCents(Math.min(g20, g22));
      const g28 = g24;
      const e29 = roundHalfUpMulDiv(g24, pctBps, 10000);
      const g29 = floorToDollarCents(e29);
      const g30 = g28 + g29;
      const g33Hundredths = g7 === 0 ? 0 : roundHalfUpMulDiv(g24, 100, g7);
      return {
        g7,
        g8,
        g9,
        g12,
        g13,
        g14,
        pctBps,
        g15,
        g18,
        g19,
        g20,
        g22,
        g24,
        g28,
        e29,
        g29,
        g30,
        g33Hundredths
      };
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = calcMath;
  } else {
    global.calcMath = calcMath;
  }
})(typeof window !== 'undefined' ? window : globalThis);

