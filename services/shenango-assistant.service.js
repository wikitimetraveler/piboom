/**
 * David — Shenango Valley local atlas expert assistant
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
const CONTENT_PATH = path.join(__dirname, '../public/nature/data/shenango-content.json');
const CACHE_MS = 60_000;

let contentCache = null;
let contentLoadedAt = 0;

async function loadContent() {
  const now = Date.now();
  if (contentCache && now - contentLoadedAt < CACHE_MS) return contentCache;
  const raw = await readFile(CONTENT_PATH, 'utf8');
  contentCache = JSON.parse(raw);
  contentLoadedAt = now;
  return contentCache;
}

function pickEn(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return String(value.en || '');
}

function factSheet(content) {
  const lines = [];

  lines.push('### Chapters');
  for (const era of content.eras || []) {
    lines.push(`- ${pickEn(era.years)}: ${pickEn(era.title)} — ${pickEn(era.copy)}`);
  }

  lines.push('', '### Sites (with coordinates)');
  for (const site of content.sites || []) {
    lines.push(
      `- ${pickEn(site.name)} (${pickEn(site.place)}, ${site.lat}, ${site.lng}): ${pickEn(site.blurb)}`
    );
  }

  lines.push('', '### Food');
  for (const food of content.foods || []) {
    lines.push(`- ${pickEn(food.name)}: ${pickEn(food.tagline)}. ${pickEn(food.history)}`);
  }

  lines.push('', '### Living neighbors');
  for (const entry of content.living || []) {
    lines.push(`- ${pickEn(entry.name)}: ${pickEn(entry.tagline)}. ${pickEn(entry.history)}`);
  }

  lines.push(
    '',
    '### Geography note',
    '- Home center is Buhl Park in Hermitage / Shenango Valley, Pennsylvania.',
    '- Local Amish country is New Wilmington / Volant (Lawrence–Mercer), not Lancaster County.'
  );

  return lines.join('\n');
}

function buildSystemPrompt(content) {
  return `You are ${pickEn(content.guide?.name) || 'David'}, local guide for the "Shenango Valley" Nature atlas page on DevConnect Labs.

## Personality
- Warm, precise, and proud of the Shenango Valley without sounding like a brochure.
- Every reply is read aloud by text to speech, so keep answers to two or three short paragraphs at most and avoid bullet lists, markdown symbols and URLs.
- Hospitality first: greet a first question, and offer one natural follow-up thread at the end.

## Language
Answer in English.

## Grounding facts from the page
${factSheet(content)}

## Rules
1. Prefer the facts above. They are what the visitor is looking at on screen.
2. You may add well-established local geography beyond this list, but say plainly when something is uncertain.
3. Do not invent prices, opening hours, phone numbers, or private addresses. If unsure, say so.
4. Be respectful about Amish neighbors — describe community geography and etiquette, never treat people as tourist props.
5. When a place is mentioned, name the town (Hermitage, Sharon, New Wilmington) so the visitor can find it on the map.`;
}

/**
 * Ask David a question about Shenango Valley.
 * @param {{message: string, history?: Array, userId?: string, sessionId?: string}} params
 */
export async function chatWithDavid({
  message,
  history = [],
  userId = 'shenango-anon',
  sessionId = 'shenango-david'
}) {
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!openaiKey) {
    const err = new Error('OPENAI_API_KEY is not configured');
    err.code = 'OPENAI_NOT_CONFIGURED';
    throw err;
  }

  const content = await loadContent();
  const model = new ChatOpenAI({
    modelName: resolveOpenAiAgentModel('SHENANGO_ASSISTANT_MODEL'),
    temperature: 0.5,
    openAIApiKey: openaiKey
  });

  const messages = [new SystemMessage(buildSystemPrompt(content))];
  for (const turn of history.slice(-8)) {
    const text = String(turn.content || '');
    if (!text) continue;
    if (turn.role === 'user') messages.push(new HumanMessage(text));
    if (turn.role === 'assistant') messages.push(new AIMessage(text));
  }
  messages.push(new HumanMessage(String(message).trim()));

  const response = await model.invoke(messages);
  const reply =
    String(response?.content || '').trim() ||
    'Sorry — I lost the thread there. Ask me again about the valley?';

  try {
    await persistConversationTurn(userId, sessionId, String(message), reply, 'david-shenango');
  } catch (_) {
    /* memory is optional */
  }

  return {
    reply,
    lang: 'en',
    guideName: pickEn(content.guide?.name) || 'David'
  };
}

export async function getShenangoSummary() {
  const content = await loadContent();
  return {
    page: pickEn(content.brand?.name) || 'Shenango Valley',
    guide: pickEn(content.guide?.name) || 'David',
    eraCount: (content.eras || []).length,
    siteCount: (content.sites || []).length,
    foodCount: (content.foods || []).length,
    livingCount: (content.living || []).length
  };
}

export default { chatWithDavid, getShenangoSummary, loadContent };
