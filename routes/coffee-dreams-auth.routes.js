/**
 * Development work by David Lane
 */
import { Router } from 'express';
import { postVerifyCoffeeDreams } from '../controllers/coffee-dreams-auth.controller.js';

const router = Router();
router.post('/verify-coffee-dreams', postVerifyCoffeeDreams);
export default router;
