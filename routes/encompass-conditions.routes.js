/**
 * Development work by David Lane
 */
import { Router } from 'express';
import { postConvertConditionsCdo } from '../controllers/encompass-conditions.controller.js';
import conditionsAssistantRoutes from '../controllers/conditions-assistant.controller.js';

const router = Router();

router.post('/convert', postConvertConditionsCdo);
router.use('/assistant', conditionsAssistantRoutes);

export default router;
