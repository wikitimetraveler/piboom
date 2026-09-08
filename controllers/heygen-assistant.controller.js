/**
 * Development work by David Lane
 * HeyGen API Expert — LangChain chat + RAG (pgvector / keyword) + citations.
 */
import express from 'express';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import heygenKnowledgeService from '../services/heygen-knowledge.service.js';
import {
  getUserConversationHistory,
  clearUserConversationHistory,
  persistConversationTurn
} from '../services/langchain-memory.service.js';
import { resolveOpenAiAgentModel } from '../services/openai-agent-model.js';
import { heygenConfigured } from '../services/heygen.service.js';
import {
  RAG_GRAPH_EXPLAINER,
  buildRagRuntimeNote,
  isRagArchitectureQuestion
} from '../lib/knowledge/rag-explain-prompt.js';

const router = express.Router();

const HEYGEN_SYSTEM_PROMPT = `You are the HeyGen API Expert for DevConnect Labs (Lane AI Labs). You help developers use HeyGen's **v3** APIs and this repo's wrappers.

## Expertise
- Video Agent (\`POST /v3/video-agents\`) vs direct video (\`POST /v3/videos\`)
- Avatars (groups vs looks; look id = avatar_id), consent, Avatar III/IV/V
- Voices, Starfish TTS, music/SFX search
- Translation, lipsync, proofread sessions, webhooks, assets, HyperFrames
- MCP / CLI / raw API auth ladder for agents
- Legacy v1/v2 deprecated — prefer v3; legacy until Oct 31, 2026

## DevConnect Labs context
- Video client: \`services/heygen.service.js\` → routes under \`/api/heygen/*\`
- Hub library: \`/heygen-hub.html\` + \`GET /api/heygen/library\`
- You answer questions; you do **not** call HeyGen to render videos here. For generation, point users to \`POST /api/heygen/videos\` or the Disaster/Lane studios.
- Env: \`HEYGEN_API_KEY\`, \`OPENAI_API_KEY\`, \`DATABASE_URL\` (memory + optional pgvector RAG)
- **Your own grounding:** hybrid RAG over HeyGen docs (\`heygen_knowledge_chunks\` + \`data/knowledge/heygen-sources.json\`). Same "two currents, one dock" pattern as Encompass ICE RAG. Disaster **GraphRAG** (\`graph_nodes\`) is a sibling system used by Unified Disasters / loan-pipeline AI — explain it when asked about graphs, but you do not query the disaster graph in this chat.

${RAG_GRAPH_EXPLAINER}

## Response style
1. Accurate, concise, actionable — cite retrieved docs as [S1], [S2] when relevant.
2. Prefer official v3 endpoints and patterns from retrieved context.
3. Include short code examples (curl or JS fetch) when helpful.
4. Never ask the user to paste an API key into chat.
5. Distinguish HyperFrames (HTML→video) from avatar Video Agent.
6. Keep answers speakable: clear sentences; avoid huge tables when a short list works (users may hear answers via TTS).
7. If asked how *you* know things / RAG / vectors / graphs — use the "two currents, one dock" explainer, name \`heygen_knowledge_chunks\`, and mention live status from the runtime note.

If context is thin, say what is uncertain and point to https://developers.heygen.com/docs/quick-start.`;

