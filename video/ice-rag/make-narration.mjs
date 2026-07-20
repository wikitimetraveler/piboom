/**
 * Generate per-scene narration MP3s for Encompass ICE RAG HyperFrames reel.
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
    text:
      'LOS A I Labs. Hybrid retrieval-augmented generation for Encompass. Two knowledge stores ground the assistants: ICE artifacts and Developer Connect docs. Keyword JSON always works. Postgres pgvector adds semantic recall when the database and OpenAI are available. Retrieval only — never execution.'
  },
  {
    id: 'scene1',
    text:
      'Two stores, same hybrid pattern. ice-knowledge.service reads ice-sources.json and the ice_knowledge_chunks table. encompass-docs.service reads encompass-docs.json and encompass_docs_chunks. Separate tables, shared embedding helpers.'
  },
  {
    id: 'scene2',
    text:
      'Ingest. Drop ICE sample repos, Postman collections, and Dev Connect snapshots under knowledge-sources slash ice. The docs scrape merges pages by title and category, so a partial scrape refreshes without wiping the committed seed.'
  },
  {
    id: 'scene3',
    text:
      'Build pipeline. npm run build colon ice-knowledge normalizes records into ice-sources.json. npm run scrape colon encompass-docs refreshes the docs JSON. Both backfills upsert pgvector rows by content hash — unchanged chunks skip re-embed.'
  },
  {
    id: 'scene4',
    text:
      'Vectors. OpenAI text-embedding-3-small, fifteen thirty-six dimensions, via embedding-utils. ensureKnowledgeVectorTable creates an embedding vector column and an H N S W cosine index. Search orders by embedding distance operator; score is one minus distance.'
  },
  {
    id: 'scene5',
    text:
      'Hybrid search. search runs searchVector and searchKeyword in Promise.all. Vector hits get a plus-five score boost, then dedupe by repo, U R L, and title. Missing database, pgvector, or A P I key — the vector lane returns empty and keyword still answers.'
  },
  {
    id: 'scene6',
    text:
      'Consumers. The Encompass Assistant controller and Unit Tests A I search both stores, assemble context, then call the L L M. executionAllowed stays false — retrieval only, never live ICE A P I calls from R A G hits.'
  },
  {
    id: 'scene7',
    text:
      'Ops. npm run refresh colon encompass-knowledge scrapes docs then rebuilds ICE. Set ENCOMPASS_DOCS_SKIP_EMBED or ICE_SKIP_EMBED for JSON-only. Graph R A G on graph_nodes embeddings is a sibling path for disaster pipeline A I — not live slash near proximity. See docs slash VECTOR_RAG and A I_SYSTEM.'
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
