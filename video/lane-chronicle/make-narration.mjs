/**
 * Generate narrator MP3s for Lane Chronicle beats 1, 6, and 7.
 * Requires DevConnect Labs server running locally (Google Cloud TTS).
 *
 * Usage: node make-narration.mjs [--base http://localhost:3000]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:3000';
const VOICE = 'en-US-Standard-D';
const OUT_DIR = path.resolve(__dirname, 'assets/narration');

const catalog = JSON.parse(
  await readFile(path.join(ROOT, 'data/lane-chronicle-movie.json'), 'utf8')
);

const scenes = (catalog.beats || [])
  .filter((b) => b.narrationText)
  .map((b) => ({ id: `beat-${b.index}`, text: b.narrationText }));

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
  await writeFile(path.join(OUT_DIR, `${scene.id}.mp3`), Buffer.from(json.audio, 'base64'));
  console.log(`${scene.id}.mp3 written`);
}
console.log('Done. Narration for beats 1, 6, 7.');
