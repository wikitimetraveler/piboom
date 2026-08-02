/**
 * Development work by David Lane
 */
import { Router } from 'express';
import { postConvertConditionsCdo } from '../controllers/encompass-conditions.controller.js';

const router = Router();

router.post('/convert', postConvertConditionsCdo);

export default router;
