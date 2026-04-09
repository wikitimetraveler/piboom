import '../../public/shared/tool8FieldMatrix.js';

const { parseTool8FieldMatrixJson, generateUnitTestFromTool8FieldMatrix, stripBrackets } = globalThis.tool8FieldMatrix;

describe('tool8FieldMatrix', () => {
  test('parseTool8FieldMatrixJson accepts Tool 8 row shape', () => {
    const json = JSON.stringify([
      { FieldID: '[353]', Label: 'Loan Amount', CType: '', Calendar: '', Method: 'isDate|[Log.MS.Date.File Prep]' },
      { Row: 2, FieldID: '4002', Label: 'Borrower', CType: 'DropdownBox', Calendar: '', Method: '' },
    ]);
    const p = parseTool8FieldMatrixJson(json);
    expect(p.error).toBeUndefined();
    expect(p.fieldIds).toEqual(['353', '4002']);
    expect(p.items).toHaveLength(2);
    expect(p.items[0].FieldID).toBe('[353]');
    expect(p.items[1].FieldID).toBe('[4002]');
  });

  test('stripBrackets', () => {
    expect(stripBrackets('[CX.FOO]')).toBe('CX.FOO');
    expect(stripBrackets('CX.FOO')).toBe('CX.FOO');
  });

  test('generateUnitTestFromTool8FieldMatrix builds SET rows', () => {
    const p = parseTool8FieldMatrixJson('[{"FieldID":"[1]","Label":"A","Method":"m"}]');
    const g = generateUnitTestFromTool8FieldMatrix(p);
    expect(g.rows).toHaveLength(1);
    expect(g.rows[0].Action).toBe('SET');
    expect(g.rows[0].Target).toBe('[1]');
    expect(g.rows[0].Description).toContain('A');
    expect(g.rows[0].Description).toContain('m');
  });
});
