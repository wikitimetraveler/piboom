import { Router } from 'express';
import { receive } from '../controllers/encompass-webhook.controller.js';

const router = Router();

// Receives Encompass/ICE webhook callbacks
router.post('/encompass', receive);

export default router;








