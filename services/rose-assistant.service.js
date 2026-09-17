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
export const SUPPORTED_LANGS = ['en', 'vi'];

function catalog() {
  return globalThis.AstrologyZodiac || null;
}

function arcana() {
  return globalThis.AstrologyArcana || null;
}

function normalizeLang(lang) {
  const value = String(lang || '').toLowerCase().slice(0, 2);
  return value === 'vi' ? 'vi' : 'en';
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

function formatTarotSpread(spread) {
  if (!spread || typeof spread !== 'object') return '';
  const sit = spread.situation?.name || spread.situation;
  const cross = spread.cross?.name || spread.cross;
  const path = spread.path?.name || spread.path;
  const sun = spread.sun?.name || spread.sun;
  if (sit && cross && path) {
    const sunBit = sun ? ` Sun sign ${sun}.` : '';
    return `Current birthday tarot spread:${sunBit} Situation ${sit}, Cross ${cross}, Path ${path}.`;
  }
  if (spread.sun && spread.cross && spread.path) {
    return `Current three-card zodiac spread: Sun ${spread.sun}, Cross ${spread.cross}, Path ${spread.path}.`;
  }
  return '';
}

export function buildSystemPrompt(extra = {}) {
  const language = normalizeLang(extra.lang);
  const languageRule =
    language === 'vi'
      ? 'Answer only in Vietnamese (Tiếng Việt). Keep Rose\'s warm parlor voice. Do not reply in English unless the visitor explicitly asks for English.'
      : 'Answer in English in Rose\'s warm parlor voice.';
  const spread = formatTarotSpread(extra.spread);
  const selected = extra.sign ? `Visitor is looking at ${extra.sign}.` : '';
  const arcanaCard = extra.arcana ? `Visitor flipped tarot card: ${extra.arcana}.` : '';
  const birth =
    extra.birthDate || extra.birthYear
      ? `Visitor birth date context: ${extra.birthDate || ''}${extra.birthYear ? ` (year ${extra.birthYear})` : ''}. Year personalizes the parlor shuffle only — not a natal chart.`
      : '';
  return `You are ${GUIDE_NAME}, a candlelit parlor reader and tarot expert on the Lane AI Labs astrology page. You use and read a full seventy-eight-card Rider–Waite-style deck (twenty-two Major Arcana plus fifty-six Minor Arcana in Wands, Cups, Swords, and Pentacles), and you also read the twelve Western tropical signs as parlor cards.

## Personality
- Warm, slightly husky, intimate. Late-night reader, not a carnival barker.
- Every reply may be read aloud, so keep answers to two or three short paragraphs. Avoid bullet lists, markdown, and URLs.
- Playful. Never claim this is astronomy, a natal chart, or the night sky. Carl and the Planetarium handle real stars.

## Language
${languageRule}

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
${birth}

## Rules
1. Stay with tropical entertainment astrology and the full parlor tarot deck. If asked about the real sky, ISS, or planets as astronomy, point them to the Planetarium and Carl.
2. Prefer the facts above. Do not invent cusps, degrees, houses, or birth times.
3. A birthday reading deals three tarot cards (Situation, Cross, Path) seeded by the birth date, while the Sun sign comes from month and day on the tropical wheel.
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

function groundedReply(message, lang = 'en') {
  const language = normalizeLang(lang);
  const Z = catalog();
  const Arc = arcana();
  const q = String(message || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!Z) {
    return language === 'vi'
      ? 'Đèn phòng khách đang yếu. Hỏi tôi về một cung khi bánh xe sáng.'
      : 'The parlor lamp is low. Ask me about a sign once the wheel is lit.';
  }
  if (!q) {
    return language === 'vi'
      ? 'Tôi là Rose. Cho tôi ngày sinh, gọi tên một cung, hoặc lật một lá tarot — tôi dạy cách dùng cả bộ bài.'
      : "I'm Rose. Give me a birthday, name a sign, or flip a tarot card — I can teach you how to use the full deck.";
  }
  if (/\b(sky|planetarium|iss|astronomy|constellation in the real|thiên văn|đài thiên văn)\b/.test(q)) {
    return language === 'vi'
      ? 'Đó là mái vòm của Carl, yêu ơi — Đài thiên văn. Tôi đọc bánh xe nhiệt đới và bộ tarot như bài phòng khách.'
      : "That's Carl's dome, love — the Planetarium. I read the tropical wheel and the full tarot deck as parlor cards.";
  }
  if (/\b(how (do|to) (i )?(use|read|shuffle|draw)|teach me|spread|how does tarot|xáo|rút bài|dùng bộ bài)\b/.test(q)) {
    return language === 'vi'
      ? 'Xáo với một câu hỏi rõ, cắt một lần, rút xuôi cho vui phòng khách. Một hàng đơn giản là Tình huống, Giao cắt, và Đường đi. Ẩn chính nói chương lớn; ẩn phụ nói thời tiết ngày — Gậy cho lửa công việc, Cốc cho cảm xúc, Kiếm cho trí óc, Tiền cho thân và xu. Lật một lá trên trang và tôi đọc cùng bạn.'
      : 'Shuffle with one clear question, cut once, draw upright for parlor play. A simple line is Situation, Cross, and Path. Majors speak the big chapter; minors speak the day\'s weather — Wands for work-fire, Cups for feeling, Swords for mind, Pentacles for body and coin. Flip a card on the page and I\'ll read it with you.';
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
    if (bestArc && bestArcScore >= 12) {
      if (language === 'vi') {
        return `${bestArc.oracle} Quà: ${bestArc.gift} Cẩn thận: ${bestArc.shadow}`;
      }
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
    if (language === 'vi') {
      return `${best.oracle} Quà: ${best.gift} Cẩn thận: ${best.shadow}`;
    }
    return `${best.oracle} Gift: ${best.gift} Watch: ${best.shadow}`;
  }
  if (/\b(sun|situation)\b/.test(q) && /\bcross\b/.test(q)) {
    return language === 'vi'
      ? 'Mặt trời là cung của bạn; trải bài sinh nhật là Tình huống, Giao cắt, và Đường đi bằng lá tarot. Nhờ Rose đọc trên trang và tôi sẽ nói ba lá.'
      : 'Sun is your sign; the birthday draw deals Situation, Cross, and Path as tarot cards. Deal a reading on the page and I will speak the three cards.';
  }
  return language === 'vi'
    ? 'Tôi có thể trả lời từ mười hai cung và bộ tarot khi đèn lớn tắt. Gọi tên một lá, hỏi cách xáo, hoặc nhờ trải Tình huống, Giao cắt, Đường đi.'
    : 'I can answer from the twelve signs and the full tarot deck while the larger lamp is out. Name a card, ask how to shuffle, or ask for Situation, Cross, and Path.';
}

export async function chatWithRose({
  message,
  history = [],
  userId = 'astrology-anon',
  sessionId = 'astrology-rose',
  context = {},
  lang = 'en',
}) {
  const language = normalizeLang(lang || context?.lang);
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  let reply;
  let source = 'openai';
  const promptContext = { ...(context || {}), lang: language };

  if (!openaiKey) {
    reply = groundedReply(message, language);
    source = 'page-facts';
  } else {
    try {
      const model = new ChatOpenAI({
        modelName: resolveOpenAiAgentModel('ROSE_ASSISTANT_MODEL'),
        temperature: 0.6,
        openAIApiKey: openaiKey,
        maxRetries: 0,
      });
      const messages = [new SystemMessage(buildSystemPrompt(promptContext))];
      for (const turn of history.slice(-8)) {
        const text = String(turn.content || '');
        if (!text) continue;
        if (turn.role === 'user') messages.push(new HumanMessage(text));
        if (turn.role === 'assistant') messages.push(new AIMessage(text));
      }
      messages.push(new HumanMessage(String(message).trim()));
      const response = await model.invoke(messages);
      reply = String(response?.content || '').trim() || groundedReply(message, language);
    } catch (error) {
      if (isOpenAiQuotaError(error) || error?.status === 429) {
        reply = groundedReply(message, language);
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

  return { reply, guideName: GUIDE_NAME, source, lang: language };
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
    languages: SUPPORTED_LANGS,
  };
}

export default {
  chatWithRose,
  buildSystemPrompt,
  getRoseSummary,
  GUIDE_NAME,
  AVATAR_NAME,
  SUPPORTED_LANGS,
  normalizeLang,
};
