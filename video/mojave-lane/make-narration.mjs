/**
 * Development work by David Lane
 */
/**
 * Generate per-scene narration MP3s for the Mojave Lane presentation
 * using the site's Google Cloud TTS endpoint (same stack as Listen).
 * Requires the DevConnect Labs server running locally.
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
    id: 'scene1',
    text: 'Captain Aaron G. Lane — eighteen seventeen to eighteen eighty-three. Piermont farmer, Mexican War veteran, Forty-niner. The Lane who settled the Mojave River.'
  },
  {
    id: 'scene2',
    text: 'Born at Peaked Mountain in Piermont, New Hampshire — twin to Moses P. Lane. Volume One records him among the youngest sons of Jonathan and Mary Towle Lane.'
  },
  {
    id: 'scene3',
    text: 'Moses died at Acapulco in eighteen fifty-two, en route to join Aaron in California. In his last years, Aaron\u2019s niece Eldora Richmond nursed him at Halleck.'
  },
  {
    id: 'scene4',
    text: 'Company H, Ninth U.S. Infantry — malaria at Puebla during the Mexican campaign. By eighteen fifty he was in the Mother Lode, then down the corridor toward San Bernardino.'
  },
  {
    id: 'scene5',
    text: 'At the Lower Narrows he established Lane\u2019s Crossing — ranch, store, and the last ford on the Mormon Road before Cajon Pass. First permanent settlement on the Mojave River.'
  },
  {
    id: 'scene6',
    text: 'At the Lower Narrows, ancient trade paths and wagon roads met. The Mohave Trail, the Mormon Road, and the Mojave Road all funneled travelers to Aaron Lane\u2019s station \u2014 the last ford on the Mojave River before Cajon Pass.'
  },
  {
    id: 'scene7',
    text: 'He died unmarried, fourteenth September eighteen eighty-three, at Lane\u2019s Crossing of the Mojave. Homer Lane\u2019s first cousin, three times removed — a name the desert still remembers.'
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
  console.log(`${scene.id}.mp3 written`);
}
console.log('Done.');
