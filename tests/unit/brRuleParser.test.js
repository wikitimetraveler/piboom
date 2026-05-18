import '../../public/shared/brRuleParser.js';

const { parseBRConditionSnippet, extractFieldIdsFromConditionText, generateUnitTestFromBRRule } =
  globalThis.brRuleParser;

describe('brRuleParser', () => {
  describe('extractFieldIdsFromConditionText', () => {
    test('collects unique bracket field ids', () => {
      const text = 'If ([16] >= 2 And ([-ULDD.X160] = "" Or [-ULDD.X161] = "")) Then Fail("x") End If';
      expect(extractFieldIdsFromConditionText(text)).toEqual(
        expect.arrayContaining(['16', '-ULDD.X160', '-ULDD.X161']),
      );
      expect(extractFieldIdsFromConditionText(text)).toHaveLength(3);
    });
  });

  describe('parseBRConditionSnippet', () => {
    test('returns error for empty input', () => {
      expect(parseBRConditionSnippet('').error).toBeTruthy();
      expect(parseBRConditionSnippet('   ').error).toBeTruthy();
    });

    test('builds advanced condition and inferred fields', () => {
      const vb = `If ([16] >= 2 And ([-ULDD.X160] = "" Or [-ULDD.X161] = "")) Or _
        ([16] >= 3 And ([-ULDD.X162] = "" Or [-ULDD.X163] = "")) Then
    Fail("All units must have Bedroom Count and Eligible Rent Amounts")
End If`;
      const parsed = parseBRConditionSnippet(vb);
      expect(parsed.error).toBeUndefined();
      expect(parsed.rule.name).toBe('Pasted VB condition');
      expect(parsed.advancedConditions).toHaveLength(1);
      expect(parsed.advancedConditions[0].value).toContain('Fail(');
      const ids = parsed.advancedConditions[0].fields.map((f) => f.entityId).sort();
      expect(ids).toEqual(['-ULDD.X160', '-ULDD.X161', '-ULDD.X162', '-ULDD.X163', '16']);
    });

    test('generateUnitTestFromBRRule produces SET and COMPARE rows', () => {
      const parsed = parseBRConditionSnippet('If [4002] = "" Then Fail("bad") End If');
      const result = generateUnitTestFromBRRule(parsed);
      expect(result).not.toBeNull();
      expect(result.rows.some((r) => r.Action === 'SET' && r.Target === '[4002]')).toBe(true);
      expect(result.rows.some((r) => r.Action === 'COMPARE')).toBe(true);
    });

    test('generated descriptions do not include bracketed field IDs', () => {
      const parsed = parseBRConditionSnippet('If [4002] = "" Then Fail("bad") End If');
      const result = generateUnitTestFromBRRule(parsed, {
        fieldMetadataLookup: {
          '4002': { description: 'Annual Income [4002]', dataType: 'Decimal' },
        },
      });
      expect(result).not.toBeNull();
      const setRow = result.rows.find((r) => r.Action === 'SET' && r.Target === '[4002]');
      expect(setRow).toBeTruthy();
      expect(setRow.Description).toContain('Annual Income');
      expect(setRow.Description).not.toMatch(/\[[^\]]+\]/);
    });
  });

});
