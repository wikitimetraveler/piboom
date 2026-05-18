// calculations.js
// ============================================================================
// Calculations Engine - Reusable Calculator Framework (DAG-lite enabled)
// ============================================================================
// @author David Lane
// @version 2.0.0
// ============================================================================

// Fallback to global calcMath if available; otherwise use empty object (caller can inject).
const __calcMath = (typeof calcMath !== 'undefined') ? calcMath : {};

class CalculationsEngine {
  constructor(
    config,
    {
      debounceMs = 50,
      math = __calcMath,
      strictNumericParsing = false,

      // DAG-lite knobs
      enableDagLite = true,
      maxCascadeDepth = 25,

      // Host-compat knobs (Encompass / embedded browsers can be quirky)
      listenToChange = true,      // add 'change' listeners alongside 'input'
      enableReentryGuard = true   // prevent root calls while cascading
    } = {}
  ) {
    this.groups = config?.groups || [];
    this.inputElements = {}; // keyed by resultId
    this.debounceMs = debounceMs;
    this.math = math || (typeof window !== 'undefined' ? window.calcMath : {});
    this.strictNumericParsing = strictNumericParsing;

    // DAG-lite state
    this.enableDagLite = enableDagLite;
    this.maxCascadeDepth = maxCascadeDepth;
    this.dependentsByInputId = new Map(); // inputId -> Set(resultId)

    // Host safety
    this.listenToChange = listenToChange;
    this.enableReentryGuard = enableReentryGuard;
    this._isComputing = false;

    this.initializeGroups();
  }

  initializeGroups() {
    this.groups.forEach(group => {
      const inputElements = (group.inputIds || []).map(id => document.getElementById(id));
      const resultElement = document.getElementById(group.resultId);

      // Additional inputs
      const additionalInputElements = {};
      if (group.additionalInputIds) {
        Object.keys(group.additionalInputIds).forEach(key => {
          const element = document.getElementById(group.additionalInputIds[key]);
          if (element) additionalInputElements[key] = element;
        });
      }

      if (!inputElements.length || !inputElements.every(Boolean) || !resultElement) {
        console.error('Invalid group configuration:', group);
        return;
      }

      this.inputElements[group.resultId] = {
        inputs: inputElements,
        result: resultElement,
        additionalInputs: additionalInputElements,
        groupConfig: group
      };

      // DAG-lite: build reverse dependency index (inputId -> resultId)
      if (this.enableDagLite) {
        const allInputIds = [
          ...(group.inputIds || []),
          ...(group.additionalInputIds ? Object.values(group.additionalInputIds) : [])
        ];
        allInputIds.forEach(inputId => this._addDependent(inputId, group.resultId));
      }

      const debouncedUpdate = this.debounce(
        () => this.updateResult(group.calculation, group.resultId),
        this.debounceMs
      );

      // listeners for primary inputs
      inputElements.forEach(input => {
        input.addEventListener('input', debouncedUpdate);
        if (this.listenToChange) input.addEventListener('change', debouncedUpdate);
      });

      // listeners for additional inputs
      Object.values(additionalInputElements).forEach(input => {
        input.addEventListener('input', debouncedUpdate);
        if (this.listenToChange) input.addEventListener('change', debouncedUpdate);
      });
    });
  }

  _addDependent(inputId, resultId) {
    if (!inputId) return;
    if (!this.dependentsByInputId.has(inputId)) {
      this.dependentsByInputId.set(inputId, new Set());
    }
    this.dependentsByInputId.get(inputId).add(resultId);
  }

