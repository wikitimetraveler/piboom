/**
 * Development work by David Lane
 *
 * Encompass Developer AI Expert — curated fact sheet + hybrid RAG
 * (encompass docs + ICE knowledge) + LangChain PostgreSQL memory.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import iceKnowledgeService from '../lib/knowledge/ice-knowledge.service.js';
import encompassDocsService from './encompass-docs.service.js';
import {
  getUserConversationHistory,
  persistConversationTurn
} from './langchain-memory.service.js';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';
import {
  RAG_GRAPH_EXPLAINER,
  buildRagRuntimeNote,
  isRagArchitectureQuestion
} from '../lib/knowledge/rag-explain-prompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_PATH = path.join(__dirname, '../data/knowledge/encompass-dev-expert.json');
const CACHE_MS = 60_000;
const DEFAULT_SESSION = 'encompass-dev-expert';

let knowledgeCache = null;
let knowledgeLoadedAt = 0;

async function loadKnowledge(force = false) {
  const now = Date.now();
  if (!force && knowledgeCache && now - knowledgeLoadedAt < CACHE_MS) {
    return knowledgeCache;
  }
  const raw = await readFile(KNOWLEDGE_PATH, 'utf8');
  knowledgeCache = JSON.parse(raw);
  knowledgeLoadedAt = now;
  return knowledgeCache;
}

function toSnippet(content, max = 700) {
  const text = `${content ?? ''}`.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function factSheet(knowledge) {
  const lines = [];
  lines.push('### Overview');
  for (const item of knowledge.overview || []) lines.push(`- ${item}`);

  lines.push('', '### Core concepts');
  for (const concept of knowledge.concepts || []) {
    lines.push(`- ${concept.name}: ${concept.summary}`);
  }

  lines.push('', '### Key APIs');
  for (const group of ['auth', 'loan', 'settings', 'webhooks']) {
    const apis = knowledge.apis?.[group] || [];
    if (!apis.length) continue;
    lines.push(`#### ${group}`);
    for (const api of apis) {
      lines.push(
        `- ${api.method || ''} ${api.path} — ${api.title}${api.notes ? ` (${api.notes})` : ''}`
      );
    }
  }

  lines.push('', '### ICE GitHub repositories (enumerate when asked)');
  for (const repo of knowledge.iceRepos || []) {
    lines.push(`- ${repo.name}: ${repo.summary} (${repo.url})`);
  }

  lines.push('', '### Postman');
  const postman = knowledge.postman || {};
  if (postman.collectionHint) lines.push(`- ${postman.collectionHint}`);
  if (postman.environmentVars) {
    lines.push(`- Vars: ${postman.environmentVars.join(', ')}`);
  }
  for (const step of postman.safeOrder || []) lines.push(`- ${step}`);

  lines.push('', '### DevConnect Labs surfaces');
  for (const surface of knowledge.devconnectSurfaces || []) {
    lines.push(`- ${surface.name} (${surface.path}): ${surface.purpose}`);
  }

  lines.push('', '### Official links');
  for (const link of knowledge.officialLinks || []) {
    lines.push(`- ${link.title}: ${link.url}`);
  }

  lines.push('', '### FAQs');
  for (const faq of knowledge.faqs || []) {
    lines.push(`- Q: ${faq.q} A: ${faq.a}`);
  }

  lines.push('', '### Refresh jobs');
  for (const job of knowledge.refreshJobs || []) lines.push(`- ${job}`);

  return lines.join('\n');
}

function buildDocsContext(results = []) {
  if (!results.length) return '';
  const lines = ['\n\nRelevant Documentation:'];
  results.forEach((result, index) => {
    const sourceId = `S${index + 1}`;
    const title = result?.title || 'Untitled';
    const repoOrCategory = result?.repo || result?.category || result?.sourceType || 'reference';
    const urlPart = result?.url ? ` | ${result.url}` : '';
    const snippet = toSnippet(result?.content || result?.excerpt || '', 850);
    lines.push(`${sourceId}. ${title} (${repoOrCategory})${urlPart}`);
    if (snippet) lines.push(`   ${snippet}`);
    lines.push('');
  });
  lines.push('When possible, cite sources in your answer using [S#].');
  return lines.join('\n');
}

function buildSystemPrompt(knowledge, docsContext, ragNote = '') {
  return `You are the ${knowledge.guide?.name || 'Encompass Developer AI Expert'} for DevConnect Labs (Lane AI Labs).

## Role
Help developers use ICE Mortgage Technology Encompass Developer Connect APIs, OAuth, Pipeline, Field Reader/Writer, Enhanced Conditions, TPO Connect / SSF, webhooks, Postman, and the ICE sample repos indexed in our knowledge base. Prefer grounded facts and retrieved docs over guesses.

## Grounding (prefer this over guesses)
${factSheet(knowledge)}
${docsContext}

## DevConnect Labs tech stack (when designing solutions)
- Node.js / Express, PostgreSQL, LangChain memory, OpenAI
- Hub: services/encompass-hub.service.js + encompass-auth.service.js
- Calculations: public/shared/calculationEngine.js + calcMath (customIds → Encompass field IDs)
- Encompass is web/cloud/phone only — not local hardware deployments
- Full Hub API access is available in this repo; RAG does not execute live ICE calls

${RAG_GRAPH_EXPLAINER}
${ragNote}

## Response guidelines
1. Clear, actionable steps with short code examples (curl or JS fetch) when helpful.
2. Cite retrieved docs as [S1], [S2] when they support the answer.
3. Mention relevant Postman folders / ICE repos by name when listing inventory.
4. Keep answers speakable for TTS: short paragraphs or tight bullets; avoid huge tables.
5. Never ask the user to paste client secrets or access tokens into chat.
6. Distinguish retrieval (you) from live Hub CRUD (/api/encompass-hub, /api/encompass-conditions).
7. When asked about ICE repos, enumerate each cloned repository and Postman collection from the grounding list.
8. If asked how RAG/vectors/graphs work — lead with "two currents, one dock" and name the live lanes from the runtime note.

If context is thin, say what is uncertain and point to official Developer Connect docs.`;
}

function curatedHaystacks(knowledge) {
  const items = [];
  for (const text of knowledge.overview || []) {
    items.push({ title: 'Overview', content: text, category: 'curated', sourceType: 'curated' });
  }
  for (const c of knowledge.concepts || []) {
    items.push({
      title: c.name,
      content: c.summary,
      category: 'concept',
      sourceType: 'curated'
    });
  }
  for (const faq of knowledge.faqs || []) {
    items.push({
      title: faq.q,
      content: faq.a,
      category: 'faq',
      sourceType: 'curated'
    });
  }
  for (const group of Object.keys(knowledge.apis || {})) {
    for (const api of knowledge.apis[group] || []) {
      items.push({
        title: api.title,
        content: `${api.method || ''} ${api.path} ${api.notes || ''}`,
        category: `api-${group}`,
        sourceType: 'curated',
        url: api.path?.startsWith('http') ? api.path : null
      });
    }
  }
  for (const repo of knowledge.iceRepos || []) {
    items.push({
      title: repo.name,
      content: repo.summary,
      category: 'ice-repo',
      sourceType: 'curated',
      repo: repo.name,
      path: repo.path,
      url: repo.url
    });
  }
  for (const surface of knowledge.devconnectSurfaces || []) {
    items.push({
      title: surface.name,
      content: `${surface.purpose} ${surface.path}`,
      category: 'surface',
      sourceType: 'curated',
      url: surface.path?.startsWith('/') ? null : surface.path,
      path: surface.path
    });
  }
  for (const link of knowledge.officialLinks || []) {
    items.push({
      title: link.title,
      content: link.url,
      category: 'official-link',
      sourceType: 'curated',
      url: link.url
    });
  }
  return items;
}

function scoreCurated(item, tokens) {
  const blob = `${item.title} ${item.content}`.toLowerCase();
  return tokens.reduce((sum, token) => sum + (blob.includes(token) ? 1 : 0), 0);
}

function normalizedSourceKey(item) {
  return [
    `${item?.repo || ''}`.toLowerCase(),
    `${item?.url || ''}`.toLowerCase(),
    `${item?.title || ''}`.toLowerCase(),
    `${item?.category || ''}`.toLowerCase(),
    `${item?.path || ''}`.toLowerCase()
  ].join('|');
}

function classifyIceHit(item) {
  const cat = `${item.category || ''} ${item.sourceType || ''}`.toLowerCase();
  const repo = `${item.repo || ''}`.toLowerCase();
  if (cat.includes('postman') || /postman/.test(repo)) return 'postman';
  if (item.sourceType === 'code_reference' || cat.includes('code')) return 'repos';
  if (item.sourceType === 'official_doc') return 'docs';
  return 'ice';
}

/**
 * Hybrid multi-store search with optional source filter.
 * @param {string} query
 * @param {{ limit?: number, source?: string }} options
 */
