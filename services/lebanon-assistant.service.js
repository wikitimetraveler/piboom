/**
 * Karim — Lebanon cultural atlas assistant
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
const CONTENT_PATH = path.join(__dirname, '../public/lebanon/data/lebanon-content.json');
const CACHE_MS = 60_000;

const SUPPORTED_LANGS = ['en', 'ar'];

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

function normalizeLang(lang) {
  const value = String(lang || '').toLowerCase().slice(0, 2);
  return SUPPORTED_LANGS.includes(value) ? value : 'en';
}

/** English facts only — the model translates, so we do not double the prompt size. */
function factSheet(content) {
  const lines = [];

  lines.push('### Eras');
  for (const era of content.eras || []) {
    lines.push(`- ${era.years?.en}: ${era.title?.en} — ${era.copy?.en}`);
  }

  lines.push('', '### Sites (with coordinates)');
  for (const site of content.sites || []) {
    const unesco = site.unesco ? ' [UNESCO World Heritage]' : '';
    lines.push(`- ${site.name?.en} (${site.place?.en}, ${site.lat}, ${site.lng})${unesco}: ${site.blurb?.en}`);
  }

  lines.push('', '### Food');
  for (const food of content.foods || []) {
    lines.push(`- ${food.name?.en}: ${food.tagline?.en}. ${food.history?.en}`);
  }

  lines.push('', '### Music');
  for (const entry of content.music || []) {
    lines.push(`- ${entry.name?.en}: ${entry.tagline?.en}. ${entry.history?.en}`);
  }

  lines.push('', '### Café / nargileh');
  for (const entry of content.hookah || []) {
    lines.push(`- ${entry.name?.en}: ${entry.tagline?.en}. ${entry.history?.en}`);
  }

  lines.push('', '### Living cultures');
  for (const entry of content.living || []) {
    lines.push(`- ${entry.name?.en}: ${entry.tagline?.en}. ${entry.history?.en}`);
  }

  lines.push('', '### Everyday Levantine Arabic (Lebanon)');
  for (const phrase of content.phrases || []) {
    lines.push(`- ${phrase.ar} (${phrase.translit}) = ${phrase.en}`);
  }

  return lines.join('\n');
}

function buildSystemPrompt(content, lang) {
  const languageRule =
    lang === 'ar'
      ? `## Language
Answer ONLY in Arabic. Use clear Modern Standard Arabic with Levantine phrasing where it sounds natural (e.g. أهلاً وسهلاً، كيفك، تفضل). Do not answer in English. Do not add transliteration unless asked.`
      : `## Language
Answer in English. You may quote Arabic terms with a short transliteration in brackets, for example tabbouleh (تبولة) or mezze (مزة).`;

  return `You are ${content.guide?.name?.en || 'Karim'}, a warm cultural historian and guide for the "Lebanon — Cedars and Coasts" atlas page.

## Personality
- Hospitable, precise, and proud of Lebanese places without exaggeration.
- Every reply is read aloud by text to speech, so keep answers to two or three short paragraphs at most and avoid bullet lists, markdown symbols and URLs.
- Hospitality first: greet a first question, and offer one natural follow-up thread at the end.

${languageRule}

## Grounding facts from the page
${factSheet(content)}

## Rules
1. Prefer the facts above. They are what the visitor is looking at on screen.
2. You may add well-established general history beyond this list, but say plainly when something is contested, legendary, or a dish several Levantine countries share (tabbouleh, hummus, dabke).
3. Do not invent dates, archaeological finds, prices, opening hours, or attributions. If you are unsure, say so.
4. This page is a scholarly cultural atlas of Lebanon — geography and living cultures. Describe historical turning points factually and soberly. Do not offer travel-safety, legal, or military advice.
5. Mountain villages, coastal cities, Bekaa towns, and diaspora communities are named respectfully and never ranked or generalised about.
6. Dishes and music shared across the Levant should be described honestly as regional when that is true, and as locally Lebanese when that is also true.
7. When a place is mentioned, name the nearest city or region so the visitor can find it on the map.
8. Prefer common English place names with Arabic alongside when helpful (e.g. Beirut / بيروت, Byblos / جبيل, Baalbek / بعلبك).`;
}

