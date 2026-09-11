/**
 * Queue a multi-avatar Video Agent conversation (Zigzag + Summer + Dave).
 * Direct POST /v3/videos cannot put three people in one chat — this uses Video Agent.
 * Requires HEYGEN_API_KEY in .env. Do not pass a single avatar_id (that locks one face).
 *
 * Usage:
 *   node scripts/tools/generate-lane-labs-intro-chat.mjs --dry-run
 *   node scripts/tools/generate-lane-labs-intro-chat.mjs --force --wait --cache-local
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  heygenConfigured,
  uploadHeygenAsset,
  createVideoAgent,
  getVideoAgentSession,
  listVideoAgentVideos,
  getVideoStatus,
} from '../../services/heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CATALOG = path.join(ROOT, 'data/lane-labs-intro-heygen.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TMP_DIR = path.join(ROOT, 'tmp');

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (chunk) => {
      err += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(-400)}`));
    });
  });
}

async function extractStill(srcAbs, destAbs) {
  await mkdir(path.dirname(destAbs), { recursive: true });
  await run('ffmpeg', [
    '-y',
    '-ss',
    '1.2',
    '-i',
    srcAbs,
    '-frames:v',
    '1',
    destAbs,
  ]);
}

async function toPng(srcAbs, destAbs) {
  await mkdir(path.dirname(destAbs), { recursive: true });
  await sharp(srcAbs).png().toFile(destAbs);
}

async function portraitPng(portrait, destAbs) {
  const stillAbs = portrait.stillFrom ? path.join(ROOT, portrait.stillFrom) : null;
  const srcAbs = path.join(ROOT, portrait.src);
  try {
    if (stillAbs) {
      await extractStill(stillAbs, destAbs);
      return destAbs;
    }
  } catch (err) {
    process.stdout.write(`  still extract failed for ${portrait.id}: ${err.message}\n`);
  }
  await toPng(srcAbs, destAbs);
  return destAbs;
}

async function downloadMp4(remoteUrl, destAbs) {
  await mkdir(path.dirname(destAbs), { recursive: true });
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destAbs, buf);
  process.stdout.write(`Saved ${destAbs} (${buf.length} bytes)\n`);
}

async function pollSession(sessionId, timeoutMs = 2700000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const videos = await listVideoAgentVideos(sessionId);
    const ready = videos.find((v) => v?.id && (v.status === 'completed' || v.video_url));
    const pending = videos.find((v) => v?.id);
    if (ready?.id) {
      process.stdout.write(`  session video ${ready.id} (${ready.status})\n`);
      return { session: { session_id: sessionId }, videoId: ready.id, video: ready };
    }
    if (pending?.id) {
      process.stdout.write(`  session video ${pending.id} ${pending.status || 'pending'}…\n`);
      return { session: { session_id: sessionId }, videoId: pending.id, video: pending };
    }
    try {
      const session = await getVideoAgentSession(sessionId);
      const status = session?.status;
      const videoId = session?.video_id;
      process.stdout.write(`  session ${status || 'pending'}${videoId ? ` · video ${videoId}` : ''}\n`);
      if (status === 'failed') {
        throw new Error(session?.error?.message || session?.failure_message || 'Video Agent session failed');
      }
      if (videoId) return { session, videoId };
    } catch (err) {
      const msg = String(err.message || '');
      if (err.status === 404 || /not found/i.test(msg)) {
        process.stdout.write('  thinking (no video yet)…\n');
      } else {
        throw err;
      }
    }
    await sleep(15000);
  }
  throw new Error(`Timed out waiting for video_id on session ${sessionId}`);
}

async function pollVideoDirect(videoId, timeoutMs = 2700000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const data = await getVideoStatus(videoId);
    const status = data?.status;
    if (status === 'completed' && data?.video_url) return data;
    if (status === 'failed') {
      throw new Error(data?.failure_message || `HeyGen render failed for ${videoId}`);
    }
    process.stdout.write(`  video ${status || 'pending'}…\n`);
    await sleep(15000);
  }
  throw new Error(`Timed out waiting for video ${videoId}`);
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, 'utf8'));
  const prompt = String(catalog.videoAgentPrompt || '').trim();
  if (!prompt) throw new Error('Missing videoAgentPrompt in lane-labs-intro-heygen.json');

  if (hasFlag('--dry-run')) {
    process.stdout.write(`${prompt}\n\n${prompt.length} chars\n`);
    return;
  }

  if (!heygenConfigured()) {
    throw new Error('HEYGEN_API_KEY is not set in .env');
  }

  if (catalog.chatHeygenVideoUrl && !hasFlag('--force')) {
    process.stdout.write('Chat video already exists — use --force to regenerate\n');
    return;
  }

  await mkdir(TMP_DIR, { recursive: true });
  const files = [];
  const tmpFiles = [];
  try {
    let sessionId = !hasFlag('--force') ? catalog.chatSessionId : '';
    if (sessionId) {
      process.stdout.write(`Resume session ${sessionId}\n`);
    } else {
      const portraits = catalog.portraits || [];
      if (portraits.length < 3) throw new Error('Need three portraits in catalog');
      for (const portrait of portraits) {
        const destAbs = path.join(TMP_DIR, `lane-labs-chat-${portrait.id}.png`);
        process.stdout.write(`Prepare ${portrait.name}…\n`);
        await portraitPng(portrait, destAbs);
        tmpFiles.push(destAbs);
        const asset = await uploadHeygenAsset(destAbs);
        files.push({ type: 'asset_id', asset_id: asset.asset_id });
        process.stdout.write(`  uploaded ${portrait.id}\n`);
      }

      process.stdout.write('Create Video Agent session (no single avatar lock)…\n');
      const created = await createVideoAgent({
        prompt,
        mode: 'generate',
        orientation: 'landscape',
        files,
      });
      sessionId = created?.session_id || created?.id;
      if (!sessionId) throw new Error('No session_id from Video Agent');
      catalog.chatSessionId = sessionId;
      catalog.chatSessionUrl = `https://app.heygen.com/video-agent/${sessionId}`;
      catalog.generatedAt = new Date().toISOString();
      await writeFile(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
      process.stdout.write(`Session ${sessionId}\n${catalog.chatSessionUrl}\n`);
    }

    if (!hasFlag('--wait')) {
      process.stdout.write('Queued. Re-run with --wait --cache-local to download.\n');
      return;
    }

    const { videoId } = await pollSession(sessionId);
    catalog.chatHeygenVideoId = videoId;
    await writeFile(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    const video = await pollVideoDirect(videoId);
    catalog.chatHeygenVideoUrl = video.video_url;
    catalog.chatDuration = video.duration;
    if (hasFlag('--cache-local') && catalog.chatLocalRel) {
      await downloadMp4(video.video_url, path.join(PUBLIC_DIR, catalog.chatLocalRel.replace(/^\//, '')));
      catalog.chatHeygenVideoLocal = catalog.chatLocalRel;
    }
    catalog.generatedAt = new Date().toISOString();
    await writeFile(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    process.stdout.write(`Ready ${catalog.chatHeygenVideoLocal || catalog.chatHeygenVideoUrl}\n`);
  } finally {
    await Promise.all(tmpFiles.map((file) => unlink(file).catch(() => {})));
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