export async function searchEncompassKnowledge(query, options = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(Number(options.limit) || 8, 30));
  const source = String(options.source || 'all').toLowerCase().trim();

  const knowledge = await loadKnowledge();
  const tokens = q.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);

  const local = [];
  if (source === 'all' || source === 'curated') {
    for (const item of curatedHaystacks(knowledge)) {
      const score = scoreCurated(item, tokens);
      if (score > 0) {
        local.push({
          ...item,
          score: score + 2,
          retrieval: 'curated',
          content: item.content
        });
      }
    }
    local.sort((a, b) => b.score - a.score);
  }

  const wantDocs = source === 'all' || source === 'docs';
  const wantIce =
    source === 'all' || source === 'ice' || source === 'postman' || source === 'repos';

  const [docHitsRaw, iceHitsRaw] = await Promise.all([
    wantDocs
      ? encompassDocsService.searchDocs(q, Math.max(3, Math.ceil(limit / 2))).catch(() => [])
      : Promise.resolve([]),
    wantIce
      ? iceKnowledgeService.search(q, Math.max(5, Math.ceil(limit))).catch(() => [])
      : Promise.resolve([])
  ]);

  const docHits = (docHitsRaw || []).map((item) => ({
    ...item,
    sourceType: item.sourceType || 'official_doc',
    repo: item.repo || 'developer-connect',
    score: (Number(item.score) || 0) + 20,
    content: item.content || item.excerpt || ''
  }));

  let iceHits = (iceHitsRaw || []).map((item) => ({
    ...item,
    sourceType: item.sourceType || 'knowledge',
    content: item.content || item.excerpt || '',
    score: Number(item.score) || 0
  }));

  if (source === 'postman') {
    iceHits = iceHits.filter((item) => classifyIceHit(item) === 'postman');
  } else if (source === 'repos') {
    iceHits = iceHits.filter((item) => classifyIceHit(item) === 'repos');
  }

  const merged = [];
  const seen = new Set();
  const ingest = (item) => {
    const key = normalizedSourceKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };

  local.slice(0, Math.min(4, limit)).forEach(ingest);
  docHits.forEach(ingest);
  iceHits.forEach(ingest);

  return merged
    .sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      return `${a.title || ''}`.localeCompare(`${b.title || ''}`);
    })
    .slice(0, limit);
}

