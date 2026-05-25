/**
 * Development work by David Lane
 */
import { describe, expect, it } from '@jest/globals';
import { askLoanProgramExpert } from '../../services/finance-loan-expert.service.js';

const scenario = {
  borrower: {
    creditScore: 720,
    firstTimeHomebuyer: true,
    income: 85000,
    amiPercent: 78
  },
  loan: {
    loanAmount: 325000,
    purchasePrice: 340000,
    ltv: 95,
    cltv: 97,
    occupancy: 'primary',
    purpose: 'purchase',
    propertyType: 'singleFamily',
    units: 1,
    state: 'CA',
    county: 'Orange',
    usdaEligibleArea: false
  },
  risk: {
    dti: 43,
    reservesMonths: 2,
    manualUnderwrite: false
  }
};

describe('finance-loan-expert.service', () => {
  it('returns structured expert guidance with citations', () => {
    const out = askLoanProgramExpert({
      question: 'What should I choose and what overlays matter?',
      scenario
    });
    expect(out.success).toBe(true);
    expect(typeof out.recommendation).toBe('string');
    expect(Array.isArray(out.rationale)).toBe(true);
    expect(Array.isArray(out.requiredVerifications)).toBe(true);
    expect(Array.isArray(out.citations)).toBe(true);
    expect(Array.isArray(out.productsConsidered)).toBe(true);
    expect(out.productsConsidered.length).toBeGreaterThan(0);
  });

  it('requires question and valid scenario', () => {
    const missingQ = askLoanProgramExpert({ scenario });
    expect(missingQ.success).toBe(false);
    const badScenario = askLoanProgramExpert({ question: 'test', scenario: {} });
    expect(badScenario.success).toBe(false);
  });
});
