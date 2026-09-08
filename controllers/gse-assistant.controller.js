/**
 * Development work by David Lane
 * GSE Loan Program Expert — LangChain chat + hybrid RAG (pgvector / keyword) + citations.
 */
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import gseKnowledgeService from '../services/gse-knowledge.service.js';
import { askLoanProgramExpert } from '../services/finance-loan-expert.service.js';
import {
  getUserConversationHistory,
  clearUserConversationHistory,
  persistConversationTurn
} from '../services/langchain-memory.service.js';
import { resolveOpenAiAgentModel } from '../services/openai-agent-model.js';
import {
  RAG_GRAPH_EXPLAINER,
  buildRagRuntimeNote,
  isRagArchitectureQuestion
} from '../lib/knowledge/rag-explain-prompt.js';

const GSE_SYSTEM_PROMPT = `You are the GSE / Agency Loan Program Expert for DevConnect Labs (Lane AI Labs).

## Expertise
- Fannie Mae, Freddie Mac, FHA, VA, USDA product fit (decision support only — not DU/LPA/TOTAL/GUS)
- Investor overlays and ops next steps
- Mortgage pooling / MBS / UMBS / TBA / Ginnie Mae delivery concepts
- ARM first rate change date vs first payment change date, including bank cycle cutoffs when described in retrieved context
- FHFA conforming limits as published snapshots — tell users to verify fhfa.gov

## Hard rules
- Never claim underwriting approval, pricing locks, or pool eligibility certification.
- Prefer retrieved knowledge slips; cite them as [S1], [S2].
- Distinguish agency guide rules from lender/bank ops cutoffs.
- You do not execute Encompass APIs from retrieved snippets.

## DevConnect grounding
- Hybrid RAG over \`gse_knowledge_chunks\` + \`data/knowledge/gse-sources.json\`
- Scenario analyzer JSON rules still exist at \`POST /api/gse/loan-program-expert\` (deterministic mode)
- Env: \`OPENAI_API_KEY\`, \`DATABASE_URL\` (memory + optional pgvector)

${RAG_GRAPH_EXPLAINER}

## Response style
1. Accurate, concise, actionable — cite [S#] when relevant.
2. Keep answers speakable for optional TTS.
3. If context is thin, say what is uncertain and point to official guides linked in sources.
4. When asked how RAG works, use "two currents, one dock" and name \`gse_knowledge_chunks\`.`;

