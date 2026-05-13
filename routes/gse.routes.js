import { Router } from 'express';
import {
  getGseProducts,
  getGseSources,
  postGseAnalyzeScenario,
  postGseImportLoanJson,
  getGseLoanLimits,
  postLoanProgramExpert
} from '../controllers/gse.controller.js';

const router = Router();

router.get('/products', getGseProducts);
router.get('/sources', getGseSources);
router.post('/analyze-scenario', postGseAnalyzeScenario);
router.post('/import-loan-json', postGseImportLoanJson);
router.get('/loan-limits', getGseLoanLimits);
router.post('/loan-program-expert', postLoanProgramExpert);

export default router;
