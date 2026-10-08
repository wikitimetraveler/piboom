/**
 * Development work by David Lane
 */
import { Router } from 'express';
import skiTopoController from '../controllers/ski-topo.controller.js';
import skiAssistantController from '../controllers/ski-assistant.controller.js';
import skiLogController from '../controllers/ski-log.controller.js';

const router = Router();
router.use('/assistant', skiAssistantController);
router.use('/log', skiLogController);
router.use('/', skiTopoController);

export default router;
