/**
 * Generate HeyGen quick-start guide clip and update lane-family-guide.json.
 * Usage: node scripts/tools/generate-lane-family-guide-video.mjs [--short] [--force] [--cache-local]
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  heygenConfigured,
  uploadHeygenAsset,
  createPhotoAvatar,
  createAvatarVideo,
  getVideoStatus
} from '../../services/heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const GUIDE_PATH = path.join(ROOT, 'data/lane-family-guide.json');
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
    process.stdout.write(`  status: ${status || 'pending'}…\n`);
    await sleep(5000);
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

async function resolvePhotoAvatar(guide) {
  if (guide.heygenPhotoAvatarId && !hasFlag('--new-photo-avatar')) {
    return guide.heygenPhotoAvatarId;
  }
  const portraitUrl = guide.portraitUrl || '/family/assets/DavidELane.png';
  const filePath = path.join(PUBLIC_DIR, portraitUrl.replace(/^\//, ''));
  const tmp = `${filePath}.heygen-upload.png`;
  await sharp(filePath).png({ density: 300 }).toFile(tmp);
  try {
    console.log(`Uploading portrait ${portraitUrl}…`);
    const asset = await uploadHeygenAsset(tmp);
    const avatarId = await createPhotoAvatar({
      name: 'David Lane — Lane Family guide',
      assetId: asset.asset_id
    });
    console.log(`Photo avatar created: ${avatarId}`);
    await sleep(20000);
    return avatarId;
  } finally {
    await import('node:fs/promises').then(({ unlink }) => unlink(tmp).catch(() => {}));
  }
}

async function main() {
  if (!heygenConfigured()) throw new Error('HEYGEN_API_KEY is not set in .env');

  const short = hasFlag('--short') || !hasFlag('--full');
  const guide = JSON.parse(await readFile(GUIDE_PATH, 'utf8'));
  const existing = short ? guide.heygenVideoUrlShort : guide.heygenVideoUrl;
  if (existing && !hasFlag('--force')) {
    console.log('Guide video already exists — use --force to regenerate');
    return;
  }

  const script = short ? guide.heygenScriptShort : guide.heygenScript;
  if (!script) throw new Error('Missing heygen script in lane-family-guide.json');

  const avatarId = await resolvePhotoAvatar(guide);
  guide.heygenPhotoAvatarId = avatarId;

  console.log(`Creating ${short ? 'short' : 'full'} guide video…`);
  const created = await createAvatarVideo({
    avatarId,
    voiceId: guide.heygenVoiceId,
    script,
    title: guide.heygenTitle || 'Lane Family guide',
    aspectRatio: '16:9',
    motionPrompt: guide.heygenMotionPrompt,
    expressiveness: guide.heygenExpressiveness || 'low'
  });

  const videoId = created?.video_id;
  if (!videoId) throw new Error('No videoId returned');

  console.log(`Queued ${videoId} — polling…`);
  const videoUrl = await pollVideoDirect(videoId);

  if (short) {
    guide.heygenVideoIdShort = videoId;
    guide.heygenVideoUrlShort = videoUrl;
  } else {
    guide.heygenVideoId = videoId;
    guide.heygenVideoUrl = videoUrl;
  }

  await writeFile(GUIDE_PATH, `${JSON.stringify(guide, null, 2)}\n`, 'utf8');
  console.log('Updated lane-family-guide.json');
  console.log(videoUrl);

  if (hasFlag('--cache-local')) {
    const localRel = short
      ? '/family/assets/video/lane-family-guide-heygen-short.mp4'
      : '/family/assets/video/lane-family-guide-heygen.mp4';
    await downloadMp4(videoUrl, path.join(PUBLIC_DIR, localRel.replace(/^\//, '')));
    if (short) {
      guide.heygenVideoLocalShort = localRel;
      guide.heygenVideoUrlShort = localRel;
    } else {
      guide.heygenVideoLocal = localRel;
      guide.heygenVideoUrl = localRel;
    }
    await writeFile(GUIDE_PATH, `${JSON.stringify(guide, null, 2)}\n`, 'utf8');
    console.log(`Cached ${localRel}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