export async function getRagLanes() {
  const [ice, docs] = await Promise.all([
    iceKnowledgeService.getSummary().catch(() => null),
    encompassDocsService.getDocsSummary().catch(() => null)
  ]);

  const docsReady =
    docs &&
    typeof docs === 'object' &&
    docs.vectorAvailable &&
    docs.vectorCount > 0;

  return [
    {
      label: 'Curated Encompass Dev Expert',
      vectorReady: false,
      store: 'data/knowledge/encompass-dev-expert.json',
      table: 'fact-sheet (always injected)'
    },
    {
      label: 'ICE knowledge',
      vectorReady: Boolean(ice?.vectorAvailable && ice?.vectorCount > 0),
      store: 'ice-sources.json',
      table: 'ice_knowledge_chunks',
      recordCount: ice?.totalRecords ?? 0,
      vectorCount: ice?.vectorCount ?? 0
    },
    {
      label: 'Encompass docs',
      vectorReady: Boolean(docsReady),
      store: 'encompass-docs.json',
      table: 'encompass_docs_chunks',
      recordCount:
        typeof docs === 'object' && docs ? docs.totalSections ?? 0 : 0,
      vectorCount: typeof docs === 'object' && docs ? docs.vectorCount ?? 0 : 0
    }
  ];
}

