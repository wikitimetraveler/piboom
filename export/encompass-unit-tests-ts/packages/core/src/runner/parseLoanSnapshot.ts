import type { LoanSnapshot } from '../types/loan.js';

export function parseLoanSnapshotJson(raw: unknown): LoanSnapshot {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Loan snapshot must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  const fields = obj.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw new Error('Loan snapshot must include a fields object');
  }
  return {
    loanGuid: obj.loanGuid as string | undefined,
    fields: fields as LoanSnapshot['fields'],
    calculatedFields: obj.calculatedFields as LoanSnapshot['calculatedFields'],
  };
}
