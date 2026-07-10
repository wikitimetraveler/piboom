/**
 * Generate HeyGen avatar intro/outro clips for stitching with the HyperFrames body.
 * Requires HEYGEN_API_KEY and avatar/voice IDs in heygen-config.json (or env).
 *
 * Usage: node make-heygen-clips.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve('assets/heygen');
const BASE = process.env.API_BASE || 'http://localhost:3000';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const SCRIPTS = {
  intro:
    'Welcome to the Endless Tour — thirty years of Grateful Dead road history. Eight iconic stops, from the Fillmore to Soldier Field. Let\u2019s ride the route.',
  outro:
    'That\u2019s the arc — but two thousand more shows await. Open the Live Music Pilgrimage Atlas and explore every stop on the map.'
};

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'scripts.json'), JSON.stringify(SCRIPTS, null, 2));

let config = {};
try {
  config = JSON.parse(await (await import('node:fs/promises')).readFile(path.join(OUT, 'config.json'), 'utf8'));
} catch {
  /* first run */
}

if (!config.avatarId || !config.voiceId) {
  try {
    const pier = JSON.parse(
      await (await import('node:fs/promises')).readFile(path.join(ROOT, 'data/newport-pier-fish.json'), 'utf8')
    );
    config.avatarId = config.avatarId || pier.avatar?.avatarId;
    config.voiceId = config.voiceId || pier.avatar?.voiceId;
  } catch {
    /* optional fallback */
  }
}

if (!config.avatarId || !config.voiceId) {
  console.log('HeyGen config missing — write assets/heygen/config.json with { "avatarId", "voiceId" }');
  console.log('List options: GET /api/heygen/avatars and /api/heygen/voices');
  console.log('Scripts saved to assets/heygen/scripts.json');
  process.exit(0);
}

for (const [kind, script] of Object.entries(SCRIPTS)) {
  const res = await fetch(`${BASE}/api/heygen/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avatarId: config.avatarId,
      voiceId: config.voiceId,
      script,
      title: `Endless Tour ${kind}`,
      aspectRatio: '16:9'
    })
  });
  const json = await res.json();
  if (!json.success) {
    console.error(`${kind} failed:`, json.message || json);
    continue;
  }
  const videoId = json.data?.video_id || json.video_id;
  console.log(`${kind}: video_id=${videoId} — poll GET /api/heygen/videos/${videoId}`);
  await writeFile(path.join(OUT, `${kind}-job.json`), JSON.stringify({ videoId, script }, null, 2));
}

console.log('When clips are ready, download MP4s to assets/heygen/intro.mp4 and outro.mp4');
console.log('Then: ffmpeg -f concat -safe 0 -i concat.txt -c copy endless-tour-full.mp4');
