/**
 * Noor assistant API for the Palestine · Israel atlas
 * Development work by David Lane
 */
import { Router } from 'express';
import holyLandAssistantService from '../services/holy-land-assistant.service.js';
import {
  getUserConversationHistory,
  clearUserConversationHistory
} from '../services/langchain-memory.service.js';

const router = Router();

function resolveUserId(req) {
  return String(req.body?.userId || req.query?.userId || req.headers['x-user-id'] || 'holy-land-anon').slice(0, 100);
}

function resolveSessionId(req) {
  return String(req.body?.sessionId || req.query?.sessionId || 'holy-land-noor').slice(0, 255);
}

/** The chat widget sends context as { lang }; older callers send an array of turns. */
function resolveLang(req) {
  const context = req.body?.context;
  const candidate = req.body?.lang || (context && !Array.isArray(context) ? context.lang : null);
  return String(candidate || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
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
    const summary = await holyLandAssistantService.getHolyLandSummary();
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
    res.json(await holyLandAssistantService.getHolyLandSummary());
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

    const result = await holyLandAssistantService.chatWithNoor({
      message,
      history: resolveHistory(req),
      lang: resolveLang(req),
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
    console.error('Noor assistant chat error:', error);
    res.status(status).json({ error: error.message || 'Chat failed' });
  }
});

router.post('/translate', async (req, res) => {
  try {
    const { text, to } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }
    res.json(await holyLandAssistantService.translateText({ text, to }));
  } catch (error) {
    const status = error.code === 'OPENAI_NOT_CONFIGURED' ? 503 : 500;
    console.error('Holy Land translate error:', error);
    res.status(status).json({ error: error.message || 'Translation failed' });
  }
});

export default router;
