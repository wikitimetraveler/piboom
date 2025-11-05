/**
 * Encompass Test Loans Library
 * 
 * @fileoverview Comprehensive library of test loan scenarios for mortgage calculators.
 *              Organized by calculator type with Encompass field mappings and expected results.
 * 
 * @author David Lane
 * @version 1.0.0
 * @since 2024
 * 
 * @description
 * This library provides pre-configured test scenarios for:
 * - DTI Calculator
 * - FHA Streamline Loan Amount Calculator
 * - VA IRRRL Calculator
 * - Asset Qualifier Calculator
 * - Cashout Refinance Calculator
 * 
 * Each scenario includes:
 * - Input field values (calculator field IDs)
 * - Encompass field mappings (optional)
 * - Expected results for validation
 * - Scenario metadata (name, description, loan type)
 */

/**
 * Encompass Field ID to Calculator Field ID Mappings
 * Maps Encompass field names to calculator-specific field IDs
 */
const ENCOMPASS_FIELD_MAPPINGS = {
    // DTI Calculator Mappings
    'CX.ANNUAL.INCOME': 'dti_annual_income',
    'CX.GROSS.MONTHLY.INCOME': 'dti_gross_monthly',
    'CX.PI.PAYMENT': 'dti_principal_interest',
    'CX.PROPERTY.TAXES': 'dti_property_taxes',
    'CX.HAZARD.INSURANCE': 'dti_hazard_insurance',
    'CX.MORTGAGE.INSURANCE': 'dti_mortgage_insurance',
    'CX.HOA.FEES': 'dti_hoa',
    'CX.AUTO.LOAN': 'dti_auto_loan',
    'CX.CREDIT.CARDS': 'dti_credit_cards',
    'CX.STUDENT.LOANS': 'dti_student_loans',
    'CX.PERSONAL.LOANS': 'dti_personal_loans',
    'CX.OTHER.DEBTS': 'dti_other_debts',

    // FHA Streamline Mappings
    'CX.FHA.SL.PRINCIPAL.BALANCE': 'fs_g9',
    'CX.FHA.SL.INTEREST.DUE': 'fs_g12',
    'CX.FHA.SL.ESCROW': 'fs_g13',
    'CX.FHA.SL.MIP.DUE.EXST': 'fs_g14',
    'CX.FHA.SL.BASE.AMOUNT': 'fs_g7',
    'CX.FHA.SL.MAX.LOAN.AMOUNT': 'fs_g8',
    'CX.FHA.SL.CASE.ASSIGN.DATE': 'fs_d29',
    'CX.FHA.SL.UFMIP.FACTOR': 'fs_d29',

    // VA IRRRL Mappings
    'CX.VA.IRRRL.CURRENT.BALANCE': 'irrrl_current_balance',
    'CX.VA.IRRRL.CURRENT.RATE': 'irrrl_current_rate',
    'CX.VA.IRRRL.CURRENT.PAYMENT': 'irrrl_current_payment',
    'CX.VA.IRRRL.NEW.RATE': 'irrrl_new_rate',
    'CX.VA.IRRRL.NEW.TERM': 'irrrl_new_term',
    'CX.VA.IRRRL.FUNDING.FEE.RATE': 'irrrl_funding_fee_rate',
    'CX.VA.IRRRL.CLOSING.COSTS': 'irrrl_closing_costs',
    'CX.VA.IRRRL.WAIVE.FUNDING.FEE': 'irrrl_waive_funding_fee',

    // Asset Qualifier Mappings
    'CX.BORROWER.DOB': 'aq_dob',
    'CX.LIQUID.ASSETS': 'aq_liquid_assets',
    'CX.OTHER.ASSETS': 'aq_other_assets',
    'CX.RETIREMENT.ASSETS': 'aq_retirement_assets',
    'CX.RESERVE.MONTHS': 'aq_reserve_months',
    'CX.MONTHLY.PAYMENT': 'aq_monthly_payment',
    'CX.NON.BORROWER.ASSETS': 'aq_non_borrower_assets',
    'CX.12MO.HISTORY': 'aq_12mo_history',

    // Cashout Refinance Mappings
    'CX.CASHOUT.CURRENT.BALANCE': 'cashout_current_balance',
    'CX.CASHOUT.PROPERTY.VALUE': 'cashout_property_value',
    'CX.CASHOUT.NEW.LOAN.AMOUNT': 'cashout_new_loan_amount',
    'CX.CASHOUT.CLOSING.COSTS': 'cashout_closing_costs',
    'CX.CASHOUT.CURRENT.RATE': 'cashout_current_rate',
    'CX.CASHOUT.NEW.RATE': 'cashout_new_rate',
    'CX.CASHOUT.LOAN.TERM': 'cashout_loan_term'
};

