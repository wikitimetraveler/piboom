/**
 * Ridge — SoCal ski-road desk for Ski Topo.
 * Development work by David Lane
 */
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { persistConversationTurn } from './langchain-memory.service.js';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';
import skiTopoService from './ski-topo.service.js';
import { getStops } from './ski-places.service.js';
import { getTrails, runCatalogSnippet } from './ski-trails.service.js';

export const GUIDE_NAME = 'Ridge';

function destSnippet(destinations = []) {
  return destinations
    .map((d) => {
      const wx = d.weather || {};
      const alertBits = (d.alerts || []).map((a) => a.event).filter(Boolean).join(', ');
      return (
        `- ${d.name} (${d.area}): ${d.score || 'unknown'}; base ${d.baseFt} ft / summit ${d.summitFt} ft;` +
        ` drive ~${d.driveMin ?? d.typicalDriveMin} min from Fountain Valley via ${(d.highways || []).join(', ')};` +
        ` temp ${wx.tempF ?? '?'} F; freeze ${wx.freezeLevelFt ?? '?'} ft;` +
        ` chains ${d.chainsLikely ? 'likely' : 'not flagged'}; alerts: ${alertBits || 'none'}.`
      );
    })
    .join('\n');
}

function stopSnippet(stops = []) {
  return stops
    .slice(0, 40)
    .map((s) => `- ${s.name} (${s.kind}, ${s.town || s.route}, ${s.source || 'seed'})`)
    .join('\n');
}

function runsForContext(destinations = [], pageContext = {}) {
  const selected = destinations.find((d) => d.id === pageContext.selectedDestination);
  const demIds = selected ? [selected.dem] : [...new Set(destinations.map((d) => d.dem).filter(Boolean))];
  const names = Object.fromEntries(destinations.map((d) => [d.id, d.name]));
  const lines = [];
  for (const demId of demIds) {
    const trails = getTrails(demId, selected ? { resort: selected.id } : {});
    if (trails?.runs?.length) lines.push(runCatalogSnippet(trails.runs, names, selected ? 120 : 40));
  }
  return lines.join('\n');
}

export function buildSystemPrompt({ destinations = [], stops = [], pageContext = {}, runs } = {}) {
  const selected = pageContext.selectedDestination || 'none selected';
  const runTable = runs ?? runsForContext(destinations, pageContext);
  return `You are ${GUIDE_NAME}, the SoCal ski-road desk for Ski Topo — a go/no-go board for Fountain Valley drives to Wrightwood (Mountain High Resort), Running Springs (Snow Valley), and Big Bear (Snow Summit and Bear Mountain).

## Personality
- Calm mountain-road voice. Short sentences. No hype.
- Two or three short paragraphs. No markdown bullets, hashes, or raw URLs.

## Ground truth
Home: Fountain Valley, California.
This is a desk aid — not official Caltrans chain control and not a resort snow report.
The site is split: Drive desk (weather, Fountain Valley trip, on-the-way shops) and Ski Areas (DEM, slope, aspect). The guest is on: ${pageContext.page || 'drive'}.
Selected destination: ${selected}
Selected run on the trail map: ${pageContext.selectedRun || 'none'}

## Destinations and weather
${destSnippet(destinations) || 'No live brief yet — use typical drive times from the catalog.'}

## On-the-way stops (seed + live listings only)
${stopSnippet(stops) || 'Scenic seed stops only until live listings return.'}

## Runs (OpenStreetMap trails measured on a 3DEP elevation model)
Ratings: Beginner/Easier = green circle, More difficult = blue square, Most difficult = black diamond, Experts only = double black.
Avg is the along-run pitch top to bottom; max is the steepest ~100 m pitch. Faces is the direction the slope faces (N-facing holds snow best in SoCal).
${runTable || 'No trail data loaded — say the trail map is unavailable.'}

## Rules
1. Smoke shops and dispensaries are 21 and over. If someone sounds under 21, refuse those topics.
2. Only name shops and stops that appear in the list above. If it is not there, say so.
3. Never invent hours, deals, inventory, or live Caltrans chain law.
4. Do not scrape or cite unofficial resort snow reports as official.
5. If weather is missing, say caution — do not guess a green light.
6. Mountain High here is the Wrightwood ski resort, not Mountain High Medicinals.
7. For run questions (pitch, facing, difficulty), only recommend runs from the run table and quote its numbers. Run open/closed status and grooming today are unknown — tell guests to check the resort.`;
}

export async function chatWithRidge({
  message,
  history = [],
  userId = 'ski-guest',
  sessionId = 'ski-ridge',
  context = {},
  brief,
  stops,
} = {}) {
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!openaiKey) {
    const err = new Error('OPENAI_API_KEY is not configured');
    err.code = 'OPENAI_NOT_CONFIGURED';
    throw err;
  }

  const liveBrief = brief || (await skiTopoService.getBrief().catch(() => ({ destinations: [] })));
  const stopList = stops || (await getStops({ route: context.route }).catch(() => []));

  const model = new ChatOpenAI({
    modelName: resolveOpenAiAgentModel('SKI_ASSISTANT_MODEL'),
    temperature: 0.45,
    openAIApiKey: openaiKey,
  });

  const messages = [
    new SystemMessage(
      buildSystemPrompt({
        destinations: liveBrief.destinations || [],
        stops: stopList,
        pageContext: context,
      })
    ),
  ];
  for (const turn of history.slice(-8)) {
    if (turn.role === 'user') messages.push(new HumanMessage(String(turn.content || '')));
    if (turn.role === 'assistant') messages.push(new AIMessage(String(turn.content || '')));
  }
  messages.push(new HumanMessage(String(message).trim()));

  const response = await model.invoke(messages);
  const reply =
    String(response?.content || '').trim() ||
    'Radio crackle — ask me that one more time?';

  try {
    await persistConversationTurn(userId, sessionId, String(message), reply, 'ridge');
  } catch (_) {
    /* memory optional */
  }

  return { reply, guideName: GUIDE_NAME };
}

export async function getRidgeSummary() {
  const catalog = await skiTopoService.loadDestinations();
  return {
    guide: GUIDE_NAME,
    home: catalog.home?.name,
    destinationCount: (catalog.destinations || []).length,
  };
}

export default {
  GUIDE_NAME,
  buildSystemPrompt,
  chatWithRidge,
  getRidgeSummary,
};
