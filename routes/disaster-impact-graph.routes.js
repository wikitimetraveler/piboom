/**
 * Development work by David Lane
 */
import express from 'express';
import * as disasterImpactGraphController from '../controllers/disaster-impact-graph.controller.js';
import { requireDisasterRefreshAccess } from '../lib/disaster-refresh-auth.js';

const router = express.Router();

router.get('/county/:countyFips/loans', disasterImpactGraphController.getLoansByCounty);
router.get('/disaster/:disasterId/ego', disasterImpactGraphController.getDisasterEgoGraph);
router.get('/disaster/:disasterId/loans', disasterImpactGraphController.getLoansByDisaster);
router.post('/refresh', requireDisasterRefreshAccess, disasterImpactGraphController.refreshImpactGraph);
router.get('/:nodeId/summary', disasterImpactGraphController.getImpactSummary);
router.get('/:nodeId', disasterImpactGraphController.getImpactGraph);

export default router;
