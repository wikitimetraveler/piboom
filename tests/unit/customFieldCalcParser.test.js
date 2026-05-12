import '../../public/shared/customFieldCalcParser.js';

const {
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
  reloadLearnedSetHintsCache,
  LEARNED_SET_HINTS_STORAGE_KEY,
} = globalThis.customFieldCalcParser;

describe('customFieldCalcParser', () => {
  describe('parseIIfScenarios', () => {
    test('returns null for non-IIf expression', () => {
      expect(parseIIfScenarios('[4002] + [4003]')).toBeNull();
      expect(parseIIfScenarios('')).toBeNull();
      expect(parseIIfScenarios(null)).toBeNull();
    });

    test('parses simple IIf with two branches', () => {
      const result = parseIIfScenarios('IIf([#60#1] <= 200, [#1415#1], 0)');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        condition: '[#60#1] <= 200',
        result: '[#1415#1]',
        isElse: false,
      });
      expect(result[1]).toEqual({
        condition: null,
        result: '0',
        isElse: true,
      });
    });

    test('parses nested IIf with four branches', () => {
      const formula =
        'IIf([#60#1] <= 200 And [#1452#1] <= 200, [#1415#1],' +
        'IIf([#60#1] <= 200 And [#1415#1] <= 200,[#1452#1],' +
        'IIf([#1452#1] <= 200 And [#1415#1] <= 200,[#60#1],' +
        'LMedian([60#1], [1452#1], [1415#1]))))';
      const result = parseIIfScenarios(formula);
      expect(result).toHaveLength(4);
      expect(result[0].condition).toBe('[#60#1] <= 200 And [#1452#1] <= 200');
      expect(result[0].result).toBe('[#1415#1]');
      expect(result[1].condition).toBe('[#60#1] <= 200 And [#1415#1] <= 200');
      expect(result[1].result).toBe('[#1452#1]');
      expect(result[2].condition).toBe('[#1452#1] <= 200 And [#1415#1] <= 200');
      expect(result[2].result).toBe('[#60#1]');
      expect(result[3].isElse).toBe(true);
      expect(result[3].result).toContain('LMedian');
    });

    test('handles IIF case insensitively', () => {
      const result = parseIIfScenarios('IIF([x] > 0, 1, 0)');
      expect(result).toHaveLength(2);
      expect(result[0].condition).toBe('[x] > 0');
    });
  });

  describe('splitByTopLevelAmpersand', () => {
    test('returns empty for empty or invalid input', () => {
      expect(splitByTopLevelAmpersand('')).toEqual([]);
      expect(splitByTopLevelAmpersand(null)).toEqual([]);
    });

    test('returns single segment when no &', () => {
      const result = splitByTopLevelAmpersand('IIf([a]=1,"x","")');
      expect(result).toEqual(['IIf([a]=1,"x","")']);
    });

    test('splits by top-level & only', () => {
      const expr = 'IIf([a]=1,"x","") & IIf([b]=2,"y","") & IIf([c]=3,"z","")';
      const result = splitByTopLevelAmpersand(expr);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe('IIf([a]=1,"x","")');
      expect(result[1]).toBe('IIf([b]=2,"y","")');
      expect(result[2]).toBe('IIf([c]=3,"z","")');
    });

    test('ignores & inside parentheses', () => {
      const expr = 'IIf([a] & [b] = "xy", "ok", "no")';
      const result = splitByTopLevelAmpersand(expr);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('IIf([a] & [b] = "xy", "ok", "no")');
    });

    test('ignores & inside quotes', () => {
      const expr = 'IIf([a]="x&y","ok","no")';
      const result = splitByTopLevelAmpersand(expr);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('IIf([a]="x&y","ok","no")');
    });
  });

  describe('parseAllIIfScenarios (concatenated IIf)', () => {
    test('returns null for non-IIf expression', () => {
      expect(parseAllIIfScenarios('[4002] + [4003]')).toBeNull();
      expect(parseAllIIfScenarios('')).toBeNull();
    });

    test('parses single IIf same as parseIIfScenarios', () => {
      const expr = 'IIf([#60#1] <= 200, [#1415#1], 0)';
      const single = parseIIfScenarios(expr);
      const all = parseAllIIfScenarios(expr);
      expect(all).toHaveLength(single.length);
      expect(all[0]).toEqual(single[0]);
      expect(all[1]).toEqual(single[1]);
    });

    test('merges scenarios from concatenated IIf blocks', () => {
      const expr = 'IIf([a]=1,"x","") & IIf([b]=2,"y","") & IIf([c]=3,"z","")';
      const result = parseAllIIfScenarios(expr);
      expect(result).not.toBeNull();
      expect(result.length).toBeGreaterThanOrEqual(6);
      const conds = result.map((r) => r.condition).filter(Boolean);
      expect(conds).toContain('[a]=1');
      expect(conds).toContain('[b]=2');
      expect(conds).toContain('[c]=3');
    });

    test('generateUnitTestFromCustomField uses concatenated scenarios', () => {
      const customField = {
        fieldId: 'CX.OUT',
        calculation: 'IIf([a]=1,"x","") & IIf([b]=2,"y","")',
      };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      expect(result.testDescriptions.length).toBeGreaterThanOrEqual(2);
      const setRows = result.rows.filter((r) => r.Action === 'SET');
      const rowA = setRows.find((r) => r.Target === '[a]');
      const rowB = setRows.find((r) => r.Target === '[b]');
      expect(rowA).toBeDefined();
      expect(rowB).toBeDefined();
    });

    test('concatenated IIf with Y conditions generates N and blank for else scenarios', () => {
      const formula =
        'IIf([4002#1] <> Nothing AndAlso ([FE0154#1] = "Y" OrElse [FE0354#1] = "Y"), "B1, ", "") & ' +
        'IIf([4006#1] <> Nothing AndAlso [FE0254#1] = "Y", "C1, ", "")';
      const customField = { fieldId: 'CX.OUT', calculation: formula };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      const setRows = result.rows.filter((r) => r.Action === 'SET');
      const rowFE0154 = setRows.find((r) => r.Target === '[FE0154#1]');
      const rowFE0354 = setRows.find((r) => r.Target === '[FE0354#1]');
      expect(rowFE0154).toBeDefined();
      expect(rowFE0354).toBeDefined();
      const values0154 = [rowFE0154['Test 1'], rowFE0154['Test 2'], rowFE0154['Test 3'], rowFE0154['Test 4'], rowFE0154['Test 5']].filter((v) => v !== undefined);
      const values0354 = [rowFE0354['Test 1'], rowFE0354['Test 2'], rowFE0354['Test 3'], rowFE0354['Test 4'], rowFE0354['Test 5']].filter((v) => v !== undefined);
      const hasN = values0154.some((v) => v === 'N') || values0354.some((v) => v === 'N');
      const hasBlank = values0154.some((v) => v === '') || values0354.some((v) => v === '');
      expect(hasN || hasBlank).toBe(true);
    });
  });

  describe('splitOrElseBranches (Or and And)', () => {
    test('splits on Or (Encompass style) in addition to OrElse', () => {
      const cond = '([#FR0112#2] + ([#FR0124#2] / 12)) >= 2 Or ([#FR0312#2] + ([#FR0324#2] / 12)) >= 2';
      const parts = expandOrElseScenarios([{ condition: cond, result: '"Yes"', isElse: false }]);
      expect(parts.length).toBeGreaterThanOrEqual(2);
    });

    test('splits on And in addition to AndAlso', () => {
      const cond = '[a] >= 1 And [b] >= 2';
      const result = evaluateCondition(cond, { a: 1, b: 2 });
      expect(result).toBe(true);
    });

    test('handles And/AndAlso case-insensitively (Encompass style)', () => {
      expect(evaluateCondition('[a] >= 1 and [b] >= 2', { a: 1, b: 2 })).toBe(true);
      expect(evaluateCondition('[a] >= 1 AND [b] >= 2', { a: 1, b: 2 })).toBe(true);
      expect(evaluateCondition('[a] >= 1 andalso [b] >= 2', { a: 1, b: 2 })).toBe(true);
    });

    test('handles Or/OrElse case-insensitively (Encompass style)', () => {
      expect(evaluateExpression('IIf([a] >= 1 or [b] >= 2, "Yes", "")', { a: 0, b: 2 })).toBe('Yes');
      expect(evaluateExpression('IIf([a] >= 1 OR [b] >= 2, "Yes", "")', { a: 0, b: 2 })).toBe('Yes');
      expect(evaluateExpression('IIf([a] >= 1 orelse [b] >= 2, "Yes", "")', { a: 0, b: 2 })).toBe('Yes');
    });
  });

  describe('extractComparisonValues', () => {
    test('returns empty array for empty or invalid input', () => {
      expect(extractComparisonValues('')).toEqual([]);
      expect(extractComparisonValues(null)).toEqual([]);
    });

    test('extracts <= comparisons', () => {
      const result = extractComparisonValues('[#60#1] <= 200 And [#1452#1] <= 200');
      expect(result).toEqual([
        { fieldId: '#60#1', op: '<=', value: 200 },
        { fieldId: '#1452#1', op: '<=', value: 200 },
      ]);
    });

    test('extracts >=, <, >, = operators', () => {
      const result = extractComparisonValues('[a] >= 10 And [b] < 5 And [c] > 0 And [d] = 100');
      expect(result).toEqual([
        { fieldId: 'a', op: '>=', value: 10 },
        { fieldId: 'b', op: '<', value: 5 },
        { fieldId: 'c', op: '>', value: 0 },
        { fieldId: 'd', op: '=', value: 100 },
      ]);
    });

    test('handles decimal values', () => {
      const result = extractComparisonValues('[x] <= 199.5');
      expect(result).toEqual([{ fieldId: 'x', op: '<=', value: 199.5 }]);
    });
  });

  describe('extractArithmeticComparisons', () => {
    test('extracts arithmetic expr comparisons', () => {
      const result = extractArithmeticComparisons('([#FR0112#2] + ([#FR0124#2] / 12)) >= 2');
      expect(result).toHaveLength(1);
      expect(result[0].op).toBe('>=');
      expect(result[0].value).toBe(2);
      expect(result[0].fieldIds).toContain('#FR0112#2');
      expect(result[0].fieldIds).toContain('#FR0124#2');
    });

    test('does not match DateDiff (no arithmetic operators)', () => {
      const result = extractArithmeticComparisons('DateDiff("d", [@A], [@B]) > 90');
      expect(result).toHaveLength(0);
    });
  });

  describe('normalizeFieldIdForLookup (borrower pair)', () => {
    test('strips leading # typecast, keeps borrower pair #n by default', () => {
      expect(normalizeFieldIdForLookup('#FR0112#2')).toBe('FR0112#2');
    });

    test('strips trailing #n when stripBorrowerPair option is true', () => {
      expect(normalizeFieldIdForLookup('#FR0112#2', { stripBorrowerPair: true })).toBe('FR0112');
    });
  });

  describe('evaluateExpression (arithmetic conditions, Or, borrower pair)', () => {
    const formula =
      'IIf(([#FR0112#2] + ([#FR0124#2] / 12)) >= 2 Or ([#FR0312#2] + ([#FR0324#2] / 12)) >= 2, "Yes", "")';

    test('returns "Yes" when first arithmetic branch is true', () => {
      const values = { 'FR0112#2': 2, 'FR0124#2': 0, 'FR0312#2': 0, 'FR0324#2': 0 };
      expect(evaluateExpression(formula, values)).toBe('Yes');
    });

    test('returns "Yes" when second arithmetic branch is true', () => {
      const values = { 'FR0112#2': 0, 'FR0124#2': 0, 'FR0312#2': 2, 'FR0324#2': 0 };
      expect(evaluateExpression(formula, values)).toBe('Yes');
    });

    test('returns "" when both branches are false', () => {
      const values = { 'FR0112#2': 0, 'FR0124#2': 0, 'FR0312#2': 0, 'FR0324#2': 0 };
      expect(evaluateExpression(formula, values)).toBe('');
    });

    test('builder mode: values keyed without #n suffix still resolve', () => {
      const values = { FR0112: 2, FR0124: 0, FR0312: 0, FR0324: 0 };
      expect(evaluateExpression(formula, values)).toBe('Yes');
    });

    test('full FR/BR formula: all four Or branches', () => {
      const fullFormula =
        'IIf(([#FR0112#2] + ([#FR0124#2] / 12)) >= 2 Or ([#BR0112#2] + [#BR0212#2]) + (([#BR0124#2] + [#BR0224#2]) / 12) >= 2 Or ([#FR0312#2] + ([#FR0324#2] / 12)) >= 2 Or ([#FR0112#2] + ([#FR0124#2] / 12)) + ([#FR0312#2] + ([#FR0324#2] / 12)) >= 2, "Yes", "")';
      expect(evaluateExpression(fullFormula, { FR0112: 2, FR0124: 0 })).toBe('Yes');
      expect(evaluateExpression(fullFormula, { BR0112: 1, BR0212: 1, BR0124: 0, BR0224: 0 })).toBe('Yes');
      expect(evaluateExpression(fullFormula, { FR0312: 2, FR0324: 0 })).toBe('Yes');
      expect(evaluateExpression(fullFormula, { FR0112: 1, FR0124: 0, FR0312: 1, FR0324: 0 })).toBe('Yes');
      expect(evaluateExpression(fullFormula, {})).toBe('');
    });

    test('user formula with #1 borrower and four Or branches', () => {
      const formula =
        'IIf(([#FR0112#1] + ([#FR0124#1] / 12)) >= 2 Or ([#BR0112#1] + [#BR0212#1] + [#BR0312#1] + [#BR0412#1] + [#BR0512#1] + [#BR0612#1] + [#BR0712#1] + [#BR0812#1] + [#BR0912#1]) + (([#BR0124#1] + [#BR0224#1] + [#BR0324#1] + [#BR0424#1] + [#BR0524#1] + [#BR0624#1] + [#BR0724#1] + [#BR0824#1] + [#BR0924#1]) / 12) >= 2 Or ([#FR0312#1] + ([#FR0324#1] / 12)) >= 2 Or ([#FR0112#1] + ([#FR0124#1] / 12)) + ([#FR0312#1] + ([#FR0324#1] / 12)) >= 2, "Yes", "")';
      expect(evaluateExpression(formula, { FR0112: 2, FR0124: 0 })).toBe('Yes');
      expect(evaluateExpression(formula, { FR0312: 2, FR0324: 0 })).toBe('Yes');
      expect(evaluateExpression(formula, { FR0112: 1, FR0124: 0, FR0312: 1, FR0324: 0 })).toBe('Yes');
      expect(evaluateExpression(formula, { BR0112: 1, BR0212: 1, BR0124: 0, BR0224: 0 })).toBe('Yes');
      expect(evaluateExpression(formula, {})).toBe('');
    });

    test('all four Or branches evaluated independently (branches 3 and 4)', () => {
      const formula =
        'IIf(([#FR0112#1] + ([#FR0124#1] / 12)) >= 2 Or ([#BR0112#1] + [#BR0212#1] + [#BR0312#1] + [#BR0412#1] + [#BR0512#1] + [#BR0612#1] + [#BR0712#1] + [#BR0812#1] + [#BR0912#1]) + (([#BR0124#1] + [#BR0224#1] + [#BR0324#1] + [#BR0424#1] + [#BR0524#1] + [#BR0624#1] + [#BR0724#1] + [#BR0824#1] + [#BR0924#1]) / 12) >= 2 Or ([#FR0312#1] + ([#FR0324#1] / 12)) >= 2 Or ([#FR0112#1] + ([#FR0124#1] / 12)) + ([#FR0312#1] + ([#FR0324#1] / 12)) >= 2, "Yes", "")';
      expect(evaluateExpression(formula, { FR0312: 2, FR0324: 0 })).toBe('Yes');
      expect(evaluateExpression(formula, { FR0112: 1, FR0124: 0, FR0312: 1, FR0324: 0 })).toBe('Yes');
      expect(evaluateExpression(formula, { BR0112: 2, BR0124: 0 })).toBe('Yes');
    });

    test('formula with newline (Encompass paste) still evaluates all four Or branches', () => {
      const formulaWithNewline =
        'IIf(([#FR0112#1] + ([#FR0124#1] / 12)) >= 2 Or ([#BR0112#1] + [#BR0212#1] + [#BR0312#1] + [#BR0412#1] + [#BR0512#1] + [#BR0612#1] + [#BR0712#1] + [#BR0812#1] +\n[#BR0912#1]) + (([#BR0124#1] + [#BR0224#1] + [#BR0324#1] + [#BR0424#1] + [#BR0524#1] + [#BR0624#1] + [#BR0724#1] + [#BR0824#1] +\n[#BR0924#1]) / 12) >= 2 Or ([#FR0312#1] + ([#FR0324#1] / 12)) >= 2 Or ([#FR0112#1] + ([#FR0124#1] / 12)) + ([#FR0312#1] + ([#FR0324#1] / 12)) >= 2, "Yes", "")';
      expect(evaluateExpression(formulaWithNewline, { FR0312: 2, FR0324: 0 })).toBe('Yes');
    });

    test('branch 2 only (BR fields) and branch 3 only (FR0312) both return Yes', () => {
      const formula =
        'IIf(([#FR0112#1] + ([#FR0124#1] / 12)) >= 2 Or ([#BR0112#1] + [#BR0212#1] + [#BR0312#1] + [#BR0412#1] + [#BR0512#1] + [#BR0612#1] + [#BR0712#1] + [#BR0812#1] + [#BR0912#1]) + (([#BR0124#1] + [#BR0224#1] + [#BR0324#1] + [#BR0424#1] + [#BR0524#1] + [#BR0624#1] + [#BR0724#1] + [#BR0824#1] + [#BR0924#1]) / 12) >= 2 Or ([#FR0312#1] + ([#FR0324#1] / 12)) >= 2 Or ([#FR0112#1] + ([#FR0124#1] / 12)) + ([#FR0312#1] + ([#FR0324#1] / 12)) >= 2, "Yes", "")';
      expect(evaluateExpression(formula, { BR0112: 2, BR0212: 0, BR0312: 0, BR0412: 0, BR0512: 0, BR0612: 0, BR0712: 0, BR0812: 0, BR0912: 0, BR0124: 0, BR0224: 0, BR0324: 0, BR0424: 0, BR0524: 0, BR0624: 0, BR0724: 0, BR0824: 0, BR0924: 0 })).toBe('Yes');
      expect(evaluateExpression(formula, { FR0312: 2, FR0324: 0 })).toBe('Yes');
    });
  });

  describe('evaluateExpression (DateAdd)', () => {
    test('DateAdd("m", 4, [@2336]) adds 4 months', () => {
      const result = evaluateExpression('DateAdd("m",4,[@2336])', { '2336': '11/01/2025', '@2336': '11/01/2025' });
      expect(result).toBe('3/1/2026');
    });
    test('DateAdd with field ID 2336 (no @) works', () => {
      const result = evaluateExpression('DateAdd("m",4,[2336])', { '2336': '11/01/2025' });
      expect(result).toBe('3/1/2026');
    });
    test('DateAdd with datetime preserves time', () => {
      const result = evaluateExpression('DateAdd("m",4,[@2336])', { '2336': '11/01/2200 01:01 AM' });
      expect(result).toMatch(/3\/1\/2201/);
      expect(result).toMatch(/1:01/);
    });
    test('DateAdd returns null for empty date', () => {
      expect(evaluateExpression('DateAdd("m",4,[@2336])', {})).toBeNull();
    });
  });

  describe('evaluateExpression (DateDiff)', () => {
    test('DateDiff("m", [682], [ULDD.X58]) returns month difference', () => {
      const result = evaluateExpression('DateDiff("m",[682],[ULDD.X58])', {
        '682': '01/01/2022',
        'ULDD.X58': '01/12/2022',
      });
      expect(result).toBe(0);
    });

    test('DateDiff("d", [@A], [@B]) returns whole day difference', () => {
      const result = evaluateExpression('DateDiff("d",[@A],[@B])', {
        '@A': '01/01/2022',
        '@B': '01/12/2022',
      });
      expect(result).toBe(11);
    });

    test('DateDiff("yyyy", [@A], [@B]) returns year boundary difference', () => {
      const result = evaluateExpression('DateDiff("yyyy",[@A],[@B])', {
        '@A': '12/31/2021',
        '@B': '01/01/2022',
      });
      expect(result).toBe(1);
    });

    test('DateDiff handles Scenario Builder placeholder datetime text', () => {
      const result = evaluateExpression('DateDiff("d",[682],[ULDD.X58])', {
        '682': '01/01/2022 --:-- --',
        'ULDD.X58': '01/12/2022 --:-- --',
      });
      expect(result).toBe(11);
    });

    test('DateDiff tolerates en/em dash in placeholder (Word/Excel paste)', () => {
      const pl = '09/19/2020 \u2013\u2013:\u2013\u2013 \u2013\u2013';
      const result = evaluateExpression('DateDiff("M", [682], [ULDD.X58])', {
        '682': pl,
        'ULDD.X58': '01/01/2020 --:-- --',
      });
      expect(result).toBe(-8);
    });

    test('DateDiff accepts single-quoted interval (VB-style)', () => {
      const result = evaluateExpression("DateDiff('m', [682], [ULDD.X58])", {
        '682': '01/01/2022',
        'ULDD.X58': '01/12/2022',
      });
      expect(result).toBe(0);
    });
  });

  describe('evaluateExpression (IIf with DateDiff condition)', () => {
    test('IIF(DateDiff("d", [3925], [682])>0, "Y", "N") is Y when end date is later', () => {
      const f = 'IIF(DateDiff("d", [3925], [682])>0, "Y", "N")';
      expect(evaluateExpression(f, { '3925': '01/01/2025', '682': '01/15/2025' })).toBe('Y');
    });
    test('IIf: N when day difference is not > 0', () => {
      const f = 'IIf(DateDiff("d", [3925], [682])>0, "Y", "N")';
      expect(evaluateExpression(f, { '3925': '01/15/2025', '682': '01/15/2025' })).toBe('N');
    });
    test('IIf: no space before > and single-quoted d', () => {
      const f = 'IIf(DateDiff(\'d\',[3925],[682])>0,"Y","N")';
      expect(evaluateExpression(f, { '3925': '1/1/2025', '682': '1/2/2025' })).toBe('Y');
    });
  });

  describe('getSuggestedValuesForScenario', () => {
    test('returns suggested values for <= condition', () => {
      const scenario = { condition: '[#60#1] <= 200 And [#1452#1] <= 200', result: '[#1415#1]', isElse: false };
      const inputFields = ['#60#1', '#1452#1', '#1415#1'];
      const result = getSuggestedValuesForScenario(scenario, inputFields);
      expect(result['60#1']).toBe(100);
      expect(result['1452#1']).toBe(100);
      expect(result['1415#1']).toBeUndefined();
    });

    test('returns empty for non-matching input fields', () => {
      const scenario = { condition: '[#60#1] <= 200', result: '[#1415#1]', isElse: false };
      const inputFields = ['#999#1'];
      const result = getSuggestedValuesForScenario(scenario, inputFields);
      expect(result).toEqual({});
    });

    test('returns empty for scenario without condition', () => {
      const scenario = { condition: null, result: '0', isElse: true };
      const result = getSuggestedValuesForScenario(scenario, ['#60#1']);
      expect(result).toEqual({});
    });
  });

  describe('generateUnitTestFromCustomField with IIf', () => {
    test('generates scenario-based test descriptions for IIf formula', () => {
      const customField = {
        fieldId: 'CX.CR.COBORR.MEDIAN',
        calculation:
          'IIf([#60#1] <= 200 And [#1452#1] <= 200, [#1415#1],' +
          'IIf([#60#1] <= 200 And [#1415#1] <= 200,[#1452#1],' +
          'IIf([#1452#1] <= 200 And [#1415#1] <= 200,[#60#1],' +
          'LMedian([60#1], [1452#1], [1415#1]))))',
      };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      expect(result.testDescriptions).toHaveLength(5);
      expect(result.testDescriptions[0].description).toBe('Scenario 1');
      expect(result.testDescriptions[1].description).toBe('Scenario 2');
      expect(result.headers).toContain('Test 1');
      expect(result.headers).toContain('Test 4');
    });

    test('excludes output field from inputFields', () => {
      const customField = {
        fieldId: 'CX.TEST',
        calculation: 'IIf([CX.TEST] > 0, [CX.TEST], [4002])',
      };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      const setTargets = result.rows.filter((r) => r.Action === 'SET').map((r) => r.Target);
      expect(setTargets).not.toContain('[CX.TEST]');
      expect(setTargets).toContain('[4002]');
    });

    test('falls back to 5 generic scenarios for non-IIf formula', () => {
      const customField = {
        fieldId: 'CX.SUM',
        calculation: '[4002] + [4003]',
      };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      expect(result.testDescriptions).toHaveLength(5);
      expect(result.testDescriptions[0].description).toBe('Scenario 1');
    });

    test('pre-fills SET cells with suggested values for IIf scenarios', () => {
      const customField = {
        fieldId: 'CX.CR.COBORR.MEDIAN',
        calculation: 'IIf([#60#1] <= 200 And [#1452#1] <= 200, [#1415#1], 0)',
      };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      const setRows = result.rows.filter((r) => r.Action === 'SET');
      const row60 = setRows.find((r) => r.Target === '[60#1]');
      const row1452 = setRows.find((r) => r.Target === '[1452#1]');
      expect(row60).toBeDefined();
      expect(row60['Test 1']).toBe('100');
      expect(row1452).toBeDefined();
      expect(row1452['Test 1']).toBe('100');
    });

    test('pre-fills COMPARE when result is single field ref from condition', () => {
      const customField = {
        fieldId: 'CX.OUT',
        calculation: 'IIf([#60#1] <= 200, [#60#1], 0)',
      };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      const compareRow = result.rows.find((r) => r.Action === 'COMPARE');
      expect(compareRow).toBeDefined();
      expect(compareRow['Test 1']).toBe('100');
    });

    test('expands OrElse into separate scenarios with different [19] values', () => {
      const formula =
        '[CX.299.REFI.FIELD.BOOL] IIf (([19] = "NoCash-Out Refinance" OrElse [19] = "Cash-Out Refinance" OrElse ([19] = "ConstructionToPermanent" AndAlso [CONSTR.REFI] = "Y")) AndAlso [299] = "", "Y", "N")';
      const customField = { fieldId: 'CX.299.REFI.FIELD.BOOL', calculation: formula };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      expect(result.testDescriptions.length).toBeGreaterThanOrEqual(3);
      const setRows = result.rows.filter((r) => r.Action === 'SET');
      const row19 = setRows.find((r) => r.Target === '[19]');
      expect(row19).toBeDefined();
      expect(row19['Test 1']).toBe('NoCash-Out Refinance');
      expect(row19['Test 2']).toBe('Cash-Out Refinance');
      expect(row19['Test 3']).toBe('ConstructionToPermanent');
    });
  });

  describe('extractStringComparisons', () => {
    test('extracts string equality', () => {
      const result = extractStringComparisons('[19] = "NoCash-Out Refinance"');
      expect(result).toEqual([{ fieldId: '19', op: '=', value: 'NoCash-Out Refinance' }]);
    });
    test('extracts empty string', () => {
      const result = extractStringComparisons('[299] = ""');
      expect(result).toEqual([{ fieldId: '299', op: '=', value: '' }]);
    });
  });

  describe('extractConditionValues (Phase 2)', () => {
    test('returns empty for empty or invalid input', () => {
      expect(extractConditionValues('')).toEqual([]);
      expect(extractConditionValues(null)).toEqual([]);
    });

    test('extracts IsDate([field])', () => {
      const result = extractConditionValues('IsDate([CX.DISASTER.DATE])');
      expect(result).toEqual([{ type: 'isDate', fieldId: 'CX.DISASTER.DATE', negated: false }]);
    });

    test('extracts Not IsDate([field])', () => {
      const result = extractConditionValues('Not IsDate([CX.DISASTER.DATE])');
      expect(result).toEqual([{ type: 'isDate', fieldId: 'CX.DISASTER.DATE', negated: true }]);
    });

    test('extracts DateDiff("d", [field1], [field2]) > N', () => {
      const result = extractConditionValues('DateDiff("d", [@CX.DISASTER.DATE], [@3142]) > 90');
      expect(result).toEqual([
        { type: 'dateDiff', interval: 'd', field1: '@CX.DISASTER.DATE', field2: '@3142', op: '>', value: 90 },
      ]);
    });

    test('extracts DateDiff with <= operator', () => {
      const result = extractConditionValues('DateDiff("d", [@field1], [@field2]) <= 90');
      expect(result).toEqual([
        { type: 'dateDiff', interval: 'd', field1: '@field1', field2: '@field2', op: '<=', value: 90 },
      ]);
    });

    test('extracts DateDiff with single-quoted interval and no spaces before >', () => {
      const result = extractConditionValues("DateDiff('d', [3925], [682])>0");
      expect(result).toEqual([
        { type: 'dateDiff', interval: 'd', field1: '3925', field2: '682', op: '>', value: 0 },
      ]);
    });

    test('extracts [field].Contains("literal")', () => {
      const result = extractConditionValues('[19].Contains("Refi")');
      expect(result).toEqual([{ type: 'contains', fieldId: '19', substring: 'Refi', negated: false }]);
    });

    test('extracts multiple condition types', () => {
      const cond = 'IsDate([CX.DATE]) And [19].Contains("Refi") And DateDiff("d", [@A], [@B]) > 30';
      const result = extractConditionValues(cond);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual({ type: 'isDate', fieldId: 'CX.DATE', negated: false });
      expect(result).toContainEqual({ type: 'contains', fieldId: '19', substring: 'Refi', negated: false });
      expect(result).toContainEqual({ type: 'dateDiff', interval: 'd', field1: '@A', field2: '@B', op: '>', value: 30 });
    });

    test('extracts [field].StartsWith("literal")', () => {
      const result = extractConditionValues('[CX.APPRAISAL.TYPE].StartsWith ("Appraisal Waived")');
      expect(result).toEqual([{ type: 'startsWith', fieldId: 'CX.APPRAISAL.TYPE', prefix: 'Appraisal Waived' }]);
    });

    test('extracts [field] <> Nothing', () => {
      const result = extractConditionValues('[CX.DATE] <> Nothing');
      expect(result).toEqual([{ type: 'nothing', fieldId: 'CX.DATE', negated: true }]);
    });

    test('extracts [field] = Nothing', () => {
      const result = extractConditionValues('[299] = Nothing');
      expect(result).toEqual([{ type: 'nothing', fieldId: '299', negated: false }]);
    });
  });

  describe('getSuggestedValuesForScenario (Phase 2)', () => {
    test('suggests valid date for IsDate([x])', () => {
      const scenario = { condition: 'IsDate([CX.DISASTER.DATE])', result: '"Y"', isElse: false };
      const result = getSuggestedValuesForScenario(scenario, ['CX.DISASTER.DATE']);
      expect(result['CX.DISASTER.DATE']).toBe('01/15/2025');
    });

    test('suggests empty for Not IsDate([x])', () => {
      const scenario = { condition: 'Not IsDate([CX.DISASTER.DATE])', result: '"N"', isElse: false };
      const result = getSuggestedValuesForScenario(scenario, ['CX.DISASTER.DATE']);
      expect(result['CX.DISASTER.DATE']).toBe('');
    });

    test('suggests substring for Contains', () => {
      const scenario = { condition: '[19].Contains("Refi")', result: '"Y"', isElse: false };
      const result = getSuggestedValuesForScenario(scenario, ['19']);
      expect(result['19']).toBe('Refi');
    });

    test('suggests different dropdown values for Contains across scenarios', () => {
      const scenario = {
        condition: '[CX.TYPE].Contains ("Fha")',
        result: '"Y"',
        isElse: false,
      };
      const fieldMetadata = {
        'CX.TYPE': {
          options: ['FHA', 'FHA 203k', 'FHA Streamline', 'VA', 'Conventional'],
        },
      };
      const r0 = getSuggestedValuesForScenario(scenario, ['CX.TYPE'], { fieldMetadata, scenarioIndex: 0 });
      const r1 = getSuggestedValuesForScenario(scenario, ['CX.TYPE'], { fieldMetadata, scenarioIndex: 1 });
      expect(r0['CX.TYPE']).toBe('FHA');
      expect(r1['CX.TYPE']).toBe('FHA 203k');
    });

    test('suggests two dates for DateDiff > 90', () => {
      const scenario = {
        condition: 'DateDiff("d", [@CX.DISASTER.DATE], [@3142]) > 90',
        result: '"Y"',
        isElse: false,
      };
      const result = getSuggestedValuesForScenario(scenario, ['CX.DISASTER.DATE', '3142']);
      expect(result['CX.DISASTER.DATE']).toBe('01/01/2025');
      expect(result['3142']).toBe('04/15/2025');
    });

    test('suggests different dropdown values for StartsWith across scenarios', () => {
      const scenario = {
        condition: '[CX.APPRAISAL.TYPE].StartsWith ("Appraisal Waived")',
        result: '"Y"',
        isElse: false,
      };
      const fieldMetadata = {
        'CX.APPRAISAL.TYPE': {
          options: ['Appraisal Waived', 'Appraisal Waived - Other', 'Desktop Appraisal', 'Full Appraisal'],
        },
      };
      const r0 = getSuggestedValuesForScenario(scenario, ['CX.APPRAISAL.TYPE'], { fieldMetadata, scenarioIndex: 0 });
      const r1 = getSuggestedValuesForScenario(scenario, ['CX.APPRAISAL.TYPE'], { fieldMetadata, scenarioIndex: 1 });
      expect(r0['CX.APPRAISAL.TYPE']).toBe('Appraisal Waived');
      expect(r1['CX.APPRAISAL.TYPE']).toBe('Appraisal Waived - Other');
    });

    test('falls back to prefix when no options for StartsWith', () => {
      const scenario = {
        condition: '[CX.APPRAISAL.TYPE].StartsWith ("Appraisal Waived")',
        result: '"Y"',
        isElse: false,
      };
      const result = getSuggestedValuesForScenario(scenario, ['CX.APPRAISAL.TYPE']);
      expect(result['CX.APPRAISAL.TYPE']).toBe('Appraisal Waived');
    });

    test('cycles Y, N, blank for [field] = "Y" across scenarios', () => {
      const scenario = { condition: '[FLAG] = "Y"', result: '"ok"', isElse: false };
      const r0 = getSuggestedValuesForScenario(scenario, ['FLAG'], { scenarioIndex: 0 });
      const r1 = getSuggestedValuesForScenario(scenario, ['FLAG'], { scenarioIndex: 1 });
      const r2 = getSuggestedValuesForScenario(scenario, ['FLAG'], { scenarioIndex: 2 });
      expect(r0['FLAG']).toBe('Y');
      expect(r1['FLAG']).toBe('N');
      expect(r2['FLAG']).toBe('');
    });

    test('cycles N, Y, blank for [field] = "N" across scenarios', () => {
      const scenario = { condition: '[FLAG] = "N"', result: '"no"', isElse: false };
      const r0 = getSuggestedValuesForScenario(scenario, ['FLAG'], { scenarioIndex: 0 });
      const r1 = getSuggestedValuesForScenario(scenario, ['FLAG'], { scenarioIndex: 1 });
      const r2 = getSuggestedValuesForScenario(scenario, ['FLAG'], { scenarioIndex: 2 });
      expect(r0['FLAG']).toBe('N');
      expect(r1['FLAG']).toBe('Y');
      expect(r2['FLAG']).toBe('');
    });

    test('suggests blank for [field] = Nothing', () => {
      const scenario = { condition: '[CX.DATE] = Nothing', result: '"N"', isElse: false };
      const result = getSuggestedValuesForScenario(scenario, ['CX.DATE']);
      expect(result['CX.DATE']).toBe('');
    });

    test('suggests Y for [field] <> Nothing', () => {
      const scenario = { condition: '[CX.DATE] <> Nothing', result: '"Y"', isElse: false };
      const result = getSuggestedValuesForScenario(scenario, ['CX.DATE']);
      expect(result['CX.DATE']).toBe('Y');
    });
  });

  describe('getSuggestedValuesForScenario learned SET hints', () => {
    beforeEach(() => {
      const mem = Object.create(null);
      const ls = {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
        setItem: (k, v) => {
          mem[k] = String(v);
        },
        removeItem: (k) => {
          delete mem[k];
        },
      };
      globalThis.localStorage = ls;
      reloadLearnedSetHintsCache();
    });

    afterEach(() => {
      try {
        globalThis.localStorage.removeItem(LEARNED_SET_HINTS_STORAGE_KEY);
      } catch (_) {
        /* ignore */
      }
      reloadLearnedSetHintsCache();
    });

    test('learned SET hint overrides parser default for same field and scenario', () => {
      const doc = {
        version: 1,
        hints: {
          FLAG: { source: 'test', valuesByScenarioIndex: { '0': 'N' } },
        },
        updatedAt: new Date().toISOString(),
      };
      globalThis.localStorage.setItem(LEARNED_SET_HINTS_STORAGE_KEY, JSON.stringify(doc));
      reloadLearnedSetHintsCache();

      const scenario = { condition: '[FLAG] = "Y"', result: '"ok"', isElse: false };
      const r0 = getSuggestedValuesForScenario(scenario, ['FLAG'], { scenarioIndex: 0 });
      expect(r0.FLAG).toBe('N');
    });

    test('learned SET hint overrides numeric suggestion from comparison', () => {
      const doc = {
        version: 1,
        hints: {
          '60#1': { source: 'test', valuesByScenarioIndex: { '0': 50 } },
        },
        updatedAt: new Date().toISOString(),
      };
      globalThis.localStorage.setItem(LEARNED_SET_HINTS_STORAGE_KEY, JSON.stringify(doc));
      reloadLearnedSetHintsCache();

      const scenario = {
        condition: '[#60#1] <= 200 And [#1452#1] <= 200',
        result: '[#1415#1]',
        isElse: false,
      };
      const inputFields = ['#60#1', '#1452#1', '#1415#1'];
      const result = getSuggestedValuesForScenario(scenario, inputFields);
      expect(result['60#1']).toBe(50);
      expect(result['1452#1']).toBe(100);
    });
  });

  describe('isSunriseField', () => {
    test('returns true for CX.SUNRISE and CX.SUNRISE.* fields', () => {
      expect(isSunriseField('CX.SUNRISE')).toBe(true);
      expect(isSunriseField('cx.sunrise')).toBe(true);
      expect(isSunriseField('CX.SUNRISE.DATE')).toBe(true);
      expect(isSunriseField('CX.SUNRISE.XXXX')).toBe(true);
      expect(isSunriseField('cx.sunrise.anything')).toBe(true);
    });
    test('returns false for non-Sunrise fields', () => {
      expect(isSunriseField('CX.OTHER.FIELD')).toBe(false);
      expect(isSunriseField('SUNRISE')).toBe(false);
    });
  });

  describe('formatDateWithOffset', () => {
    test('returns MM/DD/YYYY format', () => {
      const result = formatDateWithOffset(0);
      expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });
    test('applies day offset correctly', () => {
      const today = formatDateWithOffset(0);
      const tomorrow = formatDateWithOffset(1);
      expect(today).not.toBe(tomorrow);
    });
  });

  describe('generateUnitTestFromCustomField (Phase 2)', () => {
    test('pre-fills CX.SUNRISE.* with today ± 2 for 5 scenarios', () => {
      const customField = {
        fieldId: 'CX.OUT',
        calculation: '[CX.SUNRISE.DATE]',
      };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      const setRows = result.rows.filter((r) => r.Action === 'SET');
      const row = setRows.find((r) => r.Target === '[CX.SUNRISE.DATE]');
      expect(row).toBeDefined();
      expect(result.testDescriptions).toHaveLength(5);
      const t1 = row['Test 1'];
      const t2 = row['Test 2'];
      const t3 = row['Test 3'];
      const t4 = row['Test 4'];
      const t5 = row['Test 5'];
      expect(t1).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(t2).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(t3).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(t4).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(t5).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(new Set([t1, t2, t3, t4, t5]).size).toBe(5);
    });

    test('pre-fills CX.TYPE with different FHA values for Contains across scenarios', () => {
      const customField = {
        fieldId: 'CX.OUT',
        calculation: 'IIf([CX.TYPE].Contains ("Fha"), "Y", "N")',
      };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      const setRows = result.rows.filter((r) => r.Action === 'SET');
      const row = setRows.find((r) => r.Target === '[CX.TYPE]');
      expect(row).toBeDefined();
      const values = [row['Test 1'], row['Test 2'], row['Test 3'], row['Test 4'], row['Test 5']].filter(Boolean);
      expect(values.length).toBeGreaterThanOrEqual(1);
      values.forEach((v) => expect(v.toLowerCase().includes('fha')).toBe(true));
    });

    test('pre-fills CX.APPRAISAL.TYPE with different values for StartsWith across scenarios', () => {
      const customField = {
        fieldId: 'CX.OUT',
        calculation: 'IIf([CX.APPRAISAL.TYPE].StartsWith ("Appraisal Waived"), "Y", "N")',
      };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      const setRows = result.rows.filter((r) => r.Action === 'SET');
      const row = setRows.find((r) => r.Target === '[CX.APPRAISAL.TYPE]');
      expect(row).toBeDefined();
      const values = [row['Test 1'], row['Test 2'], row['Test 3'], row['Test 4'], row['Test 5']].filter(Boolean);
      expect(values.length).toBeGreaterThanOrEqual(1);
      values.forEach((v) => expect(v.startsWith('Appraisal Waived')).toBe(true));
    });

    test('pre-fills SET cells for IsDate/Contains/DateDiff conditions', () => {
      const customField = {
        fieldId: 'CX.OUT',
        calculation:
          'IIf(IsDate([CX.DISASTER.DATE]), "Y", IIf([19].Contains("Refi"), "Y", IIf(DateDiff("d", [@CX.DISASTER.DATE], [@3142]) > 90, "Y", "N")))',
      };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      const setRows = result.rows.filter((r) => r.Action === 'SET');
      const rowDate = setRows.find((r) => r.Target === '[CX.DISASTER.DATE]');
      const row19 = setRows.find((r) => r.Target === '[19]');
      expect(rowDate).toBeDefined();
      expect(rowDate['Test 1']).toBe('01/15/2025');
      expect(row19).toBeDefined();
      expect(row19['Test 2']).toBe('Refi');
      expect(rowDate['Test 3']).toBe('01/01/2025');
      const row3142 = setRows.find((r) => r.Target === '[3142]');
      expect(row3142).toBeDefined();
      expect(row3142['Test 3']).toBe('04/15/2025');
    });

    test('includes output field dataType in metadata from custom field definition', () => {
      const customField = {
        fieldId: 'CX.R.ALTPROPTAX',
        dataType: 'String',
        calculation:
          'IIf ([CX.TAXESCROW.EXCEEDS12] = "Y" AndAlso [CX.TAXESCROWCOLLECT.OPT] <> "Opt-In" AndAlso [CX.TAXESCROW.TYPE] <> "Alternate" , "AltPropTax(F)", "")',
      };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      expect(result.fieldMetadata).toBeDefined();
      const outMeta = result.fieldMetadata['CX.R.ALTPROPTAX'];
      expect(outMeta).toBeDefined();
      expect(outMeta.dataType).toBe('String');
    });

    test('pre-fills COMPARE row with literal string results (String/Y-N fields)', () => {
      const customField = {
        fieldId: 'CX.R.ALTPROPTAX',
        dataType: 'String',
        calculation:
          'IIf ([CX.TAXESCROW.EXCEEDS12] = "Y" AndAlso [CX.TAXESCROWCOLLECT.OPT] <> "Opt-In" AndAlso [CX.TAXESCROW.TYPE] <> "Alternate" , "AltPropTax(F)", "")',
      };
      const result = generateUnitTestFromCustomField(customField);
      expect(result).not.toBeNull();
      const compareRow = result.rows.find((r) => r.Action === 'COMPARE' && r.Target === '[CX.R.ALTPROPTAX]');
      expect(compareRow).toBeDefined();
      // Scenario 1: condition true → "AltPropTax(F)"
      expect(compareRow['Test 1']).toBe('AltPropTax(F)');
      // Scenario 2: else → ""
      expect(compareRow['Test 2']).toBe('');
    });
  });

  describe('parseCalculationFormula', () => {
    test('parses bracket assignment', () => {
      const r = parseCalculationFormula('[CX.TEST] = 1 + [353]');
      expect(r).toEqual({
        outputField: 'CX.TEST',
        inputFields: ['353'],
        expression: '1 + [353]',
      });
    });

    test('strips one leading spreadsheet equals before bracket assignment', () => {
      const withPrefix = parseCalculationFormula('=[CX.TEST] = 1 + [353]');
      const plain = parseCalculationFormula('[CX.TEST] = 1 + [353]');
      expect(withPrefix).toEqual(plain);
    });

    test('strips leading equals with spaces before bracket', () => {
      const r = parseCalculationFormula('=  [CX.TEST] = 2');
      expect(r.outputField).toBe('CX.TEST');
      expect(r.expression).toBe('2');
    });

    test('does not strip leading equals when RHS does not start with bracket', () => {
      const r = parseCalculationFormula('=1+2');
      expect(r.outputField).toBeNull();
      expect(r.expression).toBe('=1+2');
    });
  });
});
