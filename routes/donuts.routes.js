/**
 * Development work by David Lane
 */
import { Router } from 'express';
import donutsAssistantController from '../controllers/donuts-assistant.controller.js';

const router = Router();
router.use('/assistant', donutsAssistantController);

export default router;
