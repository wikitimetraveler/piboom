/**
 * Generate per-scene narration MP3s for Unified Disasters HyperFrames reel.
 * Requires DevConnect Labs server: npm start
 *
 * Usage: node make-narration.mjs [--base http://localhost:3000]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:3000';
const VOICE = 'en-US-Standard-D';
const OUT_DIR = path.resolve('assets/narration');

const SCENES = [
  {
    id: 'scene0',
    text: 'Unified Disasters at DevConnect Labs — one command center for FEMA declarations, wildfires, earthquakes, hurricanes, and weather alerts.'
  },
  {
    id: 'scene1',
    text: 'Five live feeds — FEMA, NASA FIRMS, USGS, NWS, and NHC — refresh into shared Postgres when you pull sources.'
  },
  {
    id: 'scene2',
    text: 'The map and grid show a rolling ninety-day window. Filter by source, state, and event type.'
  },
  {
    id: 'scene3',
    text: 'Enable sources, review hotspots, then select an event. Nearby loans and hazard cameras load from spatial radius search.'
  },
  {
    id: 'scene4',
    text: 'Pipeline loans carry risk scores and flood zones — tied to each disaster through proximity search.'
  },
  {
    id: 'scene5',
    text: 'Open hazard webcams for ground truth, or listen to the daily US hazard briefing.'
  },
  {
    id: 'scene6',
    text: 'Ask the unified disaster processor, export KML, or explore the impact graph. Open Unified Disasters to begin.'
  }
];

await mkdir(OUT_DIR, { recursive: true });

for (const scene of SCENES) {
  const res = await fetch(`${BASE}/api/voice/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: scene.text, voice: VOICE })
  });
  const json = await res.json();
  if (!json.success || !json.audio) {
    throw new Error(`TTS failed for ${scene.id}: ${json.message || res.status}`);
  }
  await writeFile(path.join(OUT_DIR, `${scene.id}.mp3`), Buffer.from(json.audio, 'base64'));
  console.log(`${scene.id}.mp3 written`);
}
console.log('Done.');
