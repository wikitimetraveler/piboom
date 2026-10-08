/**
 * Development work by David Lane
 */
import { Router } from 'express';
import { listSpots, listThriftNear, addSpot, updateSpot, deleteSpot, getGoogleMapsKey, importSpots } from '../controllers/local-spots.controller.js';
import localSpotsAIController from '../controllers/local-spots-ai.controller.js';

const router = Router();

router.use('/ai', localSpotsAIController);
router.get('/', listSpots);
router.get('/thrift-near', listThriftNear);
router.post('/', addSpot);
router.post('/import', importSpots);
router.put('/:id', updateSpot);
router.delete('/:id', deleteSpot);
router.get('/google-api-key', getGoogleMapsKey);

export default router;
