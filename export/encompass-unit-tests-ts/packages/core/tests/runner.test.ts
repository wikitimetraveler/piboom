import { describe, expect, test } from 'vitest';
import { executeAllScenarios } from '../src/runner/executeScenario.js';
import type { LoanSnapshot } from '../src/types/loan.js';
import type { UnitTestWorkbook } from '../src/types/workbook.js';

const workbook: UnitTestWorkbook = {
  headers: ['Step', 'Action', 'Target', 'Description', 'Test 1', 'Test 2'],
  testDescriptions: [
    { testNumber: '1', description: 'Tax check Y' },
    { testNumber: '2', description: 'Tax check N' },
  ],
  rows: [
    {
      Step: '1',
      Action: 'SET',
      Target: '[CX.PROPTAX.NEXTDUEDT.CHECK]',
      Description: 'Property tax flag',
      'Test 1': 'Y',
      'Test 2': 'N',
    },
    {
      Step: '2',
      Action: 'SET',
      Target: '[VEND.X441]',
      Description: 'Property tax due date',
      'Test 1': '01/15/2025',
      'Test 2': '06/01/2030',
    },
    {
      Step: '3',
      Action: 'SET',
      Target: '[CX.CITYTAX.NEXTDUEDT.CHECK]',
      Description: 'City tax flag',
      'Test 1': 'N',
      'Test 2': 'N',
    },
    {
      Step: '4',
      Action: 'COMPARE',
      Target: '[CX.PROPTAX.NEXTDUEDT.CHECK]',
      Description: 'Verify flag',
      'Test 1': 'Y',
      'Test 2': 'N',
    },
  ],
};

const snapshot: LoanSnapshot = {
  loanGuid: '00000000-0000-0000-0000-000000000001',
  fields: {
    'CX.PROPTAX.NEXTDUEDT.CHECK': '',
    'VEND.X441': '',
    'CX.CITYTAX.NEXTDUEDT.CHECK': 'N',
  },
};

describe('executeAllScenarios', () => {
  test('runs SET then COMPARE per scenario in memory', () => {
    const results = executeAllScenarios(workbook, snapshot);
    expect(results).toHaveLength(2);
    expect(results[0].testNumber).toBe('1');
    expect(results[0].passed).toBe(true);
    expect(results[1].testNumber).toBe('2');
    expect(results[1].passed).toBe(true);
    const compare1 = results[0].steps.find((s) => s.action === 'COMPARE');
    expect(compare1?.status).toBe('info');
  });
});
