/**
 * Development work by David Lane
 */
import { Router } from 'express';
import holyLandAssistantController from '../controllers/holy-land-assistant.controller.js';

const router = Router();
router.use('/assistant', holyLandAssistantController);

export default router;
