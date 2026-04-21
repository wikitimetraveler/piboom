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
});
