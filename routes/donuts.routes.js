/**
 * Development work by David Lane
 */
import { Router } from 'express';
import donutsAssistantController from '../controllers/donuts-assistant.controller.js';
import donutsDiscoveryController from '../controllers/donuts-discovery.controller.js';

const router = Router();
router.use('/assistant', donutsAssistantController);
router.use('/discovery', donutsDiscoveryController);

export default router;
