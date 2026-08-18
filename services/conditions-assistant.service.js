/**
 * Development work by David Lane
 *
 * Enhanced Conditions Expert — consolidates DevConnect Labs migration knowledge,
 * ICE Enhanced Conditions APIs, and optional ICE/docs RAG hits into one chat.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import iceKnowledgeService from '../lib/knowledge/ice-knowledge.service.js';
import encompassDocsService from './encompass-docs.service.js';
import { persistConversationTurn } from './langchain-memory.service.js';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';
import {
  RAG_GRAPH_EXPLAINER,
  buildRagRuntimeNote,
  isRagArchitectureQuestion,
} from '../lib/knowledge/rag-explain-prompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_PATH = path.join(__dirname, '../data/knowledge/enhanced-conditions-expert.json');
const HANDOFF_REPORT_PATH = path.join(__dirname, '../data/encompass-conditions/handoff/data-quality-report.json');
const CACHE_MS = 60_000;

let knowledgeCache = null;
let knowledgeLoadedAt = 0;
let handoffCache = null;
let handoffLoadedAt = 0;

async function loadKnowledge() {
  const now = Date.now();
  if (knowledgeCache && now - knowledgeLoadedAt < CACHE_MS) return knowledgeCache;
  const raw = await readFile(KNOWLEDGE_PATH, 'utf8');
  knowledgeCache = JSON.parse(raw);
  knowledgeLoadedAt = now;
  return knowledgeCache;
}

async function loadHandoffSummary() {
  const now = Date.now();
  if (handoffCache && now - handoffLoadedAt < CACHE_MS) return handoffCache;
  try {
    const raw = await readFile(HANDOFF_REPORT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    handoffCache = {
      available: true,
      summary: parsed.summary || null,
      personaSource: parsed.personaReconciliation
        ? {
            roleCount: parsed.personaReconciliation.roleCount,
            unmatched: parsed.personaReconciliation.unmatched?.length ?? 0,
            personaCount: parsed.personaReconciliation.personaCount,
          }
        : null,
      path: 'data/encompass-conditions/handoff/',
    };
  } catch {
    handoffCache = { available: false, summary: null, personaSource: null, path: 'data/encompass-conditions/handoff/' };
  }
  handoffLoadedAt = now;
  return handoffCache;
}

function factSheet(knowledge, handoff) {
  const lines = [];
  lines.push('### Overview');
  for (const item of knowledge.overview || []) lines.push(`- ${item}`);

  lines.push('', '### Core concepts');
  for (const concept of knowledge.concepts || []) {
    lines.push(`- ${concept.name}: ${concept.summary}`);
  }

  lines.push('', '### DevConnect Labs migration');
  const migration = knowledge.migration || {};
  lines.push(`- Source: ${migration.source || 'ConditionsTemplate.xml CDO'}`);
  for (const tool of migration.tools || []) lines.push(`- Tool: ${tool}`);
  for (const output of migration.outputs || []) lines.push(`- Output: ${output}`);
  if (migration.iceAdminTool) lines.push(`- ICE admin tool: ${migration.iceAdminTool}`);
  for (const rule of migration.rules || []) lines.push(`- Rule: ${rule}`);

  if (handoff?.available && handoff.summary) {
    const s = handoff.summary;
    lines.push('', '### Current local handoff pack (dry-run artifacts on disk)');
    lines.push(`- Folder: ${handoff.path}`);
    lines.push(`- Conditions parsed: ${s.conditionsParsed}`);
    lines.push(`- Templates generated: ${s.conditionsConverted}`);
    lines.push(`- Condition types: ${s.conditionTypes}`);
    lines.push(`- ACL profiles: ${s.aclProfiles}`);
    lines.push(`- Needs review: ${s.needsReview}; auto-fixed: ${s.autoFixed}`);
    lines.push(`- Distinct persona names in CDO: ${s.distinctRoles}`);
    if (handoff.personaSource) {
      lines.push(
        `- Persona reconciliation file: ${handoff.personaSource.personaCount || 0} personas loaded, `
          + `${handoff.personaSource.unmatched} unmatched role names`,
      );
    }
  } else {
    lines.push('', '### Current local handoff pack');
    lines.push('- No data-quality-report.json found yet. Run Condition Manager or `npm run convert:conditions-cdo`.');
  }

  lines.push('', '### Settings APIs');
  for (const api of knowledge.apis?.settings || []) {
    lines.push(`- ${api.method} ${api.path} — ${api.title}${api.notes ? ` (${api.notes})` : ''}`);
  }

  lines.push('', '### Loan APIs');
  for (const api of knowledge.apis?.loan || []) {
    lines.push(`- ${api.method} ${api.path} — ${api.title}`);
  }

  lines.push('', '### Postman');
  const postman = knowledge.postman || {};
  if (postman.collectionHint) lines.push(`- ${postman.collectionHint}`);
  if (postman.environmentVars) lines.push(`- Vars: ${postman.environmentVars.join(', ')}`);
  for (const step of postman.safeOrder || []) lines.push(`- ${step}`);

  lines.push('', '### Official links');
  for (const link of knowledge.officialLinks || []) lines.push(`- ${link.title}: ${link.url}`);

  lines.push('', '### DevConnect surfaces');
  for (const surface of knowledge.devconnectSurfaces || []) {
    lines.push(`- ${surface.name} (${surface.path}): ${surface.purpose}`);
  }

  lines.push('', '### FAQs');
  for (const faq of knowledge.faqs || []) lines.push(`- Q: ${faq.q} A: ${faq.a}`);

  return lines.join('\n');
}

function toSnippet(content, max = 700) {
  const text = `${content ?? ''}`.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function buildDocsContext(results = []) {
  if (!results.length) return '';
  const lines = ['\n\nRetrieved documentation (cite as [S#] when used):'];
  results.forEach((result, index) => {
    const sourceId = `S${index + 1}`;
    const title = result?.title || 'Untitled';
    const category = result?.category || result?.sourceType || 'doc';
    const urlPart = result?.url ? ` | ${result.url}` : '';
    lines.push(`${sourceId}. ${title} (${category})${urlPart}`);
    const snippet = toSnippet(result?.content || result?.excerpt || '', 850);
    if (snippet) lines.push(`   ${snippet}`);
    lines.push('');
  });
  return lines.join('\n');
}

function rankAndMergeResults(docHits = [], iceHits = [], limit = 8) {
  const scored = [];
  for (const hit of docHits) {
    scored.push({
      ...hit,
      category: hit.category || 'encompass-docs',
      _score: (hit.score || 0) + ( /enhanced\s*condition/i.test(`${hit.title} ${hit.content || ''}`) ? 5 : 0),
    });
  }
  for (const hit of iceHits) {
    scored.push({
      ...hit,
      category: hit.sourceType || hit.category || 'ice',
      _score: (hit.score || 0) + ( /enhanced\s*condition|condition\s*template|condition\s*type/i.test(`${hit.title} ${hit.content || ''}`) ? 6 : 0),
    });
  }
  scored.sort((a, b) => (b._score || 0) - (a._score || 0));
  const seen = new Set();
  const merged = [];
  for (const item of scored) {
    const key = `${item.title || ''}|${item.url || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}

function buildSystemPrompt(knowledge, handoff, docsContext, ragNote = '') {
  return `You are the ${knowledge.guide?.name || 'Enhanced Conditions Expert'} for DevConnect Labs.

## Role
Help Encompass admins and developers migrate legacy ConditionsTemplate.xml CDOs to Enhanced Conditions, configure types/templates/persona access, and use ICE Developer Connect APIs / Postman safely.

## Grounding (prefer this over guesses)
${factSheet(knowledge, handoff)}
${docsContext}

## Response style
1. Accurate and concise. Prefer the grounding facts and retrieved docs.
2. Cite retrieved docs as [S1], [S2] when they support the answer.
3. Distinguish clearly: personas (access) vs workflow roles vs users; types vs templates; dry-run conversion vs live ICE write APIs.
4. Condition Manager and POST /api/encompass-conditions/convert remain dry-run. Live writes use /finance/enhanced-conditions.html (POST /api/encompass-conditions/invoke and REST /types /templates /loans/:id/conditions).
5. For Postman or Live CRUD, give method, path, required vars, and body shape. Warn to use UAT first and smoke-test templates before bulk (826) loads.
6. Keep answers speakable: short paragraphs or tight bullets; users may use TTS.
7. Never ask the user to paste client secrets or access tokens into chat.

${RAG_GRAPH_EXPLAINER}
${ragNote}

If unsure, say so and point to Condition Manager (/finance/condition-manager.html) or the official ICE Enhanced Conditions docs.`;
}

export async function getRagLanes() {
  const [ice, docs] = await Promise.all([
    iceKnowledgeService.getSummary().catch(() => null),
    typeof encompassDocsService.getSummary === 'function'
      ? encompassDocsService.getSummary().catch(() => null)
      : Promise.resolve(null),
  ]);

  return [
    {
      label: 'Curated Enhanced Conditions',
      vectorReady: false,
      store: 'data/knowledge/enhanced-conditions-expert.json',
      table: 'fact-sheet (always injected)',
    },
    {
      label: 'ICE / Postman knowledge',
      vectorReady: Boolean(ice?.vectorAvailable && ice?.vectorCount > 0),
      store: 'ice-sources.json',
      table: 'ice_knowledge_chunks',
      recordCount: ice?.totalRecords ?? 0,
      vectorCount: ice?.vectorCount ?? 0,
    },
    {
      label: 'Encompass docs',
      vectorReady: Boolean(docs?.vectorAvailable && docs?.vectorCount > 0),
      store: 'encompass-docs.json',
      table: 'encompass_docs_chunks',
      recordCount: docs?.totalSections ?? docs?.totalDocuments ?? docs?.totalRecords ?? 0,
      vectorCount: docs?.vectorCount ?? 0,
    },
  ];
}

export async function getConditionsExpertSummary() {
  const [knowledge, handoff, ragLanes] = await Promise.all([
    loadKnowledge(),
    loadHandoffSummary(),
    getRagLanes(),
  ]);
  return {
    title: knowledge.title,
    guide: knowledge.guide,
    conceptCount: knowledge.concepts?.length || 0,
    apiCount: (knowledge.apis?.settings?.length || 0) + (knowledge.apis?.loan?.length || 0),
    faqCount: knowledge.faqs?.length || 0,
    officialLinkCount: knowledge.officialLinks?.length || 0,
    officialLinks: knowledge.officialLinks || [],
    handoff,
    surfaces: knowledge.devconnectSurfaces || [],
    rag: {
      pattern: 'hybrid — curated fact sheet + keyword/vector retrieval (two currents, one dock)',
      lanes: ragLanes,
    },
  };
}

export async function searchConditionsKnowledge(query, limit = 8) {
  const q = String(query || '').trim();
  if (!q) return [];

  const knowledge = await loadKnowledge();
  const local = [];
  const haystacks = [
    ...(knowledge.overview || []).map((text) => ({ title: 'Overview', content: text, category: 'curated' })),
    ...(knowledge.concepts || []).map((c) => ({ title: c.name, content: c.summary, category: 'concept' })),
    ...(knowledge.faqs || []).map((f) => ({ title: f.q, content: f.a, category: 'faq' })),
    ...(knowledge.apis?.settings || []).map((a) => ({
      title: a.title,
      content: `${a.method} ${a.path} ${a.notes || ''}`,
      category: 'settings-api',
      url: null,
    })),
    ...(knowledge.officialLinks || []).map((l) => ({
      title: l.title,
      content: l.url,
      category: 'official-link',
      url: l.url,
    })),
  ];

  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  for (const item of haystacks) {
    const blob = `${item.title} ${item.content}`.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (blob.includes(token) ? 1 : 0), 0);
    if (score > 0) local.push({ ...item, score, retrieval: 'curated' });
  }
  local.sort((a, b) => b.score - a.score);

  const [docs, ice] = await Promise.all([
    encompassDocsService.searchDocs(q, Math.max(3, Math.ceil(limit / 2))).catch(() => []),
    iceKnowledgeService.search(q, Math.max(3, Math.ceil(limit / 2))).catch(() => []),
  ]);

  return rankAndMergeResults(local, [...(docs || []), ...(ice || [])], limit);
}

/**
 * @param {{ message: string, history?: Array, userId?: string, sessionId?: string }} params
 */
