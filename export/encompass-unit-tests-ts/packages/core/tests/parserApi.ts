import { getCustomFieldCalcParser } from '../src/parser/index.js';

const parser = getCustomFieldCalcParser();

export const {
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
  getFieldValue,
} = parser;
