import { describe, expect, it } from '@jest/globals';
import { evaluateProduct } from '../../services/gse-rules.service.js';

const baseScenario = {
  borrower: { creditScore: 650, firstTimeHomebuyer: true, income: 90000, amiPercent: 95 },
  loan: {
    loanAmount: 350000,
    purchasePrice: 365000,
    ltv: 96,
    cltv: 97,
    occupancy: 'primary',
    purpose: 'purchase',
    propertyType: 'singleFamily',
    units: 1,
    state: 'TX',
    county: 'Travis',
    usdaEligibleArea: true
  },
  risk: { dti: 43, reservesMonths: 1, manualUnderwrite: true }
};

describe('gse-rules.service', () => {
  it('returns USDA guide warnings when agency is USDA', () => {
    const productRow = {
      agency: 'USDA',
      name: 'USDA guaranteed purchase',
      productId: 'usda:guaranteed-purchase',
      sourceRefs: ['USDA_GUIDE'],
      guidance: {},
      rules: {
        maxLtvPrimaryPurchase: 100,
        maxCltv: 100,
        minFico: 640,
        maxDti: 50,
        usdaEligibleAreaRequired: true,
        allowedOccupancy: ['primary'],
        allowedPurpose: ['purchase'],
        allowedPropertyTypes: ['singleFamily']
      }
    };
    const out = evaluateProduct(baseScenario, productRow, { overlayRows: [] });
    expect(out.warnings.some((w) => /USDA/i.test(w))).toBe(true);
  });

  it('captures hard-stop overlay failures', () => {
    const productRow = {
      agency: 'Fannie Mae',
      name: 'Conforming',
      productId: 'fannie:standard',
      sourceRefs: [],
      guidance: {},
      rules: {
        maxLtvPrimaryPurchase: 97,
        maxCltv: 97,
        minFico: 620,
        maxDti: 50,
        allowedOccupancy: ['primary'],
        allowedPurpose: ['purchase'],
        allowedPropertyTypes: ['singleFamily']
      }
    };
    const overlayRows = [
      {
        id: 'ovl1',
        investor: 'Investor A',
        title: 'Min FICO overlay',
        overlayType: 'credit',
        severity: 'hard-stop',
        agencyScope: ['Fannie Mae'],
        conditions: { minFico: 680 },
        sourceRefs: ['INVESTOR_OVERLAY_REF']
      }
    ];
    const out = evaluateProduct(baseScenario, productRow, { overlayRows });
    expect(out.overlayFindings.length).toBe(1);
    expect(out.overlayFindings[0].status).toBe('hard-fail');
    expect(['possible-fit', 'unlikely-fit']).toContain(out.status);
  });
});
