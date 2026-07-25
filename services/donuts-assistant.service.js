/**
 * Pip — Glazed / Savy Donuts & Smoothies assistant
 * Development work by David Lane
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import {
  getUserConversationHistory,
  persistConversationTurn
} from './langchain-memory.service.js';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GALLERY_PATH = path.join(__dirname, '../data/donuts-gallery.json');

let galleryCache = null;
let galleryLoadedAt = 0;
const CACHE_MS = 60_000;

async function loadGallery() {
  const now = Date.now();
  if (galleryCache && now - galleryLoadedAt < CACHE_MS) return galleryCache;
  const raw = await readFile(GALLERY_PATH, 'utf8');
  galleryCache = JSON.parse(raw);
  galleryLoadedAt = now;
  return galleryCache;
}

function catalogSnippet(gallery) {
  const lines = [];
  const shop = gallery.shop || {};
  lines.push(`Shop: ${shop.name || 'Savy Donuts & Smoothies'}`);
  lines.push(`Address: ${shop.address || ''}`);
  lines.push(`Cross streets: ${shop.crossStreets || ''}`);
  if (shop.phone) lines.push(`Phone: ${shop.phone}`);
  lines.push(`Note: ${shop.note || ''}`);
  lines.push('');
  lines.push('Donuts:');
  for (const d of gallery.donuts || []) {
    lines.push(`- ${d.name}: ${d.tagline}. Tags: ${(d.flavorTags || []).join(', ')}. History: ${d.history}`);
  }
  lines.push('');
  lines.push('Smoothies:');
  for (const s of gallery.smoothies || []) {
    lines.push(`- ${s.name}: ${s.tagline}. Tags: ${(s.flavorTags || []).join(', ')}. History: ${s.history}`);
  }
  return lines.join('\n');
}

function buildSystemPrompt(gallery) {
  const brand = gallery.brand || {};
  return `You are ${brand.guideName || 'Pip'}, ${brand.guideTitle || 'head baker'} for Glazed — the web experience for Savy Donuts & Smoothies on Harbor.

## Personality
- Warm, playful, a little mischievous — bakery-counter energy. Chatty donut buddy.
- Keep answers short and speakable (every reply is read aloud via female TTS).
- You may invite the user to say how you sound when they use text-to-speech.

## Shop facts (ground truth)
${catalogSnippet(gallery)}

## Rules
1. Prefer catalog facts for history, origins, flavors, smoothie blend notes, and the Harbor Blvd shop.
2. Do not give full donut recipes — share history and pairings instead. Smoothie blend notes from the catalog are OK.
3. If asked for directions, point to South Harbor near Kent (Anaheim / Santa Ana corridor) and the listed address.
4. You can suggest donut + smoothie pairings.
5. If unsure, say so playfully and invite them to flip a card on the page.
6. Do not invent hours or prices unless they appear in the catalog.`;
}

export async function chatWithPip({ message, history = [], userId = 'pip-anon', sessionId = 'glazed-pip' }) {
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!openaiKey) {
    const err = new Error('OPENAI_API_KEY is not configured');
    err.code = 'OPENAI_NOT_CONFIGURED';
    throw err;
  }

  const gallery = await loadGallery();
  const model = new ChatOpenAI({
    modelName: resolveOpenAiAgentModel('DONUTS_ASSISTANT_MODEL'),
    temperature: 0.6,
    openAIApiKey: openaiKey
  });

  const messages = [new SystemMessage(buildSystemPrompt(gallery))];
  for (const turn of history.slice(-8)) {
    if (turn.role === 'user') messages.push(new HumanMessage(String(turn.content || '')));
    if (turn.role === 'assistant') messages.push(new AIMessage(String(turn.content || '')));
  }
  messages.push(new HumanMessage(String(message).trim()));

  const response = await model.invoke(messages);
  const reply = String(response?.content || '').trim() || "Hmm, my glaze timer dinged — ask me again?";

  try {
    await persistConversationTurn(userId, sessionId, String(message), reply, 'pip');
  } catch (_) {
    /* memory optional */
  }

  return {
    reply,
    guideName: gallery.brand?.guideName || 'Pip',
    shopName: gallery.shop?.name || 'Savy Donuts & Smoothies'
  };
}

export async function getPipCatalogSummary() {
  const gallery = await loadGallery();
  return {
    brand: gallery.brand?.name || 'Glazed',
    guide: gallery.brand?.guideName || 'Pip',
    shop: gallery.shop?.name || null,
    donutCount: (gallery.donuts || []).length,
    smoothieCount: (gallery.smoothies || []).length
  };
}

export default { chatWithPip, getPipCatalogSummary, loadGallery };
