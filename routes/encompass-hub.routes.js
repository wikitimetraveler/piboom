import { Router } from 'express';
import {
  getHubStatus,
  getCompanyUsers,
  getPipeline,
  getLoan,
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
router.get('/analytics/calc-summary', getCalculatorSummary);
router.get('/analytics/ratios', getRatioAnalytics);
router.get('/visualizations/map3d', getMapVisualization);
router.get('/visualizations/stacked-cubes', getStackedVisualization);
router.get('/visualizations/timeline', getTimelineVisualization);

export default router;