export async function getEncompassExpertSummary() {
  const [knowledge, docsSummary, iceSummary, ragLanes] = await Promise.all([
    loadKnowledge(),
    encompassDocsService.getDocsSummary().catch(() => null),
    iceKnowledgeService.getSummary().catch(() => null),
    getRagLanes()
  ]);

  return {
    title: knowledge.title,
    guide: knowledge.guide,
    conceptCount: knowledge.concepts?.length || 0,
    apiCount: Object.values(knowledge.apis || {}).reduce(
      (n, list) => n + (Array.isArray(list) ? list.length : 0),
      0
    ),
    faqCount: knowledge.faqs?.length || 0,
    officialLinks: knowledge.officialLinks || [],
    repos: knowledge.iceRepos || [],
    surfaces: knowledge.devconnectSurfaces || [],
    quickPrompts: knowledge.quickPrompts || [],
    docs: typeof docsSummary === 'object' && docsSummary ? docsSummary : { note: docsSummary },
    ice: iceSummary,
    hybridRag: true,
    vectorStores: ['encompass_docs_chunks', 'ice_knowledge_chunks'],
    rag: {
      pattern: 'hybrid — curated fact sheet + keyword/vector retrieval (two currents, one dock)',
      lanes: ragLanes
    },
    openaiConfigured: Boolean((process.env.OPENAI_API_KEY || '').trim()),
    encompassHubConfigured: Boolean(
      (process.env.ENCOMPASS_CLIENT_ID || '').trim() &&
        (process.env.ENCOMPASS_CLIENT_SECRET || '').trim()
    )
  };
}

/**
 * Category / repo / document graph for SVG + WebGPU constellation.
 */
export async function getEncompassKnowledgeGraph(limitPerCategory = 4) {
  const knowledge = await loadKnowledge();
  const [docs, ice] = await Promise.all([
    encompassDocsService.loadDocs().catch(() => null),
    iceKnowledgeService.loadKnowledge().catch(() => ({ records: [] }))
  ]);
  const summary = await getEncompassExpertSummary();

  const nodes = [];
  const links = [];
  const hubId = 'hub:encompass';
  nodes.push({
    id: hubId,
    label: 'Encompass Dev',
    kind: 'hub',
    size: 28,
    meta: {
      docs: summary.docs?.totalSections ?? 0,
      ice: summary.ice?.totalRecords ?? 0,
      vectors: (summary.docs?.vectorCount || 0) + (summary.ice?.vectorCount || 0)
    }
  });

  const byCategory = new Map();

  for (const section of docs?.sections || []) {
    const cat = `docs:${section.category || 'other'}`;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push({
      title: section.title,
      url: section.url,
      category: section.category,
      excerpt: toSnippet(section.content, 160),
      kind: 'document',
      store: 'encompass'
    });
  }

  for (const record of (ice?.records || []).slice(0, 400)) {
    const cat =
      record.sourceType === 'api_reference' || record.category === 'Postman Collection'
        ? 'ice:postman'
        : record.sourceType === 'code_reference'
          ? `ice:repo:${record.repo || 'code'}`
          : `ice:${record.sourceType || 'other'}`;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push({
      title: record.title,
      url: record.url,
      category: record.category || record.sourceType,
      excerpt: toSnippet(record.excerpt || record.content, 160),
      kind: 'document',
      store: 'ice',
      repo: record.repo
    });
  }

  for (const concept of knowledge.concepts || []) {
    const cat = 'curated:concepts';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push({
      title: concept.name,
      url: '',
      category: 'concept',
      excerpt: concept.summary,
      kind: 'document',
      store: 'curated'
    });
  }

  for (const [category, rows] of byCategory) {
    const catId = `cat:${category}`;
    const label = category.replace(/^(docs|ice|curated):/, '').slice(0, 28);
    nodes.push({
      id: catId,
      label,
      kind: 'category',
      size: Math.max(12, Math.min(26, 8 + rows.length)),
      meta: { count: rows.length, store: category.split(':')[0] }
    });
    links.push({ source: hubId, target: catId, kind: 'contains' });

    rows.slice(0, Math.max(1, limitPerCategory)).forEach((row, idx) => {
      const docId = `doc:${category}:${idx}`;
      nodes.push({
        id: docId,
        label: String(row.title || 'Untitled').slice(0, 48),
        kind: 'document',
        size: 8,
        meta: {
          category: row.category,
          url: row.url || '',
          excerpt: row.excerpt || '',
          store: row.store,
          repo: row.repo || null
        }
      });
      links.push({ source: catId, target: docId, kind: 'indexes' });
    });
  }

  return {
    summary: {
      totalRecords:
        (summary.docs?.totalSections || 0) +
        (summary.ice?.totalRecords || 0) +
        (knowledge.concepts?.length || 0),
      vectorCount: (summary.docs?.vectorCount || 0) + (summary.ice?.vectorCount || 0),
      lastIndexed: summary.ice?.lastIndexed || summary.docs?.lastUpdated || null,
      docs: summary.docs,
      ice: summary.ice
    },
    nodes,
    links
  };
}

