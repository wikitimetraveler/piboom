/**
 * Planetarium API routes
 * Development work by David Lane
 */
import { Router } from 'express';
import planetariumAssistantController from '../controllers/planetarium-assistant.controller.js';
import planetariumController from '../controllers/planetarium.controller.js';

const router = Router();
router.use('/assistant', planetariumAssistantController);
router.use('/', planetariumController);

export default router;
