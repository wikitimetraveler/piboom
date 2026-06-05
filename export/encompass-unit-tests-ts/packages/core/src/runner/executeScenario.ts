/**
 * In-memory SET / GET / COMPARE runner (no Encompass API).
 * Logic extracted from piBoom unit-tests.js runTests().
 */
import {
  compareValues,
  getCompareModeFromRow,
  isBlankForTest,
} from '../compare/unitTestsUtils.js';
import type { LoanStore, ScenarioResult, StepResult } from '../types/runner.js';
import type { TestColumn, UnitTestRow, UnitTestWorkbook } from '../types/workbook.js';
import {
  findTestColumnByNumber,
  getTestColumns,
  pickTestColumnForRow,
} from '../workbook/parseWorkbook.js';
import { cloneLoanStore, resolveSetValue, targetFieldId } from './loanStore.js';
import type { LoanSnapshot } from '../types/loan.js';

function aggregateScenarioPass(steps: StepResult[]): boolean {
  const compareSteps = steps.filter((r) => r.action.toUpperCase() === 'COMPARE');
  if (compareSteps.length === 0) {
    return steps.some((r) => r.status === 'info') && !steps.every((r) => r.status === 'skipped');
  }
  return compareSteps.some((r) => r.status === 'info');
}

function descriptionForScenario(
  workbook: UnitTestWorkbook,
  testNumber: string
): string {
  const hit = workbook.testDescriptions?.find((t) => String(t.testNumber) === testNumber);
  return hit?.description || `Test ${testNumber}`;
}

export function executeScenario(
  workbook: UnitTestWorkbook,
  testNumber: string,
  snapshot: LoanSnapshot
): ScenarioResult {
  const columns = getTestColumns(workbook);
  const testColumn = findTestColumnByNumber(columns, testNumber);
  if (!testColumn) {
    return {
      testNumber,
      description: descriptionForScenario(workbook, testNumber),
      passed: false,
      skipped: true,
      steps: [
        {
          step: 0,
          action: '',
          target: '',
          description: '',
          testNumber,
          status: 'skipped',
          message: `Scenario ${testNumber} not found`,
          rowIndex: -1,
        },
      ],
    };
  }
  const store = cloneLoanStore(snapshot);
  const steps = runRows(workbook.rows, testColumn, columns, store);
  const skipped = steps.every((s) => s.status === 'skipped');
  return {
    testNumber,
    description: descriptionForScenario(workbook, testNumber),
    passed: aggregateScenarioPass(steps),
    skipped,
    steps,
  };
}

export function executeAllScenarios(
  workbook: UnitTestWorkbook,
  snapshot: LoanSnapshot
): ScenarioResult[] {
  const columns = getTestColumns(workbook).filter((c) => c.testNumber && c.testNumber !== 'RESET');
  if (!columns.length) {
    const store = cloneLoanStore(snapshot);
    const col = null;
    const steps = runRows(workbook.rows, col, [], store);
    return [
      {
        testNumber: 'single',
        description: 'Single run',
        passed: aggregateScenarioPass(steps),
        skipped: steps.every((s) => s.status === 'skipped'),
        steps,
      },
    ];
  }
  return columns.map((col) => executeScenario(workbook, col.testNumber, snapshot));
}

function runRows(
  rows: UnitTestRow[],
  testColumn: TestColumn | null,
  allColumns: TestColumn[],
  store: LoanStore
): StepResult[] {
  const results: StepResult[] = [];
  const getCache: Record<string, { status: StepResult['status']; message: string; value?: unknown }> = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const step = row.Step ?? row.step ?? i + 1;
    const action = String(row.Action ?? row.action ?? '').trim();
    const target = String(row.Target ?? row.target ?? '');
    const description = String(row.Description ?? row.description ?? '');

    if (String(step).trim().toUpperCase() === 'X') continue;
    if (!action) continue;

    const fieldId = targetFieldId(target);
    const result: StepResult = {
      step,
      action: action.toUpperCase(),
      target: fieldId || target,
      description,
      status: 'pending',
      message: '',
      rowIndex: i,
      testNumber: testColumn ? testColumn.testNumber : null,
    };

    if (!fieldId) {
      result.status = 'skipped';
      result.message = 'No field ID found in Target';
      results.push(result);
      continue;
    }

    const actionNorm = action.toLowerCase();
    const currentCol = testColumn || pickTestColumnForRow(row, allColumns);

    if (actionNorm === 'set') {
      const rawSetValue = currentCol ? row[currentCol.field] : null;
      const hasValue =
        rawSetValue !== null && rawSetValue !== undefined && String(rawSetValue).trim() !== '';
      if (!currentCol || !hasValue) {
        result.status = 'skipped';
        result.message = 'Skipped (no value to set — field left as-is)';
      } else {
        const setValue = isBlankForTest(rawSetValue) ? '' : resolveSetValue(rawSetValue);
        store.set(fieldId, setValue);
        result.status = 'info';
        result.message = `SET ${fieldId} succeeded • Value: ${JSON.stringify(setValue)}`;
      }
    } else if (actionNorm === 'get') {
      const scenarioKey = testColumn ? testColumn.testNumber : 'single';
      const getCacheKey = `${scenarioKey}-${i}-${fieldId}`;
      if (!getCache[getCacheKey]) {
        const value = store.get(fieldId);
        const displayValue =
          value === null || value === undefined ? 'No value returned' : JSON.stringify(value);
        getCache[getCacheKey] = {
          status: 'info',
          message: `GET ${fieldId}: ${displayValue}`,
          value,
        };
      }
      const cached = getCache[getCacheKey];
      result.status = cached.status;
      result.message = cached.message;
      result.actual = cached.value;
    } else if (actionNorm === 'compare') {
      if (!currentCol) {
        result.status = 'skipped';
        result.message = 'No test column for Compare';
      } else {
        const expectedValue = row[currentCol.field];
        const hasExpected =
          expectedValue !== null &&
          expectedValue !== undefined &&
          String(expectedValue).trim() !== '';
        if (!hasExpected) {
          result.status = 'skipped';
          result.message = 'No expected value in column for Compare';
        } else {
          const actualValue = store.get(fieldId);
          const compareMode = getCompareModeFromRow(row as Record<string, unknown>);
          const same = compareValues(actualValue, expectedValue, compareMode);
          result.actual = actualValue;
          result.expected = expectedValue;
          if (same) {
            result.status = 'info';
            result.message = `COMPARE ${fieldId} passed • Expected: ${JSON.stringify(expectedValue)}`;
          } else {
            result.status = 'err';
            result.message = `Compare mismatch: expected ${JSON.stringify(expectedValue)}, got ${
              actualValue === null || actualValue === undefined ? 'null' : JSON.stringify(actualValue)
            }`;
          }
        }
      }
    } else {
      result.status = 'skipped';
      result.message = `Unknown action: ${action}`;
    }

    results.push(result);
  }

  return results;
}
