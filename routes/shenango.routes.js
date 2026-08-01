/**
 * Development work by David Lane
 */
import { Router } from 'express';
import shenangoAssistantController from '../controllers/shenango-assistant.controller.js';

const router = Router();
router.use('/assistant', shenangoAssistantController);

export default router;