  debounce(func, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func(...args), delay);
    };
  }

  updateResult(calculation, resultId, _cascade = null) {
    const isRootCall = !_cascade;
    if (isRootCall && this.enableReentryGuard && this._isComputing) return;

    const group = this.inputElements[resultId];
    if (!group) return;

    const cascade = _cascade || {
      depth: 0,
      path: new Set()
    };

    // loop guards
    if (cascade.depth > this.maxCascadeDepth) {
      console.warn('DAG-lite: max cascade depth reached', { resultId, cascade });
      return;
    }
    // Detect cycles only within the current recursion path.
    // A node may be legitimately revisited from a different sibling branch.
    if (cascade.path.has(resultId)) return;
    const currentPath = new Set(cascade.path);
    currentPath.add(resultId);

    if (isRootCall) this._isComputing = true;

    try {
      // Late-bind math from global if not provided or missing
      if ((!this.math || !Object.keys(this.math).length) && typeof window !== 'undefined' && window.calcMath) {
        this.math = window.calcMath;
      }

      let fn = this.math && this.math[calculation];
      if (typeof fn !== 'function' && typeof window !== 'undefined' && window.calcMath) {
        this.math = window.calcMath;
        fn = this.math[calculation];
      }
      if (typeof fn !== 'function') {
        console.error('Unknown calculation:', calculation, { calculation, group });
        return;
      }

      // Gather raw values (math layer coerces)
      const values = group.inputs.map(input => input.value);

      const additionalData = {};
      if (group.additionalInputs) {
        Object.keys(group.additionalInputs).forEach(key => {
          additionalData[key] = group.additionalInputs[key].value;
        });
      }

      const ctx = {
        additionalData: Object.keys(additionalData).length ? additionalData : undefined,
        meta: {
          ...(group.groupConfig?.meta || {}),
          strictNumericParsing: this.strictNumericParsing
        }
      };

      const computed = fn(values, ctx);

      const invalid =
        computed === null ||
        computed === undefined ||
        (typeof computed === 'number' && !Number.isFinite(computed));

      const nextValue = invalid ? '' : String(computed);
      const prevValue = String(group.result.value ?? '');

      if (prevValue !== nextValue) {
        group.result.value = nextValue;

        // DAG-lite propagation
        if (this.enableDagLite) {
          this._propagateFromField(group.result, {
            depth: cascade.depth,
            path: currentPath
          });
        }
      }
    } catch (error) {
      console.error('Error during calculation:', calculation, error);
    } finally {
      if (isRootCall) this._isComputing = false;
    }
  }

  _propagateFromField(fieldEl, cascade) {
    if (!fieldEl || !fieldEl.id) return;

    const dependents = this.dependentsByInputId.get(fieldEl.id);
    if (!dependents || !dependents.size) return;

    const nextCascade = {
      depth: cascade.depth + 1,
      path: cascade.path
    };

    dependents.forEach(depResultId => {
      const depGroup = this.inputElements[depResultId];
      const depCalc = depGroup?.groupConfig?.calculation;
      if (!depCalc) return;

      this.updateResult(depCalc, depResultId, nextCascade);
    });
  }

  recalculateAll() {
    this.groups.forEach(group => {
      this.updateResult(group.calculation, group.resultId);
    });
  }
}

// ============================================================================
// Factory Functions for Calculator Configurations
// ============================================================================

