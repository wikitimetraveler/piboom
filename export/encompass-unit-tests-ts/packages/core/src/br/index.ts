import { installDomParserShim } from './xmlDomShim.js';

installDomParserShim();
import './brRuleParser.js';

export interface BrFieldRef {
  entityId: string;
  entityUid: string;
}

export interface BrAdvancedCondition {
  value: string;
  milestone: BrFieldRef | null;
  fields: BrFieldRef[];
}

export interface ParsedBrRule {
  rule: {
    id: string;
    name: string;
    ruleType: string;
    status: string;
  };
  mainCondition: { expression: string; fields: BrFieldRef[] } | null;
  advancedConditions: BrAdvancedCondition[];
  requiredFields: { fieldId: string; fieldUid?: string; milestone: string }[];
  error?: string;
}

export interface BrRuleParserApi {
  parseBRXml(xmlText: string): ParsedBrRule;
  parseBRConditionSnippet(snippetText: string): ParsedBrRule;
  extractFieldIdsFromConditionText(text: string): string[];
  generateUnitTestFromBRRule(
    parsed: ParsedBrRule,
    opts?: { fieldMetadataLookup?: Record<string, { description?: string; dataType?: string }> }
  ): {
    headers: string[];
    rows: Record<string, unknown>[];
    testDescriptions: { testNumber: string; description: string }[];
  } | null;
}

let cached: BrRuleParserApi | null = null;

export function getBrRuleParser(): BrRuleParserApi {
  if (cached) return cached;
  const g = globalThis as typeof globalThis & { brRuleParser?: BrRuleParserApi };
  if (!g.brRuleParser) {
    throw new Error('brRuleParser failed to load');
  }
  cached = g.brRuleParser;
  return cached;
}
