/**
 * Calculations Engine - Reusable Calculator Framework
 * 
 * @fileoverview A flexible, decoupled calculation engine for financial calculators.
 *              All calculation methods work with values rather than DOM elements,
 *              making them testable and reusable across different contexts.
 * 
 * @author David Lane
 * @version 2.0.0
 * @since 2024
 * 
 * @description
 * This class provides a reactive calculation framework where input fields automatically
 * trigger calculations when values change. Calculations are debounced for performance
 * and support additional data sources through the additionalInputIds configuration.
 * 
 * Key Features:
 * - Decoupled from DOM: calculations receive values, not elements
 * - Reactive updates: automatic recalculation on input changes
 * - Debounced for performance (50ms default)
 * - Supports additional data sources via additionalInputIds
 * - Factory functions available for common calculator types
 * 
 * @example
 * // Basic usage
 * const calc = new calculations({
 *   groups: [
 *     { inputIds: ['field1', 'field2'], resultId: 'result1', calculation: 'sumRounded' }
 *   ]
 * });
 * 
 * @example
 * // Using factory function
 * const calc = new calculations(createDTICalculatorConfig());
 */
class calculations {
  constructor(config) {
    this.groups = config.groups;
    this.inputElements = {};
    this.initializeGroups();
  }

  initializeGroups() {
    this.groups.forEach(group => {
      const inputElements = group.inputIds.map(id => document.getElementById(id));
      const resultElement = document.getElementById(group.resultId);
      
      // Get additional input elements if specified
      const additionalInputElements = {};
      if (group.additionalInputIds) {
        Object.keys(group.additionalInputIds).forEach(key => {
          const element = document.getElementById(group.additionalInputIds[key]);
          if (element) additionalInputElements[key] = element;
        });
      }

      if (!inputElements.every(element => element) || !resultElement) {
        console.error('Invalid group configuration:', group);
        return;
      }

      this.inputElements[group.resultId] = { 
        inputs: inputElements, 
        result: resultElement,
        additionalInputs: additionalInputElements,
        groupConfig: group
      };
      const debouncedUpdate = this.debounce(() => this.updateResult(group.calculation, group.resultId), 50);

      inputElements.forEach(input => {
        input.addEventListener('input', debouncedUpdate);
      });
      
      // Also listen to additional inputs if they exist
      Object.values(additionalInputElements).forEach(input => {
        input.addEventListener('input', debouncedUpdate);
      });
    });
  }

  debounce(func, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }

  getNumericValues(inputs) {
    return inputs.map(input => parseFloat(input.value) || 0);
  }

  extractDateValues(inputs) {
    return inputs.map(input => new Date(input.value));
  }

  updateResult(calculation, resultId) {
    const group = this.inputElements[resultId];
    if (group && typeof this[calculation] === 'function') {
      try {
        // Extract values from input elements
        const numericValues = this.getNumericValues(group.inputs);
        
        // Extract raw values (for strings, dates, etc.)
        const rawValues = group.inputs.map(input => input.value);
        
        // Build values array - prefer numeric where applicable, otherwise use raw
        const values = group.inputs.map((input, idx) => {
          const numVal = numericValues[idx];
          const rawVal = rawValues[idx];
          // Return number if it's a valid number, otherwise return raw value
          return (!isNaN(numVal) && rawVal !== '') ? numVal : rawVal;
        });
        
        // Extract additional data from additionalInputs if they exist
        const additionalData = {};
        if (group.additionalInputs) {
          Object.keys(group.additionalInputs).forEach(key => {
            const element = group.additionalInputs[key];
            const numVal = parseFloat(element.value);
            additionalData[key] = (!isNaN(numVal) && element.value !== '') ? numVal : element.value;
          });
        }
        
        // Pass values and options to calculation method
        const options = {
          result: group.result,
          additionalData: Object.keys(additionalData).length > 0 ? additionalData : undefined,
          rawInputs: group.inputs // Keep reference for methods that need it during transition
        };
        
        this[calculation](values, options);
      } catch (error) {
        console.error('Error during calculation:', calculation, error);
      }
    }
  }

