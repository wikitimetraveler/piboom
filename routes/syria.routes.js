/**
 * Development work by David Lane
 */
import { Router } from 'express';
import syriaAssistantController from '../controllers/syria-assistant.controller.js';

const router = Router();
router.use('/assistant', syriaAssistantController);

export default router;
