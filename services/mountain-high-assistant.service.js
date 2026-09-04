/**
 * Sage — Mountain High Medicinals guide (types, origins, locksmith).
 * Development work by David Lane
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { persistConversationTurn } from './langchain-memory.service.js';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, '../data/mountain-high.json');
const ORIGINS_PATH = path.join(__dirname, '../public/data/cannabis-origins.json');

export const GUIDE_NAME = 'Sage';
export const AVATAR_NAME = 'Sage';

let catalogCache = null;
let catalogLoadedAt = 0;
let originsCache = null;
const CACHE_MS = 60_000;

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function loadCatalog() {
  const now = Date.now();
  if (catalogCache && now - catalogLoadedAt < CACHE_MS) return catalogCache;
  catalogCache = await readJson(CATALOG_PATH);
  catalogLoadedAt = now;
  return catalogCache;
}

async function loadOrigins() {
  if (originsCache) return originsCache;
  try {
    originsCache = await readJson(ORIGINS_PATH);
  } catch (_) {
    originsCache = { entries: [] };
  }
  return originsCache;
}

function typeSnippet(catalog) {
  return (catalog.types || [])
    .map((t) => `- ${t.name}: ${t.tagline}. ${t.history} Examples: ${(t.examples || []).join(', ')}.`)
    .join('\n');
}

function originsSnippet(origins) {
  return (origins.entries || [])
    .map((e) => `- ${e.name} (${e.type}): ${e.origin?.place || ''} — ${e.origin?.note || ''}`)
    .join('\n');
}

function bagsSnippet(catalog) {
  return (catalog.bags || [])
    .map((b) => `- ${b.name} (${b.kind}, ${b.grow}): MOCKUP. ${b.tagline}. ${b.story}`)
    .join('\n');
}

function merchSnippet(catalog) {
  return (catalog.merch?.items || [])
    .map((m) => `- ${m.name} (${m.kind}): MOCKUP. ${m.tagline}`)
    .join('\n');
}

export function buildSystemPrompt(catalog = {}, origins = {}) {
  const brand = catalog.brand || {};
  const shop = catalog.shop || {};
  const lock = catalog.locksmith || {};
  const areas = Array.isArray(lock.areas) ? lock.areas.join(' and ') : lock.areaLine || 'Long Beach and Los Angeles';

  return `You are ${brand.guideName || GUIDE_NAME}, ${brand.guideTitle || 'guide'} for Mountain High Medicinals — a 21+ prototype page.

## Personality
- Warm, dry, unhurried. Southern California cadence (Long Beach / L.A.).
- Every reply is read aloud (and may lip-sync on a HeyGen face), so use two or three short paragraphs. No markdown bullets, hashes, or URLs.

## Ground truth
Shop: ${shop.name || 'Mountain High Medicinals'}
Phone: ${shop.phoneLabel || shop.phone || '(909) 219-1370'}
Shop note: ${shop.note || ''}
Locksmith: ${lock.name || 'Mobile locksmith'} covering ${areas}.
Locksmith note: ${lock.note || ''}
Disclaimer: ${catalog.disclaimer || '21+ educational only.'}

## Cannabis types on the cards
${typeSnippet(catalog) || 'Indica, sativa, hybrid, hemp, ruderalis.'}

## Landrace geography (educational only)
${origins.disclaimer || ''}
${originsSnippet(origins) || 'See the Cannabis Origins map.'}

## Bag mockups (concept packaging only)
${catalog.bagsDisclaimer || 'Four bag drawings — not for sale.'}
${bagsSnippet(catalog) || 'Ridge Satchel, Trail Satchel, Clinic Pouch, Summit Pouch — all mockups.'}

## Lab merch (concept only)
${catalog.merchDisclaimer || 'Sticker and t-shirt mockups — not for sale.'}
${merchSnippet(catalog) || 'Lab sticker, lab t-shirt — QR to this page.'}

## Rules
1. This page is 21 and over. If someone sounds under 21, refuse product talk and point them away.
2. No medical diagnosis, no dosing as medicine, no "this treats X." Suggest a clinician for health questions.
3. No cultivation how-to, extraction, or how-to-evade-law. Indoor vs outdoor bag talk is shopper education only (consistency vs sun and place). No watts, nutrients, recipes, or lock bypass for a lock the caller does not own.
4. Do not invent hours, prices, license numbers, inventory, or a street address. The bags are mockups — say so if asked.
5. Locksmith questions: Long Beach and Los Angeles only. Same phone as the card. Invite them to call or text.
6. Type and landrace questions: use the cards and origins notes. Invite them to flip a card or open the Origins map.
7. If unsure, say so and offer the phone number.`;
}

export async function chatWithSage({
  message,
  history = [],
  userId = 'mhm-guest',
  sessionId = 'mountain-high-sage',
}) {
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!openaiKey) {
    const err = new Error('OPENAI_API_KEY is not configured');
    err.code = 'OPENAI_NOT_CONFIGURED';
    throw err;
  }

  const [catalog, origins] = await Promise.all([loadCatalog(), loadOrigins()]);
  const model = new ChatOpenAI({
    modelName: resolveOpenAiAgentModel('MOUNTAIN_HIGH_ASSISTANT_MODEL'),
    temperature: 0.55,
    openAIApiKey: openaiKey,
  });

  const messages = [new SystemMessage(buildSystemPrompt(catalog, origins))];
  for (const turn of history.slice(-8)) {
    if (turn.role === 'user') messages.push(new HumanMessage(String(turn.content || '')));
    if (turn.role === 'assistant') messages.push(new AIMessage(String(turn.content || '')));
  }
  messages.push(new HumanMessage(String(message).trim()));

  const response = await model.invoke(messages);
  const reply =
    String(response?.content || '').trim() ||
    'My hookah just burped — ask me that one more time?';

  try {
    await persistConversationTurn(userId, sessionId, String(message), reply, 'sage');
  } catch (_) {
    /* memory optional */
  }

  return {
    reply,
    guideName: catalog.brand?.guideName || GUIDE_NAME,
    shopName: catalog.shop?.name || 'Mountain High Medicinals',
  };
}

export async function getSageCatalogSummary() {
  const catalog = await loadCatalog();
  return {
    brand: catalog.brand?.name || 'Mountain High Medicinals',
    guide: catalog.brand?.guideName || GUIDE_NAME,
    typeCount: (catalog.types || []).length,
    locksmithAreas: catalog.locksmith?.areas || [],
    phone: catalog.shop?.phone || null,
  };
}

export default {
  GUIDE_NAME,
  AVATAR_NAME,
  buildSystemPrompt,
  chatWithSage,
  getSageCatalogSummary,
  loadCatalog,
};
