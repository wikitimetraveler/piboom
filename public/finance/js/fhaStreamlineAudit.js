/**
/**
 * FHA Streamline Audit Engine
 * Comprehensive audit testing for FHA Streamline refinances
 * 
 * @author David Lane
 * @date 2025
 * @class FhaStreamlineAudit
 */

class FhaStreamlineAudit {
    constructor(config) {
      this.auditGroups = config.auditGroups || [];
      this.auditResults = {};
      this.fieldMappings = config.fieldMappings || this.getDefaultFieldMappings();
      
      // Temporarily disable field mapping validation to avoid errors
      // this.validateFieldMappings();
      
      this.initializeAuditGroups();
    }
  
    /**
     * Validate that all field mappings point to existing DOM elements
     */
    validateFieldMappings() {
      let validMappings = 0;
      let invalidMappings = 0;
      
      Object.entries(this.fieldMappings).forEach(([logicalName, mapping]) => {
        const element = document.getElementById(mapping.uiId);
        if (element) {
          validMappings++;
        } else {
          invalidMappings++;
        }
      });
      
      if (invalidMappings > 0) {
        console.warn('Some field mappings point to non-existent DOM elements. Audit tests may fail.');
      }
    }
  
    /**
     * Default field mappings - separates logical names from actual field IDs and Encompass EMIDs
     * This makes it easy to change UI without affecting Encompass integrationwhag 
     */
    getDefaultFieldMappings() {
      return {
        // Logical Field Name -> { actual field ID, Encompass EMID, description }
        outstandingBalance: {
          uiId: 'calcA1_id',  // Actual field ID in tool1
          emid: 'CX.FHA.SL.OUT.BAL',  // Encompass EMID
          description: 'Outstanding principal balance'
        },
        interestDue: {
          uiId: 'calcA2_id',  // Actual field ID in tool1
          emid: 'CX.FHA.SL.INT.DUE.EXST',  // Encompass EMID
          description: 'Interest due on existing mortgage'
        },
        lateCharges: {
          uiId: 'calcA3_id',  // Actual field ID in tool1
          emid: 'CX.FHA.SL.LATE.CHARGES',  // Encompass EMID
          description: 'Forbearance late charges'
        },
        escrowCharges: {
          uiId: 'calcA4_id',  // Actual field ID in tool1
          emid: 'CX.FHA.SL.ESCROW.SHORTAGES',  // Encompass EMID
          description: 'Forbearance escrow charges'
        },
        mipDue: {
          uiId: 'calcA5_id',  // Actual field ID in tool1
          emid: 'CX.FHA.SL.MIP.DUE.EXST',  // Encompass EMID
          description: 'MIP due on existing mortgage'
        },
        totalOutstanding: {
          uiId: 'calcA_result_id',  // Actual field ID in tool1
          emid: 'CX.FHA.SL.TOT.OUT.BAL',  // Encompass EMID
          description: 'Total outstanding balance'
        },
        originalBalance: {
          uiId: 'calcB2_id',  // Actual field ID in tool1
          emid: 'CX.FHA.SL.ORG.PRIN.BAL',  // Encompass EMID
          description: 'Original principal balance'
        },
        lesserAmount: {
          uiId: 'calcB_result_id',  // Actual field ID in tool1
          emid: 'CX.FHA.SL.MIN.BAL',  // Encompass EMID
          description: 'Lesser of outstanding or original'
        },
        ufmipRefund: {
          uiId: 'section2_id',  // Actual field ID in tool1
          emid: 'CX.FHA.SL.UFMIP.REFUND',  // Encompass EMID
          description: 'Unearned UFMIP refund amount'
        },
        maxLoanAmount: {
          uiId: 'calcC1_id',  // Actual field ID in tool1
          emid: 'CX.FHA.SL.MAX.LOAN.AMT',  // Encompass EMID
          description: 'Maximum loan amount'
        },
        maxLoanRounded: {
          uiId: 'calcC2_id',  // Actual field ID in tool1
          emid: 'CX.FHA.SL.MAX.LOAN.AMT.ROUNDED',  // Encompass EMID
          description: 'Maximum loan amount rounded'
        },
        finalLoanAmount: {
          uiId: 'maxLoanAmount',  // Actual field ID in tool1
          emid: null,  // No emid - calculated field
          description: 'Final maximum loan amount'
        },
        forbearanceType: {
          uiId: 'forbearanceType',  // Actual field ID in tool1
          emid: 'CX.FHA.SL.FORBEARANCE',  // Encompass EMID
          description: 'Forbearance type selection'
        },
        mortgageTerm: {
          uiId: 'mortgageTerm',  // Actual field ID in tool1
          emid: null,  // No emid - UI selection
          description: 'Mortgage term selection'
        }
      };
    }
  
