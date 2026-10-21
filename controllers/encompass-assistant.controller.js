/**
 * Development work by David Lane
 *
 * Thin HTTP layer for the Encompass Developer AI Expert.
 * Business logic lives in services/encompass-assistant.service.js.
 */
import express from 'express';
import encompassAssistantService from '../services/encompass-assistant.service.js';
import {
  getUserConversationHistory,
  clearUserConversationHistory
} from '../services/langchain-memory.service.js';
import { requireEncompassDocsScrapeAccess } from '../lib/encompass-docs-refresh-auth.js';

const router = express.Router();
const DEFAULT_SESSION = 'encompass-dev-expert';

function resolveUserId(req) {
  const fromBody = req.body?.userId;
  const fromQuery = req.query?.userId;
  const header = req.headers?.['x-user-id'];
  return String(fromBody || fromQuery || header || 'encompass-anon').slice(0, 100);
}

function resolveSessionId(req) {
  return String(
    req.body?.sessionId || req.query?.sessionId || DEFAULT_SESSION
  ).slice(0, 255);
}

router.get('/health', async (_req, res) => {
  try {
    const summary = await encompassAssistantService.getEncompassExpertSummary();
    res.json({
      ok: true,
      openaiConfigured: summary.openaiConfigured,
      encompassHubConfigured: summary.encompassHubConfigured,
      knowledge: summary
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({
        error: 'Query parameter "q" is required'
      });
    }

    const limit = parseInt(req.query.limit, 10) || 8;
    const source = String(req.query.source || 'all').toLowerCase();
    const data = await encompassAssistantService.searchEncompassKnowledge(String(query), {
      limit,
      source
    });

    res.json({
      query,
      results: data.length,
      source,
      data
    });
  } catch (error) {
    console.error('❌ Error searching Encompass docs:', error);
    res.status(500).json({
      error: 'Failed to search documentation',
      details: error.message
    });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { message, context = [] } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    console.log(`💬 Encompass AI Chat: "${String(message).slice(0, 120)}"`);

    const result = await encompassAssistantService.chatWithEncompassExpert({
      message,
      context,
      userId: resolveUserId(req),
      sessionId: resolveSessionId(req)
    });

    // Backward-compatible shape for existing clients + unit tests
    res.json({
      message: result.message,
      context: result.context,
      sources: result.sources,
      retrieval: result.retrieval,
      mode: result.mode,
      userId: result.userId,
      sessionId: result.sessionId,
      model: result.model,
      openaiConfigured: result.openaiConfigured,
      timestamp: result.timestamp,
      voiceHint: result.voiceHint
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error('❌ Error in Encompass AI chat:', error);
    }
    res.status(status).json({
      error: status === 400 ? error.message : 'Failed to process chat message',
      details: error.message
    });
  }
});

router.get('/summary', async (_req, res) => {
  try {
    const summary = await encompassAssistantService.getEncompassExpertSummary();
    res.json({
      docs: summary.docs,
      ice: summary.ice,
      hybridRag: true,
      vectorStores: summary.vectorStores,
      title: summary.title,
      rag: summary.rag,
      repos: summary.repos,
      surfaces: summary.surfaces,
      quickPrompts: summary.quickPrompts,
      openaiConfigured: summary.openaiConfigured,
      encompassHubConfigured: summary.encompassHubConfigured
    });
  } catch (error) {
    console.error('❌ Error getting docs summary:', error);
    res.status(500).json({
      error: 'Failed to get documentation summary',
      details: error.message
    });
  }
});

router.get('/graph', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 4;
    res.json(await encompassAssistantService.getEncompassKnowledgeGraph(limit));
  } catch (error) {
    res.status(500).json({
      error: 'Failed to build knowledge graph',
      details: error.message
    });
  }
});

router.get('/history', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const sessionId = resolveSessionId(req);
    const limit = parseInt(req.query.limit, 10) || 40;
    const history = await getUserConversationHistory(userId, sessionId, limit);
    res.json({ userId, sessionId, history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load history', details: error.message });
  }
});

router.delete('/history', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const sessionId = resolveSessionId(req);
    const cleared = await clearUserConversationHistory(userId, sessionId);
    res.json({ success: cleared, userId, sessionId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear history', details: error.message });
  }
});

router.post('/scrape', requireEncompassDocsScrapeAccess, async (req, res) => {
  try {
    console.log('🔄 Starting Encompass documentation scraping...');
    const docs = await encompassAssistantService.scrapeEncompassDocumentation();

    res.json({
      success: true,
      message: 'Documentation scraped successfully',
      sections: docs.sections.length,
      lastUpdated: docs.lastUpdated
    });
  } catch (error) {
    console.error('❌ Error scraping documentation:', error);
    res.status(500).json({
      error: 'Failed to scrape documentation',
      details: error.message
    });
  }
});

router.get('/section/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { q: query } = req.query;

    const sections = await encompassAssistantService.getDocsSection(category, query);
    if (!sections) {
      return res.status(404).json({
        error: 'No documentation available. Run /scrape first.'
      });
    }

    res.json({
      category,
      sections: sections.length,
      data: sections
    });
  } catch (error) {
    console.error('❌ Error getting section:', error);
    res.status(500).json({
      error: 'Failed to get documentation section',
      details: error.message
    });
  }
});

export default router;
