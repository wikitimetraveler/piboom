/**
 * Development work by David Lane
 */
import { Router } from 'express';
import omanAssistantController from '../controllers/oman-assistant.controller.js';

const router = Router();
router.use('/assistant', omanAssistantController);

export default router;