function toSnippet(content, max = 700) {
  const text = `${content ?? ''}`.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function buildDocsContext(results = []) {
  if (!results.length) return '';
  const lines = ['\n\nRelevant HeyGen documentation:'];
  results.forEach((result, index) => {
    const sourceId = `S${index + 1}`;
    const title = result?.title || 'Untitled';
    const category = result?.category || result?.sourceType || 'heygen';
    const urlPart = result?.url ? ` | ${result.url}` : '';
    const snippet = toSnippet(result?.content || '', 850);
    lines.push(`${sourceId}. ${title} (${category})${urlPart}`);
    if (snippet) lines.push(`   ${snippet}`);
    lines.push('');
  });
  lines.push('Cite sources using [S#] when they support your answer.');
  return lines.join('\n');
}

function resolveUserId(req) {
  const fromBody = req.body?.userId;
  const fromQuery = req.query?.userId;
  const header = req.headers['x-user-id'];
  return String(fromBody || fromQuery || header || 'heygen-anon').slice(0, 100);
}

function resolveSessionId(req) {
  return String(req.body?.sessionId || req.query?.sessionId || 'heygen-api-expert').slice(0, 255);
}

router.get('/health', async (_req, res) => {
  try {
    const summary = await heygenKnowledgeService.getSummary();
    res.json({
      ok: true,
      heygenConfigured: heygenConfigured(),
      openaiConfigured: Boolean((process.env.OPENAI_API_KEY || '').trim()),
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
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    const limit = parseInt(req.query.limit, 10) || 6;
    const data = await heygenKnowledgeService.search(String(query), limit);
    res.json({ query, results: data.length, data });
  } catch (error) {
    console.error('❌ HeyGen knowledge search error:', error);
    res.status(500).json({ error: 'Failed to search HeyGen knowledge', details: error.message });
  }
});

router.get('/summary', async (_req, res) => {
  try {
    res.json(await heygenKnowledgeService.getSummary());
  } catch (error) {
    res.status(500).json({ error: 'Failed to get summary', details: error.message });
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

router.post('/chat', async (req, res) => {
  try {
    const { message, context = [] } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const userId = resolveUserId(req);
    const sessionId = resolveSessionId(req);
    const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!openaiKey) {
      return res.status(503).json({
        error: 'OPENAI_API_KEY is not configured',
        code: 'OPENAI_NOT_CONFIGURED'
      });
    }

    const [searchHits, knowledgeSummary] = await Promise.all([
      heygenKnowledgeService.search(String(message), 6),
      heygenKnowledgeService.getSummary().catch(() => null)
    ]);
    const docsContext = buildDocsContext(searchHits);
    const ragRuntime = buildRagRuntimeNote([
      {
        label: 'HeyGen API knowledge',
        vectorReady: Boolean(
          knowledgeSummary?.vectorAvailable && knowledgeSummary?.vectorCount > 0
        ),
        store: 'heygen-sources.json',
        table: 'heygen_knowledge_chunks'
      }
    ]);
    const architectureNudge = isRagArchitectureQuestion(message)
      ? '\n\n(User asked about RAG/graph architecture — lead with "two currents, one dock". Name heygen_knowledge_chunks; GraphRAG is the disaster sibling.)'
      : '';

    const historyRows = await getUserConversationHistory(userId, sessionId, 16);
    const historyMessages = historyRows.map((row) => {
      if (row.role === 'assistant') return new AIMessage(row.content);
      if (row.role === 'system') return new SystemMessage(row.content);
      return new HumanMessage(row.content);
    });

    const extraContext = Array.isArray(context)
      ? context
          .filter((msg) => typeof msg === 'string' && msg.trim())
          .map((msg) => new HumanMessage(msg))
      : [];

    const openai = new ChatOpenAI({
      openAIApiKey: openaiKey,
      modelName: resolveOpenAiAgentModel('HEYGEN_ASSISTANT_MODEL') || 'gpt-4o-mini',
      temperature: 0.4,
      maxTokens: 2000
    });

    const messages = [
      new SystemMessage(HEYGEN_SYSTEM_PROMPT + ragRuntime + architectureNudge + docsContext),
      ...historyMessages,
      ...extraContext,
      new HumanMessage(String(message))
    ];

    const response = await openai.invoke(messages);
    const aiMessage = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    await persistConversationTurn(userId, sessionId, String(message), aiMessage, 'heygen');

    res.json({
      message: aiMessage,
      response: aiMessage,
      context: searchHits,
      sources: searchHits.map((item, idx) => ({
        id: `S${idx + 1}`,
        title: item.title || null,
        category: item.category || null,
        sourceType: item.sourceType || null,
        url: item.url || null,
        retrieval: item.retrieval || null
      })),
      userId,
      sessionId,
      model: resolveOpenAiAgentModel('HEYGEN_ASSISTANT_MODEL') || 'gpt-4o-mini',
      timestamp: new Date().toISOString(),
      voiceHint: 'Client may speak this reply via /shared/tts.js (speakWithGoogle).'
    });
  } catch (error) {
    console.error('❌ HeyGen API Expert chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: error.message
    });
  }
});

export default router;