/**
 * DTI Calculator Test Scenarios
 */
const DTI_SCENARIOS = [
    {
        name: 'DTI Standard Scenario - Qualified',
        calculator: 'dti',
        description: 'Standard DTI scenario with borrower who qualifies (DTI under 43%)',
        loanType: 'Conventional',
        inputs: {
            'dti_annual_income': 75000,
            'dti_principal_interest': 1200,
            'dti_property_taxes': 300,
            'dti_hazard_insurance': 150,
            'dti_mortgage_insurance': 100,
            'dti_hoa': 50,
            'dti_auto_loan': 400,
            'dti_credit_cards': 150,
            'dti_student_loans': 200,
            'dti_personal_loans': 0,
            'dti_other_debts': 0
        },
        encompassFields: {
            'CX.ANNUAL.INCOME': 75000,
            'CX.PI.PAYMENT': 1200,
            'CX.PROPERTY.TAXES': 300,
            'CX.HAZARD.INSURANCE': 150,
            'CX.MORTGAGE.INSURANCE': 100,
            'CX.HOA.FEES': 50,
            'CX.AUTO.LOAN': 400,
            'CX.CREDIT.CARDS': 150,
            'CX.STUDENT.LOANS': 200
        },
        expectedResults: {
            'dti_monthly_income_calc': 6250.00,
            'dti_total_housing': 1800.00,
            'dti_total_debts': 750.00,
            'dti_total_monthly_payment': 2550.00,
            'dti_front_end': 28.80,
            'dti_back_end': 40.80,
            'dti_min_income_needed': 5930.23
        }
    },
    {
        name: 'DTI High DTI Scenario - Marginal',
        calculator: 'dti',
        description: 'High DTI scenario near qualification limit (43-45%)',
        loanType: 'FHA',
        inputs: {
            'dti_annual_income': 60000,
            'dti_principal_interest': 1500,
            'dti_property_taxes': 400,
            'dti_hazard_insurance': 200,
            'dti_mortgage_insurance': 150,
            'dti_hoa': 100,
            'dti_auto_loan': 500,
            'dti_credit_cards': 300,
            'dti_student_loans': 400,
            'dti_personal_loans': 100,
            'dti_other_debts': 0
        },
        expectedResults: {
            'dti_monthly_income_calc': 5000.00,
            'dti_total_housing': 2750.00,
            'dti_total_debts': 1300.00,
            'dti_total_monthly_payment': 4050.00,
            'dti_front_end': 55.00,
            'dti_back_end': 81.00,
            'dti_min_income_needed': 9418.60
        }
    },
    {
        name: 'DTI Low DTI Scenario - Excellent',
        calculator: 'dti',
        description: 'Low DTI scenario with excellent qualifications',
        loanType: 'Conventional',
        inputs: {
            'dti_annual_income': 120000,
            'dti_principal_interest': 1800,
            'dti_property_taxes': 500,
            'dti_hazard_insurance': 200,
            'dti_mortgage_insurance': 0,
            'dti_hoa': 100,
            'dti_auto_loan': 500,
            'dti_credit_cards': 200,
            'dti_student_loans': 300,
            'dti_personal_loans': 0,
            'dti_other_debts': 0
        },
        expectedResults: {
            'dti_monthly_income_calc': 10000.00,
            'dti_total_housing': 2600.00,
            'dti_total_debts': 1000.00,
            'dti_total_monthly_payment': 3600.00,
            'dti_front_end': 26.00,
            'dti_back_end': 36.00,
            'dti_min_income_needed': 8372.09
        }
    }
];

