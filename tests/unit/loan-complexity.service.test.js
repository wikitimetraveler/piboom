import {
  scoreLoanWithRules,
  validateComplexityRules,
} from '../../services/loan-complexity.service.js';

describe('loan-complexity.service', () => {
  test('validateComplexityRules rejects non-array', () => {
    expect(validateComplexityRules(null).ok).toBe(false);
  });

  test('scoreLoanWithRules sums matching rules', () => {
    const fields = {
      'Loan.LoanAmount': '750000',
      'Fields.4000': 'FHA',
    };
    const rules = [
      { id: 'high_balance', points: 10, when: { field: 'Loan.LoanAmount', op: 'gte', value: 500000 } },
      { id: 'fha', points: 3, when: { field: 'Fields.4000', op: 'eq', value: 'FHA' } },
      { id: 'miss', points: 99, when: { field: 'Loan.LoanType', op: 'eq', value: 'VA' } },
    ];
    const { score, ruleHits } = scoreLoanWithRules(fields, rules);
    expect(score).toBe(13);
    expect(ruleHits).toHaveLength(2);
  });

  test('scoreLoanWithRules supports all and any', () => {
    const fields = { 'Loan.TotalDTI': '45', 'Fields.1172': 'Conventional' };
    const rules = [
      {
        id: 'combo',
        points: 5,
        when: {
          all: [
            { field: 'Loan.TotalDTI', op: 'gte', value: 40 },
            { field: 'Fields.1172', op: 'contains', value: 'Conv' },
          ],
        },
      },
      {
        id: 'anyone',
        points: 2,
        when: {
          any: [
            { field: 'Loan.TotalDTI', op: 'gte', value: 99 },
            { field: 'Fields.1172', op: 'eq', value: 'Conventional' },
          ],
        },
      },
    ];
    const { score } = scoreLoanWithRules(fields, rules);
    expect(score).toBe(7);
  });

  test('complexityMaxPoints caps score', () => {
    const fields = { 'Loan.LoanAmount': '1000000' };
    const rules = [{ points: 50, when: { field: 'Loan.LoanAmount', op: 'gte', value: 1 } }];
    expect(scoreLoanWithRules(fields, rules, { maxPoints: 12 }).score).toBe(12);
  });

  test('between and in operators', () => {
    const fields = { 'Loan.LoanAmount': '550000', 'Fields.4000': 'VA' };
    const rules = [
      { points: 4, when: { field: 'Loan.LoanAmount', op: 'between', min: 500000, max: 600000 } },
      { points: 1, when: { field: 'Fields.4000', op: 'in', values: ['FHA', 'VA'] } },
    ];
    expect(scoreLoanWithRules(fields, rules).score).toBe(5);
  });
});
