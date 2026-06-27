/**
 * Development work by David Lane
 */
/** Synthetic pipeline + processor roster for processor-assignment-mock.html */
(function (root) {
  'use strict';

  const MOCK_PROCESSORS = [
    {
      userId: 'proc.alice',
      displayName: 'Alice Chen',
      maxPoints: 40,
      products: ['Conventional', 'FHA', 'VA'],
      targetUtilization: 0.75,
    },
    {
      userId: 'proc.bob',
      displayName: 'Bob Martinez',
      maxPoints: 35,
      products: ['Jumbo', 'Condo', 'CEMA'],
      targetUtilization: 0.8,
    },
    {
      userId: 'proc.carol',
      displayName: 'Carol Nguyen',
      maxPoints: 30,
      products: ['FHA', 'VA', 'USDA'],
      targetUtilization: 0.7,
    },
  ];

  const MOCK_LOANS = [
    {
      loanGuid: 'mock-loan-001',
      fields: {
        'Loan.LoanNumber': '2026001',
        'Loan.BorrowerName': 'Smith, John',
        'Loan.MortgageType': 'Conventional',
        'Loan.LoanProgramName': '30 Year Fixed Conventional',
        'Loan.TotalDTI': 38,
        'Loan.BorrowerScore': 720,
        'Loan.PropertyType': 'Detached',
        'Loan.PropertyOccupancyType': 'PrimaryResidence',
        'Loan.LoanProcessorID': 'proc.alice',
        'Loan.LoanProcessorName': 'Alice Chen',
      },
    },
    {
      loanGuid: 'mock-loan-002',
      fields: {
        'Loan.LoanNumber': '2026002',
        'Loan.BorrowerName': 'Johnson, Maria',
        'Loan.MortgageType': 'FHA',
        'Loan.LoanProgramName': 'FHA 30 Year Fixed',
        'Loan.TotalDTI': 48,
        'Loan.BorrowerScore': 650,
        'Loan.PropertyType': 'Detached',
        'Loan.PropertyOccupancyType': 'Investment',
        'Fields.CX.BORROWER.SELF.EMPLOYED': 'Y',
        'Fields.CX.INITIAL.RE_LIABILITIES_COUNT': 3,
      },
    },
    {
      loanGuid: 'mock-loan-003',
      fields: {
        'Loan.LoanNumber': '2026003',
        'Loan.BorrowerName': 'Williams, David',
        'Loan.MortgageType': 'VA',
        'Loan.LoanProgramName': 'VA Full Doc 30 Fixed',
        'Loan.TotalDTI': 42,
        'Loan.BorrowerScore': 710,
        'Loan.PropertyOccupancyType': 'PrimaryResidence',
        'Fields.CX.INITIAL.VARIABLE_INCOME_USED': 'Y',
      },
    },
    {
      loanGuid: 'mock-loan-004',
      fields: {
        'Loan.LoanNumber': '2026004',
        'Loan.BorrowerName': 'Brown, Emily',
        'Loan.MortgageType': 'Conventional',
        'Loan.LoanProgramName': 'Jumbo 30 Year Fixed',
        'Loan.TotalDTI': 36,
        'Loan.BorrowerScore': 780,
        'Loan.PropertyType': 'Condo',
        'Loan.PropertyOccupancyType': 'SecondHome',
        'Loan.LoanProcessorID': 'proc.bob',
        'Loan.LoanProcessorName': 'Bob Martinez',
      },
    },
    {
      loanGuid: 'mock-loan-005',
      fields: {
        'Loan.LoanNumber': '2026005',
        'Loan.BorrowerName': 'Davis, Robert',
        'Loan.MortgageType': 'FHA',
        'Loan.LoanProgramName': 'FHA Streamline',
        'Loan.TotalDTI': 52,
        'Loan.BorrowerScore': 620,
        'Loan.State': 'TX',
        'Fields.CX.PROGRESSION.SUSPENDED': 'Y',
        'Fields.CX.PROGRESSION.TITLE_HOLD': 'Y',
        'Fields.CX.INITIAL.JOB_TENURE_MONTHS': 8,
      },
    },
    {
      loanGuid: 'mock-loan-006',
      fields: {
        'Loan.LoanNumber': '2026006',
        'Loan.BorrowerName': 'Miller, Sarah',
        'Loan.MortgageType': 'Conventional',
        'Loan.LoanProgramName': 'CEMA Refinance',
        'Loan.TotalDTI': 40,
        'Loan.BorrowerScore': 695,
        'Loan.PropertyType': 'Condo',
        'Loan.BorrowerType': 'Trust',
        'Fields.CX.INITIAL.SUBORDINATION': 'Y',
      },
    },
    {
      loanGuid: 'mock-loan-007',
      fields: {
        'Loan.LoanNumber': '2026007',
        'Loan.BorrowerName': 'Wilson, James',
        'Loan.MortgageType': 'VA',
        'Loan.LoanProgramName': 'VA IRRRL',
        'Loan.TotalDTI': 44,
        'Loan.BorrowerScore': 668,
        'Fields.CX.PROGRESSION.MULTIPLE_PROCESSORS': 'Y',
        'Fields.CX.INITIAL.BORROWER_PAIR_COUNT': 2,
      },
    },
    {
      loanGuid: 'mock-loan-008',
      fields: {
        'Loan.LoanNumber': '2026008',
        'Loan.BorrowerName': 'Taylor, Lisa',
        'Loan.MortgageType': 'Conventional',
        'Loan.LoanProgramName': '30 Year Fixed',
        'Loan.TotalDTI': 35,
        'Loan.BorrowerScore': 740,
        'Loan.PropertyOccupancyType': 'PrimaryResidence',
      },
    },
    {
      loanGuid: 'mock-loan-009',
      fields: {
        'Loan.LoanNumber': '2026009',
        'Loan.BorrowerName': 'Anderson, Michael',
        'Loan.MortgageType': 'FHA',
        'Loan.LoanProgramName': 'FHA 203k',
        'Loan.TotalDTI': 47,
        'Loan.BorrowerScore': 655,
        'Fields.CX.PROGRESSION.PRODUCT_CHANGE': 'Y',
        'Fields.CX.INITIAL.OTHER_INCOME_USED': 'Y',
      },
    },
    {
      loanGuid: 'mock-loan-010',
      fields: {
        'Loan.LoanNumber': '2026010',
        'Loan.BorrowerName': 'Thomas, Jennifer',
        'Loan.MortgageType': 'Conventional',
        'Loan.LoanProgramName': 'Jumbo ARM 7/6',
        'Loan.TotalDTI': 39,
        'Loan.BorrowerScore': 760,
        'Loan.PropertyType': 'Detached',
        'Loan.PropertyOccupancyType': 'Investment',
        'Fields.CX.PROGRESSION.SUBJECT_TO_APPRAISAL': 'Y',
      },
    },
  ];

  root.processorAssignmentMockData = {
    MOCK_PROCESSORS,
    MOCK_LOANS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
