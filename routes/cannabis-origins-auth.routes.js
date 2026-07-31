/**
 * Development work by David Lane
 */
import { Router } from 'express';
import { postVerifyCannabisOrigins } from '../controllers/cannabis-origins-auth.controller.js';

const router = Router();
router.post('/verify-cannabis-origins', postVerifyCannabisOrigins);
export default router;