/**
 * FHA Streamline Loan Amount Calculator Test Scenarios
 */
const FHA_STREAMLINE_SCENARIOS = [
    {
        name: 'FHA Streamline Standard Scenario',
        calculator: 'fha-streamline',
        description: 'Standard FHA Streamline refinance with post-2009 UFMIP factor',
        loanType: 'FHA Streamline',
        inputs: {
            'fs_g7': 250000,  // Base amount
            'fs_g8': 275000,  // Maximum loan amount
            'fs_g9': 220000,  // Current mortgage balance
            'fs_g12': 500,    // Interest due
            'fs_g13': 1500,   // Escrow
            'fs_g14': 222,    // MIP due existing
            'fs_d29': 0.0175  // UFMIP factor (post May 2009)
        },
        encompassFields: {
            'CX.FHA.SL.BASE.AMOUNT': 250000,
            'CX.FHA.SL.MAX.LOAN.AMOUNT': 275000,
            'CX.FHA.SL.PRINCIPAL.BALANCE': 220000,
            'CX.FHA.SL.INTEREST.DUE': 500,
            'CX.FHA.SL.ESCROW': 1500,
            'CX.FHA.SL.MIP.DUE.EXST': 222,
            'CX.FHA.SL.CASE.ASSIGN.DATE': '2010-06-01'
        },
        expectedResults: {
            'fs_g15': 2222.00,    // Total additional amounts
            'fs_g18': 2222.00,    // Total base + additional
            'fs_g19': 220000.00,  // Current mortgage balance
            'fs_g20': 2022.00,    // Difference
            'fs_g22': 275000.00,  // Maximum loan amount
            'fs_g24': 2022.00,    // Maximum loan amount (rounded down)
            'fs_g28': 2022.00,    // Final loan amount before UFMIP
            'fs_e29': 35.39,      // UFMIP amount (calculated)
            'fs_g29': 35.00,      // UFMIP rounded down
            'fs_g30': 2057.00,   // Final loan amount with UFMIP
            'fs_g33': 0.82       // LTV ratio
        }
    },
    {
        name: 'FHA Streamline Pre-2009 Scenario',
        calculator: 'fha-streamline',
        description: 'FHA Streamline with pre-2009 UFMIP factor (0.0100)',
        loanType: 'FHA Streamline',
        inputs: {
            'fs_g7': 200000,
            'fs_g8': 220000,
            'fs_g9': 180000,
            'fs_g12': 400,
            'fs_g13': 1200,
            'fs_g14': 180,
            'fs_d29': '2008-05-15'  // Date before May 31, 2009
        },
        expectedResults: {
            'fs_g15': 1780.00,
            'fs_g18': 1780.00,
            'fs_g19': 180000.00,
            'fs_g20': -1820.00,
            'fs_g24': 0.00,  // Negative difference results in 0
            'fs_g30': 0.00
        }
    }
];

/**
 * VA IRRRL Calculator Test Scenarios
 */
