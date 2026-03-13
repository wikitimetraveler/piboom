/**
 * Test the exact IIf formula from the user to verify all fields are evaluated.
 */
import '../../public/shared/customFieldCalcParser.js';

const {
  evaluateExpression,
  evaluateCondition,
  getFieldValue,
} = globalThis.customFieldCalcParser;

const FULL_IIF = `IIf(([#FR0112#1] + ([#FR0124#1] / 12)) >= 2 Or ([#BR0112#1] + [#BR0212#1] + [#BR0312#1] + [#BR0412#1] + [#BR0512#1] + [#BR0612#1] + [#BR0712#1] + [#BR0812#1] + [#BR0912#1]) + (([#BR0124#1] + [#BR0224#1] + [#BR0324#1] + [#BR0424#1] + [#BR0524#1] + [#BR0624#1] + [#BR0724#1] + [#BR0824#1] + 
[#BR0924#1]) / 12) >= 2 Or ([#FR0312#1] + ([#FR0324#1] / 12)) >= 2 Or ([#FR0112#1] + ([#FR0124#1] / 12)) + ([#FR0312#1] + ([#FR0324#1] / 12)) >= 2, "Yes", "")`;

describe('Full IIf formula evaluation', () => {
  test('branch 3 (FR0312 + FR0324/12 >= 2) returns Yes when FR0312=2, FR0324=0', () => {
    const values = {
      'FR0312#1': 2,
      'FR0324#1': 0,
    };
    const result = evaluateExpression(FULL_IIF, values);
    expect(result).toBe('Yes');
  });

  test('branch 2 (BR fields) returns Yes when BR sum/12 >= 2', () => {
    const values = {
      'BR0112#1': 0, 'BR0212#1': 0, 'BR0312#1': 0, 'BR0412#1': 0, 'BR0512#1': 0, 'BR0612#1': 0, 'BR0712#1': 0, 'BR0812#1': 0, 'BR0912#1': 0,
      'BR0124#1': 0, 'BR0224#1': 0, 'BR0324#1': 0, 'BR0424#1': 0, 'BR0524#1': 0, 'BR0624#1': 0, 'BR0724#1': 0, 'BR0824#1': 3333, 'BR0924#1': 333,
    };
    // (0+...+0) + ((0+...+3333+333)/12) = 3666/12 = 305.5 >= 2
    const result = evaluateExpression(FULL_IIF, values);
    expect(result).toBe('Yes');
  });

  test('branch 4 (FR0112+FR0124/12 + FR0312+FR0324/12 >= 2) returns Yes', () => {
    const values = {
      'FR0112#1': 1,
      'FR0124#1': 0,
      'FR0312#1': 1,
      'FR0324#1': 0,
    };
    // 1 + 0 + 1 + 0 = 2 >= 2
    const result = evaluateExpression(FULL_IIF, values);
    expect(result).toBe('Yes');
  });

  test('getFieldValue resolves #FR0312#1 from FR0312#1 key', () => {
    const values = { 'FR0312#1': 333 };
    expect(getFieldValue('#FR0312#1', values)).toBe(333);
  });

  test('branch 2: division by 12 applies to sum of BR*24 (24/12=2)', () => {
    const values = {
      'BR0112#1': 0, 'BR0212#1': 0, 'BR0312#1': 0, 'BR0412#1': 0, 'BR0512#1': 0, 'BR0612#1': 0, 'BR0712#1': 0, 'BR0812#1': 0, 'BR0912#1': 0,
      'BR0124#1': 24, 'BR0224#1': 0, 'BR0324#1': 0, 'BR0424#1': 0, 'BR0524#1': 0, 'BR0624#1': 0, 'BR0724#1': 0, 'BR0824#1': 0, 'BR0924#1': 0,
    };
    // (0) + ((24)/12) = 0 + 2 = 2 >= 2
    const result = evaluateExpression(FULL_IIF, values);
    expect(result).toBe('Yes');
  });

  test('branch 2: division by 12 applies to sum (12+12)/12=2', () => {
    const values = {
      'BR0112#1': 0, 'BR0212#1': 0, 'BR0312#1': 0, 'BR0412#1': 0, 'BR0512#1': 0, 'BR0612#1': 0, 'BR0712#1': 0, 'BR0812#1': 0, 'BR0912#1': 0,
      'BR0124#1': 12, 'BR0224#1': 12, 'BR0324#1': 0, 'BR0424#1': 0, 'BR0524#1': 0, 'BR0624#1': 0, 'BR0724#1': 0, 'BR0824#1': 0, 'BR0924#1': 0,
    };
    // (0) + ((12+12)/12) = 24/12 = 2 >= 2
    const result = evaluateExpression(FULL_IIF, values);
    expect(result).toBe('Yes');
  });
});
