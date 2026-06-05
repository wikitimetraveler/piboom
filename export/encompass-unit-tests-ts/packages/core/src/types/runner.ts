import type { UnitTestAction } from './workbook.js';

export type StepStatus = 'pass' | 'fail' | 'skipped' | 'info' | 'err' | 'pending';

export interface StepResult {
  step: string | number;
  action: string;
  target: string;
  description: string;
  testNumber: string | null;
  status: StepStatus;
  message: string;
  rowIndex: number;
  actual?: unknown;
  expected?: unknown;
}

export interface ScenarioResult {
  testNumber: string;
  description: string;
  passed: boolean;
  skipped: boolean;
  steps: StepResult[];
}

export interface LoanStore {
  get(fieldId: string): unknown;
  set(fieldId: string, value: unknown): void;
  evaluateCalculated(fieldId: string): unknown;
}
