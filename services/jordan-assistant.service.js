/**
 * Rami — Jordan history, food, music and argileh expert assistant
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
const CONTENT_PATH = path.join(__dirname, '../public/jordan/data/jordan-content.json');
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

  lines.push('', '### Argileh (hookah)');
  for (const entry of content.hookah || []) {
    lines.push(`- ${entry.name?.en}: ${entry.tagline?.en}. ${entry.history?.en}`);
  }

  lines.push('', '### Living Jordan (people, badia, crafts)');
  for (const entry of content.living || []) {
    lines.push(`- ${entry.name?.en}: ${entry.tagline?.en}. ${entry.history?.en}`);
  }

  lines.push('', '### Everyday Jordanian Arabic');
  for (const phrase of content.phrases || []) {
    lines.push(`- ${phrase.ar} (${phrase.translit}) = ${phrase.en}`);
  }

  return lines.join('\n');
}

function buildSystemPrompt(content, lang) {
  const languageRule =
    lang === 'ar'
      ? `## Language
Answer ONLY in Arabic. Use clear Modern Standard Arabic with Jordanian colloquial phrasing where it sounds natural (e.g. أهلاً وسهلاً، يعطيك العافية). Do not answer in English. Do not add transliteration unless asked.`
      : `## Language
Answer in English. You may quote Arabic terms with a short transliteration in brackets, for example mansaf (منسف).`;

  return `You are ${content.guide?.name?.en || 'Rami'}, a Jordanian historian and guide for the "Jordan — Eras of the Kingdom" page.

## Personality
- Warm, precise, and proud of Jordan without being a tourism brochure.
- Every reply is read aloud by text to speech, so keep answers to two or three short paragraphs at most and avoid bullet lists, markdown symbols and URLs.
- Hospitality first: greet a first question, and offer one natural follow-up thread at the end.

${languageRule}

## Grounding facts from the page
${factSheet(content)}

## Rules
1. Prefer the facts above. They are what the visitor is looking at on screen.
2. You may add well-established general history beyond this list, but say plainly when something is contested, legendary, or an origin story that several countries claim (hummus, falafel, dabke).
3. Do not invent dates, archaeological finds, prices, opening hours, or attributions. If you are unsure, say so.
4. Be careful and respectful about religion, the Palestinian and Syrian communities in Jordan, and regional politics. Describe, do not editorialise.
5. Dishes shared across the Levant (knafeh from Nablus, musakhan, hummus) should be described honestly as regional, not claimed as exclusively Jordanian.
6. When a place is mentioned, name the governorate or nearest city so the visitor can find it on the map.`;
}

function pickLocalized(value, lang) {
  if (!value || typeof value !== 'object') return String(value || '');
  return String(value[lang] || value.en || value.ar || '').trim();
}

function isOpenAiQuotaError(error) {
  const code = String(error?.code || error?.error?.code || '').toLowerCase();
  const type = String(error?.type || error?.error?.type || '').toLowerCase();
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === 'credit_balance_exhausted' ||
    code === 'insufficient_quota' ||
    type === 'insufficient_quota' ||
    msg.includes('credit_balance_exhausted') ||
    msg.includes('insufficient_quota') ||
    msg.includes('no credits remaining') ||
    msg.includes('rate limit')
  );
}

/**
 * Offline/page-grounded answer when OpenAI is unavailable (quota, outage).
 * Matches sites, eras, food, music, living, and phrases from jordan-content.json.
 */
