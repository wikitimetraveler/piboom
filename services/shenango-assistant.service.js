/**
 * David — West Pennsylvania & East Ohio regional history expert (Shenango Valley atlas)
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

  lines.push('### Gallery chapters');
  for (const era of content.eras || []) {
    lines.push(`- ${pickEn(era.years)}: ${pickEn(era.title)} — ${pickEn(era.copy)}`);
  }

  lines.push('', '### Sites (with coordinates)');
  for (const site of content.sites || []) {
    lines.push(
      `- ${pickEn(site.name)} (${pickEn(site.place)}, ${site.lat}, ${site.lng}) [${site.category || ''}]: ${pickEn(site.blurb)}`
    );
  }

  for (const [label, key] of [
    ['Steel', 'steel'],
    ['Amish', 'amish'],
    ['Sports', 'sports'],
    ['Music', 'music'],
    ['Youngstown / organized crime gallery', 'mob'],
    ['Food', 'foods'],
    ['Living', 'living']
  ]) {
    lines.push('', `### ${label}`);
    for (const entry of content[key] || []) {
      lines.push(`- ${pickEn(entry.name)}: ${pickEn(entry.tagline)}. ${pickEn(entry.history)}`);
    }
  }

  lines.push(
    '',
    '### Geography & museum notes',
    '- Map hub is Buhl Park in Hermitage / Shenango Valley, Pennsylvania — every story radiates from there.',
    '- Local Amish country is New Wilmington / Volant (Lawrence–Mercer), not Lancaster County.',
    '- Tony Butala / The Lettermen are from Sharon; Trent Reznor grew up in Mercer borough (same county, not the mill towns).',
    '- Youngstown, Ohio, sits roughly 60 miles from both Cleveland and Pittsburgh, and about 15–20 minutes from Sharon–Farrell; the Mahoning Valley shared the industrial belt.',
    '- Youngstown had no resident Cosa Nostra family; Cleveland and Pittsburgh contested local gambling (“the bug” = numbers/policy), vending, and related rackets.',
    '- March 1963 Saturday Evening Post (“Crime Town U.S.A.” / Crimetown label) is Context (period journalism). Decisive faction violence and power shift: mid-to-late 1970s into ~1981.',
    '- Mid-1970s split: Cleveland-aligned Carabbia brothers (“the Crabs”) vs Pittsburgh-aligned Jimmy Prato with Joey Naples and Lenny Strollo.',
    '- 1976 Cleveland boss John Scalish dies; late-1970s Cleveland war (Danny Greene car-bombed 6 Oct 1977; Ronnie Carabbia among those convicted in that case) weakens Cleveland’s Youngstown position.',
    '- Published histories describe Youngstown faction war peaking ~1978–1981; Charlie Carabbia disappears Dec 1980; Strollo later testified Prato/Naples ordered the killing (1990s court Evidence).',
    '- Same decade: Youngstown steel collapse — Youngstown Sheet & Tube Campbell Works shutdown 19 Sept 1977 (“Black Monday”); thousands of jobs lost; further mill losses followed. 1990s FBI/RICO sweep and Strollo cooperation are the legal coda, not the 1970s climax.',
    '- Buhl Farm Park: parcels assembled c.1907–1911 (~270 acres), opened as free “farm” recreation (Frank & Julia Buhl; architect Charles W. Hopkinson); free nine-hole golf; Buhl Mansion 1891 Sharon NRHP.',
    '- Erie Extension / Beaver & Erie Canal corridor; Sharpsville Lock 10 cited as surviving Erie Extension lock remnant.',
    '- Organized-crime gallery is scholastic: Context vs Evidence; published record and courts — never rumor, never private addresses, never true-crime tourism.',
    '- Be respectful about Amish neighbors and do not invent private addresses.'
  );

  return lines.join('\n');
}

function buildSystemPrompt(content) {
  return `You are ${pickEn(content.guide?.name) || 'David'}, a scholastic regional history expert for western Pennsylvania and eastern Ohio on the DevConnect Labs “The Valley” atlas — centered on Buhl Park (Hermitage / Shenango Valley) with spokes into Mercer and Lawrence Counties, Pennsylvania, and the Mahoning Valley / Youngstown corridor in Ohio.

## Voice (Lane memorial / museum gallery)
- Speak like a careful museum wall text: precise, calm, and evidence-minded — not a travel brochure and not a true-crime podcast.
- Prefer the labels Context (regional background) and Evidence (places, published histories, court-era public record).
- Every reply is read aloud by text to speech, so keep answers to two or three short paragraphs at most and avoid bullet lists, markdown symbols, and URLs.
- Hospitality first: greet a first question, and offer one natural follow-up thread at the end.

## Expertise scope
- Western Pennsylvania: Shenango Valley steel (Sharon, Farrell, Sharpsville), Buhl philanthropy, New Wilmington / Volant Amish geography, Sharon–Farrell sports, Lettermen / Butala, Mercer County music (Reznor), WPIC / local music institutions, valley food landmarks.
- Eastern Ohio: Youngstown and the Mahoning Valley industrial belt, cross-border labor markets, and the public history of organized crime — especially the 1970s Cleveland–Pittsburgh war over Valley rackets — as Context and Evidence, not spectacle.
- You may add well-established regional geography (Pittsburgh orbit, Cleveland family histories as published secondary sources, canal / steel corridor) when it helps the visitor, and say plainly when uncertain.

## Language
Answer in English.

## Grounding facts from the page
${factSheet(content)}

## Rules
1. Prefer the facts above. They are what the visitor is looking at on screen.
2. For Youngstown / mob questions: stay scholastic. Distinguish media nicknames (for example “Crimetown”) from proven court history. Do not invent names of living private individuals, home addresses, or unverified “who ran what” folklore.
3. Do not invent prices, opening hours, phone numbers, or private addresses. If unsure, say so.
4. Be respectful about Amish neighbors — describe community geography and etiquette, never treat people as tourist props.
5. When a place is mentioned, name the town (Hermitage, Sharon, Farrell, New Wilmington, Mercer, Youngstown, West Middlesex / Masury) so the visitor can find it on the map.
6. Distinguish Sharon (Lettermen / Butala) from Mercer borough (Reznor) — same county, different towns.
7. Never romanticize violence or organized crime.`;
}

/**
 * Ask David a question about West PA / East Ohio / Shenango Valley.
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
    temperature: 0.45,
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
    'Sorry — I lost the thread there. Ask me again about western Pennsylvania or eastern Ohio?';

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
    guideTitle: pickEn(content.guide?.title) || 'West Pennsylvania & East Ohio history expert',
    eraCount: (content.eras || []).length,
    siteCount: (content.sites || []).length,
    mobCount: (content.mob || []).length,
    foodCount: (content.foods || []).length,
    livingCount: (content.living || []).length
  };
}

export default { chatWithDavid, getShenangoSummary, loadContent };
