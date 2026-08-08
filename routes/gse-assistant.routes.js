/**
 * Development work by David Lane
 */
import { Router } from 'express';
import {
  getGseAssistantHealth,
  getGseKnowledgeSummary,
  getGseKnowledgeGraph,
  getGseKnowledgeSearch,
  getGseAssistantHistory,
  deleteGseAssistantHistory,
  postGseAssistantChat
} from '../controllers/gse-assistant.controller.js';

const router = Router();

router.get('/health', getGseAssistantHealth);
router.get('/summary', getGseKnowledgeSummary);
router.get('/graph', getGseKnowledgeGraph);
router.get('/search', getGseKnowledgeSearch);
router.get('/history', getGseAssistantHistory);
router.delete('/history', deleteGseAssistantHistory);
router.post('/chat', postGseAssistantChat);

export default router;
