import { Router } from 'express';
import { chatWithGPT, getMusicRecommendations, getArtistInfo } from '../controllers/chat.controller.js';

const router = Router();

// Chat routes
router.post('/chat', chatWithGPT);
router.post('/recommendations', getMusicRecommendations);
router.post('/artist-info', getArtistInfo);

export default router;
