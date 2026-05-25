/**
 * Development work by David Lane
 */
import { Router } from 'express';
import { chatWithRocky, visionIdentifyRock } from '../controllers/rock-discovery.controller.js';

const router = Router();

router.post('/chat', chatWithRocky);
router.post('/vision-id', visionIdentifyRock);

export default router;
