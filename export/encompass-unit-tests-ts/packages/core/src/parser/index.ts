/**
 * Typed wrapper around copied piBoom customFieldCalcParser.js (read-only source copy).
 * Browser: side-effect import. Node tests: see tests/setupParser.ts.
 */
import type { CustomFieldCalcParserApi } from '../types/parser.js';

import './customFieldCalcParser.js';

let cached: CustomFieldCalcParserApi | null = null;

export function getCustomFieldCalcParser(): CustomFieldCalcParserApi {
  if (cached) return cached;
  const g = globalThis as typeof globalThis & { customFieldCalcParser?: CustomFieldCalcParserApi };
  if (!g.customFieldCalcParser) {
    throw new Error('customFieldCalcParser failed to load');
  }
  cached = g.customFieldCalcParser;
  return cached;
}

export type {
  CustomFieldCalcParserApi,
  GeneratedWorkbook,
  ParsedFormula,
  IIfScenario,
  FieldMetadata,
  CustomFieldInput,
} from '../types/parser.js';