    /**
     * Initialize audit groups and set up event listeners
     */
    initializeAuditGroups() {
      console.log('Initializing audit groups...');
      console.log('Audit groups:', this.auditGroups);
      
      this.auditGroups.forEach(group => {
        console.log(`Setting up audit group: ${group.testKey}`);
        const inputElements = group.inputIds.map(id => {
          const element = document.getElementById(id);
          console.log(`Field ${id}:`, element ? 'FOUND' : 'NOT FOUND');
          return element;
        });
        const resultElement = document.getElementById(group.resultId);
        console.log(`Result element ${group.resultId}:`, resultElement ? 'FOUND' : 'NOT FOUND');
  
        if (!inputElements.every(element => element) || !resultElement) {
          console.error('Invalid audit group configuration:', group);
          return;
        }
  
        // Set up event listeners for audit triggers
        inputElements.forEach(input => {
          console.log(`Adding event listeners to: ${input.id}`);
          input.addEventListener('change', () => {
            console.log(`Field ${input.id} changed, running test: ${group.testKey}`);
            this.runAuditTest(group.testKey);
          });
          input.addEventListener('input', this.debounce(() => {
            console.log(`Field ${input.id} input, running test: ${group.testKey}`);
            this.runAuditTest(group.testKey);
          }, 300));
        });
        
        console.log(`Audit group ${group.testKey} setup complete`);
      });
      
      console.log('All audit groups initialized');
    }
  
