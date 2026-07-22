/**
 * Generate per-scene narration MP3s for Encompass ICE RAG HyperFrames reel.
 * Requires DevConnect Labs server: npm start
 *
 * Usage: node make-narration.mjs [--base http://localhost:3000]
 *
 * Keep each line ~18–28 words so it fits an ~9–12s beat at Google TTS pace.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:3000';
const VOICE = 'en-US-Standard-D';
const OUT_DIR = path.resolve('assets/narration');

/** Spoken copy — short enough for scene slots; technical and accurate. */
const SCENES = [
  {
    id: 'scene0',
    text:
      'LOS A I Labs. Hybrid R A G for Encompass: keyword JSON always on, pgvector when ready. Retrieval only — never execution.'
  },
  {
    id: 'scene1',
    text:
      'Two stores, same pattern. ice-knowledge.service hits ice_knowledge_chunks. encompass-docs.service hits encompass_docs_chunks.'
  },
  {
    id: 'scene2',
    text:
      'Ingest under knowledge-sources slash ice: repos, Postman, and Dev Connect docs. Scrapes merge by title — they do not wipe the seed.'
  },
  {
    id: 'scene3',
    text:
      'Build with npm run build colon ice-knowledge and scrape colon encompass-docs. Upserts use content hash — unchanged chunks skip re-embed.'
  },
  {
    id: 'scene4',
    text:
      'Vectors: text-embedding-3-small, fifteen thirty-six dimensions, H N S W cosine. Search orders by embedding distance; score is one minus distance.'
  },
  {
    id: 'scene5',
    text:
      'Hybrid search runs vector and keyword in Promise.all. Vector hits get a plus-five boost, then dedupe. No database — keyword still answers.'
  },
  {
    id: 'scene6',
    text:
      'Encompass Assistant and Unit Tests A I search both stores, then call the L L M. executionAllowed stays false — retrieval only.'
  },
  {
    id: 'scene7',
    text:
      'Ops: refresh colon encompass-knowledge. Graph R A G on graph_nodes is a sibling for disasters — not live slash near. See VECTOR_RAG docs.'
  }
];

function probeDurationSeconds(filePath) {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      { encoding: 'utf8' }
    ).trim();
    const n = Number(out);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

await mkdir(OUT_DIR, { recursive: true });

const timings = [];
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
  const filePath = path.join(OUT_DIR, `${scene.id}.mp3`);
  await writeFile(filePath, Buffer.from(json.audio, 'base64'));
  const duration = probeDurationSeconds(filePath);
  timings.push({ id: scene.id, duration });
  console.log(`${scene.id}.mp3 written${duration != null ? ` (${duration.toFixed(2)}s)` : ''}`);
}

console.log('Done.');
console.log(JSON.stringify({ timings }, null, 2));
