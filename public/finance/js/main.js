/**
 * Main configuration and initialization script for The ICE Box
 * Sets up global configurations, audit fields, and initializes core functionality
 * 
 * @fileoverview Main configuration script for The ICE Box tools
 * @author David Lane
 * @date March 5, 2025
 */

/** @global */
let loanObject = [];  // Global loan object 
let auditFields = []; // Global audit fields

/** @type {ScreenBindings} Instance of ScreenBindings class. */
const screenBindings = new ScreenBindings();

/** 
 * Global configuration object for all tools
 * @type {Object}
 */
const globalConfig = {
    // FHA Streamline Calculator Configuration
    fhaStreamline: {
        groups: [
            {
                inputIds: ['calcA1_id', 'calcA2_id', 'calcA3_id', 'calcA4_id', 'calcA5_id'],
                resultId: 'calcA_result_id',
                calculation: 'sumInputs'
            },
            {
                inputIds: ['calcA_result_id', 'calcB2_id'],
                resultId: 'calcB_result_id',
                calculation: 'minInputs'
            },
            {
                inputIds: ['calcB_result_id', 'calcC2_id'],
                resultId: 'calcC_result_id',
                calculation: 'maxUFMPamount'
            },
            {
                inputIds: ['calcD1_id', 'calcC_result_id'],
                resultId: 'calcD_result_id',
                calculation: 'minInputs'
            },
            {
                inputIds: ['calcB_result_id', 'calcD_result_id'],
                resultId: 'calcE_result_id',
                calculation: 'subtractInputs'
            },
            {
                inputIds: ['calcE_result_id'],
                resultId: 'calcF_result_id',
                calculation: 'truncateAndSumInputs'
            },
            {
                inputIds: ['calcG_input_id'],
                resultId: 'calcC2_id',
                calculation: 'newUfmipFactor'
            }
        ]
    },
    
    // Audit Field Configuration
    auditFields: {
        maxLoanAmount: {
            field: 'MaxLoanAmount',
            type: 'boolean',
            required: true,
            validation: 'passFail'
        },
        forbearance: {
            field: 'Forbearance',
            type: 'boolean',
            required: true,
            validation: 'passFail'
        },
        maxRefund: {
            field: 'MaxRefund',
            type: 'boolean',
            required: true,
            validation: 'passFail'
        },
        netTangibleBenefit: {
            field: 'NetTangibleBenefit',
            type: 'boolean',
            required: true,
            validation: 'passFail'
        },
        ufmipFactor: {
            field: 'UFMIPFactor',
            type: 'number',
            required: true,
            validation: 'range',
            min: 0,
            max: 1
        }
    },
    
    // Voice Control Configuration
    voiceControl: {
        enabled: true,
        commands: {
            'calculator': '/finance/fha-streamline-calculator.html',
            'parser': '/finance/tool2.html',
            'mashup': '/finance/tool3.html',
            'automator': '/finance/tool4.html',
            'ruler': '/finance/tool5.html',
            'transformer': '/finance/tool6.html',
            'alchemist': '/finance/tool8.html'
        }
    },
    
    // API Configuration
    api: {
        encompass: {
            baseUrl: 'https://api.encompass.com',
            timeout: 30000,
            retries: 3
        },
        azure: {
            baseUrl: 'https://dev.azure.com',
            timeout: 30000,
            retries: 3
        }
    }
};

/** @type {CalculationsEngine} Instance of calculations class. */
const fhaStreamlineCalculator = new CalculationsEngine(globalConfig.fhaStreamline);

/**
 * Initialize audit fields from configuration
 */
function initializeAuditFields() {
    auditFields = Object.keys(globalConfig.auditFields).map(key => ({
        name: key,
        ...globalConfig.auditFields[key]
    }));
    console.log('Audit fields initialized:', auditFields);
}

/**
 * Get audit field configuration by name
 */
function getAuditField(fieldName) {
    return globalConfig.auditFields[fieldName] || null;
}

/**
 * Validate audit field value
 */
function validateAuditField(fieldName, value) {
    const field = getAuditField(fieldName);
    if (!field) return false;
    
    switch (field.validation) {
        case 'passFail':
            return typeof value === 'boolean';
        case 'range':
            return typeof value === 'number' && value >= field.min && value <= field.max;
        default:
            return true;
    }
}