const VA_IRRRL_SCENARIOS = [
    {
        name: 'VA IRRRL Standard Savings Scenario',
        calculator: 'va-irrrl',
        description: 'Standard VA IRRRL with monthly savings and break-even analysis',
        loanType: 'VA IRRRL',
        inputs: {
            'irrrl_current_balance': 250000,
            'irrrl_current_rate': 4.5,
            'irrrl_current_payment': 1265.75,
            'irrrl_new_rate': 3.5,
            'irrrl_new_term': 30,
            'irrrl_funding_fee_rate': 0.5,
            'irrrl_closing_costs': 5000,
            'irrrl_waive_funding_fee': false
        },
        encompassFields: {
            'CX.VA.IRRRL.CURRENT.BALANCE': 250000,
            'CX.VA.IRRRL.CURRENT.RATE': 4.5,
            'CX.VA.IRRRL.CURRENT.PAYMENT': 1265.75,
            'CX.VA.IRRRL.NEW.RATE': 3.5,
            'CX.VA.IRRRL.NEW.TERM': 30,
            'CX.VA.IRRRL.FUNDING.FEE.RATE': 0.5,
            'CX.VA.IRRRL.CLOSING.COSTS': 5000
        },
        expectedResults: {
            'irrrl_funding_fee_amount': 1250.00,
            'irrrl_new_loan_amount': 256250.00,
            'irrrl_new_payment': 1149.51,
            'irrrl_monthly_savings': 116.24,
            'irrrl_break_even': 43.0,
            'irrrl_savings_5yr': 6974.40,
            'irrrl_savings_10yr': 13948.80,
            'irrrl_total_interest_savings': 41846.40
        }
    },
    {
        name: 'VA IRRRL With Funding Fee Waiver',
        calculator: 'va-irrrl',
        description: 'VA IRRRL with funding fee waived for disabled veteran',
        loanType: 'VA IRRRL',
        inputs: {
            'irrrl_current_balance': 200000,
            'irrrl_current_rate': 5.0,
            'irrrl_current_payment': 1073.64,
            'irrrl_new_rate': 3.75,
            'irrrl_new_term': 30,
            'irrrl_funding_fee_rate': 0.5,
            'irrrl_closing_costs': 4000,
            'irrrl_waive_funding_fee': true
        },
        expectedResults: {
            'irrrl_funding_fee_amount': 0.00,
            'irrrl_new_loan_amount': 204000.00,
            'irrrl_new_payment': 944.51,
            'irrrl_monthly_savings': 129.13,
            'irrrl_break_even': 31.0
        }
    }
];

/**
 * Asset Qualifier Calculator Test Scenarios
 */
