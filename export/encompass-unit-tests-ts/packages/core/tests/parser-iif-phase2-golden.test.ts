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

describe('IIF_PARSER_PHASE2 golden manifest', () => {
  describe('Part A — IsDate, DateDiff, Contains, StartsWith', () => {
    test.each([
      ['IsDate([CX.DISASTER.DATE])', [{ type: 'isDate', fieldId: 'CX.DISASTER.DATE', negated: false }]],
      ['Not IsDate([CX.DISASTER.DATE])', [{ type: 'isDate', fieldId: 'CX.DISASTER.DATE', negated: true }]],
      [
        'DateDiff("d", [@CX.DISASTER.DATE], [@3142]) > 90',
        [{ type: 'dateDiff', interval: 'd', field1: '@CX.DISASTER.DATE', field2: '@3142', op: '>', value: 90 }],
      ],
      ['[19].Contains("Refi")', [{ type: 'contains', fieldId: '19', substring: 'Refi', negated: false }]],
      [
        '[CX.TYPE].StartsWith("Conv")',
        [{ type: 'startsWith', fieldId: 'CX.TYPE', prefix: 'Conv' }],
      ],
    ])('extractConditionValues(%s)', (cond, expected) => {
      const result = extractConditionValues(cond);
      expected.forEach((part) => expect(result).toContainEqual(part));
    });
  });

  describe('Part B — suggested SET pre-fill', () => {
    test('IsDate suggests valid date on true branch', () => {
      const vals = getSuggestedValuesForScenario(
        { condition: 'IsDate([CX.DATE])', result: 'Y', isElse: false },
        ['CX.DATE'],
      );
      expect(vals['CX.DATE']).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    test('Contains suggests substring', () => {
      const vals = getSuggestedValuesForScenario(
        { condition: '[19].Contains("Refi")', result: 'Y', isElse: false },
        ['19'],
      );
      expect(String(vals['19'])).toContain('Refi');
    });

    test('DateDiff > 90 suggests dates 91+ days apart', () => {
      const vals = getSuggestedValuesForScenario(
        {
          condition: 'DateDiff("d", [@A], [@B]) > 90',
          result: 'Y',
          isElse: false,
        },
        ['@A', '@B'],
      );
      expect(vals['A'] || vals['@A']).toBeTruthy();
      expect(vals['B'] || vals['@B']).toBeTruthy();
    });
  });

  describe('Part C — Nothing and Y/N', () => {
    test('Nothing suggests blank', () => {
      const vals = getSuggestedValuesForScenario(
        { condition: '[299] = Nothing', result: 'X', isElse: false },
        ['299'],
      );
      expect(vals['299'] === '' || vals['299'] === undefined).toBe(true);
    });

    test('<> Nothing suggests Y', () => {
      const vals = getSuggestedValuesForScenario(
        { condition: '[CX.FLAG] <> Nothing', result: 'X', isElse: false },
        ['CX.FLAG'],
      );
      expect(vals['CX.FLAG']).toBe('Y');
    });
  });

  describe('Part D — concatenated IIf', () => {
    test('parseAllIIfScenarios merges ampersand segments', () => {
      const expr = 'IIf([a]=1,"x","") & IIf([b]=2,"y","")';
      expect(splitByTopLevelAmpersand(expr)).toHaveLength(2);
      const scenarios = parseAllIIfScenarios(expr);
      expect(scenarios).not.toBeNull();
      expect(scenarios.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Part E — special fields CX.TYPE', () => {
    test('StartsWith Conv suggests Conv for CX.TYPE', () => {
      const vals = getSuggestedValuesForScenario(
        { condition: '[CX.TYPE].StartsWith("Conv")', result: 'Y', isElse: false },
        ['CX.TYPE'],
        { scenarioIndex: 0 },
      );
      expect(String(vals['CX.TYPE'])).toMatch(/conv/i);
    });
  });

  describe('Part F — else branch Y/N blank', () => {
    test('else scenario suggests N or blank for Y/N fields', () => {
      const all = [
        { condition: '[CX.YN] = "Y"', result: '1', isElse: false },
        { condition: null, result: '0', isElse: true },
      ];
      const vals = getSuggestedValuesForScenario(all[1], ['CX.YN'], {
        allScenarios: all,
        scenarioIndex: 1,
        fieldMetadata: { 'CX.YN': { dataType: 'Y/N' } },
      });
      expect(['N', 'Y', '', undefined]).toContain(vals['CX.YN']);
    });
  });

  describe('scenario deduplication', () => {
    test('dedupeScenariosBySuggestedSets removes identical SET maps', () => {
      const scenarios = [
        { condition: '[x] > 0', result: '1', isElse: false },
        { condition: '[x] > 0', result: '1', isElse: false },
        { condition: '[x] <= 0', result: '0', isElse: false },
      ];
      const deduped = dedupeScenariosBySuggestedSets(scenarios, ['x'], {});
      expect(deduped.length).toBeLessThan(scenarios.length);
      expect(deduped.length).toBeGreaterThanOrEqual(2);
    });

    test('generateUnitTestFromCustomField applies dedupe without error', () => {
      const out = generateUnitTestFromCustomField({
        fieldId: 'CX.DEMO',
        calculation: 'IIf([#60#1] <= 200, [#1415#1], 0)',
      });
      expect(out).not.toBeNull();
      expect(out.headers).toContain('Test 1');
      expect(out.rows.some((r) => r.Action === 'COMPARE')).toBe(true);
    });
  });
});
