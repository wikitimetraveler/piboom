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

  lines.push('', '### Happening now — dated 2026 local listings');
  for (const ev of content.events || []) {
    lines.push(
      `- ${ev.start || ''} ${pickEn(ev.title)} @ ${pickEn(ev.place)} [${ev.series || ev.category || ''}]: ${pickEn(ev.copy)} Source: ${ev.sourceName || ev.source || ''}`
    );
  }

  lines.push(
    '',
    '### Geography & museum notes',
    '- Map hub is Buhl Farm Park, Hermitage / Shenango Valley, PA — deeded 1 Nov 1915 to F.H. Buhl Trustees for $1 + endowment; free nine-hole golf; Lake Julia; Casino; ~270 acres.',
    '- Erie Extension (Beaver & Erie) Canal: ~136 miles Beaver→Erie, ~137 locks, opened 1844, abandoned early 1870s; Sharpsville Lock 10 = surviving lock remnant (~7 ft lift).',
    '- Frank H. Buhl (1848–1918): Buhl Steel 1896; Sharon Steel Works South Sharon Feb 1900; sold ~1902; Magic City → Farrell 1912; late-1920s ~10,000 mill workers; Sharon Steel bankruptcies 1987/1992; later NLMK on footprint.',
    '- Amish: New Wilmington / Volant Lawrence–Mercer settlement from Mifflin County ~1847 (Yoder/Zook land buys); not Lancaster; burnt-orange/brown buggy tops; etiquette — no photographing people.',
    '- Music: Tony Butala b. Sharon 20 Nov 1940 — Lettermen 1958, “Way You Look Tonight” 1961; Vocal Group HoF museum Sharon ~1998. Trent Reznor = Mercer borough / Mercer HS jazz, then NIN — same county, not Sharon childhood. Related OH: Cedars Lounge at 23 N. Hazel (1975, Tommy Simon) → Cedars West End 706 Steel St (2013); same downtown block — State Theater Tomorrow Club (~1973) → Youngstown Agora (31 Dec 1978–23 July 1982) → Star Theatre mid-1980s at 213 W Federal; Muddy Waters Tomorrow Club 25 June 1978 and Agora 9 March 1980; Spyro Gyra Star Theatre 20 Oct 1985; Outlaws Tomorrow Club 1976–77 (three) + Star Theatre; The Godz (Ohio) Tomorrow Youngstown 21 May 1978; demolished 2008, facade remains.',
    '- Sports: Sharon Tigers vs Farrell Steelers District 10; Steel Bowl football rivalry (multi-decade; gap ~2014–2021); Buhl original athletic field + free golf.',
    '- Youngstown: no resident LCN family; Cleveland (Carabbias) vs Pittsburgh (Prato/Naples/Strollo); SEP Mar 1963 Crime Town U.S.A.; Greene bomb 6 Oct 1977; Charlie Carabbia missing Dec 1980 (Strollo testimony); Black Monday 19 Sept 1977 Campbell Works ~5,000 jobs; ~50,000 valley jobs lost within ~5 years.',
    '- Organized-crime gallery: Context vs Evidence; published record and courts — never rumor, never private addresses, never true-crime tourism.',
    '- Food landmarks: Quaker Steak & Lube original (Chestnut St, Sharon, PA, 1974); Tony’s Pizza & Pub (628 Stambaugh Ave, Sharon, PA 16146; tonyspizzaandpub.com; 724-347-3323; official site claims 70+ years serving Shenango Valley); Luigi’s Pizza (Hermitage / E State).',
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
- Western Pennsylvania: Shenango Valley steel (Sharon, Farrell, Sharpsville), Buhl philanthropy, New Wilmington / Volant Amish geography, Sharon–Farrell sports, Lettermen / Butala, Mercer County music (Reznor), WPIC / local music institutions, valley food landmarks, and the Happening now calendar of dated 2026 public events (Buhl concerts, Buhl Day, Sharon River Market, Acoustic Sundays, Rockin’ on the Rails).
- Eastern Ohio: Youngstown and the Mahoning Valley industrial belt, Cedars Lounge / Cedars West End and the Tomorrow Club / Youngstown Agora (State Theater) downtown music lineage, cross-border labor markets, and the public history of organized crime — especially the 1970s Cleveland–Pittsburgh war over Valley rackets — as Context and Evidence, not spectacle.
- You may add well-established regional geography (Pittsburgh orbit, Cleveland family histories as published secondary sources, canal / steel corridor) when it helps the visitor, and say plainly when uncertain.

## Language
Answer in English.

## Grounding facts from the page
${factSheet(content)}

## Rules
1. Prefer the facts above. They are what the visitor is looking at on screen.
2. For Youngstown / mob questions: stay scholastic. Distinguish media nicknames (for example “Crimetown”) from proven court history. Do not invent names of living private individuals, home addresses, or unverified “who ran what” folklore.
3. Do not invent prices, opening hours, phone numbers, or private addresses. If unsure, say so. For “what’s on tonight / this week,” use only the Happening now listings and tell the visitor to confirm on the official page (weather can cancel a park night).
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
    livingCount: (content.living || []).length,
    eventCount: (content.events || []).length
  };
}

export default { chatWithDavid, getShenangoSummary, loadContent };