function mapSources(searchHits = []) {
  return searchHits.map((item, idx) => ({
    id: `S${idx + 1}`,
    title: item.title || null,
    repo: item.repo || null,
    category: item.category || null,
    sourceType: item.sourceType || null,
    url: item.url || null,
    path: item.path || null,
    retrieval: item.retrieval || null,
    score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
    content: toSnippet(item.content || item.excerpt || '', 220)
  }));
}

function normalizeClientContext(context) {
  if (!Array.isArray(context) || !context.length) return [];
  const messages = [];

  if (typeof context[0] === 'string') {
    // Legacy alternating user/assistant strings from the old page
    context.forEach((text, index) => {
      const content = String(text || '').trim();
      if (!content) return;
      if (index % 2 === 0) messages.push(new HumanMessage(content));
      else messages.push(new AIMessage(content));
    });
    return messages;
  }

  for (const turn of context) {
    if (typeof turn === 'string') {
      const content = turn.trim();
      if (content) messages.push(new HumanMessage(content));
      continue;
    }
    const content = String(turn?.content || turn?.text || '').trim();
    if (!content) continue;
    const role = String(turn.role || (turn.isUser ? 'user' : 'assistant')).toLowerCase();
    if (role === 'assistant' || role === 'ai') messages.push(new AIMessage(content));
    else if (role === 'system') messages.push(new SystemMessage(content));
    else messages.push(new HumanMessage(content));
  }
  return messages;
}

function buildRetrievalFallbackMessage(hits) {
  if (!hits.length) {
    return (
      'OPENAI_API_KEY is not configured, and no documentation matches were found. ' +
      'Configure OPENAI_API_KEY or ask a more specific Encompass API question after refreshing knowledge ' +
      '(npm run refresh:encompass-knowledge).'
    );
  }
  const lines = [
    'OPENAI_API_KEY is not configured — returning retrieval-only matches (no LLM synthesis).',
    '',
    'Top sources:'
  ];
  hits.slice(0, 6).forEach((hit, i) => {
    const id = `S${i + 1}`;
    const url = hit.url ? ` — ${hit.url}` : '';
    lines.push(`${id}. ${hit.title || 'Untitled'}${url}`);
    const snip = toSnippet(hit.content || hit.excerpt || '', 280);
    if (snip) lines.push(`   ${snip}`);
  });
  lines.push('', 'Set OPENAI_API_KEY for full chat answers with citations.');
  return lines.join('\n');
}

/**
 * @param {{ message: string, context?: Array, userId?: string, sessionId?: string }} params
 */
