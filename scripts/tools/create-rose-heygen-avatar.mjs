/**
 * Create Rose (astrology parlor) HeyGen photo avatar + optional intro video.
 * Requires HEYGEN_API_KEY in .env
 *
 * Usage:
 *   node scripts/tools/create-rose-heygen-avatar.mjs --dry-run
 *   node scripts/tools/create-rose-heygen-avatar.mjs --create-avatar
 *   node scripts/tools/create-rose-heygen-avatar.mjs --create-avatar --video --direct --cache-local
 *   node scripts/tools/create-rose-heygen-avatar.mjs --video-only --direct --cache-local
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  heygenConfigured,
  uploadHeygenAsset,
  listVoices,
  createPhotoAvatar,
  createAvatarVideo,
  getVideoStatus,
} from '../../services/heygen.service.js';
import { getRoseDemoShort, pickRoseVoice, ROSE_VIDEO_LOCAL } from '../../services/rose-heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORTRAIT = path.join(ROOT, 'public/entertainment/assets/rose-guide-portrait.png');
const AVATAR_MD = path.join(ROOT, 'AVATAR-ROSE.md');
const DEMO_JSON = path.join(ROOT, 'data/rose-heygen-demo.json');
const LOCAL_ABS = path.join(ROOT, 'public', ROSE_VIDEO_LOCAL.replace(/^\//, ''));

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function preparePortraitUpload(filePath) {
  const tmp = `${filePath}.heygen-upload.png`;
  await sharp(filePath).resize(1024, 1024, { fit: 'cover' }).png({ density: 300 }).toFile(tmp);
  return tmp;
}

async function pollVideo(videoId, timeoutMs = 900000) {
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

/** Photo avatars often report "missing image dimensions" for a minute after create. */
async function createVideoWithRetry(opts, maxAttempts = 8) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await createAvatarVideo(opts);
    } catch (err) {
      lastErr = err;
      if (!/missing image dimensions/i.test(err?.message || '') || attempt === maxAttempts) throw err;
      process.stdout.write(`  photo avatar not ready (attempt ${attempt}) — waiting 12s…\n`);
      await sleep(12000);
    }
  }
  throw lastErr;
}

async function cacheLocal(url, dest) {
  await mkdir(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

async function patchAvatarMd({ groupId, lookId, voiceId, voiceName }) {
  let md = await readFile(AVATAR_MD, 'utf8');
  const stamp = new Date().toISOString();
  md = md.replace(/- Group ID:.*$/m, `- Group ID: ${groupId || ''}`);
  md = md.replace(/- Voice ID:.*$/m, `- Voice ID: ${voiceId || ''}`);
  md = md.replace(/- Voice Name:.*$/m, `- Voice Name: ${voiceName || ''}`);
  md = md.replace(/- Looks:.*$/m, `- Looks: square=${lookId || ''}`);
  md = md.replace(/- Last Synced:.*$/m, `- Last Synced: ${stamp}`);
  md = md.replace(
    /- Status:.*$/m,
    '- Status: heygen-ready (photo avatar from parlor portrait)'
  );
  await writeFile(AVATAR_MD, md, 'utf8');
}

async function main() {
  const dry = hasFlag('--dry-run');
  const createAvatar = hasFlag('--create-avatar') || hasFlag('--avatar-only');
  const videoOnly = hasFlag('--video-only');
  const wantVideo = hasFlag('--video') || videoOnly || hasFlag('--cache-local');

  const demo = JSON.parse(await readFile(DEMO_JSON, 'utf8'));
  const short = getRoseDemoShort();

  let lookId = demo.heygenAvatarId || demo.avatar?.lookId || null;
  let groupId = demo.heygenAvatarGroupId || demo.avatar?.groupId || null;
  let voiceId = demo.heygenVoiceId || null;
  let voiceName = demo.heygenVoiceName || 'Rose';

  console.log('Rose HeyGen plan');
  console.log(`  script: ${short.script.slice(0, 80)}…`);
  console.log(`  portrait: ${PORTRAIT}`);
  console.log(`  look: ${lookId || 'will create'}`);
  console.log(`  voice: ${voiceName} (${voiceId || 'pick from catalog'})`);
  console.log(`  createAvatar=${createAvatar} video=${wantVideo}`);
  if (dry) {
    console.log('Dry run — no credits spent.');
    return;
  }

  if (!heygenConfigured()) {
    throw new Error('HEYGEN_API_KEY is not configured');
  }

  const voices = await listVoices();
  const picked = pickRoseVoice(voices);
  if (picked && !voiceId) {
    voiceId = picked.voiceId;
    voiceName = picked.voiceName;
  }
  console.log(`  resolved voice: ${voiceName} (${voiceId || 'unresolved'})`);

  if (createAvatar && !videoOnly) {
    const tmp = await preparePortraitUpload(PORTRAIT);
    try {
      const asset = await uploadHeygenAsset(tmp);
      const assetId = asset?.asset_id || asset?.id;
      if (!assetId) throw new Error('Upload returned no asset id');
      lookId = await createPhotoAvatar({
        name: 'Rose — parlor reader',
        assetId,
      });
      console.log(`Created Rose look ${lookId}`);
    } finally {
      await unlink(tmp).catch(() => {});
    }
  }

  demo.heygenAvatarId = lookId;
  demo.heygenAvatarGroupId = groupId;
  demo.heygenVoiceId = voiceId;
  demo.heygenVoiceName = voiceName;
  demo.heygenScriptShort = short.script;
  if (demo.avatar) {
    demo.avatar.lookId = lookId;
    demo.avatar.groupId = groupId;
    demo.avatar.status = lookId ? 'heygen-ready' : demo.avatar.status;
  }
  await writeFile(DEMO_JSON, `${JSON.stringify(demo, null, 2)}\n`, 'utf8');
  await patchAvatarMd({ groupId, lookId, voiceId, voiceName });

  if (hasFlag('--avatar-only')) {
    console.log('Avatar only — stopping before video render.');
    return;
  }

  if (!wantVideo) {
    console.log('Avatar/catalog updated. Pass --video --cache-local to render intro.');
    return;
  }

  if (!lookId || !voiceId) {
    throw new Error('Need avatar look id and voice id before rendering. Re-run with --create-avatar.');
  }

  const created = await createVideoWithRetry({
    avatarId: lookId,
    voiceId,
    script: short.script,
    aspectRatio: short.aspectRatio,
    title: short.title,
    motionPrompt: short.motionPrompt,
    expressiveness: short.expressiveness,
  });
  const videoId = created?.video_id || created?.id;
  if (!videoId) throw new Error('No video id from createAvatarVideo');
  console.log(`Rendering ${videoId}…`);
  const url = await pollVideo(videoId);
  demo.heygenVideoIdShort = videoId;
  demo.heygenVideoUrlShort = url;
  demo.generatedAt = new Date().toISOString();

  if (hasFlag('--cache-local')) {
    await cacheLocal(url, LOCAL_ABS);
    demo.heygenVideoLocalShort = ROSE_VIDEO_LOCAL;
    demo.heygenVideoUrlShort = null;
    if (demo.avatar) demo.avatar.status = 'heygen-ready-with-video';
    console.log(`Cached ${ROSE_VIDEO_LOCAL}`);
  }

  await writeFile(DEMO_JSON, `${JSON.stringify(demo, null, 2)}\n`, 'utf8');
  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
