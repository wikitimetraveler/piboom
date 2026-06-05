import { getCustomFieldCalcParser } from '../parser/index.js';
import type { LoanSnapshot } from '../types/loan.js';
import type { LoanStore } from '../types/runner.js';
import { extractFieldId } from '../compare/unitTestsUtils.js';

function fieldValuesFromSnapshot(snapshot: LoanSnapshot): Record<string, unknown> {
  return { ...snapshot.fields };
}

function parseFormulaOutputField(calculation: string): string | null {
  const parser = getCustomFieldCalcParser();
  const parsed = parser.parseCalculationFormula(calculation);
  return parsed.outputField;
}

function collectInputValues(
  expression: string,
  fields: Record<string, unknown>
): Record<string, unknown> {
  const parser = getCustomFieldCalcParser();
  const parsed = parser.parseCalculationFormula(`[OUT] = ${expression}`);
  const values: Record<string, unknown> = {};
  for (const fid of parsed.inputFields) {
    const norm = parser.normalizeFieldIdForLookup(fid);
    values[fid] = fields[norm] ?? fields[fid] ?? '';
    values[norm] = fields[norm] ?? fields[fid] ?? '';
  }
  return values;
}

export function createLoanStore(snapshot: LoanSnapshot): LoanStore {
  const fields: Record<string, unknown> = fieldValuesFromSnapshot(snapshot);
  const parser = getCustomFieldCalcParser();

  return {
    get(fieldId: string): unknown {
      const norm = parser.normalizeFieldIdForLookup(fieldId);
      if (Object.prototype.hasOwnProperty.call(fields, norm)) return fields[norm];
      if (Object.prototype.hasOwnProperty.call(fields, fieldId)) return fields[fieldId];
      return this.evaluateCalculated(fieldId);
    },

    set(fieldId: string, value: unknown): void {
      const norm = parser.normalizeFieldIdForLookup(fieldId);
      fields[norm] = value;
      fields[fieldId] = value;
    },

    evaluateCalculated(fieldId: string): unknown {
      const norm = parser.normalizeFieldIdForLookup(fieldId);
      const def = snapshot.calculatedFields?.[norm] || snapshot.calculatedFields?.[fieldId];
      if (!def?.calculation) return null;
      const parsed = parser.parseCalculationFormula(def.calculation);
      if (!parsed.expression) return null;
      const values = collectInputValues(parsed.expression, fields);
      return parser.evaluateExpression(parsed.expression, values);
    },
  };
}

/** Clone snapshot fields for isolated per-scenario runs. */
export function cloneLoanStore(snapshot: LoanSnapshot): LoanStore {
  return createLoanStore({
    ...snapshot,
    fields: { ...snapshot.fields },
  });
}

export function resolveSetValue(raw: unknown): unknown {
  const s = raw === null || raw === undefined ? '' : String(raw).trim();
  if (s.toLowerCase() === 'null' || s.toLowerCase() === 'nothing') return '';
  return raw;
}

export function targetFieldId(target: string): string | null {
  return extractFieldId(target);
}
