/**
 * Development work by David Lane
 */
import { buildStructuredFailureAnalysis } from '../../services/unit-tests-ai-analysis.service.js';

describe('unit-tests-ai-analysis.service', () => {
  test('buildStructuredFailureAnalysis maps COMPARE mismatches', () => {
    const rows = buildStructuredFailureAnalysis({
      failures: [
        {
          action: 'COMPARE',
          target: '[CX.TYPE]',
          testNumber: 2,
          message: 'Compare mismatch: expected "Y", got "N"',
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].field).toBe('CX.TYPE');
    expect(rows[0].scenario).toBe('2');
    expect(rows[0].rootCause).toMatch(/COMPARE/i);
  });

  test('returns empty array when no failures', () => {
    expect(buildStructuredFailureAnalysis({ failures: [] })).toEqual([]);
  });
});
