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
  getHeygenDemoScript,
  postHeygenDisasterBriefing
} from '../controllers/heygen.controller.js';

const router = Router();

router.get('/health', getHeygenHealth);
router.get('/avatars', getHeygenAvatars);
router.get('/voices', getHeygenVoices);
router.get('/scripts/schema', getHeygenSchemaScript);
router.get('/scripts/demo', getHeygenDemoScript);
router.post('/videos/briefing', postHeygenDisasterBriefing);
router.post('/videos', postHeygenVideo);
router.get('/videos/:videoId', getHeygenVideoStatus);

export default router;
