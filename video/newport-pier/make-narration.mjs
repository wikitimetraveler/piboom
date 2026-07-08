/**
 * Generate per-scene narration MP3s from data/newport-pier-fish.json.
 * Uses Google Cloud TTS via VoiceService (no HeyGen). Server optional.
 *
 * Usage:
 *   node make-narration.mjs
 *   node make-narration.mjs --base http://localhost:3000   # legacy HTTP to /api/voice/synthesize
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildReelNarrationScenes,
  DEFAULT_TTS_VOICE,
  writeReelNarration
} from '../../services/newport-pier-reel.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_PATH = path.join(ROOT, 'data/newport-pier-fish.json');
const useHttp = process.argv.includes('--base');
const BASE = useHttp
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:3000';
const OUT_DIR = path.resolve('assets/narration');

const catalog = JSON.parse(await readFile(DATA_PATH, 'utf8'));

if (useHttp) {
  const scenes = buildReelNarrationScenes(catalog);
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir(OUT_DIR, { recursive: true });
  for (const scene of scenes) {
    const res = await fetch(`${BASE}/api/voice/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: scene.text, voice: DEFAULT_TTS_VOICE })
    });
    const json = await res.json();
    if (!json.success || !json.audio) {
      throw new Error(`TTS failed for ${scene.id}: ${json.message || res.status}`);
    }
    await writeFile(path.join(OUT_DIR, `${scene.id}.mp3`), Buffer.from(json.audio, 'base64'));
    console.log(`${scene.id}.mp3 written`);
  }
} else {
  const result = await writeReelNarration(catalog, { outDir: OUT_DIR });
  result.files.forEach((f) => console.log(`${path.basename(f)} written`));
}

console.log('Done.');
