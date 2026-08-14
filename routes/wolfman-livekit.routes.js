/**
 * Development work by David Lane
 */
import { Router } from 'express';
import { getWolfmanHealth, postWolfmanLivekitToken } from '../controllers/wolfman-livekit.controller.js';

const router = Router();
router.get('/health', getWolfmanHealth);
router.post('/livekit-token', postWolfmanLivekitToken);
export default router;
