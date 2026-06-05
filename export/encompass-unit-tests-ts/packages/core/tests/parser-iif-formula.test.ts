import { describe, expect, test } from 'vitest';
import {
  parseIIfScenarios,
  parseAllIIfScenarios,
  splitByTopLevelAmpersand,
  expandOrElseScenarios,
  extractComparisonValues,
  extractArithmeticComparisons,
  extractConditionValues,
  extractStringComparisons,
  getSuggestedValuesForScenario,
  generateUnitTestFromCustomField,
  parseCalculationFormula,
  normalizeFieldIdForLookup,
  evaluateExpression,
  evaluateCondition,
  isSunriseField,
  formatDateWithOffset,
  formatDateForEncompassWriter,
  parseLoanDateValue,
  reloadLearnedSetHintsCache,
  LEARNED_SET_HINTS_STORAGE_KEY,
  dedupeScenariosBySuggestedSets,
  getFieldValue,
} from './parserApi.js';

/**
 * Test the exact IIf formula from the user to verify all fields are evaluated.
 */
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

/**
 * NQM eligibility formula: TPO.X88 <> Y AndAlso (AUS Jumbo | NQM Expanded | NQM DSCR | Jumbo | Express)
 * with Not [CX.SUB.NQM.*].contains("ND") checks.
 */
const NQM_IIF = `IIf(
  [TPO.X88] <> "Y"  
  AndAlso
  (
    (
      (
        [1401].contains ( "AUS Jumbo" )
        OrElse [2866].contains ( "AUS Jumbo" )
      )
      AndAlso Not [CX.SUB.NQM.EXPRESS].contains ( "ND" )
    )
    OrElse
    (
      (
        [1401].contains ( "NQM Expanded" )
        OrElse [2866].contains ( "NQM Expanded" )
      )
      AndAlso Not [CX.SUB.NQM.EXPANDED].contains ( "ND" )
    )
    OrElse
    (
      (
        [1401].contains ( "NQM DSCR" )
        OrElse [2866].contains ( "NQM DSCR" )
      )
      AndAlso Not [CX.SUB.NQM.DSCR].contains ( "ND" )
    )
    OrElse
    (
      (
        [1401].contains ( "Jumbo" ) AndAlso Not( [1401].contains ( "AUS" ))
        OrElse ([2866].contains ( "Jumbo" ) AndAlso Not([2866].contains("AUS" )))
      )
      AndAlso Not [CX.SUB.NQM.JUMBO].contains ( "ND" )
    )
    OrElse
    (
      (
        [1401].contains ( "Express" ) AndAlso Not( [1401].contains ( "AUS" ))
        OrElse ([2866].contains ( "Express" ) AndAlso Not([2866].contains("AUS" )))
      )
      AndAlso Not [CX.SUB.NQM.EXPRESS].contains ( "ND" )
    )
  )
  ,
  "Y",
  "N"
)`;

describe('NQM IIf formula (Not contains, corrected Express block)', () => {
  test('returns N when TPO.X88 is Y', () => {
    const values = {
      'TPO.X88': 'Y',
      '1401': 'AUS Jumbo',
      '2866': '',
      'CX.SUB.NQM.EXPRESS': '',
    };
    expect(evaluateExpression(NQM_IIF, values)).toBe('N');
  });

  test('returns Y when 1401 has AUS Jumbo and CX.SUB.NQM.EXPRESS does not contain ND', () => {
    const values = {
      'TPO.X88': 'N',
      '1401': 'AUS Jumbo',
      '2866': '',
      'CX.SUB.NQM.EXPRESS': 'Approved',
    };
    expect(evaluateExpression(NQM_IIF, values)).toBe('Y');
  });

  test('returns N when 1401 has AUS Jumbo but CX.SUB.NQM.EXPRESS contains ND', () => {
    const values = {
      'TPO.X88': 'N',
      '1401': 'AUS Jumbo',
      '2866': '',
      'CX.SUB.NQM.EXPRESS': 'ND',
    };
    expect(evaluateExpression(NQM_IIF, values)).toBe('N');
  });

  test('returns Y when 2866 has Express (not AUS) and CX.SUB.NQM.EXPRESS does not contain ND', () => {
    const values = {
      'TPO.X88': 'N',
      '1401': '',
      '2866': 'Express',
      'CX.SUB.NQM.EXPRESS': 'Approved',
      'CX.SUB.NQM.EXPANDED': '',
      'CX.SUB.NQM.DSCR': '',
      'CX.SUB.NQM.JUMBO': '',
    };
    const block5IIf = `IIf([TPO.X88] <> "Y" AndAlso ((([1401].contains("Express") AndAlso Not([1401].contains("AUS"))) OrElse ([2866].contains("Express") AndAlso Not([2866].contains("AUS")))) AndAlso Not [CX.SUB.NQM.EXPRESS].contains("ND")),"Y","N")`;
    expect(evaluateExpression(block5IIf, values)).toBe('Y');
  });

  test('Not contains("ND") evaluates correctly', () => {
    const cond = 'Not [CX.SUB.NQM.EXPRESS].contains ( "ND" )';
    expect(evaluateCondition(cond, { 'CX.SUB.NQM.EXPRESS': 'Approved' })).toBe(true);
    expect(evaluateCondition(cond, { 'CX.SUB.NQM.EXPRESS': 'ND' })).toBe(false);
    expect(evaluateCondition(cond, { 'CX.SUB.NQM.EXPRESS': 'Pending ND review' })).toBe(false);
  });

  test('smart quotes in literals still evaluate (Excel/Word paste)', () => {
    const iif =
      'IIf([TPO.X88] <> \u201CY\u201D AndAlso [1401].contains ( \u201CAUS Jumbo\u201D ), \u201CY\u201D, \u201CN\u201D)';
    expect(evaluateExpression(iif, { 'TPO.X88': 'N', '1401': 'AUS Jumbo' })).toBe('Y');
  });

});
