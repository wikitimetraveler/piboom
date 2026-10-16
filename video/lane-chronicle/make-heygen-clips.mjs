/**
 * Optional HeyGen host-narrator stubs for Lane Chronicle beats 1 / 6 / 7.
 * Ancestor photo-avatar clips already live under public/family/assets/video/.
 *
 * Requires HEYGEN_API_KEY and assets/heygen/config.json with { avatarId, voiceId }
 * (or API_BASE pointing at a running server).
 *
 * Usage: node make-heygen-clips.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(__dirname, 'assets/heygen');
const BASE = process.env.API_BASE || 'http://localhost:3000';

const catalog = JSON.parse(
  await readFile(path.join(ROOT, 'data/lane-chronicle-movie.json'), 'utf8')
);

const SCRIPTS = Object.fromEntries(
  (catalog.beats || [])
    .filter((b) => b.kind === 'narrator' && b.narrationText)
    .map((b) => [`beat-${b.index}`, b.narrationText])
);

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'scripts.json'), JSON.stringify(SCRIPTS, null, 2));

let config = {};
try {
  config = JSON.parse(await readFile(path.join(OUT, 'config.json'), 'utf8'));
} catch {
  /* first run */
}

if (!config.avatarId || !config.voiceId) {
  console.log('HeyGen config missing — write assets/heygen/config.json with { "avatarId", "voiceId" }');
  console.log('List options: GET /api/heygen/avatars and /api/heygen/voices');
  console.log('Scripts saved to assets/heygen/scripts.json');
  console.log('Ancestor clips are already cached under public/family/assets/video/.');
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
      title: `Lane Chronicle ${kind}`,
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

console.log('When clips are ready, download MP4s to assets/heygen/beat-1.mp4, beat-6.mp4, beat-7.mp4');
console.log('HeyGen prompt cues: MCU, steady studio light, low expressiveness, 16:9, heritage tone.');
