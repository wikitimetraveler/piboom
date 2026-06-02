/**
 * Development work by David Lane
 */
/**
 * Build structured failure analysis from a unit test run (no LLM).
 * @param {{ failures?: object[], results?: object[], summary?: string }} testContext
 * @returns {Array<{ rootCause: string, field: string, scenario: string, suggestedFix: string }>}
 */
export function buildStructuredFailureAnalysis(testContext) {
  const failures =
    testContext?.failures ||
    (testContext?.results || []).filter((r) => r && r.status === 'err');
  if (!failures.length) return [];

  return failures.map((f) => {
    const action = String(f.action || '').toUpperCase();
    const target = String(f.target || f.fieldId || '').replace(/^\[|\]$/g, '');
    const message = String(f.message || '');
    const scenario = f.testNumber != null ? String(f.testNumber) : '';

    let rootCause = 'Test step failed';
    let suggestedFix = 'Review the step, expected value, and loan state.';

    if (/mismatch/i.test(message)) {
      rootCause = 'COMPARE expected value does not match Encompass field';
      suggestedFix =
        'Verify SET rows ran successfully, confirm field is writable, and adjust expected value or compare mode (approx/date).';
    } else if (/missing loan guid/i.test(message)) {
      rootCause = 'Loan GUID not configured';
      suggestedFix = 'Enter a valid loan GUID in the toolbar before running tests.';
    } else if (action === 'SET' && /skip|calculated|read-only/i.test(message)) {
      rootCause = 'SET skipped on calculated or read-only field';
      suggestedFix = 'Remove SET for calculated fields or use COMPARE only after manual loan setup.';
    } else if (/get failed|compare get failed/i.test(message)) {
      rootCause = 'Encompass field-reader API error';
      suggestedFix = 'Check Hub connectivity, field ID spelling, and loan permissions.';
    }

    return {
      rootCause,
      field: target,
      scenario,
      suggestedFix,
    };
  });
}
