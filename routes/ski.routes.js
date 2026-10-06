/**
 * Development work by David Lane
 */
import { Router } from 'express';
import skiTopoController from '../controllers/ski-topo.controller.js';
import skiAssistantController from '../controllers/ski-assistant.controller.js';

const router = Router();
router.use('/assistant', skiAssistantController);
router.use('/', skiTopoController);

export default router;
