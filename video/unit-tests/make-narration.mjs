/**
 * Generate per-scene narration MP3s for DevConnect Unit Test HyperFrames reel.
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
    text: 'DevConnect Labs Unit Test tool — prove Encompass custom field calculations against real loan data, right in your browser.'
  },
  {
    id: 'scene1',
    text: 'Step one, Generate and load. Load tests from Excel, or generate from a calculated custom field. Preview set and compare steps, then generate and load.'
  },
  {
    id: 'scene2',
    text: 'Step two, Test Grid. All cells are editable. Date fields get a date picker. Review set and compare rows and scenario columns.'
  },
  {
    id: 'scene3',
    text: 'Step three, Run tests. Enter a loan GUID from your Encompass pipeline. Pass means the calculated value matches; fail means it does not.'
  },
  {
    id: 'scene4',
    text: 'Search the Test Library by field ID for impact analysis. Export to Excel or CSV, and reload saved spreadsheets when you need them.'
  },
  {
    id: 'scene5',
    text: 'Learn Mode trains parser examples from worked cases. The AI Assistant answers unit-testing and Encompass questions on the same page.'
  },
  {
    id: 'scene6',
    text: 'Open unit-tests dot html — try the offline demo and play the highlight reel to walk every section. DevConnect Labs.'
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