// Event listener for DOMContentLoaded to initialize the application.
document.addEventListener("DOMContentLoaded", function() {
    initializeAuditFields();
    initializeEventListeners();
    screenBindings.bindFieldValues();
    
    // Initialize audit engine if available
    if (typeof initializeAuditEngine === 'function') {
        window.auditEngine = initializeAuditEngine();
        console.log('Audit engine initialized');
    }
});

/**
 * Initializes all event listeners required for the application.
 */
function initializeEventListeners() {
    setupCalculatorInputs();
    setupMaxLoanTest();
    setupFieldProcessing();
    setupDateInputs();
}

/**
 * Sets up event listeners for calculator inputs to trigger recalculation.
 */
function setupDateInputs() {
    document.querySelectorAll('.date-input').forEach(input => {
        input.addEventListener('input', () => fhaStreamlineCalculator.newUfmipFactor());
    });
}
function setupCalculatorInputs() {
    document.querySelectorAll('.calculator-input').forEach(input => {
        input.addEventListener('input', () => fhaStreamlineCalculator.recalculateAll());
    });
}

/**
 * Sets up the event listener for the maximum loan test link.
 */
function setupMaxLoanTest() {
    document.getElementById('maxLoanTestLink').addEventListener('click', function(e) {
        e.preventDefault();
        executeMaxLoanTest();
    });
    
  
     document.getElementById('populateButton').addEventListener('click', function(e) {
        e.preventDefault();
        onPopulateButtonClick();
        fhaStreamlineCalculator.recalculateAll();

     });
}



/**
 * Executes the Maximum Loan Test and updates the audit table with results.
 */
function executeMaxLoanTest() {
    // Example values, replace with actual values as needed.
    let actualLoanAmount = 300000;
    let maxLoanAmount = 250000;

    const auditResults = {
        MaxLoanAmount: validateAuditField('maxLoanAmount', true) ? 'Pass' : 'Fail',
        Forbearance: validateAuditField('forbearance', true) ? 'Pass' : 'Fail',
        MaxRefund: validateAuditField('maxRefund', true) ? 'Pass' : 'Fail',
        NetTangibleBenefit: validateAuditField('netTangibleBenefit', true) ? 'Pass' : 'Fail'
    };

    let maxLoanTest = new MaxLoanAmountTest(auditResults, actualLoanAmount, maxLoanAmount);
    maxLoanTest.executeTest();
    updateAuditTable(auditResults);
}

/**
 * Sets up event listeners for buttons related to field processing.
 */
function setupFieldProcessing() {
    document.getElementById("mergeChangedFieldsBtn").addEventListener("click", () => {
        screenBindings.processLoanObject();
    });

    document.getElementById("parseFieldsBtn").addEventListener("click", () => {
        screenBindings.generateElements();
        screenBindings.bindFieldValues2();
    });

    const saveBtn = document.getElementById("saveToEncompassBtn");
    if (saveBtn) {
        saveBtn.addEventListener("click", (event) => {
            event.preventDefault();
            handleSaveToEncompass();
        });
    }
}

// Additional functions and logic to be added here.

let saveStatusResetTimeout = null;

function handleSaveToEncompass() {
    if (!screenBindings || typeof screenBindings.processLoanObject !== 'function') {
        updateSaveStatus('Unavailable', 'badge-secondary');
        console.error('Screen bindings are not initialized.');
        return;
    }

    if (!screenBindings.loanObject) {
        updateSaveStatus('Not Connected', 'badge-danger');
        console.warn('Cannot save to Encompass: loan object not available.');
        return;
    }

    updateSaveStatus('Saving...', 'badge-warning text-dark');

    try {
        screenBindings.processLoanObject();
        updateSaveStatus('Saved', 'badge-success');
        if (saveStatusResetTimeout) {
            clearTimeout(saveStatusResetTimeout);
        }
        saveStatusResetTimeout = setTimeout(() => updateSaveStatus('Ready', 'badge-light text-dark'), 4000);
    } catch (error) {
        console.error('Error saving to Encompass:', error);
        updateSaveStatus('Error', 'badge-danger');
    }
}

function updateSaveStatus(text, additionalClasses) {
    const badge = document.getElementById('saveStatusBadge');
    if (!badge) return;
    const classes = ['badge', 'badge-pill'];
    if (additionalClasses) {
        classes.push(...additionalClasses.split(' '));
    } else {
        classes.push('badge-light', 'text-dark');
    }
    badge.className = classes.join(' ');
    badge.textContent = text;
}
