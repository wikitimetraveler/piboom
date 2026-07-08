/**
 * Generate per-scene narration MP3s from data/newport-pier-fish.json.
 * Requires DevConnect Labs server: npm start
 *
 * Usage: node make-narration.mjs [--base http://localhost:3000]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_PATH = path.join(ROOT, 'data/newport-pier-fish.json');
const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:3000';
const VOICE = 'en-US-Standard-D';
const OUT_DIR = path.resolve('assets/narration');

const catalog = JSON.parse(await readFile(DATA_PATH, 'utf8'));
const scenes = [
  {
    id: 'scene0',
    text: `Welcome to Newport Beach Pier — a classic Southern California rail where surf perch, mackerel, halibut, and more meet the sand. Let's walk the pier stop by stop.`
  },
  ...(catalog.stops || []).map((stop, i) => ({
    id: `scene${i + 1}`,
    text: stop.heygenScript || `${stop.label}.`
  })),
  {
    id: `scene${(catalog.stops?.length || 0) + 1}`,
    text: `That's the pier walk. Open the interactive guide at DevConnect Labs to explore every species and generate your own avatar narration.`
  }
];

await mkdir(OUT_DIR, { recursive: true });

for (const scene of scenes) {
  const res = await fetch(`${BASE}/api/voice/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: scene.text, voice: VOICE })
  });
  const json = await res.json();
  if (!json.success || !json.audio) {
    throw new Error(`TTS failed for ${scene.id}: ${json.message || res.status}`);
  }
  const file = path.join(OUT_DIR, `${scene.id}.mp3`);
  await writeFile(file, Buffer.from(json.audio, 'base64'));
  console.log(`${scene.id}.mp3 written`);
}
console.log('Done.');
