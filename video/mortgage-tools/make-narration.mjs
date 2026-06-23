/**
 * Generate per-scene narration MP3s for DevConnect mortgage tools HyperFrames reel.
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
    text: 'DevConnect Labs mortgage tools — Worksheets and Encompass integrations in one browser, backed by a service-layer API.'
  },
  {
    id: 'scene1',
    text: 'Encompass Hub brings pipeline reads, batch updates, and field explorers to your tenant.'
  },
  {
    id: 'scene2',
    text: 'Unit Tests prove custom field calculations — generate scenarios from calculated fields and run against live loan GUIDs.'
  },
  {
    id: 'scene3',
    text: 'Screen Test reviews Encompass form manifests with reviewer AI before you ship.'
  },
  {
    id: 'scene4',
    text: 'Worksheets calculators share one calculation engine — DTI, FHA streamline, LTV, amortization, and more.'
  },
  {
    id: 'scene5',
    text: 'Unified Disasters links FEMA, wildfire, earthquake, and weather alerts to pipeline loans and hazard webcams on one map.'
  },
  {
    id: 'scene6',
    text: 'Encompass Assistant grounds answers in ICE knowledge, Encompass docs, and LangChain memory.'
  },
  {
    id: 'scene7',
    text: 'Processor assignment and pipeline risk round out the platform. Open Worksheets to begin.'
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
