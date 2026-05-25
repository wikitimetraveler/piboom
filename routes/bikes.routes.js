/**
 * Development work by David Lane
 */
import { Router } from 'express';
import { listBikes, addBike, updateBike, getGoogleMapsKey } from '../controllers/bikes.controller.js';
import { visionIdentifyBike } from '../controllers/bike-vision.controller.js';

const router = Router();

router.get('/', listBikes);
router.post('/', addBike);
router.put('/:id', updateBike);
router.get('/google-api-key', getGoogleMapsKey);
router.post('/vision-id', visionIdentifyBike);

export default router;

