/**
 * Queue Zigzag + Summer + Dave intro clips for Lane AI Labs.
 * Requires HEYGEN_API_KEY in .env
 *
 * Usage:
 *   node scripts/tools/generate-lane-labs-intro-heygen.mjs --dry-run
 *   node scripts/tools/generate-lane-labs-intro-heygen.mjs --force --direct --cache-local
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  heygenConfigured,
  createAvatarVideo,
  getVideoStatus,
} from '../../services/heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CATALOG = path.join(ROOT, 'data/lane-labs-intro-heygen.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollVideoDirect(videoId, timeoutMs = 600000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const data = await getVideoStatus(videoId);
    const status = data?.status;
    if (status === 'completed' && data?.video_url) return data.video_url;
    if (status === 'failed') throw new Error(`HeyGen render failed for ${videoId}`);
    process.stdout.write(`  ${videoId}: ${status || 'pending'}…\n`);
    await sleep(8000);
  }
  throw new Error(`Timed out waiting for video ${videoId}`);
}

async function downloadMp4(remoteUrl, destAbs) {
  await mkdir(path.dirname(destAbs), { recursive: true });
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destAbs, buf);
  process.stdout.write(`Saved ${destAbs} (${buf.length} bytes)\n`);
}

async function queueClip(clip) {
  const created = await createAvatarVideo({
    avatarId: clip.avatarId,
    voiceId: clip.voiceId,
    script: clip.script,
    title: `Lane AI Labs intro — ${clip.name}`,
    aspectRatio: '16:9',
    resolution: '1080p',
    motionPrompt: clip.motionPrompt,
    expressiveness: clip.expressiveness || 'low',
  });
  const videoId = created?.video_id;
  if (!videoId) throw new Error(`No video_id for ${clip.id}`);
  return videoId;
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, 'utf8'));
  const clips = catalog.clips || [];
  if (!clips.length) throw new Error('No clips in lane-labs-intro-heygen.json');

  if (hasFlag('--dry-run')) {
    for (const clip of clips) {
      const words = String(clip.script || '').trim().split(/\s+/).length;
      process.stdout.write(
        `${clip.id}: ${clip.name} · ${words} words · avatar ${String(clip.avatarId).slice(0, 8)}…\n${clip.script}\n\n`
      );
    }
    process.stdout.write(`Video Agent prompt: ${catalog.videoAgentPrompt.length} chars\n`);
    return;
  }

  if (!heygenConfigured()) {
    throw new Error('HEYGEN_API_KEY is not set in .env');
  }

  const queued = [];
  for (const clip of clips) {
    if (clip.heygenVideoUrl && !hasFlag('--force')) {
      process.stdout.write(`skip ${clip.id} (already has video — use --force)\n`);
      continue;
    }
    process.stdout.write(`Queue ${clip.name}…\n`);
    try {
      clip.heygenVideoId = await queueClip(clip);
    } catch (err) {
      if (clip.altAvatarId && /not found|404|avatar/i.test(String(err.message || ''))) {
        process.stdout.write(`  retry ${clip.id} with alt look…\n`);
        clip.avatarId = clip.altAvatarId;
        clip.heygenVideoId = await queueClip(clip);
      } else {
        throw err;
      }
    }
    queued.push(clip);
    process.stdout.write(`  queued ${clip.heygenVideoId}\n`);
  }

  if (!queued.length) {
    process.stdout.write('Nothing to render.\n');
    return;
  }

  for (const clip of queued) {
    process.stdout.write(`Poll ${clip.name}…\n`);
    clip.heygenVideoUrl = await pollVideoDirect(clip.heygenVideoId);
    if (hasFlag('--cache-local') && clip.localRel) {
      await downloadMp4(clip.heygenVideoUrl, path.join(PUBLIC_DIR, clip.localRel.replace(/^\//, '')));
      clip.heygenVideoLocal = clip.localRel;
    }
  }

  catalog.generatedAt = new Date().toISOString();
  await writeFile(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  process.stdout.write('Updated data/lane-labs-intro-heygen.json\n');
  for (const clip of clips) {
    process.stdout.write(`${clip.id}: ${clip.heygenVideoUrl || clip.heygenVideoLocal || 'pending'}\n`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
