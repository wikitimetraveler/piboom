import { Router } from 'express';
import {
  getHubStatus,
  getCustomFields,
  getNativeFields,
  getCompanyUsers,
  getPipeline,
  getLoan,
  setLoanFields,
  getLoanFields,
  getCalculatorSummary,
  getRatioAnalytics,
  getMapVisualization,
  getStackedVisualization,
  getTimelineVisualization,
} from '../controllers/encompass-hub.controller.js';

const router = Router();

router.get('/status', getHubStatus);
router.get('/users', getCompanyUsers);
router.get('/pipeline', getPipeline);
router.get('/loans/:loanGuid', getLoan);
router.post('/loans/:loanId/field-writer', setLoanFields);
router.post('/loans/:loanGuid/field-reader', getLoanFields);
router.get('/analytics/calc-summary', getCalculatorSummary);
router.get('/analytics/ratios', getRatioAnalytics);
router.get('/visualizations/map3d', getMapVisualization);
router.get('/visualizations/stacked-cubes', getStackedVisualization);
router.get('/visualizations/timeline', getTimelineVisualization);
router.get('/native-fields', getNativeFields);
router.get('/custom-fields', getCustomFields);

export default router;