function toSnippet(content, max = 700) {
  const text = `${content ?? ''}`.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function buildDocsContext(results = []) {
  if (!results.length) return '';
  const lines = ['\n\nRelevant GSE / mortgage knowledge:'];
  results.forEach((result, index) => {
    const sourceId = `S${index + 1}`;
    const title = result?.title || 'Untitled';
    const category = result?.category || result?.sourceType || 'gse';
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
  return String(fromBody || fromQuery || header || 'gse-anon').slice(0, 100);
}

function resolveSessionId(req) {
  return String(req.body?.sessionId || req.query?.sessionId || 'gse-loan-program-expert').slice(0, 255);
}

function mapSources(searchHits = []) {
  return searchHits.map((item, idx) => ({
    id: `S${idx + 1}`,
    title: item.title || null,
    category: item.category || null,
    sourceType: item.sourceType || null,
    url: item.url || null,
    retrieval: item.retrieval || null,
    score: item.score ?? null,
    excerpt: toSnippet(item.content || '', 220)
  }));
}

export async function getGseAssistantHealth(_req, res) {
  try {
    const summary = await gseKnowledgeService.getSummary();
    res.json({
      ok: true,
      openaiConfigured: Boolean((process.env.OPENAI_API_KEY || '').trim()),
      knowledge: summary
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function getGseKnowledgeSummary(_req, res) {
  try {
    res.json(await gseKnowledgeService.getSummary());
  } catch (error) {
    res.status(500).json({ error: 'Failed to get summary', details: error.message });
  }
}

export async function getGseKnowledgeGraph(req, res) {
  try {
    const limit = parseInt(req.query.limit, 10) || 4;
    res.json(await gseKnowledgeService.getGraph(limit));
  } catch (error) {
    res.status(500).json({ error: 'Failed to build knowledge graph', details: error.message });
  }
}

export async function getGseKnowledgeSearch(req, res) {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    const limit = parseInt(req.query.limit, 10) || 8;
    const data = await gseKnowledgeService.search(String(query), limit);
    res.json({ query, results: data.length, data });
  } catch (error) {
    console.error('❌ GSE knowledge search error:', error);
    res.status(500).json({ error: 'Failed to search GSE knowledge', details: error.message });
  }
}

export async function getGseAssistantHistory(req, res) {
  try {
    const userId = resolveUserId(req);
    const sessionId = resolveSessionId(req);
    const limit = parseInt(req.query.limit, 10) || 40;
    const history = await getUserConversationHistory(userId, sessionId, limit);
    res.json({ userId, sessionId, history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load history', details: error.message });
  }
}

export async function deleteGseAssistantHistory(req, res) {
  try {
    const userId = resolveUserId(req);
    const sessionId = resolveSessionId(req);
    const cleared = await clearUserConversationHistory(userId, sessionId);
    res.json({ success: cleared, userId, sessionId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear history', details: error.message });
  }
}

export async function postGseAssistantChat(req, res) {
  try {
    const { message, question, scenario = null, context = [], includeRules = true } = req.body || {};
    const text = String(message || question || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const userId = resolveUserId(req);
    const sessionId = resolveSessionId(req);
    const openaiKey = (process.env.OPENAI_API_KEY || '').trim();

    const [searchHits, knowledgeSummary] = await Promise.all([
      gseKnowledgeService.search(text, 8),
      gseKnowledgeService.getSummary().catch(() => null)
    ]);

    let rulesBundle = null;
    if (includeRules !== false && scenario && typeof scenario === 'object') {
      try {
        rulesBundle = askLoanProgramExpert({ question: text, scenario });
      } catch {
        rulesBundle = null;
      }
    }

    if (!openaiKey) {
      if (rulesBundle?.success) {
        return res.json({
          success: true,
          mode: 'rules-fallback',
          message: rulesBundle.recommendation,
          response: rulesBundle.recommendation,
          recommendation: rulesBundle.recommendation,
          rationale: rulesBundle.rationale,
          requiredVerifications: rulesBundle.requiredVerifications,
          overlayRisks: rulesBundle.overlayRisks,
          citations: rulesBundle.citations,
          expertMode: rulesBundle.expertMode,
          context: searchHits,
          sources: mapSources(searchHits),
          knowledge: knowledgeSummary,
          openaiConfigured: false,
          userId,
          sessionId,
          timestamp: new Date().toISOString()
        });
      }
      return res.status(503).json({
        error: 'OPENAI_API_KEY is not configured and rules fallback needs a scenario',
        code: 'OPENAI_NOT_CONFIGURED',
        sources: mapSources(searchHits),
        knowledge: knowledgeSummary
      });
    }

    const docsContext = buildDocsContext(searchHits);
    const ragRuntime = buildRagRuntimeNote([
      {
        label: 'GSE / mortgage knowledge',
        vectorReady: Boolean(
          knowledgeSummary?.vectorAvailable && knowledgeSummary?.vectorCount > 0
        ),
        store: 'gse-sources.json',
        table: 'gse_knowledge_chunks'
      }
    ]);
    const architectureNudge = isRagArchitectureQuestion(text)
      ? '\n\n(User asked about RAG/graph architecture — lead with "two currents, one dock". Name gse_knowledge_chunks.)'
      : '';

    let rulesContext = '';
    if (rulesBundle?.success) {
      rulesContext = [
        '\n\nDeterministic rule-expert snapshot for this scenario (may be incomplete):',
        `Mode: ${rulesBundle.expertMode || 'general'}`,
        `Recommendation: ${rulesBundle.recommendation || ''}`,
        `Rationale: ${(rulesBundle.rationale || []).join('; ')}`,
        `Verifications: ${(rulesBundle.requiredVerifications || []).join('; ')}`
      ].join('\n');
    }

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

    const modelName = resolveOpenAiAgentModel('GSE_ASSISTANT_MODEL') || 'gpt-4o-mini';
    const openai = new ChatOpenAI({
      openAIApiKey: openaiKey,
      modelName,
      temperature: 0.35,
      maxTokens: 2200
    });

    const messages = [
      new SystemMessage(GSE_SYSTEM_PROMPT + ragRuntime + architectureNudge + docsContext + rulesContext),
      ...historyMessages,
      ...extraContext,
      new HumanMessage(text)
    ];

    const response = await openai.invoke(messages);
    const aiMessage =
      typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    await persistConversationTurn(userId, sessionId, text, aiMessage, 'gse');

    res.json({
      success: true,
      mode: 'rag-chat',
      message: aiMessage,
      response: aiMessage,
      recommendation: aiMessage,
      context: searchHits,
      sources: mapSources(searchHits),
      rules: rulesBundle?.success
        ? {
            expertMode: rulesBundle.expertMode,
            recommendation: rulesBundle.recommendation,
            rationale: rulesBundle.rationale,
            requiredVerifications: rulesBundle.requiredVerifications,
            overlayRisks: rulesBundle.overlayRisks,
            citations: rulesBundle.citations
          }
        : null,
      knowledge: knowledgeSummary,
      userId,
      sessionId,
      model: modelName,
      timestamp: new Date().toISOString(),
      voiceHint: 'Client may speak this reply via /shared/tts.js (speakWithGoogle).'
    });
  } catch (error) {
    console.error('❌ GSE assistant chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: error.message
    });
  }
}
