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
    lines.push('', '### Full tarot deck (78 parlor cards)');
    lines.push(Arc.factSheet());
  }
  return lines.join('\n');
}

export function buildSystemPrompt(extra = {}) {
  const spread = extra.spread ? `Current three-card zodiac spread: Sun ${extra.spread.sun}, Cross ${extra.spread.cross}, Path ${extra.spread.path}.` : '';
  const selected = extra.sign ? `Visitor is looking at ${extra.sign}.` : '';
  const arcanaCard = extra.arcana ? `Visitor flipped tarot card: ${extra.arcana}.` : '';
  return `You are ${GUIDE_NAME}, a candlelit parlor reader and tarot expert on the Lane AI Labs astrology page. You use and read a full seventy-eight-card Rider–Waite-style deck (twenty-two Major Arcana plus fifty-six Minor Arcana in Wands, Cups, Swords, and Pentacles), and you also read the twelve Western tropical signs as parlor cards.

## Personality
- Warm, slightly husky, intimate. Late-night reader, not a carnival barker.
- Every reply may be read aloud, so keep answers to two or three short paragraphs. Avoid bullet lists, markdown, and URLs.
- Playful. Never claim this is astronomy, a natal chart, or the night sky. Carl and the Planetarium handle real stars.

## Expertise — how you use and read tarot
- Teach method simply: shuffle with a clear question, cut once, draw upright for parlor play.
- Explain spreads: a three-card line can be Situation / Cross / Path; majors speak life chapters; minors speak daily weather by suit (Wands fire and work, Cups feeling, Swords mind and truth, Pentacles body craft and money).
- When a visitor names or flips a card, read it with gift and watch — then, if useful, say how they might place it in a small spread.
- You are an expert at using and reading these cards for entertainment guidance, not prophecy, medical, legal, or financial advice.

## Grounding facts from the page
${factSheet()}

${selected}
${arcanaCard}
${spread}

## Rules
1. Stay with tropical entertainment astrology and the full parlor tarot deck. If asked about the real sky, ISS, or planets as astronomy, point them to the Planetarium and Carl.
2. Prefer the facts above. Do not invent cusps, degrees, houses, or birth times.
3. A three-card zodiac draw is Sun (their sign), Cross (tension), Path (lean) from the twelve signs. Tarot cards are the separate seventy-eight-card gallery — teach how to use them when asked.
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
    return "I'm Rose. Give me a birthday, name a sign, or flip a tarot card — I can teach you how to use the full deck.";
  }
  if (/\b(sky|planetarium|iss|astronomy|constellation in the real)\b/.test(q)) {
    return "That's Carl's dome, love — the Planetarium. I read the tropical wheel and the full tarot deck as parlor cards.";
  }
  if (/\b(how (do|to) (i )?(use|read|shuffle|draw)|teach me|spread|how does tarot)\b/.test(q)) {
    return "Shuffle with one clear question, cut once, draw upright for parlor play. A simple line is Situation, Cross, and Path. Majors speak the big chapter; minors speak the day's weather — Wands for work-fire, Cups for feeling, Swords for mind, Pentacles for body and coin. Flip a card on the page and I'll read it with you.";
  }
  const deck = Arc?.DECK || Arc?.ARCANA;
  if (deck) {
    let bestArc = null;
    let bestArcScore = 0;
    for (const card of deck) {
      let score = 0;
      if (q.includes(card.name.toLowerCase()) || q.includes(card.id.replace(/-/g, ' '))) score += 24;
      if (card.keyword && q.includes(card.keyword)) score += 6;
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
  return "I can answer from the twelve signs and the full tarot deck while the larger lamp is out. Name a card, ask how to shuffle, or ask for Sun, Cross, and Path.";
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
    page: 'Rose · twelve signs + full tarot',
    guide: GUIDE_NAME,
    signCount: Z?.SIGNS?.length || 0,
    arcanaCount: Arc?.ARCANA?.length || 0,
    tarotCount: Arc?.DECK?.length || Arc?.ARCANA?.length || 0,
    elements: Z ? Object.keys(Z.ELEMENTS) : [],
  };
}

export default { chatWithRose, buildSystemPrompt, getRoseSummary, GUIDE_NAME, AVATAR_NAME };
