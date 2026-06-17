/**
 * Development work by David Lane
 */
import { Router } from 'express';
import {
  getHeygenHealth,
  getHeygenAvatars,
  getHeygenVoices,
  postHeygenVideo,
  getHeygenVideoStatus,
  getHeygenSchemaScript,
  postHeygenDisasterBriefing
} from '../controllers/heygen.controller.js';

const router = Router();

router.get('/health', getHeygenHealth);
router.get('/avatars', getHeygenAvatars);
router.get('/voices', getHeygenVoices);
router.get('/scripts/schema', getHeygenSchemaScript);
router.post('/videos/briefing', postHeygenDisasterBriefing);
router.post('/videos', postHeygenVideo);
router.get('/videos/:videoId', getHeygenVideoStatus);

export default router;
