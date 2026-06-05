export type UnitTestAction = 'SET' | 'GET' | 'COMPARE';

export interface UnitTestRow {
  Step: string | number;
  Action: UnitTestAction | string;
  Target: string;
  Description: string;
  CompareMode?: string;
  Operator?: string;
  [testColumn: string]: string | number | boolean | null | undefined;
}

export interface TestDescription {
  testNumber: string;
  description: string;
}

export interface UnitTestWorkbook {
  meta?: { name?: string; loanGuid?: string };
  headers: string[];
  testDescriptions?: TestDescription[];
  rows: UnitTestRow[];
}

export interface TestColumn {
  field: string;
  testNumber: string;
}
