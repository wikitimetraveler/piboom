/**
 * Development work by David Lane
 */
import { Router } from 'express';
import { addCatch, listCatches, updateCatch, getGoogleMapsKey } from '../controllers/fish-catches.controller.js';
import { visionIdentify } from '../controllers/fish-vision.controller.js';

const router = Router();

router.post('/', addCatch);
router.get('/', listCatches);
router.get('/google-api-key', getGoogleMapsKey);
router.post('/vision-id', visionIdentify);
router.put('/:id', updateCatch);

export default router;

