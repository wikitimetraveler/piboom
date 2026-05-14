import express from 'express';
import * as disasterImpactGraphController from '../controllers/disaster-impact-graph.controller.js';

const router = express.Router();

router.get('/county/:countyFips/loans', disasterImpactGraphController.getLoansByCounty);
router.get('/disaster/:disasterId/loans', disasterImpactGraphController.getLoansByDisaster);
router.get('/:nodeId/summary', disasterImpactGraphController.getImpactSummary);
router.get('/:nodeId', disasterImpactGraphController.getImpactGraph);

export default router;
