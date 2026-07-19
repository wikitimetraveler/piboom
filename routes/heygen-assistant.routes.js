/**
 * Development work by David Lane
 */
import { Router } from 'express';
import heygenAssistantController from '../controllers/heygen-assistant.controller.js';

const router = Router();
router.use('/', heygenAssistantController);

export default router;
