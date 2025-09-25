import { Router } from 'express';
import { 
  chatWithGPT, 
  getMusicRecommendations, 
  getArtistInfo,
  getConversationHistory,
  clearConversationHistory,
  updateUserPreferences,
  getGreeting,
  switchAssistant,
  getCurrentAssistant
} from '../controllers/chat.controller.js';

const router = Router();

// Chat routes
router.post('/chat', chatWithGPT);
router.post('/recommendations', getMusicRecommendations);
router.post('/artist-info', getArtistInfo);
router.get('/greeting', getGreeting);
router.get('/history', getConversationHistory);
router.delete('/history', clearConversationHistory);
router.put('/preferences', updateUserPreferences);

// Assistant management routes
router.post('/switch-assistant', switchAssistant);
router.get('/current-assistant', getCurrentAssistant);

export default router;
