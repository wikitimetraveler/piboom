/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import express from 'express';
import { invokeLaneExpertChat } from '../services/lane-family-ai.service.js';

const router = express.Router();

/**
 * POST /api/genealogy/ai/chat
 * Body: { message: string, history?: { user, assistant }[], pageContext?: string }
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history, pageContext } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return res.status(503).json({
        success: false,
        error: 'Lane guide is not configured (missing OPENAI_API_KEY).'
      });
    }
    const { text } = await invokeLaneExpertChat({
      userMessage: message.trim(),
      history: Array.isArray(history) ? history : [],
      pageContext: typeof pageContext === 'string' ? pageContext : ''
    });
    return res.json({
      success: true,
      message: text,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Lane family AI chat error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to get a response from the guide.'
    });
  }
});

export default router;
