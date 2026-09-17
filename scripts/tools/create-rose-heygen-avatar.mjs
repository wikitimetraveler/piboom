/**
 * Create Rose (astrology parlor) HeyGen photo avatar + optional intro video.
 * Requires HEYGEN_API_KEY in .env
 *
 * Usage:
 *   node scripts/tools/create-rose-heygen-avatar.mjs --dry-run
 *   node scripts/tools/create-rose-heygen-avatar.mjs --create-avatar
 *   node scripts/tools/create-rose-heygen-avatar.mjs --create-avatar --video --direct --cache-local
 *   node scripts/tools/create-rose-heygen-avatar.mjs --video-only --direct --cache-local
 *   node scripts/tools/create-rose-heygen-avatar.mjs --lang vi --video-only --direct --cache-local
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
import {
  getRoseDemoShort,
  pickRoseVoice,
  ROSE_LANGS,
  ROSE_VIDEO_LOCAL,
} from '../../services/rose-heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORTRAIT = path.join(ROOT, 'public/entertainment/assets/rose-guide-portrait.png');
const AVATAR_MD = path.join(ROOT, 'AVATAR-ROSE.md');
const DEMO_JSON = path.join(ROOT, 'data/rose-heygen-demo.json');

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx < 0 || idx >= process.argv.length - 1) return null;
  return process.argv[idx + 1];
}

function resolveLang() {
  const raw = String(argValue('--lang') || 'en').toLowerCase().slice(0, 2);
  if (!ROSE_LANGS.includes(raw)) {
    throw new Error(`--lang must be one of: ${ROSE_LANGS.join(', ')}`);
  }
  return raw;
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
  const lang = resolveLang();
  const short = getRoseDemoShort(lang);
  const localPath = short.localPath;
  const localAbs = path.join(ROOT, 'public', localPath.replace(/^\//, ''));

  const demo = JSON.parse(await readFile(DEMO_JSON, 'utf8'));

  let lookId = demo.heygenAvatarId || demo.avatar?.lookId || null;
  let groupId = demo.heygenAvatarGroupId || demo.avatar?.groupId || null;
  let voiceId =
    argValue('--voice-id') ||
    (lang === 'vi' ? demo.heygenVoiceIdVi || null : demo.heygenVoiceId || null);
  let voiceName =
    lang === 'vi'
      ? demo.heygenVoiceNameVi || 'Rose'
      : demo.heygenVoiceName || 'Rose';

  // Never reuse a known male Vietnamese catalog pick for Rose.
  if (lang === 'vi' && !argValue('--voice-id')) {
    const maleNames = /son tran|minh quang|dang tung|minhtrung|ly hai|anh đức|kim hung|huynhduong|khanhlq|việt dũng|nổi tiếng/i;
    if (maleNames.test(String(voiceName)) || voiceId === '0132f85950a94d11ba180f885101bf84') {
      voiceId = null;
      voiceName = 'Rose';
    }
  }

  console.log(`Rose HeyGen plan [${lang}]`);
  console.log(`  script: ${short.script.slice(0, 80)}…`);
  console.log(`  portrait: ${PORTRAIT}`);
  console.log(`  look: ${lookId || 'will create'}`);
  console.log(`  voice language: ${short.voiceLanguage}`);
  console.log(`  voice: ${voiceName} (${voiceId || 'pick from catalog'})`);
  console.log(`  local: ${localPath}`);
  console.log(`  createAvatar=${createAvatar} video=${wantVideo}`);
  if (dry) {
    console.log('Dry run — no credits spent.');
    return;
  }

  if (!heygenConfigured()) {
    throw new Error('HEYGEN_API_KEY is not configured');
  }

  const voices = await listVoices({
    language: short.voiceLanguage,
    maxPages: lang === 'vi' ? 20 : 2,
  });
  if (voiceId && argValue('--voice-id')) {
    const named = voices.find((v) => (v.voice_id || v.id) === voiceId);
    if (named) voiceName = named.name || named.voice_name || voiceName;
    if (!named) {
      const all = await listVoices({ maxPages: 20 });
      const hit = all.find((v) => (v.voice_id || v.id) === voiceId);
      if (hit) {
        voiceName = hit.name || hit.voice_name || voiceName;
        if (String(hit.gender || '').toLowerCase() === 'male') {
          throw new Error(`Voice ${voiceId} is male — Rose requires a female voice.`);
        }
      }
    }
  }
  const picked = pickRoseVoice(voices, lang);
  if (picked && !argValue('--voice-id')) {
    voiceId = picked.voiceId;
    voiceName = picked.voiceName;
  }
  if (!voiceId && lang === 'vi') {
    const all = await listVoices({ maxPages: 20 });
    const fallback = pickRoseVoice(all, lang);
    if (fallback) {
      voiceId = fallback.voiceId;
      voiceName = fallback.voiceName;
    }
  }
  console.log(`  resolved voice: ${voiceName} (${voiceId || 'unresolved'})`);
  if (!voiceId) {
    throw new Error(
      lang === 'vi'
        ? 'No female Vietnamese HeyGen voice found for Rose. Pass --voice-id with a female voice.'
        : 'No suitable Rose voice found.'
    );
  }
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
  if (lang === 'vi') {
    demo.heygenScriptShortVi = short.script;
    demo.heygenVoiceIdVi = voiceId;
    demo.heygenVoiceNameVi = voiceName;
    demo.titleVi = short.title;
  } else {
    demo.heygenVoiceId = voiceId;
    demo.heygenVoiceName = voiceName;
    demo.heygenScriptShort = short.script;
    demo.title = short.title;
  }
  if (demo.avatar) {
    demo.avatar.lookId = lookId;
    demo.avatar.groupId = groupId;
    demo.avatar.status = lookId ? 'heygen-ready' : demo.avatar.status;
  }
  await writeFile(DEMO_JSON, `${JSON.stringify(demo, null, 2)}\n`, 'utf8');
  if (lang === 'en') {
    await patchAvatarMd({ groupId, lookId, voiceId, voiceName });
  }

  if (hasFlag('--avatar-only')) {
    console.log('Avatar only — stopping before video render.');
    return;
  }

  if (!wantVideo) {
    console.log('Avatar/catalog updated. Pass --video --cache-local to render intro.');
    return;
  }

  if (!lookId || !voiceId) {
    throw new Error('Need avatar look id and voice id before rendering. Re-run with --create-avatar or fix voice pick.');
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

  if (lang === 'vi') {
    demo.heygenVideoIdShortVi = videoId;
    demo.heygenVideoUrlShortVi = url;
    demo.generatedAtVi = new Date().toISOString();
  } else {
    demo.heygenVideoIdShort = videoId;
    demo.heygenVideoUrlShort = url;
    demo.generatedAt = new Date().toISOString();
  }

  if (hasFlag('--cache-local')) {
    await cacheLocal(url, localAbs);
    if (lang === 'vi') {
      demo.heygenVideoLocalShortVi = localPath;
      demo.heygenVideoUrlShortVi = null;
    } else {
      demo.heygenVideoLocalShort = localPath;
      demo.heygenVideoUrlShort = null;
    }
    if (demo.avatar) demo.avatar.status = 'heygen-ready-with-video';
    console.log(`Cached ${localPath}`);
  }

  await writeFile(DEMO_JSON, `${JSON.stringify(demo, null, 2)}\n`, 'utf8');
  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
