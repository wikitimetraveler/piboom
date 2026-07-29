/**
 * Development work by David Lane
 */
import { Router } from 'express';
import jordanAssistantController from '../controllers/jordan-assistant.controller.js';

const router = Router();
router.use('/assistant', jordanAssistantController);

export default router;
