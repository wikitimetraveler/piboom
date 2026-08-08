/**
 * Development work by David Lane
 */
import { Router } from 'express';
import iranAssistantController from '../controllers/iran-assistant.controller.js';

const router = Router();
router.use('/assistant', iranAssistantController);

export default router;