  recalculateAll() {
    this.groups.forEach(group => {
      this.updateResult(group.calculation, group.resultId);
    });
  }

  sumInputs(values, options) {
    if (!values || !options || !options.result) return;
    const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(v) || 0);
    const total = numericValues.reduce((acc, value) => acc + value, 0);
    options.result.value = total;
  }

  subtractInputs(values, options) {
    if (!values || !options || !options.result) return;
    const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(v) || 0);
    const total = numericValues.reduce((acc, value) => acc - value);
    options.result.value = total;
  }

  truncateAndSumInputs(values, options) {
    if (!values || !options || !options.result) return;
    const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(v) || 0);
    const truncatedValues = numericValues.map(Math.trunc);
    const total = truncatedValues.reduce((acc, value) => acc + value, 0);
    options.result.value = total;
  }

  minInputs(values, options) {
    if (!values || !options || !options.result) return;
    const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(v) || 0);
    const min = Math.min(...numericValues);
    options.result.value = isFinite(min) ? min : '';
  }

  maxUFMPamount(values, options) {
    if (!values || !options || !options.result) return;
    const inputValue1 = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    const inputValue2 = typeof values[1] === 'number' ? values[1] : parseFloat(values[1]) || 0;
    const adjustedValue1 = inputValue1 - Math.round(inputValue1 * inputValue2 / (1 + inputValue2) * 100) / 100;
    options.result.value = Math.trunc(adjustedValue1) * inputValue2;
  }

  newUfmipFactor(values, options) {
    if (!values || !options || !options.result) return;

    // Define the date to compare against (May 31, 2009)
    const comparisonDate = new Date('2009-05-31');

    // Get the input date value (can be string or Date object)
    const inputDateValue = values[0];

    // Check if the input date is empty or invalid
    if (!inputDateValue || isNaN(Date.parse(inputDateValue))) {
        options.result.value = 0;
        return;
    }

    // Convert the input date to a Date object
    const inputDateObj = new Date(inputDateValue);

    // Check if the input date is before or after the comparison date
    const isBeforeComparisonDate = inputDateObj < comparisonDate;

    // Set the result based on the date comparison
    options.result.value = isBeforeComparisonDate ? .0100 : .0175;
  }

  // FHA Streamline Loan Amount Calculator functions
  sumRounded(values, options) {
    if (!values || !options || !options.result) return;
    const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(v) || 0);
    const total = numericValues.reduce((acc, value) => acc + value, 0);
    options.result.value = Math.round(total * 100) / 100;
  }

  subtractRounded(values, options) {
    if (!values || !options || !options.result) return;
    const val1 = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    const val2 = typeof values[1] === 'number' ? values[1] : parseFloat(values[1]) || 0;
    const total = val1 - val2;
    options.result.value = Math.round(total * 100) / 100;
  }

  copyValue(values, options) {
    if (!values || !options || !options.result) return;
    const value = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    options.result.value = Math.round(value * 100) / 100;
  }

  minRoundDown(values, options) {
    if (!values || !options || !options.result) return;
    const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(v) || 0);
    const min = Math.min(...numericValues);
    options.result.value = Math.floor(min); // ROUNDDOWN = Math.floor
  }

  multiplyPercentage(values, options) {
    if (!values || !options || !options.result) return;
    const base = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    const percent = typeof values[1] === 'number' ? values[1] : parseFloat(values[1]) || 0;
    const resultValue = base * (percent / 100); // Convert percentage to decimal
    options.result.value = Math.round(resultValue * 100) / 100;
  }

  roundDown(values, options) {
    if (!values || !options || !options.result) return;
    const value = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    options.result.value = Math.floor(value); // ROUNDDOWN = Math.floor
  }

  divideRounded(values, options) {
    if (!values || !options || !options.result) return;
    const val1 = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    const val2 = typeof values[1] === 'number' ? values[1] : parseFloat(values[1]) || 0;
    if (val2 === 0) {
      options.result.value = '';
      return;
    }
    const quotient = val1 / val2;
    options.result.value = Math.round(quotient * 100) / 100;
  }

  // DTI Calculator functions
  annualToMonthly(values, options) {
    if (!values || !options || !options.result) return;
    const annual = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    const monthly = annual / 12;
    options.result.value = Math.round(monthly * 100) / 100;
  }

  calculateDTI(values, options) {
    if (!values || !options || !options.result) return;
    const payment = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    let income = typeof values[1] === 'number' ? values[1] : parseFloat(values[1]) || 0;
    
    // Check for additional income from additionalData (e.g., manually entered gross monthly)
    if (options.additionalData && options.additionalData.grossMonthly) {
      const grossMonthly = typeof options.additionalData.grossMonthly === 'number' 
        ? options.additionalData.grossMonthly 
        : parseFloat(options.additionalData.grossMonthly) || 0;
      if (grossMonthly > 0) {
        income = grossMonthly;
      }
    }
    
    if (income === 0) {
      options.result.value = '';
      return;
    }
    const dti = (payment / income) * 100;
    options.result.value = Math.round(dti * 100) / 100; // Round to 2 decimals
  }

  calculateMinIncome(values, options) {
    if (!values || !options || !options.result) return;
    const totalPayment = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    // Minimum income needed for 43% Back-End DTI (FHA standard)
    const minIncome = totalPayment / 0.43;
    options.result.value = Math.round(minIncome * 100) / 100;
  }

  // Asset Qualifier Calculator functions
  multiplyRounded(values, options) {
    if (!values || !options || !options.result) return;
    const a = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    const b = typeof values[1] === 'number' ? values[1] : parseFloat(values[1]) || 0;
    const prod = a * b;
    options.result.value = Math.round((prod + Number.EPSILON) * 100) / 100;
  }

  ageBasedRetFactor(values, options) {
    if (!values || !options || !options.result) return;
    const dobValue = values[0];
    const dob = dobValue ? new Date(dobValue) : null;
    if (!dob || isNaN(dob.getTime())) { 
      options.result.value = 0.7; 
      return; 
    }
    const today = new Date();
    const ageYears = (today - dob) / (365.25 * 24 * 60 * 60 * 1000);
    options.result.value = ageYears > 56.9 ? 1.0 : 0.7;
  }

  minAssetsPass(values, options) {
    if (!values || !options || !options.result) return;
    // Inputs: liquid_assets, other_assets, retirement_assets, required_reserves
    const liquid = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    const other = typeof values[1] === 'number' ? values[1] : parseFloat(values[1]) || 0;
    const retirement = typeof values[2] === 'number' ? values[2] : parseFloat(values[2]) || 0;
    const required = typeof values[3] === 'number' ? values[3] : parseFloat(values[3]) || 0;
    const threshold = 500000;
    const pass = (liquid + other + retirement) - required >= threshold;
    options.result.value = pass ? 'PASS' : 'FAIL';
  }

  supportablePaymentRounded(values, options) {
    if (!values || !options || !options.result) return;
    const netAssets = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    const factor = (0.0025 * 1.233354) / (1.233354 - 1);
    const val = netAssets * factor;
    options.result.value = Math.round((val + Number.EPSILON) * 100) / 100;
  }

  messagesC31C32(values, options) {
    if (!values || !options || !options.result) return;
    const nonBorrower = (String(values[0] || '')).trim();
    const hist12mo = (String(values[1] || '')).trim();
    const liquid = typeof values[2] === 'number' ? values[2] : parseFloat(values[2]) || 0;
    const other = typeof values[3] === 'number' ? values[3] : parseFloat(values[3]) || 0;
    const retirement = typeof values[4] === 'number' ? values[4] : parseFloat(values[4]) || 0;
    const msgs = [];
    // C31 logic
    if (!nonBorrower) {
      msgs.push('Confirmation Required');
    } else if (nonBorrower === 'Yes') {
      msgs.push('Guidelines do not accept assets from non-borrowers');
    } else if ((liquid + other + retirement) < 500000) {
      msgs.push('A minimum of $500,000 is required');
    }
    // C32 logic
    if (!hist12mo) {
      msgs.push('Missing data entry: 12-month account history required');
    } else if (hist12mo === 'No') {
      msgs.push('Most recent 12-month account history is required');
    }
    options.result.value = msgs.join(' | ') || '';
  }
}