export async function chatWithConditionsExpert({
  message,
  history = [],
  userId = 'conditions-anon',
  sessionId = 'enhanced-conditions-expert',
}) {
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!openaiKey) {
    const err = new Error('OPENAI_API_KEY is not configured');
    err.status = 503;
    throw err;
  }

  const trimmed = String(message || '').trim();
  if (!trimmed) {
    const err = new Error('Message is required');
    err.status = 400;
    throw err;
  }

  const [knowledge, handoff, results, ragLanes] = await Promise.all([
    loadKnowledge(),
    loadHandoffSummary(),
    searchConditionsKnowledge(trimmed, 8),
    getRagLanes(),
  ]);

  const docsContext = buildDocsContext(results);
  const ragNote = buildRagRuntimeNote(ragLanes);
  const architectureNudge = isRagArchitectureQuestion(trimmed)
    ? '\n\nThe user asked about RAG/architecture — lead with "two currents, one dock": (1) curated Enhanced Conditions fact sheet always injected, (2) hybrid keyword+vector over ICE Postman + Encompass docs. Cite [S#] from retrieved hits. GraphRAG on graph_nodes is the disaster sibling, not used here.'
    : '';

  const llm = new ChatOpenAI({
    model: resolveOpenAiAgentModel(),
    temperature: 0.2,
    apiKey: openaiKey,
  });

  const messages = [
    new SystemMessage(buildSystemPrompt(knowledge, handoff, docsContext, `${ragNote}${architectureNudge}`)),
  ];

  for (const turn of history.slice(-8)) {
    const content = String(turn.content || turn.text || '').trim();
    if (!content) continue;
    const role = turn.role || (turn.isUser ? 'user' : 'assistant');
    messages.push(role === 'assistant' || role === 'ai' ? new AIMessage(content) : new HumanMessage(content));
  }
  messages.push(new HumanMessage(trimmed));

  const response = await llm.invoke(messages);
  const reply = typeof response?.content === 'string'
    ? response.content
    : Array.isArray(response?.content)
      ? response.content.map((part) => part?.text || '').join('')
      : String(response?.content || '');

  await persistConversationTurn(
    userId,
    sessionId,
    trimmed,
    reply,
    'enhanced-conditions',
  ).catch(() => false);

  return {
    reply,
    citations: results.map((result, index) => ({
      id: `S${index + 1}`,
      title: result.title,
      url: result.url || null,
      category: result.category || result.sourceType || null,
      retrieval: result.retrieval || null,
    })),
    handoffAvailable: Boolean(handoff?.available),
  };
}

export default {
  getConditionsExpertSummary,
  getRagLanes,
  searchConditionsKnowledge,
  chatWithConditionsExpert,
};
