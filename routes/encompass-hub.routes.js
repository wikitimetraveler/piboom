import { Router } from 'express';
import { encompassEnvStorage } from '../services/encompass-auth.service.js';
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
  postCreateFields,
} from '../controllers/encompass-hub.controller.js';

const router = Router();

/** Set request-scoped Encompass env from X-Encompass-Env header (correspondent | retail). Default: correspondent. */
router.use((req, res, next) => {
  const raw = (req.headers['x-encompass-env'] || '').toString().toLowerCase().trim();
  const env = raw === 'retail' ? 'retail' : 'correspondent';
  encompassEnvStorage.run({ env }, () => next());
});

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
router.post('/create-fields', postCreateFields);

export default router;

