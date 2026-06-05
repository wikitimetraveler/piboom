// Compare
export {
  compareValues,
  coerce,
  extractFieldId,
  extractFieldIdsFromTarget,
  formatDescriptionFromMeta,
  getCompareModeFromRow,
  getFieldPath,
  getRawFieldIdFromTarget,
  hasFieldId,
  isBlankForTest,
  normalizeCompareMode,
  sanitizeDescriptionText,
  COMPARE_MODES,
} from './compare/unitTestsUtils.js';
export { approxEqual, parseUnitTestDateMs } from './compare/calcMath.js';

// Parser (copied JS + typed wrapper)
export { getCustomFieldCalcParser } from './parser/index.js';
export { InMemoryLearnHintsProvider, installLearnHintsStorage } from './parser/learnHints.js';
export type { LearnHintsProvider } from './parser/learnHints.js';

// BR rule parser (copied JS + typed wrapper)
export { getBrRuleParser } from './br/index.js';
export type { BrRuleParserApi, ParsedBrRule } from './br/index.js';

// Workbook
export {
  extractTestNumberFromHeader,
  getTestColumns,
  getTestColumnsFromHeaders,
  parseWorkbookJson,
  pickTestColumnForRow,
  findTestColumnByNumber,
} from './workbook/parseWorkbook.js';

// Runner
export { createLoanStore, cloneLoanStore } from './runner/loanStore.js';
export { executeScenario, executeAllScenarios } from './runner/executeScenario.js';
export { parseLoanSnapshotJson } from './runner/parseLoanSnapshot.js';

// Types
export type { CompareMode, CompareOptions } from './types/compare.js';
export type { UnitTestAction, UnitTestRow, UnitTestWorkbook, TestColumn, TestDescription } from './types/workbook.js';
export type { LoanSnapshot, CalculatedFieldDef } from './types/loan.js';
export type { LoanStore, StepResult, ScenarioResult, StepStatus } from './types/runner.js';
export type {
  CustomFieldCalcParserApi,
  CustomFieldInput,
  FieldMetadata,
  GeneratedWorkbook,
  IIfScenario,
  ParsedFormula,
} from './types/parser.js';
export type { WorkbookFixture, LoanSnapshotFixture } from './types/fixtures.js';
