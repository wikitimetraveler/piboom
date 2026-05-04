import { Router } from 'express';
import {
  getGseProducts,
  getGseSources,
  postGseAnalyzeScenario,
  postGseImportLoanJson,
  getGseLoanLimits
} from '../controllers/gse.controller.js';

const router = Router();

router.get('/products', getGseProducts);
router.get('/sources', getGseSources);
router.post('/analyze-scenario', postGseAnalyzeScenario);
router.post('/import-loan-json', postGseImportLoanJson);
router.get('/loan-limits', getGseLoanLimits);

export default router;