function createDTICalculatorConfig(options = {}) {
  const prefix = options.prefix || 'dti';
  const ids = {
    annualIncome: options.customIds?.annualIncome || `${prefix}_annual_income`,
    monthlyIncomeCalc: options.customIds?.monthlyIncomeCalc || `${prefix}_monthly_income_calc`,
    grossMonthly: options.customIds?.grossMonthly || `${prefix}_gross_monthly`,
    principalInterest: options.customIds?.principalInterest || `${prefix}_principal_interest`,
    propertyTaxes: options.customIds?.propertyTaxes || `${prefix}_property_taxes`,
    hazardInsurance: options.customIds?.hazardInsurance || `${prefix}_hazard_insurance`,
    mortgageInsurance: options.customIds?.mortgageInsurance || `${prefix}_mortgage_insurance`,
    hoa: options.customIds?.hoa || `${prefix}_hoa`,
    totalHousing: options.customIds?.totalHousing || `${prefix}_total_housing`,
    frontEnd: options.customIds?.frontEnd || `${prefix}_front_end`,
    autoLoan: options.customIds?.autoLoan || `${prefix}_auto_loan`,
    creditCards: options.customIds?.creditCards || `${prefix}_credit_cards`,
    studentLoans: options.customIds?.studentLoans || `${prefix}_student_loans`,
    personalLoans: options.customIds?.personalLoans || `${prefix}_personal_loans`,
    otherDebts: options.customIds?.otherDebts || `${prefix}_other_debts`,
    totalDebts: options.customIds?.totalDebts || `${prefix}_total_debts`,
    totalMonthlyPayment: options.customIds?.totalMonthlyPayment || `${prefix}_total_monthly_payment`,
    backEnd: options.customIds?.backEnd || `${prefix}_back_end`,
    minIncomeNeeded: options.customIds?.minIncomeNeeded || `${prefix}_min_income_needed`
  };

  return {
    groups: [
      { inputIds: [ids.annualIncome], resultId: ids.monthlyIncomeCalc, calculation: 'annualToMonthly' },
      {
        inputIds: [ids.principalInterest, ids.propertyTaxes, ids.hazardInsurance, ids.mortgageInsurance, ids.hoa],
        resultId: ids.totalHousing,
        calculation: 'sumRounded'
      },
      {
        inputIds: [ids.totalHousing, ids.monthlyIncomeCalc],
        resultId: ids.frontEnd,
        calculation: 'calculateDTI',
        additionalInputIds: { grossMonthly: ids.grossMonthly }
      },
      {
        inputIds: [ids.autoLoan, ids.creditCards, ids.studentLoans, ids.personalLoans, ids.otherDebts],
        resultId: ids.totalDebts,
        calculation: 'sumRounded'
      },
      {
        inputIds: [ids.totalHousing, ids.totalDebts],
        resultId: ids.totalMonthlyPayment,
        calculation: 'sumRounded'
      },
      {
        inputIds: [ids.totalMonthlyPayment, ids.monthlyIncomeCalc],
        resultId: ids.backEnd,
        calculation: 'calculateDTI',
        additionalInputIds: { grossMonthly: ids.grossMonthly }
      },
      { inputIds: [ids.totalMonthlyPayment], resultId: ids.minIncomeNeeded, calculation: 'calculateMinIncome' }
    ]
  };
}

function createFHACalculatorConfig(options = {}) {
  const prefix = options.prefix || 'fs';
  const ids = {
    g12: options.customIds?.g12 || `${prefix}_g12`,
    g13: options.customIds?.g13 || `${prefix}_g13`,
    g14: options.customIds?.g14 || `${prefix}_g14`,
    g15: options.customIds?.g15 || `${prefix}_g15`,
    g18: options.customIds?.g18 || `${prefix}_g18`,
    g9: options.customIds?.g9 || `${prefix}_g9`,
    g19: options.customIds?.g19 || `${prefix}_g19`,
    g20: options.customIds?.g20 || `${prefix}_g20`,
    g8: options.customIds?.g8 || `${prefix}_g8`,
    g22: options.customIds?.g22 || `${prefix}_g22`,
    g24: options.customIds?.g24 || `${prefix}_g24`,
    g28: options.customIds?.g28 || `${prefix}_g28`,
    d29: options.customIds?.d29 || `${prefix}_d29`,
    e29: options.customIds?.e29 || `${prefix}_e29`,
    g29: options.customIds?.g29 || `${prefix}_g29`,
    g30: options.customIds?.g30 || `${prefix}_g30`,
    g7: options.customIds?.g7 || `${prefix}_g7`,
    g33: options.customIds?.g33 || `${prefix}_g33`
  };

  return {
    groups: [
      { inputIds: [ids.g12, ids.g13, ids.g14], resultId: ids.g15, calculation: 'sumRounded' },
      { inputIds: [ids.g15], resultId: ids.g18, calculation: 'copyValue' },
      { inputIds: [ids.g9], resultId: ids.g19, calculation: 'copyValue' },
      { inputIds: [ids.g18, ids.g19], resultId: ids.g20, calculation: 'subtractRounded' },
      { inputIds: [ids.g8], resultId: ids.g22, calculation: 'copyValue' },
      { inputIds: [ids.g20, ids.g22], resultId: ids.g24, calculation: 'minRoundDown' },
      { inputIds: [ids.g24], resultId: ids.g28, calculation: 'copyValue' },
      { inputIds: [ids.g24, ids.d29], resultId: ids.e29, calculation: 'multiplyPercentage' },
      { inputIds: [ids.e29], resultId: ids.g29, calculation: 'roundDown' },
      { inputIds: [ids.g28, ids.g29], resultId: ids.g30, calculation: 'sumRounded' },
      { inputIds: [ids.g24, ids.g7], resultId: ids.g33, calculation: 'divideRounded' }
    ]
  };
}

