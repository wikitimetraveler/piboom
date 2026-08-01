/**
 * David assistant API for the Shenango Valley Nature page
 * Development work by David Lane
 */
import { Router } from 'express';
import shenangoAssistantService from '../services/shenango-assistant.service.js';
import {
  getUserConversationHistory,
  clearUserConversationHistory
} from '../services/langchain-memory.service.js';

const router = Router();

function resolveUserId(req) {
  return String(
    req.body?.userId || req.query?.userId || req.headers['x-user-id'] || 'shenango-anon'
  ).slice(0, 100);
}

function resolveSessionId(req) {
  return String(req.body?.sessionId || req.query?.sessionId || 'shenango-david').slice(0, 255);
}

function resolveHistory(req) {
  const context = req.body?.context;
  if (!Array.isArray(context)) return [];
  return context.map((turn) => ({
    role: turn.role || (turn.isUser ? 'user' : 'assistant'),
    content: turn.content || turn.text || ''
  }));
}

router.get('/health', async (_req, res) => {
  try {
    const summary = await shenangoAssistantService.getShenangoSummary();
    res.json({
      ok: true,
      openaiConfigured: Boolean((process.env.OPENAI_API_KEY || '').trim()),
      content: summary
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/summary', async (_req, res) => {
  try {
    res.json(await shenangoAssistantService.getShenangoSummary());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const sessionId = resolveSessionId(req);
    const history = await getUserConversationHistory(
      userId,
      sessionId,
      parseInt(req.query.limit, 10) || 40
    );
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

    const result = await shenangoAssistantService.chatWithDavid({
      message,
      history: resolveHistory(req),
      userId: resolveUserId(req),
      sessionId: resolveSessionId(req)
    });

    res.json({
      success: true,
      response: result.reply,
      reply: result.reply,
      message: result.reply,
      lang: result.lang,
      guideName: result.guideName
    });
  } catch (error) {
    const status = error.code === 'OPENAI_NOT_CONFIGURED' ? 503 : 500;
    console.error('Shenango David assistant chat error:', error);
    res.status(status).json({ error: error.message || 'Chat failed' });
  }
});

export default router;
