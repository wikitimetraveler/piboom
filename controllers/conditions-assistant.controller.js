/**
 * Development work by David Lane
 *
 * Thin HTTP layer for the Enhanced Conditions Expert.
 */
import { Router } from 'express';
import conditionsAssistantService from '../services/conditions-assistant.service.js';
import {
  getUserConversationHistory,
  clearUserConversationHistory,
} from '../services/langchain-memory.service.js';

const router = Router();

function resolveUserId(req) {
  return String(req.body?.userId || req.query?.userId || req.headers?.['x-user-id'] || 'conditions-anon').slice(0, 100);
}

function resolveSessionId(req) {
  return String(req.body?.sessionId || req.query?.sessionId || 'enhanced-conditions-expert').slice(0, 255);
}

function resolveHistory(req) {
  const context = req.body?.context;
  if (!Array.isArray(context)) return [];
  return context.map((turn) => ({
    role: turn.role || (turn.isUser ? 'user' : 'assistant'),
    content: turn.content || turn.text || '',
  }));
}

router.get('/health', async (_req, res) => {
  try {
    const summary = await conditionsAssistantService.getConditionsExpertSummary();
    res.json({
      ok: true,
      openaiConfigured: Boolean((process.env.OPENAI_API_KEY || '').trim()),
      expert: summary,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/summary', async (_req, res) => {
  try {
    res.json(await conditionsAssistantService.getConditionsExpertSummary());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || req.query.query || '').trim();
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);
    const results = await conditionsAssistantService.searchConditionsKnowledge(q, limit);
    res.json({ query: q, count: results.length, results });
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
    const { message } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await conditionsAssistantService.chatWithConditionsExpert({
      message,
      history: resolveHistory(req),
      userId: resolveUserId(req),
      sessionId: resolveSessionId(req),
    });

    res.json({
      success: true,
      response: result.reply,
      reply: result.reply,
      message: result.reply,
      citations: result.citations,
      handoffAvailable: result.handoffAvailable,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('Enhanced Conditions Expert chat error:', error.message);
    res.status(status).json({ error: error.message || 'Chat failed' });
  }
});

export default router;