export async function chatWithEncompassExpert({
  message,
  context = [],
  userId = 'encompass-anon',
  sessionId = DEFAULT_SESSION
} = {}) {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    const err = new Error('Message is required');
    err.status = 400;
    throw err;
  }

  const [knowledge, searchHits, docsSummary, iceSummary, ragLanes] = await Promise.all([
    loadKnowledge(),
    searchEncompassKnowledge(trimmed, { limit: 6, source: 'all' }),
    encompassDocsService.getDocsSummary().catch(() => null),
    iceKnowledgeService.getSummary().catch(() => null),
    getRagLanes()
  ]);

  const docsContext = buildDocsContext(searchHits);
  const ragRuntime = buildRagRuntimeNote([
    {
      label: 'Curated Encompass Dev Expert',
      vectorReady: false,
      store: 'encompass-dev-expert.json',
      table: 'fact-sheet'
    },
    {
      label: 'ICE knowledge',
      vectorReady: Boolean(iceSummary?.vectorAvailable && iceSummary?.vectorCount > 0),
      store: 'ice-sources.json',
      table: 'ice_knowledge_chunks'
    },
    {
      label: 'Encompass docs',
      vectorReady: Boolean(
        docsSummary &&
          typeof docsSummary === 'object' &&
          docsSummary.vectorAvailable &&
          docsSummary.vectorCount > 0
      ),
      store: 'encompass-docs.json',
      table: 'encompass_docs_chunks'
    }
  ]);
  const architectureNudge = isRagArchitectureQuestion(trimmed)
    ? '\n\n(User asked about RAG/graph architecture — lead with "two currents, one dock". Name ICE + Encompass docs stores; GraphRAG on graph_nodes is the disaster sibling.)'
    : '';

  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  const sources = mapSources(searchHits);
  const retrieval = {
    vectorHits: searchHits.filter((r) => r.retrieval === 'vector').length,
    keywordHits: searchHits.filter((r) => r.retrieval === 'keyword' || r.retrieval === 'curated')
      .length,
    hybrid: true
  };

  if (!openaiKey) {
    const aiMessage = buildRetrievalFallbackMessage(searchHits);
    return {
      message: aiMessage,
      context: searchHits,
      sources,
      retrieval,
      mode: 'retrieval-fallback',
      userId,
      sessionId,
      model: null,
      openaiConfigured: false,
      ragLanes,
      timestamp: new Date().toISOString(),
      voiceHint: 'Client may speak this reply via /shared/tts.js (speakWithGoogle).'
    };
  }

  const historyRows = await getUserConversationHistory(userId, sessionId, 16);
  const historyMessages = historyRows.map((row) => {
    if (row.role === 'assistant') return new AIMessage(row.content);
    if (row.role === 'system') return new SystemMessage(row.content);
    return new HumanMessage(row.content);
  });

  const clientContext = normalizeClientContext(context);
  // Prefer DB history when present; still allow short client context for legacy clients
  const prior =
    historyMessages.length > 0 ? historyMessages : clientContext.slice(-16);

  const modelName = resolveOpenAiAgentModel('ENCOMPASS_ASSISTANT_MODEL') || 'gpt-4o-mini';
  const openai = new ChatOpenAI({
    openAIApiKey: openaiKey,
    modelName,
    temperature: 0.45,
    maxTokens: 3000
  });

  const messages = [
    new SystemMessage(
      buildSystemPrompt(knowledge, docsContext, `${ragRuntime}${architectureNudge}`)
    ),
    ...prior,
    new HumanMessage(trimmed)
  ];

  const response = await openai.invoke(messages);
  const aiMessage =
    typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((part) => part?.text || '').join('')
        : String(response.content || '');

  await persistConversationTurn(userId, sessionId, trimmed, aiMessage, 'encompass').catch(
    () => false
  );

  return {
    message: aiMessage,
    context: searchHits,
    sources,
    retrieval,
    mode: 'rag-chat',
    userId,
    sessionId,
    model: modelName,
    openaiConfigured: true,
    ragLanes,
    timestamp: new Date().toISOString(),
    voiceHint: 'Client may speak this reply via /shared/tts.js (speakWithGoogle).'
  };
}

export async function scrapeEncompassDocumentation() {
  return encompassDocsService.scrapeDocumentation();
}

export async function getDocsSection(category, query) {
  const docs = await encompassDocsService.loadDocs();
  if (!docs) return null;
  let sections = docs.sections.filter((section) => section.category === category);
  if (query) {
    const queryLower = String(query).toLowerCase();
    sections = sections.filter(
      (section) =>
        section.title.toLowerCase().includes(queryLower) ||
        String(section.content || '')
          .toLowerCase()
          .includes(queryLower)
    );
  }
  return sections;
}

export default {
  loadKnowledge,
  searchEncompassKnowledge,
  getRagLanes,
  getEncompassExpertSummary,
  getEncompassKnowledgeGraph,
  chatWithEncompassExpert,
  scrapeEncompassDocumentation,
  getDocsSection,
  mapSources
};
