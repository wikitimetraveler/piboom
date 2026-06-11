/**
 * Development work by David Lane
 */
/**
 * Generate per-scene narration MP3s for the Scientific Lane presentation
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
    text: 'Jonathan Homer Lane, eighteen nineteen to eighteen eighty — the family\u2019s astrophysicist. His name rides on the Moon, and in the Lane\u2013Emden equation.'
  },
  {
    id: 'scene2',
    text: 'His only known portrait: a quiet pencil sketch, preserved because Peirce sent him Photometric Researches in eighteen seventy-eight — and the list kept his face.'
  },
  {
    id: 'scene3',
    text: 'The grand-uncle of the line — brother of David Tenney Lane. The name Homer echoes down to Grandfather Homer R, in his memory.'
  },
  {
    id: 'scene4',
    text: 'Born in Geneseo, schooled at Exeter, Yale in eighteen forty-six. Then Washington — coast survey, and principal examiner at the Patent Office.'
  },
  {
    id: 'scene5',
    text: 'Between appointments he came home to Venango County, Pennsylvania — six years in Franklin with his blacksmith brother. The branch put down roots here: Franklin and Oil City, where Dad and Aunt Peg were born.'
  },
  {
    id: 'scene6',
    text: 'In eighteen seventy he modeled the Sun as a ball of gas held up by its own heat and gravity — the first step toward stellar structure theory.'
  },
  {
    id: 'scene7',
    text: 'He died unmarried in Washington in eighteen eighty. Ninety years later the I A U named a far-side crater Lane. The Moon remembers.'
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
