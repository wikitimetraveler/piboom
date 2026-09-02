/**
 * Development work by David Lane
 */
import { Router } from 'express';
import mountainHighAssistantController from '../controllers/mountain-high-assistant.controller.js';

const router = Router();
router.use('/assistant', mountainHighAssistantController);

export default router;
