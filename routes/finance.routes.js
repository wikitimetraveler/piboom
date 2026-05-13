import { Router } from 'express';
import { postLoanProgramExpert } from '../controllers/gse.controller.js';

const router = Router();

// Shared finance AI endpoint (reused by GSE page and other finance tools)
router.post('/loan-program-expert', postLoanProgramExpert);

export default router;
