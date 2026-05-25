/**
 * Development work by David Lane
 */
import {
  buildAiFieldSummary,
  parseAiComplexityJson,
} from '../../services/loan-complexity-ai.service.js';

describe('loan-complexity-ai.service', () => {
  test('buildAiFieldSummary keeps only known keys', () => {
    const fields = {
      'Loan.LoanNumber': '1001',
      'Loan.Extra': 'x',
      'Fields.CX.BORROWER.SELF.EMPLOYED': 'Y',
    };
    expect(buildAiFieldSummary(fields)).toEqual({
      'Loan.LoanNumber': '1001',
      'Fields.CX.BORROWER.SELF.EMPLOYED': 'Y',
    });
  });

  test('parseAiComplexityJson clamps points and trims rationale', () => {
    expect(parseAiComplexityJson({ points: 999, rationale: 'x'.repeat(600) })).toEqual({
      points: 50,
      rationale: 'x'.repeat(500),
    });
    expect(parseAiComplexityJson('not json')).toEqual({ points: 0, rationale: '' });
  });
});
