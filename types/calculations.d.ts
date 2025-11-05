/**
 * Type definitions for the calculations class and related interfaces
 */

export interface CalculationOptions {
  result: HTMLInputElement;
  additionalData?: Record<string, number | string>;
  rawInputs?: HTMLInputElement[];
}

export interface CalculationGroup {
  inputIds: string[];
  resultId: string;
  calculation: string;
  additionalInputIds?: Record<string, string>;
}

export interface CalculatorConfig {
  groups: CalculationGroup[];
}

export interface GroupElementData {
  inputs: HTMLInputElement[];
  result: HTMLInputElement;
  additionalInputs: Record<string, HTMLInputElement>;
  groupConfig: CalculationGroup;
}

export type CalculationMethod = (values: (number | string)[], options: CalculationOptions) => void;

export interface DTICalculatorIds {
  annualIncome: string;
  monthlyIncomeCalc: string;
  grossMonthly: string;
  principalInterest: string;
  propertyTaxes: string;
  hazardInsurance: string;
  mortgageInsurance: string;
  hoa: string;
  totalHousing: string;
  frontEnd: string;
  autoLoan: string;
  creditCards: string;
  studentLoans: string;
  personalLoans: string;
  otherDebts: string;
  totalDebts: string;
  totalMonthlyPayment: string;
  backEnd: string;
  minIncomeNeeded: string;
}

export interface FHACalculatorIds {
  g12: string;
  g13: string;
  g14: string;
  g15: string;
  g18: string;
  g9: string;
  g19: string;
  g20: string;
  g8: string;
  g22: string;
  g24: string;
  g28: string;
  d29: string;
  e29: string;
  g29: string;
  g30: string;
  g7: string;
  g33: string;
}

export interface AssetQualifierIds {
  cat1Factor: string;
  liquidAssets: string;
  cat1Eligible: string;
  cat2Factor: string;
  otherAssets: string;
  cat2Eligible: string;
  dob: string;
  retFactor: string;
  retirementAssets: string;
  retEligible: string;
  totalEligibleAssets: string;
  reserveMonths: string;
  monthlyPayment: string;
  requiredReserves: string;
  minAssetsResult: string;
  netEligibleAssets: string;
  supportablePayment: string;
  nonBorrowerAssets: string;
  hist12mo: string;
  messages: string;
}

export interface CalculatorFactoryOptions {
  prefix?: string;
  customIds?: Partial<DTICalculatorIds> | Partial<FHACalculatorIds> | Partial<AssetQualifierIds>;
}

