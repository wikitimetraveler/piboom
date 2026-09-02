/**
 * Carl AstroAI — planetarium assistant API
 * Development work by David Lane
 */
import { Router } from 'express';
import planetariumAssistantService from '../services/planetarium-assistant.service.js';
import {
  clearUserConversationHistory,
  getUserConversationHistory,
} from '../services/langchain-memory.service.js';

const router = Router();

function resolveUserId(req) {
  return String(req.body?.userId || req.query?.userId || req.headers['x-user-id'] || 'planetarium-guest').slice(
    0,
    100
  );
}

function resolveSessionId(req) {
  return String(req.body?.sessionId || req.query?.sessionId || 'planetarium-carl').slice(0, 255);
}

/** Chat widget sends context as { skyContext }; older callers may post skyContext directly. */
function resolveSkyContext(req) {
  const ctx = req.body?.context;
  if (ctx && typeof ctx === 'object' && !Array.isArray(ctx) && ctx.skyContext) {
    return ctx.skyContext;
  }
  return req.body?.skyContext && typeof req.body.skyContext === 'object' ? req.body.skyContext : {};
}

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    guideName: planetariumAssistantService.GUIDE_NAME,
    avatarName: planetariumAssistantService.AVATAR_NAME,
    openaiConfigured: Boolean((process.env.OPENAI_API_KEY || '').trim()),
  });
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
    const { message, context = [] } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const userId = resolveUserId(req);
    const sessionId = resolveSessionId(req);
    const skyContext = resolveSkyContext(req);
    const history = Array.isArray(context)
      ? context.map((c) => ({
          role: c.role || (c.isUser ? 'user' : 'assistant'),
          content: c.content || c.text || '',
        }))
      : [];

    const result = await planetariumAssistantService.chatWithCarl({
      message,
      history,
      userId,
      sessionId,
      skyContext,
    });

    res.json({
      success: true,
      response: result.reply,
      reply: result.reply,
      message: result.reply,
      guideName: result.guideName,
      avatarName: result.avatarName,
    });
  } catch (error) {
    const status = error.code === 'OPENAI_NOT_CONFIGURED' ? 503 : 500;
    console.error('Carl assistant chat error:', error);
    res.status(status).json({ error: error.message || 'Chat failed' });
  }
});

export default router;
