/**
 * Map Encompass field-reader responses to GSE analyzer scenario JSON (no PII in output).
 * Field ID list mirrors services/encompass-hub.service.js PIPELINE_FIELDS (minus BorrowerName)
 * plus purchase price, first-time buyer, and monthly income candidates.
 */
(function (global) {
  'use strict';

  /** @type {string[]} Same order as server pipeline reads; omit BorrowerName for GSE load. */
  const PIPELINE_FIELD_IDS = [
    'Loan.LoanGuid',
    'Loan.LoanNumber',
    'Loan.LoanAmount',
    'Loan.LoanFolder',
    'Loan.LoanPurpose',
    'Loan.LoanType',
    'Loan.LoanProgram',
    'Loan.LoanChannel',
    'Loan.LoanStatus',
    'Loan.BranchName',
    'Loan.Division',
    'Loan.OccupancyStatus',
    'Loan.PropertyType',
    'Loan.NumberOfUnits',
    'Loan.LoanTerm',
    'Loan.LTV',
    'Loan.CLTV',
    'Loan.HousingRatio',
    'Loan.DebtRatio',
    'Loan.TotalDTI',
    'Loan.TotalExpenseRatio',
    'Loan.BackRatio',
    'Loan.TopRatioPercent',
    'Loan.BottomRatioPercent',
    'Loan.FundsRequiredClose',
    'Loan.ReservesRequiredVerified',
    'Loan.TotalFundsVerified',
    'Loan.CashBack',
    'Loan.NetCashBack',
    'Loan.ProposedTotalMonthlyDebt',
    'Loan.ProposedTotalHousingPayment',
    'Loan.ProposedHazardInsurance',
    'Loan.ProposedTaxes',
    'Loan.ProposedMortgageInsurance',
    'Loan.ProposedHoaFees',
    'Loan.ProposedOtherPayment',
    'Loan.FirstPaymentPrincipalAndInterest',
    'Loan.CurrentMilestoneId',
    'Loan.CurrentMilestoneName',
    'Loan.CurrentMilestoneDate',
    'Loan.BorrowerScore',
    'Loan.BorrowerScore2',
    'Loan.BorrowerScore3',
    'Loan.CoBorrowerScore',
    'Loan.CoBorrowerScore2',
    'Loan.CoBorrowerScore3',
    'Loan.LoanOfficerID',
    'Loan.LoanOfficerName',
    'Loan.LoanProcessorID',
    'Loan.LoanProcessorName',
    'Loan.UnderwriterID',
    'Loan.UnderwriterName',
    'Loan.CloserID',
    'Loan.CloserName',
    'Loan.InvestorName',
    'Fields.1172',
    'Fields.4000',
    'Fields.11',
    'Fields.12',
    'Fields.13',
    'Fields.14',
    'Fields.15'
  ];

  /** Extra fields for GSE scenario (LoanContract-aligned names where possible). */
  const GSE_EXTRA_FIELD_IDS = [
    'Loan.PurchasePriceAmount',
    'Loan.FirstTimeHomebuyersIndicator',
    // Monthly gross — try common loan-level aliases; first finite value × 12 becomes annual income.
    'Loan.TotalMonthlyIncome',
    'Loan.TotalBorrowerMonthlyIncome',
    'Loan.BorrowerMonthlyIncome'
  ];

  const GSE_ENCOMPASS_FIELD_IDS = [...PIPELINE_FIELD_IDS, ...GSE_EXTRA_FIELD_IDS];

  function parseNumber(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : NaN;
  }

  function extractFieldValueFromReaderResponse(data, fieldId) {
    if (!data) return null;
    const fid = String(fieldId || '').trim();
    const sameId = (item, key) => {
      const v = item?.[key];
      return v !== undefined && v !== null && String(v).trim() === fid;
    };
    const getValue = (item) => {
      if (item == null) return null;
      const v =
        item.value ??
        item.Value ??
        item.fieldValue ??
        item.field_value ??
        item.stringValue ??
        item.StringValue;
      if (v !== undefined && v !== null) return v;
      const arr = item.values ?? item.Values;
      if (Array.isArray(arr) && arr.length) return arr[0];
      return null;
    };

    if (Array.isArray(data)) {
      const match =
        data.find(
          (item) =>
            typeof item === 'object' && (sameId(item, 'id') || sameId(item, 'fieldId') || sameId(item, 'FieldId'))
        ) || (data.length === 1 && typeof data[0] === 'object' ? data[0] : null);
      if (match) return getValue(match);
      if (data.length === 1 && (typeof data[0] === 'string' || typeof data[0] === 'number')) return data[0];
      return null;
    }
    if (typeof data === 'object') {
      const arr = data.fields ?? data.items ?? data.data ?? data.results;
      if (Array.isArray(arr)) return extractFieldValueFromReaderResponse(arr, fieldId);
      const direct = data[fid] ?? data[fid?.toUpperCase?.()] ?? data[fid?.toLowerCase?.()];
      if (direct !== undefined && direct !== null) {
        return typeof direct === 'object' ? (direct.value ?? direct.Value ?? direct) : direct;
      }
      return null;
    }
    return null;
  }

  /**
   * @param {unknown} readerJson
   * @returns {Map<string, unknown>}
   */
  function buildFieldValueMapFromReader(readerJson) {
    const map = new Map();
    for (const id of GSE_ENCOMPASS_FIELD_IDS) {
      const v = extractFieldValueFromReaderResponse(readerJson, id);
      map.set(id, v);
    }
    return map;
  }

  function normStr(s) {
    return String(s ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function mapOccupancy(raw) {
    const s = normStr(raw);
    if (!s) return { ok: false, raw, error: 'Occupancy is empty.' };
    if (s.includes('second') && s.includes('home')) return { ok: true, value: 'secondHome' };
    if (s.includes('invest') || s === 'investment' || s.includes('non-owner') || s.includes('no o')) {
      return { ok: true, value: 'investment' };
    }
    const primaryHints = ['primary residence', 'primaryresidence', 'owner occupied', 'owner-occupied', 'principal residence'];
    if (primaryHints.some((h) => s.includes(h)) || s === 'primary' || /^primary\s/.test(s)) {
      return { ok: true, value: 'primary' };
    }
    return { ok: false, raw, error: `Unknown occupancy "${raw}".` };
  }

  function mapPurpose(raw) {
    const s = normStr(raw);
    if (!s) return { ok: false, raw, error: 'Loan purpose is empty.' };
    if (s.includes('purchase') || s === 'p') return { ok: true, value: 'purchase' };
    if (s.includes('nocash') || s.includes('no cash') || s.includes('rate') || s.includes('term')) {
      return { ok: true, value: 'rateTermRefi' };
    }
    if (s.includes('cash') && s.includes('out')) return { ok: true, value: 'cashOutRefi' };
    if (s.includes('refinance') || s === 'refi') return { ok: true, value: 'rateTermRefi' };
    return { ok: false, raw, error: `Unknown loan purpose "${raw}".` };
  }

  function mapPropertyType(raw, units) {
    const s = normStr(raw);
    const u = Math.min(4, Math.max(1, parseInt(String(units), 10) || 1));
    if (u >= 2) {
      if (u === 2) return { ok: true, value: '2unit' };
      if (u === 3) return { ok: true, value: '3unit' };
      return { ok: true, value: '4unit' };
    }
    if (!s) return { ok: false, raw, error: 'Property type is empty.' };
    if (s.includes('single') || s.includes('detached') || s.includes('sfr') || s.includes('attached')) {
      return { ok: true, value: 'singleFamily' };
    }
    if (s.includes('condo') || s.includes('high rise') || s.includes('condominium')) {
      return { ok: true, value: 'condo' };
    }
    if (s.includes('pud') || s.includes('planned unit')) return { ok: true, value: 'pud' };
    if (s.includes('2') && s.includes('unit')) return { ok: true, value: '2unit' };
    if (s.includes('3') && s.includes('unit')) return { ok: true, value: '3unit' };
    if (s.includes('4') && s.includes('unit')) return { ok: true, value: '4unit' };
    if (s.includes('duplex')) return { ok: true, value: '2unit' };
    if (s.includes('triplex')) return { ok: true, value: '3unit' };
    if (s.includes('fourplex') || s.includes('4-plex')) return { ok: true, value: '4unit' };
    return { ok: false, raw, error: `Unknown property type "${raw}".` };
  }

  function parseFirstTimeHomebuyer(raw) {
    if (raw === true) return true;
    if (raw === false) return false;
    const s = normStr(raw);
    if (s === 'y' || s === 'yes' || s === 'true' || s === '1') return true;
    if (s === 'n' || s === 'no' || s === 'false' || s === '0' || s === '') return false;
    return false;
  }

  function pickCreditScore(map) {
    for (const k of ['Loan.BorrowerScore', 'Loan.BorrowerScore2', 'Loan.BorrowerScore3']) {
      const n = parseNumber(map.get(k));
      if (Number.isFinite(n) && n > 300 && n <= 850) return n;
    }
    return NaN;
  }

  function pickMonthlyIncome(map) {
    for (const k of ['Loan.TotalMonthlyIncome', 'Loan.TotalBorrowerMonthlyIncome', 'Loan.BorrowerMonthlyIncome']) {
      const n = parseNumber(map.get(k));
      if (Number.isFinite(n) && n > 0) return { monthly: n, fieldId: k };
    }
    return { monthly: NaN, fieldId: null };
  }

  function pickDti(map) {
    const keys = ['Loan.TotalDTI', 'Loan.DebtRatio', 'Loan.BottomRatioPercent', 'Loan.TotalExpenseRatio'];
    for (const k of keys) {
      const n = parseNumber(map.get(k));
      if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    }
    return NaN;
  }

  /**
   * @param {unknown} readerJson - raw field-reader POST response
   * @returns {{ ok: true, scenario: object, warnings: string[] } | { ok: false, errors: string[] }}
   */
  function mapReaderToScenario(readerJson) {
    const warnings = [];
    const errors = [];
    const map = buildFieldValueMapFromReader(readerJson);

    const creditScore = pickCreditScore(map);
    if (!Number.isFinite(creditScore)) errors.push('Could not read a usable primary credit score (Loan.BorrowerScore*).');

    const fth = parseFirstTimeHomebuyer(map.get('Loan.FirstTimeHomebuyersIndicator'));

    const inc = pickMonthlyIncome(map);
    let incomeAnnual = NaN;
    if (Number.isFinite(inc.monthly)) {
      incomeAnnual = inc.monthly * 12;
    } else {
      errors.push(
        'Could not read gross monthly income from Loan.TotalMonthlyIncome / TotalBorrowerMonthlyIncome / BorrowerMonthlyIncome.'
      );
    }

    const loanAmount = parseNumber(map.get('Loan.LoanAmount'));
    if (!Number.isFinite(loanAmount) || loanAmount <= 0) errors.push('Loan.LoanAmount is missing or invalid.');

    let purchasePrice = parseNumber(map.get('Loan.PurchasePriceAmount'));
    if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
      if (Number.isFinite(loanAmount) && loanAmount > 0) {
        purchasePrice = loanAmount;
        warnings.push('Purchase price missing; using Loan.LoanAmount as purchase price for LTV cross-check.');
      } else {
        errors.push('Loan.PurchasePriceAmount is missing and Loan.LoanAmount is not usable.');
      }
    }

    const ltv = parseNumber(map.get('Loan.LTV'));
    if (!Number.isFinite(ltv) || ltv < 0) errors.push('Loan.LTV is missing or invalid.');
    let cltv = parseNumber(map.get('Loan.CLTV'));
    if (!Number.isFinite(cltv) || cltv < 0) {
      cltv = ltv;
      warnings.push('Loan.CLTV missing; defaulting CLTV to LTV.');
    }

    const stateRaw = map.get('Fields.14');
    const state = String(stateRaw ?? '')
      .trim()
      .toUpperCase();
    if (state.length !== 2) errors.push('Fields.14 (property state) must be a 2-letter US state.');

    const county = String(map.get('Fields.15') ?? '')
      .trim()
      .replace(/\s+County$/i, '');
    if (!county) errors.push('Fields.15 (property county) is required.');

    const unitsRaw = map.get('Loan.NumberOfUnits');
    const units = Math.min(4, Math.max(1, parseInt(String(unitsRaw ?? '1'), 10) || 1));

    const occ = mapOccupancy(map.get('Loan.OccupancyStatus'));
    if (!occ.ok) errors.push(occ.error);

    const purp = mapPurpose(map.get('Loan.LoanPurpose'));
    if (!purp.ok) errors.push(purp.error);

    const prop = mapPropertyType(map.get('Loan.PropertyType'), units);
    if (!prop.ok) errors.push(prop.error);

    const dti = pickDti(map);
    if (!Number.isFinite(dti)) errors.push('Could not read DTI from Loan.TotalDTI / DebtRatio / BottomRatioPercent.');

    warnings.push(
      'Reserves (months) were not read from Encompass; defaulted to 0. Edit before analyzing if material.'
    );
    const reservesMonths = 0;

    if (errors.length) {
      return { ok: false, errors };
    }

    const scenario = {
      borrower: {
        creditScore,
        firstTimeHomebuyer: fth,
        income: incomeAnnual
      },
      loan: {
        loanAmount,
        purchasePrice,
        ltv,
        cltv,
        occupancy: occ.value,
        purpose: purp.value,
        propertyType: prop.value,
        units,
        state,
        county
      },
      risk: {
        dti,
        reservesMonths
      }
    };

    return { ok: true, scenario, warnings };
  }

  const api = {
    GSE_ENCOMPASS_FIELD_IDS,
    extractFieldValueFromReaderResponse,
    buildFieldValueMapFromReader,
    mapReaderToScenario
  };

  globalThis.gseEncompassFieldMap = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
