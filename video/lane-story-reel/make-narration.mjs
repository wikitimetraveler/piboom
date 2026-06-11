/**
 * Development work by David Lane
 */
/**
 * Generate per-scene narration MP3s for the Lane museum reel using the
 * site's Google Cloud TTS endpoint (same stack as the Listen feature).
 * Requires the DevConnect Labs server running locally.
 *
 * Usage: node make-narration.mjs [--base http://localhost:3000]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:3000';
const VOICE = 'en-US-Standard-D'; // same default as public/shared/tts.js
const OUT_DIR = path.resolve('assets/narration');

const SCENES = [
  {
    id: 'scene1',
    text: 'Welcome to the Lane Legacy Museum — a guided reel from colonial Boston onward through later Lane generations.'
  },
  {
    id: 'scene2',
    text: 'The opening exhibit: William E Lane of Boston, cordwainer. Hartford and Lynn appearances, freeman in sixteen fifty-seven, and the Mary Brewer marriage.'
  },
  {
    id: 'scene3',
    text: 'Volume one was generations in the making — behind the printed volumes stand the compilers who condensed centuries into book form.'
  },
  {
    id: 'scene4',
    text: 'In May of eighteen eighty-four, Popular Science Monthly profiled George G. Lane of Hampton Falls — a man with remarkable calendrical gifts.'
  },
  {
    id: 'scene5',
    text: 'Jonathan Homer Lane\u2019s solar models helped launch stellar structure theory. The Moon\u2019s Lane crater, named in nineteen seventy, honors him.'
  },
  {
    id: 'scene6',
    text: 'From freeman Boston to Bennington, the Mojave, and the Moon — continue on the memorial wall for the deeper evidence.'
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
  const file = path.join(OUT_DIR, `${scene.id}.mp3`);
  await writeFile(file, Buffer.from(json.audio, 'base64'));
  console.log(`${scene.id}.mp3 written (${json.audio.length} b64 chars)`);
}
console.log('Done.');
