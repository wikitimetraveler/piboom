/**
 * Development work by David Lane
 */
import { Router } from 'express';
import roseAssistantController from '../controllers/rose-assistant.controller.js';
import roseHeygenController from '../controllers/rose-heygen.controller.js';

const router = Router();
router.use(roseHeygenController);
router.use('/assistant', roseAssistantController);

export default router;
