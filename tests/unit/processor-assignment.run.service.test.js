/**
 * Development work by David Lane
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

describe('runProcessorAssignment product eligibility', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  async function loadServiceWithMocks() {
    await jest.unstable_mockModule('../../services/encompass-hub.service.js', () => ({
      fetchPipelineLoans: jest.fn().mockResolvedValue([]),
      fetchLoanAssociates: jest.fn().mockResolvedValue([]),
      assignLoanAssociate: jest.fn().mockResolvedValue({ ok: true }),
    }));
    await jest.unstable_mockModule('../../services/loan-complexity-ai.service.js', () => ({
      scoreLoanComplexityWithAi: jest.fn().mockResolvedValue({ points: 0, rationale: '' }),
      isAiComplexityConfigured: jest.fn().mockReturnValue(true),
    }));
    return import('../../services/processor-assignment.service.js');
  }

  test('hard-block skips when no eligible processor by product', async () => {
    const { runProcessorAssignment } = await loadServiceWithMocks();
    const loan = {
      loanGuid: 'g-1',
      fields: {
        'Loan.LoanNumber': '1001',
        'Loan.BorrowerName': 'Borrower One',
        'Loan.MortgageType': 'FHA',
      },
    };
    const out = await runProcessorAssignment({
      dryRun: true,
      loans: [loan],
      processors: [{ userId: 'p-jumbo', maxPoints: 10, products: ['Jumbo'] }],
      complexityRules: [],
      allowIneligibleOverride: false,
    });
    expect(out.results).toHaveLength(1);
    expect(out.results[0].status).toBe('skipped');
    expect(out.results[0].reason).toBe('no_eligible_processor');
  });

  test('override proposes ineligible processor when enabled', async () => {
    const { runProcessorAssignment } = await loadServiceWithMocks();
    const loan = {
      loanGuid: 'g-2',
      fields: {
        'Loan.LoanNumber': '1002',
        'Loan.BorrowerName': 'Borrower Two',
        'Loan.MortgageType': 'FHA',
      },
    };
    const out = await runProcessorAssignment({
      dryRun: true,
      loans: [loan],
      processors: [{ userId: 'p-jumbo', maxPoints: 10, products: ['Jumbo'] }],
      complexityRules: [],
      allowIneligibleOverride: true,
    });
    expect(out.results[0].status).toBe('proposed');
    expect(out.results[0].processorUserId).toBe('p-jumbo');
    expect(out.results[0].eligibilityNote).toMatch(/override/i);
  });

  test('returns no_capacity_eligible when eligible processor exists without room', async () => {
    const { runProcessorAssignment } = await loadServiceWithMocks();
    const loan = {
      loanGuid: 'g-3',
      fields: {
        'Loan.LoanNumber': '1003',
        'Loan.BorrowerName': 'Borrower Three',
        'Loan.MortgageType': 'FHA',
      },
    };
    const out = await runProcessorAssignment({
      dryRun: true,
      loans: [loan],
      processors: [{ userId: 'p-fha', maxPoints: 2, products: ['FHA'] }],
      complexityRules: [
        {
          id: 'min_points_rule',
          points: 5,
          when: { field: 'Loan.MortgageType', op: 'isnotempty' },
        },
      ],
      allowIneligibleOverride: false,
    });
    expect(out.results[0].status).toBe('skipped');
    expect(out.results[0].reason).toBe('no_capacity_eligible');
  });

  test('assigns to processor closest to utilization target after impact', async () => {
    const { runProcessorAssignment } = await loadServiceWithMocks();
    const loan = {
      loanGuid: 'g-4',
      fields: {
        'Loan.LoanNumber': '1004',
        'Loan.BorrowerName': 'Borrower Four',
        'Loan.MortgageType': 'FHA',
      },
    };
    const out = await runProcessorAssignment({
      dryRun: true,
      loans: [loan],
      processors: [
        { userId: 'p-low-target', maxPoints: 10, products: ['FHA'], targetUtilization: 0.4 },
        { userId: 'p-high-target', maxPoints: 6, products: ['FHA'], targetUtilization: 0.85 },
      ],
      complexityRules: [
        {
          id: 'score_five',
          points: 5,
          when: { field: 'Loan.MortgageType', op: 'isnotempty' },
        },
      ],
      allowIneligibleOverride: false,
    });
    expect(out.results[0].status).toBe('proposed');
    expect(out.results[0].processorUserId).toBe('p-high-target');
  });

  test('uses weighted capacity impact when deciding assignment', async () => {
    const { runProcessorAssignment } = await loadServiceWithMocks();
    const loan = {
      loanGuid: 'g-5',
      fields: {
        'Loan.LoanNumber': '1005',
        'Loan.BorrowerName': 'Borrower Five',
        'Loan.MortgageType': 'FHA',
      },
    };
    const out = await runProcessorAssignment({
      dryRun: true,
      loans: [loan],
      processors: [
        { userId: 'p-small', maxPoints: 6, products: ['FHA'] },
        { userId: 'p-large', maxPoints: 10, products: ['FHA'] },
      ],
      complexityRules: [
        {
          id: 'score_five',
          points: 5,
          when: { field: 'Loan.MortgageType', op: 'isnotempty' },
        },
      ],
      capacityWeightingMode: 'linear',
      capacityWeightFactor: 1.2,
      allowIneligibleOverride: false,
    });
    expect(out.results[0].status).toBe('proposed');
    expect(out.results[0].capacityImpact).toBe(6);
    expect(out.results[0].processorUserId).toBe('p-large');
    expect(out.usedPointsBasis).toBe('weighted_capacity_impact');
    expect(out.routingConfig.capacityWeightingMode).toBe('linear');
    expect(out.routingConfig.capacityWeightFactor).toBe(1.2);
  });

  test('applies hard-loan multiplier above threshold', async () => {
    const { runProcessorAssignment } = await loadServiceWithMocks();
    const loan = {
      loanGuid: 'g-6',
      fields: {
        'Loan.LoanNumber': '1006',
        'Loan.BorrowerName': 'Borrower Six',
        'Loan.MortgageType': 'FHA',
      },
    };
    const out = await runProcessorAssignment({
      dryRun: true,
      loans: [loan],
      processors: [
        { userId: 'p-limited', maxPoints: 9, products: ['FHA'] },
        { userId: 'p-room', maxPoints: 12, products: ['FHA'] },
      ],
      complexityRules: [
        {
          id: 'score_five',
          points: 5,
          when: { field: 'Loan.MortgageType', op: 'isnotempty' },
        },
      ],
      hardLoanThreshold: 4,
      hardLoanWeightMultiplier: 2,
      allowIneligibleOverride: false,
    });
    expect(out.results[0].status).toBe('proposed');
    expect(out.results[0].capacityImpact).toBe(10);
    expect(out.results[0].processorUserId).toBe('p-room');
  });
});
