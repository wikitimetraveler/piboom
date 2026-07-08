/**
 * Generate HeyGen avatar clips per pier stop from data/newport-pier-fish.json.
 * Requires HEYGEN_API_KEY and avatar/voice in assets/heygen/config.json (or catalog.avatar).
 *
 * Usage: node make-heygen-clips.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_PATH = path.join(ROOT, 'data/newport-pier-fish.json');
const OUT = path.resolve('assets/heygen');
const BASE = process.env.API_BASE || 'http://localhost:3000';

const catalog = JSON.parse(await readFile(DATA_PATH, 'utf8'));
await mkdir(OUT, { recursive: true });

let config = {};
try {
  config = JSON.parse(await readFile(path.join(OUT, 'config.json'), 'utf8'));
} catch {
  /* first run */
}

const avatarId = config.avatarId || catalog.avatar?.avatarId;
const voiceId = config.voiceId || catalog.avatar?.voiceId;

if (!avatarId || !voiceId) {
  console.log('HeyGen config missing — write assets/heygen/config.json with { "avatarId", "voiceId" }');
  console.log('Or set avatar.avatarId / avatar.voiceId in data/newport-pier-fish.json');
  console.log('List options: GET /api/heygen/avatars and /api/heygen/voices');
  process.exit(0);
}

const jobs = [
  {
    kind: 'intro',
    script:
      'Welcome to Newport Beach Pier — six stops along the rail, and the fish anglers catch at each one. Let\'s walk the pier.',
    title: 'Newport Pier intro'
  },
  ...(catalog.stops || []).map((stop) => ({
    kind: stop.id,
    script: stop.heygenScript,
    title: `Newport Pier — ${stop.label}`
  })),
  {
    kind: 'outro',
    script:
      'That\'s the pier. Open the Newport Pier fish guide to explore species, freeze your own walk, and add more catches.',
    title: 'Newport Pier outro'
  }
];

for (const job of jobs) {
  if (!job.script?.trim()) continue;
  const res = await fetch(`${BASE}/api/heygen/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avatarId,
      voiceId,
      script: job.script,
      title: job.title,
      aspectRatio: '16:9',
      outputFormat: 'webm',
      libraryDomain: 'nature',
      libraryId: `nature-pier-${job.kind}`
    })
  });
  const json = await res.json();
  if (!json.success) {
    console.error(`${job.kind} failed:`, json.error || json.message || json);
    continue;
  }
  const videoId = json.videoId || json.data?.video_id;
  console.log(`${job.kind}: video_id=${videoId}`);
  await writeFile(path.join(OUT, `${job.kind}-job.json`), JSON.stringify({ videoId, script: job.script }, null, 2));
}

console.log('When clips are ready, download MP4s to assets/heygen/');
