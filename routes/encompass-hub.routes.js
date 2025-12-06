import { Router } from 'express';
import { getHubStatus, getPipeline, getLoan } from '../controllers/encompass-hub.controller.js';

const router = Router();

router.get('/status', getHubStatus);
router.get('/pipeline', getPipeline);
router.get('/loans/:loanGuid', getLoan);

export default router;

