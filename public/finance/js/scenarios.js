/**
 * Scenarios Class - Mortgage Calculator Test Scenarios
 * 
 * @fileoverview Comprehensive scenario management and test execution system for mortgage calculators.
 *              Supports Encompass field mapping, test case execution, and result validation.
 * 
 * @author David Lane
 * @version 2.0.0
 * @since 2024
 * 
 * @description
 * This class provides:
 * - Scenario management (create, store, load, execute scenarios)
 * - Input population from Encompass field mappings or direct field IDs
 * - Test execution with expected vs actual result validation
 * - Integration with calculationEngine.js engine for automated testing
 * - Support for all calculator types (DTI, FHA Streamline, VA IRRRL, Asset Qualifier, etc.)
 */
class Scenarios {
    constructor(options = {}) {
        this.scenarios = options.scenarios || [];
        this.currentScenario = null;
        this.testResults = [];
        this.fieldMappings = options.fieldMappings || {};
        this.calculatorInstance = options.calculatorInstance || null;
        this.tolerance = options.tolerance || 0.01; // Default tolerance for numeric comparisons
    }

    /**
     * Populate inputs from data object
     * Supports both Encompass field IDs (emid attribute) and direct field IDs
     * 
     * @param {Object} data - Data object with field IDs as keys
     * @param {Object} options - Options for population
     * @param {boolean} options.useEmid - Use emid attributes (default: true)
     * @param {boolean} options.useId - Use id attributes (default: true)
     * @param {boolean} options.triggerEvents - Trigger input events after population (default: true)
     */
    populateInputs(data, options = {}) {
        const {
            useEmid = true,
            useId = true,
            triggerEvents = true
        } = options;

        // First, try Encompass field mappings (emid attributes)
        if (useEmid) {
            const emidElements = document.querySelectorAll('input[emid], select[emid], textarea[emid]');
            emidElements.forEach(element => {
                const key = element.getAttribute('emid');
                if (data[key] !== undefined) {
                    this._setElementValue(element, data[key]);
                }
            });
        }

        // Then, try direct field ID mappings
        if (useId) {
            Object.keys(data).forEach(key => {
                const element = document.getElementById(key);
                if (element) {
                    this._setElementValue(element, data[key]);
                }
            });
        }

        // Trigger input events to recalculate if needed
        if (triggerEvents && this.calculatorInstance) {
            setTimeout(() => {
                if (typeof this.calculatorInstance.recalculateAll === 'function') {
                    this.calculatorInstance.recalculateAll();
                }
            }, 100);
        } else if (triggerEvents) {
            // Trigger native input events
            const inputs = document.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (input.value) {
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        }
    }

    /**
     * Set value on an element based on its type
     * @private
     */
    _setElementValue(element, value) {
        if (element.tagName === 'SELECT') {
            element.value = value;
            // Trigger change event for select elements
            element.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            switch(element.type) {
                case 'date':
                    element.value = value; // Assuming date is in 'YYYY-MM-DD' format
                    break;
                case 'checkbox':
                    element.checked = Boolean(value);
                    break;
                case 'radio':
                    if (element.value === String(value)) {
                        element.checked = true;
                    }
                    break;
                default:
                    element.value = value;
            }
            // Trigger input event
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    /**
     * Load a scenario by name or index
     * @param {string|number} identifier - Scenario name or index
     * @returns {Object|null} The scenario object or null if not found
     */
    loadScenario(identifier) {
        let scenario = null;
        
        if (typeof identifier === 'number') {
            scenario = this.scenarios[identifier];
        } else {
            scenario = this.scenarios.find(s => s.name === identifier);
        }

        if (scenario) {
            this.currentScenario = scenario;
            return scenario;
        }

        return null;
    }

    /**
     * Execute a scenario - populate inputs and optionally validate results
     * @param {string|number|Object} scenario - Scenario identifier or scenario object
     * @param {Object} options - Execution options
     * @param {boolean} options.validate - Validate results against expected values (default: false)
     * @param {boolean} options.useEncompassFields - Use Encompass field mappings (default: true)
     * @returns {Object} Execution result with populated inputs and validation results
     */
    executeScenario(scenario, options = {}) {
        const {
            validate = false,
            useEncompassFields = true
        } = options;

        // Load scenario if identifier provided
        if (typeof scenario === 'string' || typeof scenario === 'number') {
            const identifier = scenario;
            scenario = this.loadScenario(identifier);
            if (!scenario) {
                throw new Error(`Scenario not found: ${identifier}`);
            }
        }

        this.currentScenario = scenario;

        // Build input data - prioritize Encompass fields if requested
        let inputData = scenario.inputs;
        
        if (useEncompassFields && scenario.encompassFields) {
            // Map Encompass fields to calculator fields if mappings exist
            const mappedEncompassFields = this.mapEncompassFields(scenario.encompassFields);
            inputData = { ...mappedEncompassFields, ...scenario.inputs };
        }

        // Populate inputs
        this.populateInputs(inputData, {
            useEmid: useEncompassFields,
            useId: true,
            triggerEvents: true
        });

        const result = {
            scenario: scenario.name,
            calculator: scenario.calculator,
            timestamp: new Date().toISOString(),
            inputsPopulated: Object.keys(inputData).length,
            validation: null
        };

        // Validate results if requested
        if (validate && scenario.expectedResults) {
            result.validation = this.validateResults(scenario.expectedResults);
        }

        // Store result
        this.testResults.push(result);

        return result;
    }

    /**
     * Validate actual results against expected results
     * @param {Object} expectedResults - Object with field IDs and expected values
     * @returns {Object} Validation result with pass/fail status and details
     */
    validateResults(expectedResults) {
        const validation = {
            passed: true,
            total: 0,
            passedCount: 0,
            failedCount: 0,
            results: []
        };

        Object.keys(expectedResults).forEach(fieldId => {
            const expected = expectedResults[fieldId];
            const element = document.getElementById(fieldId);
            
            validation.total++;

            if (!element) {
                validation.passed = false;
                validation.failedCount++;
                validation.results.push({
                    fieldId,
                    status: 'error',
                    message: `Field not found: ${fieldId}`,
                    expected,
                    actual: null
                });
                return;
            }

            let actual = element.value;
            
            // Convert to number if expected is numeric
            if (typeof expected === 'number') {
                actual = parseFloat(actual) || 0;
            }

            // Compare values
            const isMatch = this._compareValues(actual, expected);

            if (isMatch) {
                validation.passedCount++;
                validation.results.push({
                    fieldId,
                    status: 'pass',
                    expected,
                    actual
                });
            } else {
                validation.passed = false;
                validation.failedCount++;
                validation.results.push({
                    fieldId,
                    status: 'fail',
                    message: `Expected ${expected}, got ${actual}`,
                    expected,
                    actual
                });
            }
        });

        return validation;
    }

    /**
     * Compare two values with tolerance for numeric comparisons
     * @private
     */
    _compareValues(actual, expected) {
        // Exact match for strings
        if (typeof expected === 'string') {
            return String(actual).trim() === String(expected).trim();
        }

        // Numeric comparison with tolerance
        if (typeof expected === 'number') {
            const actualNum = parseFloat(actual);
            if (isNaN(actualNum)) return false;
            return Math.abs(actualNum - expected) <= this.tolerance;
        }

        // Boolean comparison
        if (typeof expected === 'boolean') {
            return Boolean(actual) === expected;
        }

        // Default strict equality
        return actual === expected;
    }

    /**
     * Add a scenario to the scenarios collection
     * @param {Object} scenario - Scenario object
     */
    addScenario(scenario) {
        if (!scenario.name) {
            throw new Error('Scenario must have a name');
        }
        if (!scenario.calculator) {
            throw new Error('Scenario must specify a calculator type');
        }
        this.scenarios.push(scenario);
    }

    /**
     * Get all scenarios for a specific calculator
     * @param {string} calculatorType - Calculator type (e.g., 'dti', 'fha-streamline')
     * @returns {Array} Array of scenarios for the calculator
     */
    getScenariosForCalculator(calculatorType) {
        return this.scenarios.filter(s => s.calculator === calculatorType);
    }

    /**
     * Clear all test results
     */
    clearResults() {
        this.testResults = [];
    }

    /**
     * Get test summary statistics
     * @returns {Object} Summary statistics
     */
    getTestSummary() {
        const total = this.testResults.length;
        const validated = this.testResults.filter(r => r.validation !== null);
        const passed = validated.filter(r => r.validation.passed).length;
        const failed = validated.filter(r => !r.validation.passed).length;

        return {
            total,
            validated: validated.length,
            passed,
            failed,
            passRate: validated.length > 0 ? (passed / validated.length * 100).toFixed(2) + '%' : 'N/A'
        };
    }

    /**
     * Set calculator instance for automatic recalculation
     * @param {Object} calculatorInstance - Instance of calculations class
     */
    setCalculatorInstance(calculatorInstance) {
        this.calculatorInstance = calculatorInstance;
    }

    /**
     * Set field mapping for Encompass fields to calculator fields
     * @param {Object} mappings - Object with Encompass field IDs as keys and calculator field IDs as values
     */
    setFieldMappings(mappings) {
        this.fieldMappings = { ...this.fieldMappings, ...mappings };
    }

    /**
     * Map Encompass fields to calculator fields using the mapping table
     * @param {Object} encompassFields - Object with Encompass field IDs as keys
     * @returns {Object} Object with calculator field IDs as keys
     */
    mapEncompassFields(encompassFields) {
        const mapped = {};
        Object.keys(encompassFields).forEach(encompassField => {
            const calculatorField = this.fieldMappings[encompassField] || encompassField;
            mapped[calculatorField] = encompassFields[encompassField];
        });
        return mapped;
    }

    /**
     * Run multiple scenarios as a batch test suite
     * @param {Array|string} scenarioIdentifiers - Array of scenario names/indices, or 'all' to run all scenarios
     * @param {Object} options - Execution options
     * @param {boolean} options.validate - Validate results (default: true)
     * @param {boolean} options.stopOnFailure - Stop on first failure (default: false)
     * @param {string} options.calculatorFilter - Filter by calculator type (optional)
     * @returns {Object} Batch test results
     */
    runBatchTests(scenarioIdentifiers = 'all', options = {}) {
        const {
            validate = true,
            stopOnFailure = false,
            calculatorFilter = null
        } = options;

        let scenariosToRun = [];

        // Determine which scenarios to run
        if (scenarioIdentifiers === 'all') {
            scenariosToRun = calculatorFilter
                ? this.scenarios.filter(s => s.calculator === calculatorFilter)
                : this.scenarios;
        } else if (Array.isArray(scenarioIdentifiers)) {
            scenariosToRun = scenarioIdentifiers.map(id => {
                if (typeof id === 'number') {
                    return this.scenarios[id];
                } else {
                    return this.scenarios.find(s => s.name === id);
                }
            }).filter(s => s !== undefined);
        } else {
            throw new Error('scenarioIdentifiers must be "all" or an array');
        }

        const batchResults = {
            startTime: new Date().toISOString(),
            totalScenarios: scenariosToRun.length,
            scenariosRun: 0,
            scenariosPassed: 0,
            scenariosFailed: 0,
            scenariosSkipped: 0,
            results: [],
            summary: null
        };

        // Execute each scenario
        scenariosToRun.forEach((scenario, index) => {
            if (stopOnFailure && batchResults.scenariosFailed > 0) {
                batchResults.scenariosSkipped++;
                return;
            }

            try {
                const result = this.executeScenario(scenario, {
                    validate,
                    useEncompassFields: true
                });

                batchResults.scenariosRun++;
                batchResults.results.push(result);

                if (result.validation) {
                    if (result.validation.passed) {
                        batchResults.scenariosPassed++;
                    } else {
                        batchResults.scenariosFailed++;
                    }
                } else {
                    // No validation performed
                    batchResults.scenariosPassed++;
                }
            } catch (error) {
                batchResults.scenariosFailed++;
                batchResults.results.push({
                    scenario: scenario.name,
                    calculator: scenario.calculator,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        batchResults.endTime = new Date().toISOString();
        batchResults.summary = this.getTestSummary();

        return batchResults;
    }

    /**
     * Get detailed test report with formatted output
     * @param {Object} batchResults - Results from runBatchTests (optional, uses current results if not provided)
     * @returns {string} Formatted test report
     */
    getTestReport(batchResults = null) {
        const results = batchResults || { results: this.testResults };
        const summary = batchResults?.summary || this.getTestSummary();

        let report = '=== Mortgage Calculator Test Report ===\n\n';
        report += `Total Tests: ${summary.total}\n`;
        report += `Validated: ${summary.validated}\n`;
        report += `Passed: ${summary.passed}\n`;
        report += `Failed: ${summary.failed}\n`;
        report += `Pass Rate: ${summary.passRate}\n\n`;

        if (batchResults) {
            report += `Start Time: ${batchResults.startTime}\n`;
            report += `End Time: ${batchResults.endTime}\n\n`;
        }

        report += '=== Detailed Results ===\n\n';

        results.results.forEach((result, index) => {
            report += `${index + 1}. ${result.scenario} (${result.calculator})\n`;
            
            if (result.error) {
                report += `   ERROR: ${result.error}\n`;
            } else if (result.validation) {
                const status = result.validation.passed ? 'PASS' : 'FAIL';
                report += `   Status: ${status}\n`;
                report += `   Tests: ${result.validation.passedCount}/${result.validation.total} passed\n`;
                
                if (!result.validation.passed) {
                    report += `   Failures:\n`;
                    result.validation.results
                        .filter(r => r.status === 'fail' || r.status === 'error')
                        .forEach(failure => {
                            report += `     - ${failure.fieldId}: Expected ${failure.expected}, Got ${failure.actual}\n`;
                        });
                }
            } else {
                report += `   Status: EXECUTED (no validation)\n`;
            }
            
            report += '\n';
        });

        return report;
    }

    /**
     * Load scenarios from the Encompass test loans library
     * @param {Array} scenarios - Array of scenario objects from encompass-test-loans.js
     * @param {Object} mappings - Optional field mappings object
     */
    loadScenariosFromLibrary(scenarios, mappings = null) {
        if (mappings) {
            this.setFieldMappings(mappings);
        }
        
        scenarios.forEach(scenario => {
            this.addScenario(scenario);
        });
    }
}

/**
 * Initialize Scenarios with Encompass test loans library
 * Helper function to quickly set up scenarios with all test loans
 * 
 * @param {Object} options - Initialization options
 * @param {Object} options.calculatorInstance - Calculator instance for auto-recalculation
 * @param {Array} options.scenarios - Custom scenarios array (optional, uses ALL_SCENARIOS if not provided)
 * @param {Object} options.mappings - Custom field mappings (optional, uses ENCOMPASS_FIELD_MAPPINGS if not provided)
 * @returns {Scenarios} Configured Scenarios instance
 */
function initializeScenarios(options = {}) {
    const {
        calculatorInstance = null,
        scenarios = null,
        mappings = null
    } = options;

    // Try to load from encompass-test-loans.js if available
    let testScenarios = scenarios;
    let fieldMappings = mappings;

    if (typeof ALL_SCENARIOS !== 'undefined') {
        testScenarios = testScenarios || ALL_SCENARIOS;
    }
    if (typeof ENCOMPASS_FIELD_MAPPINGS !== 'undefined') {
        fieldMappings = fieldMappings || ENCOMPASS_FIELD_MAPPINGS;
    }

    const scenariosInstance = new Scenarios({
        scenarios: testScenarios || [],
        fieldMappings: fieldMappings || {},
        calculatorInstance
    });

    return scenariosInstance;
}

/**
 * Legacy function for backward compatibility
 */
function onPopulateButtonClick() {
    const scenarios = new Scenarios();
    const data = {
        'CX.FHA.SL.MIN.BAL': 0.00,
        '1134': 0.00,
        'CX.FHA.SL.UFMIP.MAX.APP': 0.00,
        'CX.FHA.SL.MIP.DUE.EXST': 222.00,
        'CX.FHA.SL.FORBEARANCE': 'noLateCharges'
    };

    scenarios.populateInputs(data);
}