// ============================================================================
// Factory Functions for Calculator Configurations
// ============================================================================
// @author David Lane
// These factory functions generate standardized calculator configurations
// for common financial calculator types. They support customization through
// prefix options and custom field ID mappings for integration with external
// systems like Encompass.
// ============================================================================

/**
 * Creates a configuration for a DTI (Debt-to-Income) Calculator
 * 
 * @author David Lane
 * @description Generates a complete DTI calculator configuration with all
 *              required calculation groups for front-end and back-end DTI ratios.
 *              Supports both annual and manual monthly income entry.
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.prefix - ID prefix for all fields (default: 'dti')
 * @param {Object} options.customIds - Override specific field IDs (useful for Encompass field mapping)
 * @returns {Object} Calculator configuration object with groups array
 * 
 * @example
 * // Default usage
 * const config = createDTICalculatorConfig();
 * 
 * @example
 * // Custom prefix
 * const config = createDTICalculatorConfig({ prefix: 'mydti' });
 * 
 * @example
 * // Encompass field mapping
 * const config = createDTICalculatorConfig({
 *   customIds: {
 *     annualIncome: 'field_4002',
 *     grossMonthly: 'field_131'
 *   }
 * });
 */
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
      // Calculate monthly income (from annual if provided)
      { 
        inputIds: [ids.annualIncome], 
        resultId: ids.monthlyIncomeCalc, 
        calculation: 'annualToMonthly' 
      },
      // Total housing costs
      { 
        inputIds: [ids.principalInterest, ids.propertyTaxes, ids.hazardInsurance, ids.mortgageInsurance, ids.hoa], 
        resultId: ids.totalHousing, 
        calculation: 'sumRounded' 
      },
      // Front-end DTI (with additional gross monthly income if manually entered)
      { 
        inputIds: [ids.totalHousing, ids.monthlyIncomeCalc], 
        resultId: ids.frontEnd, 
        calculation: 'calculateDTI',
        additionalInputIds: { grossMonthly: ids.grossMonthly }
      },
      // Total monthly debts
      { 
        inputIds: [ids.autoLoan, ids.creditCards, ids.studentLoans, ids.personalLoans, ids.otherDebts], 
        resultId: ids.totalDebts, 
        calculation: 'sumRounded' 
      },
      // Total monthly payment
      { 
        inputIds: [ids.totalHousing, ids.totalDebts], 
        resultId: ids.totalMonthlyPayment, 
        calculation: 'sumRounded' 
      },
      // Back-end DTI (with additional gross monthly income if manually entered)
      { 
        inputIds: [ids.totalMonthlyPayment, ids.monthlyIncomeCalc], 
        resultId: ids.backEnd, 
        calculation: 'calculateDTI',
        additionalInputIds: { grossMonthly: ids.grossMonthly }
      },
      // Minimum income needed (for 43% DTI)
      { 
        inputIds: [ids.totalMonthlyPayment], 
        resultId: ids.minIncomeNeeded, 
        calculation: 'calculateMinIncome' 
      }
    ]
  };
}