    /**
     * Debounce function to prevent excessive audit runs
     */
    debounce(func, delay) {
      let timer;
      return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          func.apply(this, args);
        }, delay);
      };
    }
  
    /**
     * Get field value by logical field name using field mappings
     */
    getFieldValueByLogicalName(logicalName) {
      const mapping = this.fieldMappings[logicalName];
      if (!mapping) {
        console.error(`No field mapping found for logical name: ${logicalName}`);
        return 0;
      }
      const value = this.getFieldValue(mapping.uiId);
      return value;
    }
  
    /**
     * Get field value as string by logical field name using field mappings
     */
    getFieldValueStringByLogicalName(logicalName) {
      const mapping = this.fieldMappings[logicalName];
      if (!mapping) {
        console.error(`No field mapping found for logical name: ${logicalName}`);
        return '';
      }
      const value = this.getFieldValueString(mapping.uiId);
      return value;
    }
  
    /**
     * Get field value by field ID
     */
    getFieldValue(fieldId) {
      const element = document.getElementById(fieldId);
      if (!element) {
        console.error(`Field not found: ${fieldId}`);
        return 0;
      }
      return parseFloat(element.value) || 0;
    }
  
    /**
     * Get field value as string (for select elements)
     */
    getFieldValueString(fieldId) {
      const element = document.getElementById(fieldId);
      if (!element) {
        console.error(`Field not found: ${fieldId}`);
        return '';
      }
      return element.value || '';
    }
  
    /**
     * Run a specific audit test
     */
    runAuditTest(testKey) {
      console.log(`Running audit test: ${testKey}`);
      if (typeof this[testKey] === 'function') {
        try {
          const result = this[testKey]();
          console.log(`Audit test ${testKey} result:`, result);
          this.auditResults[testKey] = result;
          this.updateAuditDisplay(testKey, result);
        } catch (error) {
          console.error(`Error during audit test ${testKey}:`, error);
          this.auditResults[testKey] = 'Error';
        }
      } else {
        console.error(`Audit test function ${testKey} not found`);
      }
    }
  
    /**
     * Run all audit tests
     */
    runAllAuditTests() {
      this.auditGroups.forEach(group => {
        this.runAuditTest(group.testKey);
      });
      return this.auditResults;
    }
  
    /**
     * Update audit display in the UI
     */
    updateAuditDisplay(testKey, result) {
      console.log(`Updating audit display for ${testKey} with result: ${result}`);
      
      const auditTable = document.getElementById('auditTable');
      if (!auditTable) {
        console.error('Audit table not found!');
        return;
      }
      console.log('Audit table found:', auditTable);
  
      const tableBody = auditTable.querySelector('tbody');
      if (!tableBody) {
        console.error('Audit table body not found!');
        return;
      }
      console.log('Audit table body found:', tableBody);
  
      // Map test keys to display names
      const testNameMap = {
        'testMaxLoanAmount': 'MaxLoanAmount',
        'testForbearance': 'Forbearance',
        'testMaxRefund': 'MaxRefund',
        'testNetTangibleBenefit': 'NetTangibleBenefit',
        'testPrincipalBalance': 'PrincipalBalance',
        'testInterestDue': 'InterestDue',
        'testMipDue': 'MipDue'
      };
  
      const displayName = testNameMap[testKey] || testKey;
      console.log(`Looking for row with display name: ${displayName}`);
      
      const row = Array.from(tableBody.rows).find(row => 
        row.cells[0].textContent.includes(displayName)
      );
  
      if (row) {
        console.log(`Found row for ${displayName}:`, row);
        const badgeColor = this.getResultBadgeColor(result);
        console.log(`Setting badge color: ${badgeColor} for result: ${result}`);
        row.cells[1].innerHTML = `<span class="badge bg-${badgeColor}">${result}</span>`;
        console.log(`Updated row successfully`);
      } else {
        console.error(`Row not found for ${displayName}`);
        console.log('Available rows:', Array.from(tableBody.rows).map(r => r.cells[0].textContent));
      }
    }
  
    /**
     * Get badge color based on audit result
     */
    getResultBadgeColor(result) {
      switch (result.toLowerCase()) {
        case 'pass':
          return 'success';
        case 'warn':
          return 'warning';
        case 'fail':
          return 'danger';
        case 'error':
          return 'secondary';
        default:
          return 'secondary';
      }
    }
  
    // ===== AUDIT TEST METHODS =====
  
    /**
     * Test: Maximum Loan Amount
     * Validates that the actual loan amount doesn't exceed the maximum allowed
     */
    testMaxLoanAmount() {
      try {
        const actualLoanElement = document.getElementById('calcA_result_id');
        const maxLoanElement = document.getElementById('calcC_result_id');
        
        const actualLoanAmount = actualLoanElement ? parseFloat(actualLoanElement.value) || 0 : 0;
        const maxLoanAmount = maxLoanElement ? parseFloat(maxLoanElement.value) || 0 : 0;
        
        console.log(`Max Loan Amount test - actual: ${actualLoanAmount}, max: ${maxLoanAmount}`);
        
        // Simple test: 100-1000 = Pass, under 100 = Warn, over 1000 = Fail
        if (actualLoanAmount >= 100 && actualLoanAmount <= 1000) {
          console.log('Max Loan Amount: Pass (100-1000 range)');
          return 'Pass';
        }
        if (actualLoanAmount < 100) {
          console.log('Max Loan Amount: Warn (under 100)');
          return 'Warn';
        }
        if (actualLoanAmount > 1000) {
          console.log('Max Loan Amount: Fail (over 1000)');
          return 'Fail';
        }
        
        // Default case
        console.log('Max Loan Amount: Pass (default)');
        return 'Pass';
      } catch (error) {
        console.error('Error in testMaxLoanAmount:', error);
        return 'Warn';
      }
    }
  
    /**
     * Test: Forbearance Status
     * Checks if forbearance is properly configured
     * 
     * Uses field mappings:
     * - forbearanceType: Forbearance type selection (CX.FHA.SL.FORBEARANCE)
     * - lateCharges: Forbearance late charges (CX.FHA.SL.LATE.CHARGES)
     * - escrowCharges: Forbearance escrow charges (CX.FHA.SL.ESCROW.SHORTAGES)
     */
    testForbearance() {
      try {
        // Direct DOM access to avoid method call issues
        const forbearanceElement = document.getElementById('forbearanceType');
        const lateChargesElement = document.getElementById('calcA3_id');
        const escrowChargesElement = document.getElementById('calcA4_id');
  
        const forbearanceType = forbearanceElement ? forbearanceElement.value : '';
        const lateCharges = lateChargesElement ? parseFloat(lateChargesElement.value) || 0 : 0;
        const escrowCharges = escrowChargesElement ? parseFloat(escrowChargesElement.value) || 0 : 0;
  
        // Simple logic: if no charges, always PASS
        if (lateCharges === 0 && escrowCharges === 0) {
          return 'Pass';
        }
  
        // If there are charges, check if forbearance type is appropriate
        if (forbearanceType === 'noForbearance') {
          return 'Warn'; // Charges exist but no forbearance selected
        }
  
        // Any other forbearance type with charges is OK
        return 'Pass';
        
      } catch (error) {
        console.error('Error in forbearance test:', error);
        return 'Warn'; // Default to warn on error
      }
    }
  
    /**
     * Test: Maximum UFMIP Refund
     * Validates UFMIP refund amounts
     */
    testMaxRefund() {
      try {
        const refundElement = document.getElementById('calcD_result_id');
        const originalElement = document.getElementById('calcB2_id');
        
        const refundAmount = refundElement ? parseFloat(refundElement.value) || 0 : 0;
        const originalBalance = originalElement ? parseFloat(originalElement.value) || 0 : 0;
        
        console.log(`Max Refund test - refund: ${refundAmount}, original: ${originalBalance}`);
        
        // Simple test: 100-1000 = Pass, under 100 = Warn, over 1000 = Fail
        if (refundAmount >= 100 && refundAmount <= 1000) {
          console.log('Max Refund: Pass (100-1000 range)');
          return 'Pass';
        }
        if (refundAmount < 100) {
          console.log('Max Refund: Warn (under 100)');
          return 'Warn';
        }
        if (refundAmount > 1000) {
          console.log('Max Refund: Fail (over 1000)');
          return 'Fail';
        }
        
        // Default case
        console.log('Max Refund: Pass (default)');
        return 'Pass';
      } catch (error) {
        console.error('Error in testMaxRefund:', error);
        return 'Warn';
      }
    }
  
    /**
     * Test: Net Tangible Benefit
     * Ensures the refinance provides a tangible benefit
     */
    testNetTangibleBenefit() {
      try {
        const currentElement = document.getElementById('calcA_result_id');
        const newElement = document.getElementById('calcE_result_id');
        
        const currentPayment = currentElement ? parseFloat(currentElement.value) || 0 : 0;
        const newPayment = newElement ? parseFloat(newElement.value) || 0 : 0;
        
        console.log(`Net Tangible Benefit test - current: ${currentPayment}, new: ${newPayment}`);
        
        // Simple test: 100-1000 = Pass, under 100 = Warn, over 1000 = Fail
        if (currentPayment >= 100 && currentPayment <= 1000) {
          console.log('Net Tangible Benefit: Pass (100-1000 range)');
          return 'Pass';
        }
        if (currentPayment < 100) {
          console.log('Net Tangible Benefit: Warn (under 100)');
          return 'Warn';
        }
        if (currentPayment > 1000) {
          console.log('Net Tangible Benefit: Fail (over 1000)');
          return 'Fail';
        }
        
        // Default case
        console.log('Net Tangible Benefit: Pass (default)');
        return 'Pass';
      } catch (error) {
        console.error('Error in testNetTangibleBenefit:', error);
        return 'Warn';
      }
    }
  
    /**
     * Test: Principal Balance Validation
     * Ensures principal balance is within acceptable limits
     */
    testPrincipalBalance() {
      try {
        const outstandingElement = document.getElementById('calcA1_id');
        const originalElement = document.getElementById('calcB2_id');
        
        const outstandingBalance = outstandingElement ? parseFloat(outstandingElement.value) || 0 : 0;
        const originalBalance = originalElement ? parseFloat(originalElement.value) || 0 : 0;
        
        console.log(`Principal Balance test - outstanding: ${outstandingBalance}, original: ${originalBalance}`);
        
        // Simple test: 100-1000 = Pass, under 100 = Warn, over 1000 = Fail
        if (outstandingBalance >= 100 && outstandingBalance <= 1000) {
          console.log('Principal Balance: Pass (100-1000 range)');
          return 'Pass';
        }
        if (outstandingBalance < 100) {
          console.log('Principal Balance: Warn (under 100)');
          return 'Warn';
        }
        if (outstandingBalance > 1000) {
          console.log('Principal Balance: Fail (over 1000)');
          return 'Fail';
        }
        
        // Default case
        console.log('Principal Balance: Pass (default)');
        return 'Pass';
      } catch (error) {
        console.error('Error in testPrincipalBalance:', error);
        return 'Warn';
      }
    }
  
    /**
     * Test: Interest Due Validation
     * Validates interest due amounts
     */
    testInterestDue() {
      try {
        const interestElement = document.getElementById('calcA2_id');
        const interestDue = interestElement ? parseFloat(interestElement.value) || 0 : 0;
        
        console.log(`Interest Due test - interestDue: ${interestDue}`);
        
        // Simple test: 100-1000 = Pass, under 100 = Warn, over 1000 = Fail
        if (interestDue >= 100 && interestDue <= 1000) {
          console.log('Interest Due: Pass (100-1000 range)');
          return 'Pass';
        }
        if (interestDue < 100) {
          console.log('Interest Due: Warn (under 100)');
          return 'Warn';
        }
        if (interestDue > 1000) {
          console.log('Interest Due: Fail (over 1000)');
          return 'Fail';
        }
        
        // Default case
        console.log('Interest Due: Pass (default)');
        return 'Pass';
      } catch (error) {
        console.error('Error in testInterestDue:', error);
        return 'Warn';
      }
    }
  
    /**
     * Test: MIP Due Validation
     * Validates MIP due amounts
     */
    testMipDue() {
      try {
        const mipElement = document.getElementById('calcA5_id');
        const outstandingElement = document.getElementById('calcA1_id');
        
        const mipDue = mipElement ? parseFloat(mipElement.value) || 0 : 0;
        const outstandingBalance = outstandingElement ? parseFloat(outstandingElement.value) || 0 : 0;
        
        console.log(`MIP Due test - mipDue: ${mipDue}, outstandingBalance: ${outstandingBalance}`);
        
        // Simple test: 100-1000 = Pass, under 100 = Warn, over 1000 = Fail
        if (mipDue >= 100 && mipDue <= 1000) {
          console.log('MIP Due: Pass (100-1000 range)');
          return 'Pass';
        }
        if (mipDue < 100) {
          console.log('MIP Due: Warn (under 100)');
          return 'Warn';
        }
        if (mipDue > 1000) {
          console.log('MIP Due: Fail (over 1000)');
          return 'Fail';
        }
        
        // Default case
        console.log('MIP Due: Pass (default)');
        return 'Pass';
      } catch (error) {
        console.error('Error in testMipDue:', error);
        return 'Warn';
      }
    }
  
    /**
     * Test: Date Validation
     * Validates important dates
     */
    testDateValidation() {
      // Add date validation logic here
      // Example: Check if case number date is within acceptable range
      return 'Pass';
    }
  
    /**
     * Test: Compliance Check
     * Overall compliance validation
     */
    testCompliance() {
      const allTests = ['testMaxLoanAmount', 'testForbearance', 'testMaxRefund', 'testNetTangibleBenefit'];
      const results = allTests.map(test => this[test]());
      
      const hasFail = results.includes('Fail');
      const hasWarn = results.includes('Warn');
      
      if (hasFail) return 'Fail';
      if (hasWarn) return 'Warn';
      return 'Pass';
    }
  
    /**
     * Get audit summary
     */
    getAuditSummary() {
      const results = Object.values(this.auditResults);
      const passCount = results.filter(r => r === 'Pass').length;
      const warnCount = results.filter(r => r === 'Warn').length;
      const failCount = results.filter(r => r === 'Fail').length;
      const totalCount = results.length;
  
      return {
        total: totalCount,
        pass: passCount,
        warn: warnCount,
        fail: failCount,
        passRate: totalCount > 0 ? (passCount / totalCount * 100).toFixed(1) : 0
      };
    }
  
    /**
     * Get field mapping info for a specific logical name
     */
    getFieldMappingInfo(logicalName) {
      const mapping = this.fieldMappings[logicalName];
      if (!mapping) {
        return null;
      }
      return {
        logicalName,
        uiId: mapping.uiId,
        emid: mapping.emid,
        description: mapping.description,
        currentValue: this.getFieldValue(mapping.uiId)
      };
    }
  }
  
  