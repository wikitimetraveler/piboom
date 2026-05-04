// Calculation Engine Library
// ============================================================================
// @author David Lane
// Pure calculation helpers (no DOM). Attaches to global for browser use.
// ============================================================================
(function (global) {
  const toNumber = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

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

    divideRounded(values = []) {
      const a = toNumber(values[0]);
      const b = toNumber(values[1]);
      if (b === 0) return '';
      return round2(a / b);
    },

    annualToMonthly(values = []) {
      const annual = toNumber(values[0]);
      return round2(annual / 12);
    },

    calculateDTI(values = [], ctx) {
      const payment = toNumber(values[0]);
      let income = toNumber(values[1]);
      const gm = ctx?.additionalData?.grossMonthly;
      const grossMonthly = gm !== undefined ? toNumber(gm) : 0;
      if (grossMonthly > 0) income = grossMonthly;
      if (income === 0) return '';
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
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = calcMath;
  } else {
    global.calcMath = calcMath;
  }
})(typeof window !== 'undefined' ? window : globalThis);

