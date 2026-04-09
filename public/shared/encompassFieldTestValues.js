/**
 * Sample test values for Encompass fields (Alchemist / Tool 8 style).
 * Used by tool8.js and unit-tests Live Scenario Builder “Tool 8 samples”.
 */
(function (global) {
  'use strict';

  global.encompassFieldTestValuesMap = {
    '1172': 'FHA',
    'CX.TYPE': 'Purchase',
    'MORNET.X67': 'FHA Full Doc',
    'CX.PROPERTY.TYPE': 'Condo',
    'CX.PROPERTY.STATUS': 'Existing',
    'CX.IS.APPRAISALWAIVERUSED': 'N',
    'CX.APPRAISAL.TYPE': 'Full',
    'Log.MS.Date.Underwriting': '2020-01-15',
    '@Log.MS.Date.Underwriting': '2020-01-15',
    'Log.MS.Date.Processing': '2019-12-15',
    '@Log.MS.Date.Processing': '2019-12-15',
    'Log.MS.Date.Closing': '2020-02-15',
    '@Log.MS.Date.Closing': '2020-02-15',
    'CX.BORROWER.COUNT': '1',
    'CX.BORROWER.1.CREDIT.SCORE': '720',
    'CX.BORROWER.1.OCCUPANCY': 'Primary',
    'CX.LOAN.AMOUNT': '250000',
    'CX.MAX.LOAN.AMOUNT': '300000',
    'CX.INTEREST.RATE': '3.5',
    'CX.MIP.RATE': '0.85',
    'CX.CHANNEL': 'Brokered',
    'CX.PROGRAM': 'Standard',
    DEFAULT_STRING: 'N',
    DEFAULT_DATE: '2020-01-15',
    DEFAULT_NUMBER: '0',
  };
})(typeof window !== 'undefined' ? window : globalThis);
