import type { LoanSnapshot } from './loan.js';
import type { UnitTestWorkbook } from './workbook.js';

/** JSON schema shape for workbook.json (documentation + validation helpers). */
export interface WorkbookFixture extends UnitTestWorkbook {
  meta?: { name?: string; loanGuid?: string };
}

/** JSON schema shape for loan-snapshot.json */
export interface LoanSnapshotFixture extends LoanSnapshot {}