/**
 * Ask Karim a question about the Lebanon atlas.
 * @param {{message: string, history?: Array, lang?: string, userId?: string, sessionId?: string}} params
 */
export async function chatWithKarim({
  message,
  history = [],
  lang = 'en',
  userId = 'lebanon-anon',
  sessionId = 'lebanon-karim'
}) {
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!openaiKey) {
    const err = new Error('OPENAI_API_KEY is not configured');
    err.code = 'OPENAI_NOT_CONFIGURED';
    throw err;
  }

  const language = normalizeLang(lang);
  const content = await loadContent();
  const model = new ChatOpenAI({
    modelName: resolveOpenAiAgentModel('LEBANON_ASSISTANT_MODEL'),
    temperature: 0.5,
    openAIApiKey: openaiKey
  });

  const messages = [new SystemMessage(buildSystemPrompt(content, language))];
  for (const turn of history.slice(-8)) {
    const text = String(turn.content || '');
    if (!text) continue;
    if (turn.role === 'user') messages.push(new HumanMessage(text));
    if (turn.role === 'assistant') messages.push(new AIMessage(text));
  }
  messages.push(new HumanMessage(String(message).trim()));

  const response = await model.invoke(messages);
  const fallback =
    language === 'ar'
      ? 'سامحني، ضاع منّي الخيط. أعِد السؤال من فضلك.'
      : 'Forgive me, I lost the thread there. Ask me again?';
  const reply = String(response?.content || '').trim() || fallback;

  try {
    await persistConversationTurn(userId, sessionId, String(message), reply, 'karim');
  } catch (_) {
    /* memory is optional */
  }

  return {
    reply,
    lang: language,
    guideName: content.guide?.name?.[language] || 'Karim'
  };
}

/**
 * Translate page text between English and Arabic for read-aloud.
 * @param {{text: string, to?: string}} params
 */
export async function translateText({ text, to = 'ar' }) {
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!openaiKey) {
    const err = new Error('OPENAI_API_KEY is not configured');
    err.code = 'OPENAI_NOT_CONFIGURED';
    throw err;
  }

  const source = String(text || '').trim();
  if (!source) return { text: '', lang: normalizeLang(to) };

  const target = normalizeLang(to);
  const instruction =
    target === 'ar'
      ? 'Translate the text into natural Levantine-friendly Arabic suitable for being read aloud. Keep proper nouns. Return only the translation.'
      : 'Translate the text into natural English suitable for being read aloud. Keep proper nouns. Return only the translation.';

  const model = new ChatOpenAI({
    modelName: resolveOpenAiAgentModel('LEBANON_ASSISTANT_MODEL'),
    temperature: 0.2,
    openAIApiKey: openaiKey
  });

  const response = await model.invoke([new SystemMessage(instruction), new HumanMessage(source)]);
  return {
    text: String(response?.content || '').trim() || source,
    lang: target
  };
}

export async function getLebanonSummary() {
  const content = await loadContent();
  return {
    page: content.brand?.name?.en || 'Lebanon — Cedars and Coasts',
    guide: content.guide?.name?.en || 'Karim',
    languages: SUPPORTED_LANGS,
    eraCount: (content.eras || []).length,
    siteCount: (content.sites || []).length,
    foodCount: (content.foods || []).length,
    musicCount: (content.music || []).length,
    hookahCount: (content.hookah || []).length,
    livingCount: (content.living || []).length,
    phraseCount: (content.phrases || []).length
  };
}

export default { chatWithKarim, translateText, getLebanonSummary, loadContent };