/**
 * Creates a configuration for an FHA Streamline Loan Amount Calculator
 * 
 * @author David Lane
 * @description Generates configuration for FHA Streamline refinance loan amount
 *              calculations. Implements the standard FHA Streamline worksheet logic
 *              including UFMIP calculations and loan-to-value ratios.
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.prefix - ID prefix for all fields (default: 'fs')
 * @param {Object} options.customIds - Override specific field IDs
 * @returns {Object} Calculator configuration object with groups array
 * 
 * @example
 * const config = createFHACalculatorConfig();
 */
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
      // G15 = SUM(G12:G14)
      { inputIds: [ids.g12, ids.g13, ids.g14], resultId: ids.g15, calculation: 'sumRounded' },
      // G18 = G15
      { inputIds: [ids.g15], resultId: ids.g18, calculation: 'copyValue' },
      // G19 = G9
      { inputIds: [ids.g9], resultId: ids.g19, calculation: 'copyValue' },
      // G20 = G18 - G19
      { inputIds: [ids.g18, ids.g19], resultId: ids.g20, calculation: 'subtractRounded' },
      // G22 = G8
      { inputIds: [ids.g8], resultId: ids.g22, calculation: 'copyValue' },
      // G24 = ROUNDDOWN(MIN(G20,G22),0)
      { inputIds: [ids.g20, ids.g22], resultId: ids.g24, calculation: 'minRoundDown' },
      // G28 = G24
      { inputIds: [ids.g24], resultId: ids.g28, calculation: 'copyValue' },
      // E29 = G24 * D29 (convert D29 from percentage to decimal)
      { inputIds: [ids.g24, ids.d29], resultId: ids.e29, calculation: 'multiplyPercentage' },
      // G29 = ROUNDDOWN(E29,0)
      { inputIds: [ids.e29], resultId: ids.g29, calculation: 'roundDown' },
      // G30 = SUM(G28:G29)
      { inputIds: [ids.g28, ids.g29], resultId: ids.g30, calculation: 'sumRounded' },
      // G33 = G24 / G7
      { inputIds: [ids.g24, ids.g7], resultId: ids.g33, calculation: 'divideRounded' }
    ]
  };
}

