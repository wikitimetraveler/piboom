/**
 * Rose — playful tropical-astrology parlor reader (not astronomy).
 * Development work by David Lane
 */
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { persistConversationTurn } from './langchain-memory.service.js';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';
import '../public/entertainment/js/astrology-zodiac.js';
import '../public/entertainment/js/astrology-arcana.js';

export const GUIDE_NAME = 'Rose';
export const AVATAR_NAME = 'Rose';

function catalog() {
  return globalThis.AstrologyZodiac || null;
}

function arcana() {
  return globalThis.AstrologyArcana || null;
}

function factSheet() {
  const Z = catalog();
  const Arc = arcana();
  if (!Z) return 'No sign catalog loaded.';
  const lines = ['### Twelve tropical signs'];
  for (const sign of Z.SIGNS) {
    lines.push(
      `- ${sign.name} (${sign.glyph}) ${sign.dates}; ${sign.element} / ${sign.modality}; ruler ${sign.ruler}; symbol ${sign.symbol}. ${sign.blurb} Oracle: ${sign.oracle} Gift: ${sign.gift} Watch: ${sign.shadow}`
    );
  }
  lines.push('', '### Elements');
  for (const el of Object.values(Z.ELEMENTS)) {
    lines.push(`- ${el.label}: ${el.motto}`);
  }
  if (Arc?.factSheet) {
    lines.push('', '### Major Arcana (parlor trump cards)');
    lines.push(Arc.factSheet());
  }
  return lines.join('\n');
}

export function buildSystemPrompt(extra = {}) {
  const spread = extra.spread ? `Current three-card spread: Sun ${extra.spread.sun}, Cross ${extra.spread.cross}, Path ${extra.spread.path}.` : '';
  const selected = extra.sign ? `Visitor is looking at ${extra.sign}.` : '';
  const arcanaCard = extra.arcana ? `Visitor flipped Major Arcana: ${extra.arcana}.` : '';
  return `You are ${GUIDE_NAME}, a candlelit parlor reader on the Lane AI Labs astrology page. You read the twelve Western tropical signs and the twenty-two Major Arcana as parlor cards.

## Personality
- Warm, slightly husky, intimate. Late-night reader, not a carnival barker.
- Every reply may be read aloud, so keep answers to two or three short paragraphs. Avoid bullet lists, markdown, and URLs.
- Playful. Never claim this is astronomy, a natal chart, or the night sky. Carl and the Planetarium handle real stars.

## Grounding facts from the page
${factSheet()}

${selected}
${arcanaCard}
${spread}

## Rules
1. Stay with tropical entertainment astrology and parlor Major Arcana. If asked about the real sky, ISS, or planets as astronomy, point them to the Planetarium and Carl.
2. Prefer the facts above. Do not invent cusps, degrees, houses, or birth times.
3. A three-card zodiac draw is Sun (their sign), Cross (tension), Path (lean) from the twelve signs. Major Arcana are a separate twenty-two-card trump gallery — not a full 78-card Rider-Waite encyclopaedia.
4. Do not give medical, legal, or financial advice. Readings are parlor play.
5. If you are unsure, say so in Rose's voice.`;
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

function groundedReply(message) {
  const Z = catalog();
  const Arc = arcana();
  const q = String(message || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!Z) {
    return "The parlor lamp is low. Ask me about a sign once the wheel is lit.";
  }
  if (!q) {
    return "I'm Rose. Give me a birthday, name a sign, or flip a Major Arcana card.";
  }
  if (/\b(sky|planetarium|iss|astronomy|constellation in the real)\b/.test(q)) {
    return "That's Carl's dome, love — the Planetarium. I only read the tropical wheel and the Major Arcana as parlor cards.";
  }
  if (Arc?.ARCANA) {
    let bestArc = null;
    let bestArcScore = 0;
    for (const card of Arc.ARCANA) {
      let score = 0;
      if (q.includes(card.name.toLowerCase()) || q.includes(card.id.replace(/-/g, ' '))) score += 24;
      if (q.includes(card.keyword)) score += 6;
      if (score > bestArcScore) {
        bestArcScore = score;
        bestArc = card;
      }
    }
    if (bestArc && bestArcScore >= 8) {
      return `${bestArc.oracle} Gift: ${bestArc.gift} Watch: ${bestArc.shadow}`;
    }
  }
  let best = null;
  let bestScore = 0;
  for (const sign of Z.SIGNS) {
    const hay = `${sign.name} ${sign.id} ${sign.symbol} ${sign.element} ${sign.askRose}`.toLowerCase();
    let score = 0;
    if (q.includes(sign.name.toLowerCase()) || q.includes(sign.id)) score += 20;
    if (q.includes(String(sign.symbol).toLowerCase())) score += 8;
    if (q.includes(sign.element)) score += 3;
    if (hay.includes(q) && q.length >= 4) score += q.length;
    if (score > bestScore) {
      bestScore = score;
      best = sign;
    }
  }
  if (best && bestScore >= 8) {
    return `${best.oracle} Gift: ${best.gift} Watch: ${best.shadow}`;
  }
  if (/\bsun\b/.test(q) && /\bcross\b/.test(q)) {
    return "Sun is your sign, Cross is the tension, Path is the lean. Deal a reading on the page and I will speak the three cards.";
  }
  return "I can answer from the twelve signs and the Major Arcana while the larger lamp is out. Name a card, or ask for Sun, Cross, and Path.";
}

export async function chatWithRose({
  message,
  history = [],
  userId = 'astrology-anon',
  sessionId = 'astrology-rose',
  context = {},
}) {
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  let reply;
  let source = 'openai';

  if (!openaiKey) {
    reply = groundedReply(message);
    source = 'page-facts';
  } else {
    try {
      const model = new ChatOpenAI({
        modelName: resolveOpenAiAgentModel('ROSE_ASSISTANT_MODEL'),
        temperature: 0.6,
        openAIApiKey: openaiKey,
        maxRetries: 0,
      });
      const messages = [new SystemMessage(buildSystemPrompt(context || {}))];
      for (const turn of history.slice(-8)) {
        const text = String(turn.content || '');
        if (!text) continue;
        if (turn.role === 'user') messages.push(new HumanMessage(text));
        if (turn.role === 'assistant') messages.push(new AIMessage(text));
      }
      messages.push(new HumanMessage(String(message).trim()));
      const response = await model.invoke(messages);
      reply = String(response?.content || '').trim() || groundedReply(message);
    } catch (error) {
      if (isOpenAiQuotaError(error) || error?.status === 429) {
        reply = groundedReply(message);
        source = 'page-facts';
      } else {
        throw error;
      }
    }
  }

  try {
    await persistConversationTurn(userId, sessionId, String(message), reply, 'rose');
  } catch (_) {
    /* memory is optional */
  }

  return { reply, guideName: GUIDE_NAME, source };
}

export function getRoseSummary() {
  const Z = catalog();
  const Arc = arcana();
  return {
    page: 'Rose · twelve signs + Major Arcana',
    guide: GUIDE_NAME,
    signCount: Z?.SIGNS?.length || 0,
    arcanaCount: Arc?.ARCANA?.length || 0,
    elements: Z ? Object.keys(Z.ELEMENTS) : [],
  };
}

export default { chatWithRose, buildSystemPrompt, getRoseSummary, GUIDE_NAME, AVATAR_NAME };