const ASSET_QUALIFIER_SCENARIOS = [
    {
        name: 'Asset Qualifier Standard Scenario - Pass',
        calculator: 'asset-qualifier',
        description: 'Asset qualifier scenario that passes minimum assets test',
        loanType: 'Conventional',
        inputs: {
            'aq_dob': '1965-01-15',  // Age 59+ (100% retirement factor)
            'aq_liquid_assets': 300000,
            'aq_other_assets': 200000,
            'aq_retirement_assets': 400000,
            'aq_reserve_months': 6,
            'aq_monthly_payment': 3000,
            'aq_non_borrower_assets': 'No',
            'aq_12mo_history': 'Yes',
            'aq_cat1_factor': 1.0,
            'aq_cat2_factor': 0.7
        },
        encompassFields: {
            'CX.BORROWER.DOB': '1965-01-15',
            'CX.LIQUID.ASSETS': 300000,
            'CX.OTHER.ASSETS': 200000,
            'CX.RETIREMENT.ASSETS': 400000,
            'CX.RESERVE.MONTHS': 6,
            'CX.MONTHLY.PAYMENT': 3000,
            'CX.NON.BORROWER.ASSETS': 'No',
            'CX.12MO.HISTORY': 'Yes'
        },
        expectedResults: {
            'aq_ret_factor': 1.0,
            'aq_cat1_eligible': 300000.00,
            'aq_cat2_eligible': 140000.00,
            'aq_ret_eligible': 400000.00,
            'aq_total_eligible_assets': 840000.00,
            'aq_required_reserves': 18000.00,
            'aq_min_assets_result': 'PASS',
            'aq_net_eligible_assets': 822000.00,
            'aq_supportable_payment': 2533.78,
            'aq_messages': ''
        }
    },
    {
        name: 'Asset Qualifier Under 57 Scenario',
        calculator: 'asset-qualifier',
        description: 'Asset qualifier with borrower under 57 (70% retirement factor)',
        loanType: 'Conventional',
        inputs: {
            'aq_dob': '1985-06-20',  // Age under 57 (70% retirement factor)
            'aq_liquid_assets': 250000,
            'aq_other_assets': 150000,
            'aq_retirement_assets': 300000,
            'aq_reserve_months': 6,
            'aq_monthly_payment': 2500,
            'aq_non_borrower_assets': 'No',
            'aq_12mo_history': 'Yes',
            'aq_cat1_factor': 1.0,
            'aq_cat2_factor': 0.7
        },
        expectedResults: {
            'aq_ret_factor': 0.7,
            'aq_cat1_eligible': 250000.00,
            'aq_cat2_eligible': 105000.00,
            'aq_ret_eligible': 210000.00,
            'aq_total_eligible_assets': 565000.00,
            'aq_required_reserves': 15000.00,
            'aq_min_assets_result': 'PASS',
            'aq_net_eligible_assets': 550000.00,
            'aq_supportable_payment': 1696.84
        }
    },
    {
        name: 'Asset Qualifier Fail Scenario',
        calculator: 'asset-qualifier',
        description: 'Asset qualifier that fails minimum assets test',
        loanType: 'Conventional',
        inputs: {
            'aq_dob': '1970-03-10',
            'aq_liquid_assets': 100000,
            'aq_other_assets': 50000,
            'aq_retirement_assets': 200000,
            'aq_reserve_months': 6,
            'aq_monthly_payment': 4000,
            'aq_non_borrower_assets': 'No',
            'aq_12mo_history': 'Yes',
            'aq_cat1_factor': 1.0,
            'aq_cat2_factor': 0.7
        },
        expectedResults: {
            'aq_ret_factor': 0.7,
            'aq_total_eligible_assets': 290000.00,
            'aq_required_reserves': 24000.00,
            'aq_min_assets_result': 'FAIL',  // (350000 - 24000) < 500000
            'aq_net_eligible_assets': 266000.00
        }
    }
];

/**
 * Cashout Refinance Calculator Test Scenarios
 * Note: These are placeholder scenarios - adjust field IDs based on actual calculator implementation
 */
const CASHOUT_REFINANCE_SCENARIOS = [
    {
        name: 'Cashout Refinance Standard Scenario',
        calculator: 'cashout-refinance',
        description: 'Standard cashout refinance with equity extraction',
        loanType: 'Cashout Refinance',
        inputs: {
            'cashout_current_balance': 200000,
            'cashout_property_value': 350000,
            'cashout_new_loan_amount': 280000,
            'cashout_closing_costs': 6000,
            'cashout_current_rate': 4.5,
            'cashout_new_rate': 3.75,
            'cashout_loan_term': 30
        },
        expectedResults: {
            // Add expected results when calculator fields are confirmed
        }
    }
];

/**
 * All Test Scenarios Combined
 */
const ALL_SCENARIOS = [
    ...DTI_SCENARIOS,
    ...FHA_STREAMLINE_SCENARIOS,
    ...VA_IRRRL_SCENARIOS,
    ...ASSET_QUALIFIER_SCENARIOS,
    ...CASHOUT_REFINANCE_SCENARIOS
];

/**
 * Export scenarios and mappings for use with Scenarios class
 */
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        ENCOMPASS_FIELD_MAPPINGS,
        DTI_SCENARIOS,
        FHA_STREAMLINE_SCENARIOS,
        VA_IRRRL_SCENARIOS,
        ASSET_QUALIFIER_SCENARIOS,
        CASHOUT_REFINANCE_SCENARIOS,
        ALL_SCENARIOS
    };
}

