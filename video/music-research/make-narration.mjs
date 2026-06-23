/**
 * Generate per-scene narration MP3s for Music Research HyperFrames reel.
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
    text: 'Music Research at DevConnect Labs — one search assembles timeline, map, sources, and Historian chat around an artist.'
  },
  {
    id: 'scene1',
    text: "Knowledge Graph entity cards give a fast factual anchor before you go deeper."
  },
  {
    id: 'scene2',
    text: 'The timeline shows births, band formation, and releases — era at a glance.'
  },
  {
    id: 'scene3',
    text: 'On the map, teal pins mark personal origins; amber marks where the band formed.'
  },
  {
    id: 'scene4',
    text: 'Ask the Historian in chat — documented fact separated from interpretation.'
  },
  {
    id: 'scene5',
    text: 'Album Discovery, Time Machine, and the Pilgrimage Atlas extend the same research stack.'
  },
  {
    id: 'scene6',
    text: 'Open Music Research and start with an artist you love.'
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
