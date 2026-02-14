import { Router } from 'express';
import reviewerAIController from '../controllers/reviewer-ai.controller.js';

const router = Router();

router.use('/ai', reviewerAIController);

export default router;
