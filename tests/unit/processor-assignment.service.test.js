import {
  findProcessorLogId,
  extractAssociateLogId,
  normalizeAssociatesList,
  normalizeComplexityMode,
  composeComplexityScores,
  currentProcessorFromFields,
} from '../../services/processor-assignment.service.js';

describe('processor-assignment.service helpers', () => {
  test('normalizeAssociatesList handles array and wrapper', () => {
    expect(normalizeAssociatesList([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(normalizeAssociatesList({ associates: [{ b: 2 }] })).toEqual([{ b: 2 }]);
  });

  test('extractAssociateLogId reads common keys', () => {
    expect(extractAssociateLogId({ logId: 'L1' })).toBe('L1');
    expect(extractAssociateLogId({ LogId: 'L2' })).toBe('L2');
    expect(extractAssociateLogId({ id: 'L3' })).toBe('L3');
  });

  test('findProcessorLogId matches role name includes', () => {
    const data = [
      { logId: '99', roleName: 'Loan Officer' },
      { logId: '100', roleName: 'Processor' },
    ];
    expect(findProcessorLogId(data, { roleNameIncludes: 'processor' })).toBe('100');
  });

  test('findProcessorLogId respects fixedRoleId filter', () => {
    const data = [
      { logId: '1', roleName: 'Processor', fixedRoleId: 'A' },
      { logId: '2', roleName: 'Processor', fixedRoleId: 'B' },
    ];
    expect(findProcessorLogId(data, { roleNameIncludes: 'processor', fixedRoleId: 'B' })).toBe('2');
  });

  test('normalizeComplexityMode', () => {
    expect(normalizeComplexityMode('AI')).toBe('ai');
    expect(normalizeComplexityMode('Both')).toBe('both');
    expect(normalizeComplexityMode(undefined)).toBe('rules');
  });

  test('composeComplexityScores caps total', () => {
    expect(
      composeComplexityScores({ mode: 'both', rulesScore: 30, aiPoints: 40, maxPoints: 50 }),
    ).toBe(50);
    expect(composeComplexityScores({ mode: 'ai', rulesScore: 99, aiPoints: 12, maxPoints: null })).toBe(12);
    expect(composeComplexityScores({ mode: 'rules', rulesScore: 12, aiPoints: 99, maxPoints: null })).toBe(12);
  });

  test('currentProcessorFromFields reads Loan.LoanProcessorID and name', () => {
    const f = currentProcessorFromFields({
      'Loan.LoanProcessorID': 'u-1',
      'Loan.LoanProcessorName': 'Jane P',
    });
    expect(f.currentProcessorId).toBe('u-1');
    expect(f.currentProcessorName).toBe('Jane P');
  });

  test('currentProcessorFromFields returns nulls when empty', () => {
    const f = currentProcessorFromFields({});
    expect(f.currentProcessorId).toBeNull();
    expect(f.currentProcessorName).toBeNull();
  });
});
