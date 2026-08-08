/**
 * Development work by David Lane
 */
import { Router } from 'express';
import iraqAssistantController from '../controllers/iraq-assistant.controller.js';

const router = Router();
router.use('/assistant', iraqAssistantController);

export default router;
