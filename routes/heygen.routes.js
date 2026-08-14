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
  postHeygenDisasterBriefing,
  getHeygenLibrary,
  postHeygenSpeech,
  postHeygenStreamingStart,
  postHeygenStreamingSpeak,
  postHeygenStreamingStop
} from '../controllers/heygen.controller.js';

const router = Router();

router.get('/health', getHeygenHealth);
router.get('/library', getHeygenLibrary);
router.get('/avatars', getHeygenAvatars);
router.get('/voices', getHeygenVoices);
router.post('/speech', postHeygenSpeech);
router.get('/scripts/schema', getHeygenSchemaScript);
router.get('/scripts/demo', getHeygenDemoScript);
router.post('/videos/briefing', postHeygenDisasterBriefing);
router.post('/videos', postHeygenVideo);
router.get('/videos/:videoId', getHeygenVideoStatus);
router.post('/streaming/start', postHeygenStreamingStart);
router.post('/streaming/speak', postHeygenStreamingSpeak);
router.post('/streaming/stop', postHeygenStreamingStop);

export default router;
