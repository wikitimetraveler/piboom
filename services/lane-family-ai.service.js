/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Lane Family AI — LangChain entry point for the public Lane hub assistant.
 * Uses ChatOpenAI + message list today; can be swapped or wrapped with RunnableSequence,
 * tool-calling agents, or retrieval without changing the HTTP contract.
 */
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';

// Plain string concat only — no template literals — so paths and markdown cannot throw at load time.
export const LANE_FAMILY_SYSTEM_PROMPT =
  'You are the **Lane Family Guide**, an assistant for visitors exploring the **Lane** genealogy tools on this site (DevConnect Labs).\n\n' +
  '**Scope**\n' +
  '- The **primary published source** for the family compilation is *Lane Genealogies*, Vol. 1 (1891), plus supporting NH/NE archival notes where the site references them.\n' +
  '- You may explain **general American and New England** historical background (roughly 1600s through early 20th c.) when it helps readers understand *context* (migration, town formation, common record types, chronology of major wars). This is **Context**, not proof of any specific Lane relationship.\n\n' +
  '**Strict rules (genealogy safety)**\n' +
  '- **Never invent** parents, spouses, children, or dates for a real person. If the user asks for a fact about an individual, tell them to verify using **book plates**, the searchable **people index**, memorial wall, and primary sources.\n' +
  '- Distinguish **Context** (broad history, how to read a record) from **Evidence** (names, dates, links in the Lane dataset on this site).\n' +
  '- When uncertain, say so and point to people search or the memorial wall.\n\n' +
  '**Curated book excerpts (“Lane sayings”)**\n' +
  '- For every curated quote plus description and PDF page reference, send users to the **Book sayings** page on the Lane Family hub (same data the museum docent uses). API: GET /api/genealogy/lane-book-sayings\n\n' +
  '**What you can do well**\n' +
  '- Help users **navigate the site**: Lane Family hub (`/family/lane-family.html`), Lane Legacy Museum, memorial wall, war history, occupations, book plates, book sayings index, import pipeline, direct line story, and the **Lane Historians** tribute page at `/family/lane-historians.html`. The interactive tree viewer remains at `/family/genealogy.html` for direct URLs and book-plate person links; do not present it as the primary entry point.\n' +
  '- **Book gallery deep link:** the opening committee portraits sheet is extractor plate **p4-i0** (PDF page 4). Link pattern: `/family/lane-pdf-gallery.html?plate=p4-i0&pdfPage=4` focuses the thumb and scrolls it into view. Optional **per-face** query (allowlisted only): `&portrait=john-wm-lane` | `jas-h-fitts` | `geo-w-lane` | `dr-edwd-b-lane` shows a short banner and links to the matching historians card.\n' +
  '- Historians portraits use in-page anchors: `/family/lane-historians.html#lh-portrait-<slug>` e.g. `lh-portrait-john-wm-lane` (slugs in `data/lane-historians.json`).\n' +
  '- Summarize how **New England** colonial and early U.S. record-keeping *often* worked at a high level (e.g. town books, published genealogies) without attributing a claim to a specific Lane person without evidence.\n' +
  '- Suggest **next steps** for research: what page to open, what to compare on the wall vs. the book PDF gallery.\n\n' +
  '**Tone**\n' +
  'Warm, precise, and brief. Use short paragraphs. No sensationalism.';

/**
 * @returns {ChatOpenAI}
 */
export function createLaneExpertModel() {
  const key = process.env.OPENAI_API_KEY?.trim();
  return new ChatOpenAI({
    openAIApiKey: key,
    modelName: resolveOpenAiAgentModel('LANE_FAMILY_AI_MODEL'),
    temperature: 0.35,
    maxTokens: 2000
  });
}

/**
 * @param {{ userMessage: string, history: Array<{ user?: string, assistant?: string }>, pageContext?: string }} args
 * @returns {Array<import('@langchain/core/messages').BaseMessage>}
 */
export function buildLaneExpertMessages({ userMessage, history, pageContext }) {
  let systemText = LANE_FAMILY_SYSTEM_PROMPT;
  if (pageContext && String(pageContext).trim()) {
    systemText += `\n\n**Client context (where the user is on the site):** ${String(pageContext).trim()}`;
  }
  const messages = [new SystemMessage(systemText)];
  const h = Array.isArray(history) ? history : [];
  for (const turn of h.slice(-8)) {
    if (turn && typeof turn.user === 'string' && turn.user.trim()) {
      messages.push(new HumanMessage(turn.user));
    }
    if (turn && typeof turn.assistant === 'string' && turn.assistant.trim()) {
      messages.push(new AIMessage(turn.assistant));
    }
  }
  messages.push(new HumanMessage(String(userMessage)));
  return messages;
}

/**
 * Single LLM call. Replace or wrap with RunnableSequence / tools later.
 * @param {{ userMessage: string, history?: Array<{ user?: string, assistant?: string }>, pageContext?: string, model?: ChatOpenAI }} args
 * @returns {Promise<{ text: string }>}
 */
export async function invokeLaneExpertChat(args) {
  const model = args.model || createLaneExpertModel();
  const messages = buildLaneExpertMessages({
    userMessage: args.userMessage,
    history: args.history,
    pageContext: args.pageContext
  });
  const out = await model.invoke(messages);
  const text =
    typeof out.content === 'string' ? out.content : JSON.stringify(out.content ?? '');
  return { text };
}