function groundedReply(content, message, lang) {
  const q = String(message || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!q) {
    return lang === 'ar'
      ? 'أهلاً وسهلاً. اسألني عن موقع أو طبق أو عبارة من الصفحة.'
      : 'Ahlan. Ask me about a place, dish, or phrase from the page.';
  }

  const buckets = [
    ...(content.sites || []).map((item) => ({ kind: 'site', item })),
    ...(content.eras || []).map((item) => ({ kind: 'era', item })),
    ...(content.foods || []).map((item) => ({ kind: 'food', item })),
    ...(content.music || []).map((item) => ({ kind: 'music', item })),
    ...(content.hookah || []).map((item) => ({ kind: 'hookah', item })),
    ...(content.living || []).map((item) => ({ kind: 'living', item }))
  ];

  let best = null;
  let bestScore = 0;
  for (const entry of buckets) {
    const item = entry.item;
    const names = [item.name?.en, item.name?.ar, item.title?.en, item.title?.ar, item.place?.en, item.place?.ar]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    let score = 0;
    for (const name of names) {
      if (!name) continue;
      if (q.includes(name) || name.includes(q)) score += name.length;
      for (const token of name.split(/\s+/)) {
        if (token.length >= 4 && q.includes(token)) score += token.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (best && bestScore >= 4) {
    const item = best.item;
    const name = pickLocalized(item.name || item.title, lang);
    const place = pickLocalized(item.place, lang);
    const body =
      pickLocalized(item.narration, lang) ||
      pickLocalized(item.history, lang) ||
      pickLocalized(item.blurb, lang) ||
      pickLocalized(item.copy, lang) ||
      pickLocalized(item.tagline, lang);
    if (lang === 'ar') {
      const where = place ? ` في ${place}.` : '.';
      return `بخصوص ${name}${where} ${body}`.replace(/\s+/g, ' ').trim();
    }
    const where = place ? ` in ${place}.` : '.';
    return `About ${name}${where} ${body}`.replace(/\s+/g, ' ').trim();
  }

  for (const phrase of content.phrases || []) {
    const hay = `${phrase.ar || ''} ${phrase.en || ''} ${phrase.translit || ''}`.toLowerCase();
    if (hay && (q.includes(String(phrase.en || '').toLowerCase()) || q.includes(String(phrase.translit || '').toLowerCase()))) {
      return lang === 'ar'
        ? `${phrase.ar} — ${phrase.en}`
        : `${phrase.ar} (${phrase.translit}) means “${phrase.en}.”`;
    }
  }

  return lang === 'ar'
    ? 'أجاوبك الآن من محتوى الصفحة فقط لأن خدمة الذكاء متوقفة مؤقتاً. اسأل عن البتراء أو المنسف أو جرش أو عبارة أردنية.'
    : 'I can answer from the page facts right now while the AI service is unavailable. Try Petra, mansaf, Jerash, or a Jordanian phrase.';
}

/**
 * Ask Rami a question about Jordan.
 * @param {{message: string, history?: Array, lang?: string, userId?: string, sessionId?: string}} params
 */
export async function chatWithRami({
  message,
  history = [],
  lang = 'en',
  userId = 'jordan-anon',
  sessionId = 'jordan-rami'
}) {
  const language = normalizeLang(lang);
  const content = await loadContent();
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();

  let reply;
  let source = 'openai';

  if (!openaiKey) {
    reply = groundedReply(content, message, language);
    source = 'page-facts';
  } else {
    try {
      const model = new ChatOpenAI({
        modelName: resolveOpenAiAgentModel('JORDAN_ASSISTANT_MODEL'),
        temperature: 0.5,
        openAIApiKey: openaiKey,
        // Quota/rate-limit errors should fall back to page facts quickly, not retry for minutes.
        maxRetries: 0
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
      reply = String(response?.content || '').trim() || fallback;
    } catch (error) {
      if (isOpenAiQuotaError(error) || error?.status === 429) {
        console.warn('Rami falling back to page facts (OpenAI unavailable):', error?.message || error);
        reply = groundedReply(content, message, language);
        source = 'page-facts';
      } else {
        throw error;
      }
    }
  }

  try {
    await persistConversationTurn(userId, sessionId, String(message), reply, 'rami');
  } catch (_) {
    /* memory is optional */
  }

  return {
    reply,
    lang: language,
    guideName: content.guide?.name?.[language] || 'Rami',
    source
  };
}

/**
 * Translate arbitrary page text between English and Jordanian Arabic.
 * Used for anything not already authored bilingually (AI answers, user notes).
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
      ? 'Translate the text into natural Jordanian Arabic suitable for being read aloud. Keep proper nouns. Return only the translation.'
      : 'Translate the text into natural English suitable for being read aloud. Keep proper nouns. Return only the translation.';

  const model = new ChatOpenAI({
    modelName: resolveOpenAiAgentModel('JORDAN_ASSISTANT_MODEL'),
    temperature: 0.2,
    openAIApiKey: openaiKey
  });

  const response = await model.invoke([new SystemMessage(instruction), new HumanMessage(source)]);
  return {
    text: String(response?.content || '').trim() || source,
    lang: target
  };
}

export async function getJordanSummary() {
  const content = await loadContent();
  return {
    page: content.brand?.name?.en || 'Jordan — Eras of the Kingdom',
    guide: content.guide?.name?.en || 'Rami',
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

export default { chatWithRami, translateText, getJordanSummary, loadContent };
