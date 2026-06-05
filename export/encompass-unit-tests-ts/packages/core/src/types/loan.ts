export interface CalculatedFieldDef {
  calculation: string;
  dataType?: string;
  format?: string;
  description?: string;
}

export interface LoanSnapshot {
  loanGuid?: string;
  fields: Record<string, string | number | boolean | null>;
  calculatedFields?: Record<string, CalculatedFieldDef>;
}
