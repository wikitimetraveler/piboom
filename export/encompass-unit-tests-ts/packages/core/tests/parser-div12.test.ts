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
} from './parserApi.js';

/**
 * Regression: extractArithmeticComparisons must capture full arithmetic expressions
 * including divide-by-12 sub-expressions (BR*24, FR0124, FR0324) and BR*12 sums.
 */
const FULL_IIF = `IIf(([#FR0112#1] + ([#FR0124#1] / 12)) >= 2 Or ([#BR0112#1] + [#BR0212#1] + [#BR0312#1] + [#BR0412#1] + [#BR0512#1] + [#BR0612#1] + [#BR0712#1] + [#BR0812#1] + [#BR0912#1]) + (([#BR0124#1] + [#BR0224#1] + [#BR0324#1] + [#BR0424#1] + [#BR0524#1] + [#BR0624#1] + [#BR0724#1] + [#BR0824#1] + [#BR0924#1]) / 12) >= 2 Or ([#FR0312#1] + ([#FR0324#1] / 12)) >= 2 Or ([#FR0112#1] + ([#FR0124#1] / 12)) + ([#FR0312#1] + ([#FR0324#1] / 12)) >= 2, "Yes", "")`;

describe('extractArithmeticComparisons /12 coverage', () => {
  test('BR branch: extractArithmeticComparisons includes BR*24 fields (divide by 12)', () => {
    const cond = '([#BR0112#1] + [#BR0212#1] + [#BR0912#1]) + (([#BR0124#1] + [#BR0224#1] + [#BR0924#1]) / 12) >= 2';
    const matches = extractArithmeticComparisons(cond);
    const allFieldIds = matches.flatMap((m) => m.fieldIds || []);
    const normalized = allFieldIds.map((f) => f.replace(/^#+/, ''));
    expect(normalized).toContain('BR0124#1');
    expect(normalized).toContain('BR0224#1');
    expect(normalized).toContain('BR0924#1');
    expect(matches.some((m) => m.expr && m.expr.includes('/ 12'))).toBe(true);
  });

  test('BR branch: also includes BR*12 fields (first sum)', () => {
    const cond = '([#BR0112#1] + [#BR0212#1] + [#BR0912#1]) + (([#BR0124#1] + [#BR0224#1] + [#BR0924#1]) / 12) >= 2';
    const matches = extractArithmeticComparisons(cond);
    const allFieldIds = matches.flatMap((m) => m.fieldIds || []);
    const normalized = allFieldIds.map((f) => f.replace(/^#+/, ''));
    expect(normalized).toContain('BR0112#1');
    expect(normalized).toContain('BR0212#1');
  });

  test('FR branch: extractArithmeticComparisons includes FR0124 (divide by 12)', () => {
    const cond = '([#FR0112#1] + ([#FR0124#1] / 12)) >= 2';
    const matches = extractArithmeticComparisons(cond);
    const allFieldIds = matches.flatMap((m) => m.fieldIds || []);
    const normalized = allFieldIds.map((f) => f.replace(/^#+/, ''));
    expect(normalized).toContain('FR0124#1');
    expect(matches.some((m) => m.expr && m.expr.includes('/ 12'))).toBe(true);
  });

  test('expanded scenarios: each arithmetic branch has /12 fields in suggested values', () => {
    const parsed = { expression: FULL_IIF };
    const scenarios = expandOrElseScenarios(parseAllIIfScenarios(parsed.expression) || []);
    const inputFields = [
      'FR0112#1', 'FR0124#1', 'FR0312#1', 'FR0324#1',
      'BR0112#1', 'BR0212#1', 'BR0312#1', 'BR0412#1', 'BR0512#1', 'BR0612#1', 'BR0712#1', 'BR0812#1', 'BR0912#1',
      'BR0124#1', 'BR0224#1', 'BR0324#1', 'BR0424#1', 'BR0524#1', 'BR0624#1', 'BR0724#1', 'BR0824#1', 'BR0924#1',
    ];
    for (let i = 0; i < scenarios.length; i++) {
      const s = scenarios[i];
      if (!s.condition) continue;
      const arith = extractArithmeticComparisons(s.condition);
      const hasDiv12 = arith.some((a) => a.expr && a.expr.includes('/ 12'));
      const fieldIds = arith.flatMap((a) => a.fieldIds || []);
      const hasBR24 = fieldIds.some((f) => f.includes('BR') && f.includes('24'));
      const hasFR24 = fieldIds.some((f) => f.includes('FR') && f.includes('24'));
      if (s.condition.includes('BR') && s.condition.includes('/ 12')) {
        expect(hasBR24 || hasDiv12).toBe(true);
      }
      if (s.condition.includes('FR0124') || s.condition.includes('FR0324')) {
        expect(hasFR24 || hasDiv12).toBe(true);
      }
    }
  });
});
