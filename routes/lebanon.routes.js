/**
 * Development work by David Lane
 */
import { Router } from 'express';
import lebanonAssistantController from '../controllers/lebanon-assistant.controller.js';

const router = Router();
router.use('/assistant', lebanonAssistantController);

export default router;
