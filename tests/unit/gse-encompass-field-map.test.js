import { describe, expect, test } from '@jest/globals';
import '../../public/shared/gse-encompass-field-map.js';

const { gseEncompassFieldMap } = globalThis;

function readerFromMap(valueMap) {
  const rows = [];
  for (const id of gseEncompassFieldMap.GSE_ENCOMPASS_FIELD_IDS) {
    if (Object.prototype.hasOwnProperty.call(valueMap, id)) {
      rows.push({ id, value: valueMap[id] });
    }
  }
  return rows;
}

describe('gseEncompassFieldMap', () => {
  test('extractFieldValueFromReaderResponse reads array of { id, value }', () => {
    const data = [
      { id: 'Loan.LTV', value: '82.5' },
      { id: 'Loan.LoanPurpose', value: 'Purchase' }
    ];
    expect(gseEncompassFieldMap.extractFieldValueFromReaderResponse(data, 'Loan.LTV')).toBe('82.5');
    expect(gseEncompassFieldMap.extractFieldValueFromReaderResponse(data, 'Loan.LoanPurpose')).toBe('Purchase');
  });

  test('mapReaderToScenario succeeds with typical pipeline-shaped values', () => {
    const valueMap = {};
    for (const id of gseEncompassFieldMap.GSE_ENCOMPASS_FIELD_IDS) {
      valueMap[id] = '';
    }
    Object.assign(valueMap, {
      'Loan.BorrowerScore': '720',
      'Loan.FirstTimeHomebuyersIndicator': 'true',
      'Loan.TotalMonthlyIncome': '6000',
      'Loan.LoanAmount': '480000',
      'Loan.PurchasePriceAmount': '500000',
      'Loan.LTV': '96',
      'Loan.CLTV': '96',
      'Fields.14': 'TX',
      'Fields.15': 'Travis County',
      'Loan.NumberOfUnits': '1',
      'Loan.OccupancyStatus': 'PrimaryResidence',
      'Loan.LoanPurpose': 'Purchase',
      'Loan.PropertyType': 'Single Family',
      'Loan.TotalDTI': '41'
    });
    const out = gseEncompassFieldMap.mapReaderToScenario(readerFromMap(valueMap));
    expect(out.ok).toBe(true);
    expect(out.scenario.borrower.creditScore).toBe(720);
    expect(out.scenario.borrower.income).toBe(6000 * 12);
    expect(out.scenario.loan.state).toBe('TX');
    expect(out.scenario.loan.county).toBe('Travis');
    expect(out.scenario.loan.occupancy).toBe('primary');
    expect(out.scenario.loan.purpose).toBe('purchase');
    expect(out.scenario.loan.propertyType).toBe('singleFamily');
    expect(out.warnings.some((w) => /Reserves/i.test(w))).toBe(true);
  });

  test('mapReaderToScenario fails when income fields are empty', () => {
    const valueMap = {};
    for (const id of gseEncompassFieldMap.GSE_ENCOMPASS_FIELD_IDS) {
      valueMap[id] = '';
    }
    Object.assign(valueMap, {
      'Loan.BorrowerScore': '700',
      'Loan.LoanAmount': '300000',
      'Loan.PurchasePriceAmount': '310000',
      'Loan.LTV': '90',
      'Loan.CLTV': '90',
      'Fields.14': 'CA',
      'Fields.15': 'Orange',
      'Loan.NumberOfUnits': '1',
      'Loan.OccupancyStatus': 'PrimaryResidence',
      'Loan.LoanPurpose': 'NoCashOutRefinance',
      'Loan.PropertyType': 'Condominium',
      'Loan.TotalDTI': '38'
    });
    const out = gseEncompassFieldMap.mapReaderToScenario(readerFromMap(valueMap));
    expect(out.ok).toBe(false);
    expect(out.errors.some((e) => /income/i.test(e))).toBe(true);
  });

  test('mapReaderToScenario maps rate/term refi purpose', () => {
    const valueMap = {};
    for (const id of gseEncompassFieldMap.GSE_ENCOMPASS_FIELD_IDS) {
      valueMap[id] = '';
    }
    Object.assign(valueMap, {
      'Loan.BorrowerScore': '680',
      'Loan.TotalBorrowerMonthlyIncome': '5500',
      'Loan.LoanAmount': '250000',
      'Loan.PurchasePriceAmount': '320000',
      'Loan.LTV': '78',
      'Loan.CLTV': '78',
      'Fields.14': 'FL',
      'Fields.15': 'Duval',
      'Loan.NumberOfUnits': '1',
      'Loan.OccupancyStatus': 'Investor',
      'Loan.LoanPurpose': 'NoCashOutRefinance',
      'Loan.PropertyType': 'PUD',
      'Loan.TotalDTI': '44'
    });
    const out = gseEncompassFieldMap.mapReaderToScenario(readerFromMap(valueMap));
    expect(out.ok).toBe(true);
    expect(out.scenario.loan.purpose).toBe('rateTermRefi');
    expect(out.scenario.loan.occupancy).toBe('investment');
    expect(out.scenario.loan.propertyType).toBe('pud');
  });
});
