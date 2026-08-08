/**
 * Development work by David Lane
 */
import { Router } from 'express';
import egyptAssistantController from '../controllers/egypt-assistant.controller.js';

const router = Router();
router.use('/assistant', egyptAssistantController);

export default router;
