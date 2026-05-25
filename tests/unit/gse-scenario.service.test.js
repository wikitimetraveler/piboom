/**
 * Development work by David Lane
 */
import { describe, expect, it } from '@jest/globals';
import { analyzeScenario, normalizeScenario } from '../../services/gse-scenario.service.js';

const sampleScenario = {
  borrower: {
    creditScore: 720,
    firstTimeHomebuyer: true,
    income: 85000,
    amiPercent: 78
  },
  loan: {
    loanAmount: 725000,
    purchasePrice: 760000,
    ltv: 95,
    cltv: 97,
    occupancy: 'primary',
    purpose: 'purchase',
    propertyType: 'singleFamily',
    units: 1,
    state: 'CA',
    county: 'Orange'
  },
  risk: {
    dti: 43,
    reservesMonths: 2
  }
};

describe('gse-scenario.service', () => {
  it('normalizeScenario rejects borrower PII keys', () => {
    const bad = { ...sampleScenario, borrower: { ...sampleScenario.borrower, ssn: '123' } };
    const out = normalizeScenario(bad);
    expect(out.ok).toBe(false);
    expect(out.errors.some((e) => e.includes('ssn'))).toBe(true);
  });

  it('analyzeScenario returns shape and within-limit for CA Orange sample', () => {
    const out = analyzeScenario(sampleScenario);
    expect(out.success).toBe(true);
    expect(out.summary).toBeDefined();
    expect(out.summary.conformingStatus).toBe('within-limit');
    expect(out.summary.bestFit).not.toBe('none');
    expect(Array.isArray(out.products)).toBe(true);
    expect(out.products.length).toBeGreaterThanOrEqual(15);
    for (const p of out.products) {
      expect(
        p.warnings.some(
          (w) =>
            w.includes('Selling Guide') ||
            w.includes('Seller/Servicer') ||
            w.includes('VA Lenders') ||
            w.includes('HUD FHA') ||
            w.includes('USDA')
        )
      ).toBe(true);
    }
    expect(Array.isArray(out.suggestions)).toBe(true);
    expect(out.suggestions.some((s) => String(s).toLowerCase().includes('aus'))).toBe(true);
  });

  it('analyzeScenario returns errors for invalid body', () => {
    const out = analyzeScenario(null);
    expect(out.success).toBe(false);
    expect(out.errors.length).toBeGreaterThan(0);
  });
});
