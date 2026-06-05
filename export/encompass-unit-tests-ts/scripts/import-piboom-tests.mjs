/**
 * One-time converter: piBoom Jest tests → export vitest .test.ts (read-only source).
 */
import fs from 'fs';
import path from 'path';

const piboomRoot = path.resolve(import.meta.dirname, '../../..');
const exportTests = path.resolve(import.meta.dirname, '../packages/core/tests');

const parserImports = `import { describe, expect, test } from 'vitest';
import {
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
} from './parserApi.js';
`;

const brImports = `import { describe, expect, test } from 'vitest';
import { getBrRuleParser } from '../src/br/index.js';

const { parseBRConditionSnippet, extractFieldIdsFromConditionText, generateUnitTestFromBRRule } =
  getBrRuleParser();
`;

function stripParserPreamble(src) {
  return src
    .replace(/^\/\*\*[\s\S]*?\*\/\s*/m, '')
    .replace(/import\s+['"]\.\.\/\.\.\/public\/shared\/customFieldCalcParser\.js['"];\s*/g, '')
    .replace(/const\s*\{[\s\S]*?\}\s*=\s*globalThis\.customFieldCalcParser;\s*/g, '');
}

function stripBrPreamble(src) {
  return src
    .replace(/^\/\*\*[\s\S]*?\*\/\s*/m, '')
    .replace(/import\s+['"]\.\.\/\.\.\/public\/shared\/brRuleParser\.js['"];\s*/g, '')
    .replace(
      /const\s*\{[\s\S]*?\}\s*=\s*globalThis\.brRuleParser;\s*/g,
      ''
    );
}

function convertParserTest(name) {
  const srcPath = path.join(piboomRoot, 'tests/unit', name);
  let body = stripParserPreamble(fs.readFileSync(srcPath, 'utf8'));
  body = body.replace(/test\.each\(/g, 'test.each(');
  const out = parserImports + '\n' + body;
  const outName = name.replace('.js', '.ts').replace('customFieldCalcParser', 'parser');
  fs.writeFileSync(path.join(exportTests, outName), out);
  console.log('wrote', outName);
}

function convertBrTest() {
  const srcPath = path.join(piboomRoot, 'tests/unit/brRuleParser.test.js');
  let body = stripBrPreamble(fs.readFileSync(srcPath, 'utf8'));
  const out = brImports + '\n' + body;
  fs.writeFileSync(path.join(exportTests, 'brRuleParser.test.ts'), out);
  console.log('wrote brRuleParser.test.ts');
}

fs.mkdirSync(exportTests, { recursive: true });
convertParserTest('customFieldCalcParser.test.js');
convertParserTest('customFieldCalcParser-iif-phase2-golden.test.js');
convertParserTest('customFieldCalcParser-iif-formula.test.js');
convertParserTest('customFieldCalcParser-div12.test.js');
convertBrTest();
