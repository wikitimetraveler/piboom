/**
 * Development work by David Lane
 */
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
  getCurrentAssistant,
  searchYouTubeVideos,
  // New LangChain + PostgreSQL memory functions
  chatWithLangChain,
  getLangChainConversationHistory,
  clearLangChainConversationHistory,
  getConversationStats
} from '../controllers/chat.controller.js';

const router = Router();

// Chat routes (legacy - in-memory)
router.post('/chat', chatWithGPT);
router.post('/recommendations', getMusicRecommendations);
router.post('/artist-info', getArtistInfo);
router.get('/greeting', getGreeting);
router.get('/history', getConversationHistory);
router.delete('/history', clearConversationHistory);
router.put('/preferences', updateUserPreferences);

// NEW LangChain + PostgreSQL Memory Routes 
router.post('/langchain/chat', chatWithLangChain);
router.get('/langchain/history', getLangChainConversationHistory);
router.delete('/langchain/history', clearLangChainConversationHistory);
router.get('/langchain/stats', getConversationStats);

// Assistant management routes
router.post('/switch-assistant', switchAssistant);
router.get('/current-assistant', getCurrentAssistant);

// YouTube search route
router.post('/youtube-search', searchYouTubeVideos);

export default router;
