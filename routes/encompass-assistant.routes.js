import { Router } from 'express';
import encompassAssistantController from '../controllers/encompass-assistant.controller.js';

const router = Router();

// Use the controller routes
router.use('/', encompassAssistantController);

export default router;
