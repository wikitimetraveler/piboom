/**
 * Planetarium API routes
 * Development work by David Lane
 */
import { Router } from 'express';
import planetariumAssistantController from '../controllers/planetarium-assistant.controller.js';

const router = Router();
router.use('/assistant', planetariumAssistantController);

export default router;
