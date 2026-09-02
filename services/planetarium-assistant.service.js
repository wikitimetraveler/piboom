/**
 * Carl — AstroAI planetarium guide (tonight's sky, constellations, planets).
 * Development work by David Lane
 */
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { persistConversationTurn } from './langchain-memory.service.js';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';

export const GUIDE_NAME = 'Carl';
export const AVATAR_NAME = 'Zed';

export function buildSystemPrompt(skyContext = {}) {
  const ctx = skyContext && typeof skyContext === 'object' ? skyContext : {};
  const lines = [];
  if (ctx.observerLabel) lines.push(`Observer: ${ctx.observerLabel} (${ctx.lat}, ${ctx.lon})`);
  if (ctx.dateLocal) lines.push(`Sky time (local): ${ctx.dateLocal}`);
  if (ctx.facing) lines.push(`Facing: ${ctx.facing}`);
  if (ctx.moonPhase) lines.push(`Moon phase: ${ctx.moonPhase}`);
  if (ctx.caption) lines.push(`Sky summary: ${ctx.caption}`);
  if (Array.isArray(ctx.planets) && ctx.planets.length) {
    lines.push(
      'Planets up: ' +
        ctx.planets.map((p) => `${p.name} ${p.alt}° alt / ${p.az}° az`).join('; ')
    );
  }
  if (Array.isArray(ctx.asterisms) && ctx.asterisms.length) {
    lines.push('Asterisms drawn: ' + ctx.asterisms.join(', '));
  }

  const skyBlock = lines.length ? lines.join('\n') : 'No live sky context — answer generally for mid-northern latitudes.';

  return `You are Carl, AstroAI — a friendly astronomy educator on the DevConnect Labs planetarium page.

## Personality
- Warm, curious, precise. You sound like a patient observatory docent, not a textbook.
- Every reply is read aloud (and may lip-sync on the Zed HeyGen avatar), so use two or three short paragraphs max.
- No markdown bullets, hashes, or URLs. Plain spoken English.

## Live sky context (ground truth for this session)
${skyBlock}

## Expertise
- Bright stars, asterisms (Orion, Big Dipper, Cassiopeia, Summer Triangle, Scorpius), Milky Way band, naked-eye planets.
- Altitude/azimuth, twilight, moon phases, seasonal sky changes, Jonathan Homer Lane / Hampton Falls default lore when relevant.
- Distinguish documented fact from folklore. Say when something is approximate (low-precision ephemeris on this page).

## Rules
1. Prefer the live sky context above when the visitor asks "what's up tonight" or "what am I seeing".
2. If they change date/time in the UI, they may ask again — trust the newest context in their message if provided.
3. Invite one natural follow-up (e.g. "Want Orion's belt or Jupiter's moons?").
4. You appear alongside the alien presenter Zed on video — you are Carl the voice/expert; Zed is the face.`;
}

export async function chatWithCarl({
  message,
  history = [],
  userId = 'planetarium-guest',
  sessionId = 'planetarium-carl',
  skyContext = {},
}) {
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!openaiKey) {
    const err = new Error('OPENAI_API_KEY is not configured');
    err.code = 'OPENAI_NOT_CONFIGURED';
    throw err;
  }

  const model = new ChatOpenAI({
    modelName: resolveOpenAiAgentModel('PLANETARIUM_ASSISTANT_MODEL'),
    temperature: 0.55,
    openAIApiKey: openaiKey,
  });

  const messages = [new SystemMessage(buildSystemPrompt(skyContext))];
  for (const turn of history.slice(-8)) {
    if (turn.role === 'user') messages.push(new HumanMessage(String(turn.content || '')));
    if (turn.role === 'assistant') messages.push(new AIMessage(String(turn.content || '')));
  }
  messages.push(new HumanMessage(String(message).trim()));

  const response = await model.invoke(messages);
  const reply =
    String(response?.content || '').trim() ||
    'Give me a second — a satellite just crossed my field. Ask again?';

  try {
    await persistConversationTurn(userId, sessionId, String(message), reply, 'carl');
  } catch (_) {
    /* memory optional */
  }

  return {
    reply,
    guideName: GUIDE_NAME,
    avatarName: AVATAR_NAME,
  };
}

export default {
  GUIDE_NAME,
  AVATAR_NAME,
  buildSystemPrompt,
  chatWithCarl,
};
