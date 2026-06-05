export interface ParsedFormula {
  outputField: string | null;
  inputFields: string[];
  expression: string;
}

export interface IIfScenario {
  condition: string | null;
  result: string;
  isElse: boolean;
}

export interface FieldMetadata {
  dataType?: string;
  format?: string;
  description?: string;
}

export interface GeneratedWorkbook {
  headers: string[];
  rows: Record<string, unknown>[];
  testDescriptions: { testNumber: string; description: string }[];
  fieldMetadata?: Record<string, FieldMetadata>;
}

export interface CustomFieldInput {
  fieldId?: string;
  id?: string;
  calculation?: string;
  calculationExpression?: string;
  description?: string;
  dataType?: string;
  format?: string;
}

export interface CustomFieldCalcParserApi {
  parseCalculationFormula(calc: string): ParsedFormula;
  parseAllIIfScenarios(expression: string): IIfScenario[] | null;
  expandOrElseScenarios(scenarios: IIfScenario[]): IIfScenario[];
  getSuggestedValuesForScenario(
    scenario: IIfScenario,
    inputFields: string[],
    opts?: { fieldMetadata?: Record<string, FieldMetadata>; scenarioIndex?: number; allScenarios?: IIfScenario[] }
  ): Record<string, string | number>;
  generateUnitTestFromCustomField(
    field: CustomFieldInput,
    opts?: { fieldMetadata?: Record<string, FieldMetadata> }
  ): GeneratedWorkbook;
  evaluateExpression(expression: string, values: Record<string, unknown>): unknown;
  evaluateCondition(condition: string, values: Record<string, unknown>): boolean;
  buildFieldMetadataLookup(customList?: unknown[], nativeList?: unknown[]): Record<string, FieldMetadata>;
  getFallbackFieldMetadata(): Record<string, FieldMetadata>;
  normalizeFieldIdForLookup(raw: string): string;
  isDateFieldByNotation(raw: string): boolean;
  isNumberFieldByNotation(raw: string): boolean;
}
