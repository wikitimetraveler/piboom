/**
 * Reed — Studio engineer assistant
 * Development work by David Lane
 */
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { persistConversationTurn } from './langchain-memory.service.js';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';
import { getLivekitConfig } from './livekit.service.js';

const GUIDE_NAME = 'Reed';

function buildSystemPrompt() {
  const livekit = getLivekitConfig();
  const livekitLine = livekit.configured
    ? `LiveKit is configured at ${livekit.url}. Voice, camera, and screen share join the same reel room.`
    : 'LiveKit env vars are not set yet (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET). Local recording still works in the tab; remote A/V waits on those keys.';

  return `You are ${GUIDE_NAME}, house engineer for StarBand, a browser recording studio.

## Personality
- Dry, precise, tape-room calm. Short sentences. No hype.
- Every reply may be read aloud, so keep answers to two short paragraphs. No markdown lists unless asked.

## How the desk actually works
- The session opens with two acoustic-guitar tracks: Acoustic Guitar Neck (twelfth-fret mic, panned a little left, brighter presence) and Acoustic Guitar Body (soundhole / body mic, panned a little right, warmer low mids). Vocal and Harmony sit under those.
- Music input is on by default. Echo cancellation, noise suppression, auto-gain, and the browser high-pass stay off so the acoustic is not chewed up.
- Acoustic desk is on by default: neck/body EQ, light compression, and a small wood-room reverb on play and bounce. Players should use headphones so speakers do not leak into the mics.
- Takes are recorded as PCM in the tab, not Opus. Stacking Body while Neck plays is an overdub — the live mic is not routed to speakers.
- Autotune is voice only (Vocal and Harmony). Acoustic guitar never gets pitch correction. Default is chromatic hard retune on those two lanes.
- Bounces are WAV. Indexed in the listening room behind one password (default reel1, override STUDIO_LISTEN_PASSWORD).
- Socket.IO namespace /studio is the control plane: who is in the reel, transport (play/record), take-filed, booth chat.
- LiveKit is the media plane: microphone talkback or music input, camera, and screen share of the desk. Reed the StarBand agent can join the same room.
- Latency compensation: clips land at the playhead where the player actually hit record.
- Engineer chat is you. Cover art for a release can be a still from screen share or a bounced title card.

${livekitLine}

## Rules
1. Do not invent LiveKit room URLs, API secrets, or claim a take uploaded unless the user said they bounced/released it.
2. If they ask how to invite a remote player: share the desk URL with ?reel=CODE, join LiveKit, arm a track, record.
3. If LiveKit is down, tell them they can still record locally and use Socket.IO presence.
4. Never ask for API secrets in chat. Point at .env LIVEKIT_* only.`;
}

export function groundedReply(message) {
  const q = String(message || '').toLowerCase();
  if (!q.trim()) {
    return 'Console is up. Arm a track, or ask me about LiveKit, bounce, or the listening room.';
  }
  if (q.includes('password') || q.includes('listen')) {
    return 'The listening room is one password. Default is reel1 unless STUDIO_LISTEN_PASSWORD is set. Bounce a WAV from the desk and it shows up there.';
  }
  if (q.includes('livekit') || q.includes('video') || q.includes('screen')) {
    const livekit = getLivekitConfig();
    return livekit.configured
      ? 'LiveKit is on. Join the reel, then toggle mic, camera, or screen share. Socket.IO only moves transport and presence — the audio/video path is WebRTC.'
      : 'LiveKit keys are not on this server yet. You can still record in the tab. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to open voice, camera, and screen share.';
  }
  if (q.includes('guitar') || q.includes('acoustic')) {
    return 'Two acoustic guitar tracks are already on the desk. Neck is the twelfth-fret mic, panned a little left and brighter. Body is the soundhole mic, panned a little right and warmer. Takes are PCM, not Opus. Acoustic desk adds neck/body EQ and a small wood room. Headphones on. Arm Neck first, then stack Body.';
  }
  if (q.includes('autotune') || q.includes('auto tune') || q.includes('auto-tune') || q.includes('pitch')) {
    return 'Autotune is on your voice only — Vocal and Harmony. Guitar stays dry. Chromatic hard retune is the default. Pick a key if you want it to snap to a scale. Uncheck Autotune on the voice lane to hear the dry take.';
  }
  if (q.includes('record') || q.includes('mic') || q.includes('arm')) {
    return 'Add a track, arm it, pick music input if you are tracking a performance. Hit record. The waveform draws on the timeline. Remote friends file takes over LiveKit; the bounce still renders here.';
  }
  if (q.includes('wav') || q.includes('bounce') || q.includes('mix')) {
    return 'Faders and pans are local. Bounce writes a WAV in this machine, then you can push it to the listening room. No server mixdown.';
  }
  return 'Arm, record, stack, mix, release. LiveKit for the room. Socket.IO for the transport. The desk never leaves the tab.';
}

export async function chatWithReed({
  message,
  history = [],
  userId = 'studio-anon',
  sessionId = 'studio-reed',
} = {}) {
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!openaiKey) {
    return { reply: groundedReply(message), guideName: GUIDE_NAME, source: 'grounded' };
  }

  try {
    const model = new ChatOpenAI({
      modelName: resolveOpenAiAgentModel('STUDIO_ASSISTANT_MODEL'),
      temperature: 0.4,
      openAIApiKey: openaiKey,
    });
    const messages = [new SystemMessage(buildSystemPrompt())];
    for (const turn of history.slice(-8)) {
      if (turn.role === 'user') messages.push(new HumanMessage(String(turn.content || '')));
      if (turn.role === 'assistant') messages.push(new AIMessage(String(turn.content || '')));
    }
    messages.push(new HumanMessage(String(message).trim()));
    const response = await model.invoke(messages);
    const reply = String(response?.content || '').trim() || groundedReply(message);
    try {
      await persistConversationTurn(userId, sessionId, String(message), reply, 'studio');
    } catch (_) {
      /* memory optional */
    }
    return { reply, guideName: GUIDE_NAME, source: 'openai' };
  } catch (_) {
    return { reply: groundedReply(message), guideName: GUIDE_NAME, source: 'grounded' };
  }
}

export function getReedSummary() {
  const livekit = getLivekitConfig();
  return {
    guideName: GUIDE_NAME,
    livekitConfigured: livekit.configured,
  };
}

export default {
  chatWithReed,
  getReedSummary,
  groundedReply,
};
