/**
 * Generate per-scene narration MP3s for the Endless Tour era reel.
 * Requires DevConnect Labs server running locally.
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
    text: 'The Endless Tour — thirty years on the road. More than two thousand shows. Eight stops that trace the arc from Fillmore to Soldier Field.'
  },
  {
    id: 'scene1',
    text: 'December nineteen sixty-five — the Fillmore Auditorium. The first public show under the name Grateful Dead. Bill Graham\u2019s room became their spiritual home.'
  },
  {
    id: 'scene2',
    text: 'January nineteen sixty-seven — the Human Be-In in Golden Gate Park. Thirty thousand in the grass. Turn on, tune in, drop out — and the Dead on stage.'
  },
  {
    id: 'scene3',
    text: 'August nineteen seventy-two — Veneta, Oregon. Sunshine Daydream on a hot summer afternoon. An outdoor benefit that became legend on tape and film.'
  },
  {
    id: 'scene4',
    text: 'Nineteen seventy-four — Winterland and the Wall of Sound. Six hundred speakers, seventy-five tons. Then a farewell before the hiatus.'
  },
  {
    id: 'scene5',
    text: 'May eighth, nineteen seventy-seven — Barton Hall at Cornell. Scarlet Begonias into Fire on the Mountain. The show every Deadhead argues about — and many call the best.'
  },
  {
    id: 'scene6',
    text: 'September nineteen seventy-eight — three nights at the Great Pyramids. A lunar eclipse over Giza. Rocking the cradle under the oldest sky on Earth.'
  },
  {
    id: 'scene7',
    text: 'Nineteen eighty-nine — Alpine Valley in Wisconsin. Outdoor amphitheater, Midwest deadheads, the late-era tour at full strength.'
  },
  {
    id: 'scene8',
    text: 'July ninth, nineteen ninety-five — Soldier Field, Chicago. The last show with Jerry Garcia. Show number two thousand three hundred eighteen. Box of Rain at the close.'
  },
  {
    id: 'scene9',
    text: 'The tour never really ended. Explore every stop — dates, venues, and tapes — in the Live Music Pilgrimage Atlas.'
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