/**
 * Creates a configuration for an Asset Qualifier Calculator
 * 
 * @author David Lane
 * @description Generates configuration for asset-based qualification calculations.
 *              Handles liquid assets, retirement assets with age-based factors,
 *              required reserves, and supportable payment calculations. Includes
 *              validation messages for non-borrower assets and account history.
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.prefix - ID prefix for all fields (default: 'aq')
 * @param {Object} options.customIds - Override specific field IDs
 * @returns {Object} Calculator configuration object with groups array
 * 
 * @example
 * const config = createAssetQualifierConfig();
 */
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
      // H15 = G15*F15 (rounded)
      { inputIds: [ids.cat1Factor, ids.liquidAssets], resultId: ids.cat1Eligible, calculation: 'multiplyRounded' },
      // H16 = G16*F16 (rounded)
      { inputIds: [ids.cat2Factor, ids.otherAssets], resultId: ids.cat2Eligible, calculation: 'multiplyRounded' },
      // G17 depends on DOB; computed by ageBasedRetFactor, then H17 = F17*G17
      { inputIds: [ids.dob], resultId: ids.retFactor, calculation: 'ageBasedRetFactor' },
      { inputIds: [ids.retirementAssets, ids.retFactor], resultId: ids.retEligible, calculation: 'multiplyRounded' },
      // H19 = SUM(H15:H17) (rounded)
      { inputIds: [ids.cat1Eligible, ids.cat2Eligible, ids.retEligible], resultId: ids.totalEligibleAssets, calculation: 'sumRounded' },
      // F21 = months * payment (rounded)
      { inputIds: [ids.reserveMonths, ids.monthlyPayment], resultId: ids.requiredReserves, calculation: 'multiplyRounded' },
      // H22 = PASS/FAIL minimum assets test
      { inputIds: [ids.liquidAssets, ids.otherAssets, ids.retirementAssets, ids.requiredReserves], resultId: ids.minAssetsResult, calculation: 'minAssetsPass' },
      // H24 = H19 - F21 (rounded)
      { inputIds: [ids.totalEligibleAssets, ids.requiredReserves], resultId: ids.netEligibleAssets, calculation: 'subtractRounded' },
      // H28 = H24*((0.0025*1.233354)/(1.233354-1)) (rounded)
      { inputIds: [ids.netEligibleAssets], resultId: ids.supportablePayment, calculation: 'supportablePaymentRounded' },
      // C31/C32 messages
      { inputIds: [ids.nonBorrowerAssets, ids.hist12mo, ids.liquidAssets, ids.otherAssets, ids.retirementAssets], resultId: ids.messages, calculation: 'messagesC31C32' }
    ]
  };
}


