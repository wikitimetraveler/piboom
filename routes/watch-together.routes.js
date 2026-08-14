/**
 * Development work by David Lane
 */
import { Router } from 'express';
import {
  postVerifyWatchTogether,
  getWatchTogetherGoogleApiKey,
  getWatchTogetherHealth,
  getWatchTogetherState,
  postWatchTogetherIntent,
  postWatchTogetherLivekitToken,
} from '../controllers/watch-together.controller.js';
import { attachWatchTogetherSockets } from '../services/watch-together.service.js';

export default function buildWatchTogetherRoutes(io) {
  attachWatchTogetherSockets(io);
  const router = Router();
  router.post('/verify', postVerifyWatchTogether);
  router.get('/google-api-key', getWatchTogetherGoogleApiKey);
  router.get('/status', getWatchTogetherHealth);
  router.get('/state', getWatchTogetherState);
  router.post('/intent', postWatchTogetherIntent);
  router.post('/livekit-token', postWatchTogetherLivekitToken);
  return router;
}
