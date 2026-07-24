/**
 * Pip assistant API for Glazed / Savvy
 * Development work by David Lane
 */
import { Router } from 'express';
import donutsAssistantService from '../services/donuts-assistant.service.js';
import {
  getUserConversationHistory,
  clearUserConversationHistory
} from '../services/langchain-memory.service.js';

const router = Router();

function resolveUserId(req) {
  return String(req.body?.userId || req.query?.userId || req.headers['x-user-id'] || 'pip-anon').slice(0, 100);
}

function resolveSessionId(req) {
  return String(req.body?.sessionId || req.query?.sessionId || 'glazed-pip').slice(0, 255);
}

router.get('/health', async (_req, res) => {
  try {
    const summary = await donutsAssistantService.getPipCatalogSummary();
    res.json({
      ok: true,
      openaiConfigured: Boolean((process.env.OPENAI_API_KEY || '').trim()),
      catalog: summary
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/summary', async (_req, res) => {
  try {
    res.json(await donutsAssistantService.getPipCatalogSummary());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const sessionId = resolveSessionId(req);
    const history = await getUserConversationHistory(userId, sessionId, parseInt(req.query.limit, 10) || 40);
    res.json({ userId, sessionId, history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/history', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const sessionId = resolveSessionId(req);
    const cleared = await clearUserConversationHistory(userId, sessionId);
    res.json({ success: cleared, userId, sessionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { message, context = [] } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const userId = resolveUserId(req);
    const sessionId = resolveSessionId(req);
    const history = Array.isArray(context)
      ? context.map((c) => ({ role: c.role || (c.isUser ? 'user' : 'assistant'), content: c.content || c.text || '' }))
      : [];

    const result = await donutsAssistantService.chatWithPip({
      message,
      history,
      userId,
      sessionId
    });

    res.json({
      success: true,
      response: result.reply,
      reply: result.reply,
      message: result.reply,
      guideName: result.guideName,
      shopName: result.shopName
    });
  } catch (error) {
    const status = error.code === 'OPENAI_NOT_CONFIGURED' ? 503 : 500;
    console.error('Pip assistant chat error:', error);
    res.status(status).json({ error: error.message || 'Chat failed' });
  }
});

export default router;
