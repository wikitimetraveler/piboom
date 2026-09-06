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
  if (ctx.twilight) lines.push(`Twilight: ${ctx.twilight}`);
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
  if (ctx.selection && typeof ctx.selection === 'object') {
    const s = ctx.selection;
    const bits = [
      s.type || 'object',
      s.name || s.id,
      Number.isFinite(s.alt) ? `${s.alt}° alt` : null,
      Number.isFinite(s.az) ? `${s.az}° az` : null,
    ].filter(Boolean);
    lines.push('Selected on dome: ' + bits.join(' · '));
  }
  if (ctx.refreshedAt) lines.push(`Context stamped: ${ctx.refreshedAt}`);

  const world = ctx.world && typeof ctx.world === 'object' ? ctx.world : null;
  const worldId = ctx.worldId || world?.id || null;
  const worldLines = [];
  if (world) {
    worldLines.push(`Open world page: ${world.name || world.id}${world.kicker ? ' — ' + world.kicker : ''}`);
    if (world.lede) worldLines.push(`Lede: ${world.lede}`);
    if (world.physical && typeof world.physical === 'object') {
      const p = world.physical;
      worldLines.push(
        `Physical: radius ${p.radiusKm} km; day ${p.dayHours} h; year ${p.yearDays} d; moons ${p.moons}; tilt ${p.tiltDeg}°`
      );
    }
    if (world.landmark && typeof world.landmark === 'object') {
      worldLines.push(
        `Landmark: ${world.landmark.label}` +
          (world.landmark.blurb ? ` — ${world.landmark.blurb}` : '')
      );
    }
    if (Array.isArray(world.missions) && world.missions.length) {
      worldLines.push(
        'Missions: ' +
          world.missions
            .map((m) => `${m.name} (${m.year})${m.note ? ': ' + m.note : ''}`)
            .join('; ')
      );
    }
    if (Array.isArray(world.researchNotes) && world.researchNotes.length) {
      worldLines.push('Research notes: ' + world.researchNotes.join(' '));
    }
    if (world.folklore) worldLines.push(`Folklore (label as folklore): ${world.folklore}`);
    if (world.carlFocus) worldLines.push(`Guide focus: ${world.carlFocus}`);
    if (world.credit) worldLines.push(`Imagery credit: ${world.credit}`);
  } else if (worldId) {
    worldLines.push(`Open world page id: ${worldId}`);
  }

  const skyBlock = lines.length ? lines.join('\n') : 'No live sky context — answer generally for mid-northern latitudes.';
  const worldBlock = worldLines.length
    ? worldLines.join('\n')
    : '';

  return `You are Carl, AstroAI — a friendly astronomy educator on the DevConnect Labs planetarium.

## Personality
- Warm, curious, precise. You sound like a patient observatory docent, not a textbook.
- Every reply is read aloud (and may lip-sync on the Zed HeyGen avatar), so use two or three short paragraphs max.
- No markdown bullets, hashes, or URLs. Plain spoken English.

## Live sky context (ground truth for this session)
${skyBlock}
${worldBlock ? `\n## Open planet world dossier (prefer these facts on the world page)\n${worldBlock}\n` : ''}
## Expertise
- Bright stars, IAU constellations, Milky Way band, naked-eye planets (Mercury through Neptune) with astronomy-engine ephemeris.
- Planet world dossiers (missions, landmarks, physical facts) when the visitor is on a body home page.
- Catalog objects (Messier / named stars) the visitor may have selected on the dome.
- Altitude/azimuth, twilight, moon phases, seasonal sky changes, Jonathan Homer Lane / Hampton Falls default lore when relevant.
- Distinguish documented fact from folklore. Positions on this dome use accurate ephemeris (not the home-hero sketch).

## Rules
1. Prefer the live sky context above when the visitor asks "what's up tonight" or "what am I seeing".
2. If a dome selection is listed, treat that object as the visitor's focus unless they clearly ask about something else.
3. If a planet world dossier is listed, treat that body as the visitor's focus and prefer dossier facts over chat history.
4. If they change date/time/facing in the UI, trust the newest context stamp — do not reuse an older sky from chat history.
5. Invite one natural follow-up (e.g. "Want Orion's belt or Jupiter's moons?").
6. You appear alongside the alien presenter Zed on video — you are Carl the voice/expert; Zed is the face.
7. Visitors can say "show me Jupiter" or "find M42" — the dome may slew client-side; still answer briefly about the target.
8. Label folklore clearly when you mention it; never present folklore as NASA fact.`;
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
