/**
 * Development work by David Lane
 */
import {
  extractBracketFieldIds,
  validateTool8FieldMatrixJson,
  detectBrRuleFormat,
  fieldIdsForBrBody,
} from '../../services/business-rule-files.service.js';

describe('business-rule-files.service (pure helpers)', () => {
  test('extractBracketFieldIds', () => {
    expect(extractBracketFieldIds('If [16] >= 2 And [-ULDD.X1] = ""')).toEqual(['-ULDD.X1', '16']);
  });

  test('validateTool8FieldMatrixJson', () => {
    const ok = validateTool8FieldMatrixJson('[{"FieldID":"[a]"}]');
    expect(ok.ok).toBe(true);
    expect(ok.fieldIds).toEqual(['a']);
    const bad = validateTool8FieldMatrixJson('{}');
    expect(bad.ok).toBe(false);
  });

  test('detectBrRuleFormat', () => {
    expect(detectBrRuleFormat(Buffer.from('<Rule Name="X"/>'), 'r.xml')).toBe('encompass_br_xml');
    expect(detectBrRuleFormat(Buffer.from('[{"FieldID":"[1]"}]'), 'x.json')).toBe('tool8_field_matrix_json');
  });

  test('fieldIdsForBrBody', () => {
    expect(fieldIdsForBrBody('[{"FieldID":"[z]"}]', 'tool8_field_matrix_json')).toEqual(['z']);
    expect(fieldIdsForBrBody('x [AB] y', 'encompass_br_xml')).toContain('AB');
  });
});