function createAssetQualifierConfig(options = {}) {
  const prefix = options.prefix || 'aq';
  const ids = {
    cat1Factor: options.customIds?.cat1Factor || `${prefix}_cat1_factor`,
    liquidAssets: options.customIds?.liquidAssets || `${prefix}_liquid_assets`,
    cat1Eligible: options.customIds?.cat1Eligible || `${prefix}_cat1_eligible`,
    cat2Factor: options.customIds?.cat2Factor || `${prefix}_cat2_factor`,
    otherAssets: options.customIds?.otherAssets || `${prefix}_other_assets`,
    cat2Eligible: options.customIds?.cat2Eligible || `${prefix}_cat2_eligible`,
    dob: options.customIds?.dob || `${prefix}_dob`,
    retFactor: options.customIds?.retFactor || `${prefix}_ret_factor`,
    retirementAssets: options.customIds?.retirementAssets || `${prefix}_retirement_assets`,
    retEligible: options.customIds?.retEligible || `${prefix}_ret_eligible`,
    totalEligibleAssets: options.customIds?.totalEligibleAssets || `${prefix}_total_eligible_assets`,
    reserveMonths: options.customIds?.reserveMonths || `${prefix}_reserve_months`,
    monthlyPayment: options.customIds?.monthlyPayment || `${prefix}_monthly_payment`,
    requiredReserves: options.customIds?.requiredReserves || `${prefix}_required_reserves`,
    minAssetsResult: options.customIds?.minAssetsResult || `${prefix}_min_assets_result`,
    netEligibleAssets: options.customIds?.netEligibleAssets || `${prefix}_net_eligible_assets`,
    supportablePayment: options.customIds?.supportablePayment || `${prefix}_supportable_payment`,
    nonBorrowerAssets: options.customIds?.nonBorrowerAssets || `${prefix}_non_borrower_assets`,
    hist12mo: options.customIds?.hist12mo || `${prefix}_12mo_history`,
    messages: options.customIds?.messages || `${prefix}_messages`
  };

  return {
    groups: [
      { inputIds: [ids.cat1Factor, ids.liquidAssets], resultId: ids.cat1Eligible, calculation: 'multiplyRounded' },
      { inputIds: [ids.cat2Factor, ids.otherAssets], resultId: ids.cat2Eligible, calculation: 'multiplyRounded' },
      { inputIds: [ids.dob], resultId: ids.retFactor, calculation: 'ageBasedRetFactor' },
      { inputIds: [ids.retirementAssets, ids.retFactor], resultId: ids.retEligible, calculation: 'multiplyRounded' },
      { inputIds: [ids.cat1Eligible, ids.cat2Eligible, ids.retEligible], resultId: ids.totalEligibleAssets, calculation: 'sumRounded' },
      { inputIds: [ids.reserveMonths, ids.monthlyPayment], resultId: ids.requiredReserves, calculation: 'multiplyRounded' },
      { inputIds: [ids.liquidAssets, ids.otherAssets, ids.retirementAssets, ids.requiredReserves], resultId: ids.minAssetsResult, calculation: 'minAssetsPass' },
      { inputIds: [ids.totalEligibleAssets, ids.requiredReserves], resultId: ids.netEligibleAssets, calculation: 'subtractRounded' },
      { inputIds: [ids.netEligibleAssets], resultId: ids.supportablePayment, calculation: 'supportablePaymentRounded' },
      { inputIds: [ids.nonBorrowerAssets, ids.hist12mo, ids.liquidAssets, ids.otherAssets, ids.retirementAssets], resultId: ids.messages, calculation: 'messagesC31C32' }
    ]
  };
}

// Expose globals for browser usage (and Node tests)
const __calcGlobal = typeof window !== 'undefined' ? window : globalThis;
if (__calcGlobal) {
  __calcGlobal.CalculationsEngine = CalculationsEngine;
  __calcGlobal.createDTICalculatorConfig = createDTICalculatorConfig;
  __calcGlobal.createFHACalculatorConfig = createFHACalculatorConfig;
  __calcGlobal.createAssetQualifierConfig = createAssetQualifierConfig;
}
