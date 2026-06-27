/**
 * Generate per-scene narration MP3s for DevConnect Labs tech stack HyperFrames reel.
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
    text: 'DevConnect Labs — one Node repository hosting Encompass tooling, AI assistants, unified disasters, music research, and Lane genealogy.'
  },
  {
    id: 'scene1',
    text: 'The platform layer: Express routes call services, not fat controllers. PostgreSQL stores graphs, disasters, config, and chat memory. Jest keeps CI green.'
  },
  {
    id: 'scene2',
    text: 'AI and assistants: LangChain memory, OpenAI Vision, and ICE knowledge RAG ground Encompass Assistant and Screen Test. HeyGen avatars and HyperFrames explain the product.'
  },
  {
    id: 'scene3',
    text: 'Mortgage and Encompass: Hub APIs, a shared calculation engine, processor assignment scoring, and Unit Tests with Automator manifest review.'
  },
  {
    id: 'scene4',
    text: 'Frontend: Bootstrap and vanilla JavaScript — no React. AG Grid and DataTables where grids matter, plus design tokens, dark mode, and a sitewide voice widget.'
  },
  {
    id: 'scene5',
    text: 'Data and maps: FEMA, NASA FIRMS, NOAA, and USGS feed unified disasters. Google Maps geocodes family and hazard layers. MusicBrainz and Wikimedia power music research.'
  },
  {
    id: 'scene6',
    text: 'Explore grouped stack cards on stack dot html, or browse every HeyGen clip and HyperFrames reel on the public video hub.'
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
