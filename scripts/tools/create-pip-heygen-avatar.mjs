/**
 * Create Pip (Glazed baker) HeyGen photo avatar + optional intro video.
 * Requires HEYGEN_API_KEY in .env
 *
 * Usage:
 *   node scripts/tools/create-pip-heygen-avatar.mjs
 *   node scripts/tools/create-pip-heygen-avatar.mjs --video --cache-local
 *   node scripts/tools/create-pip-heygen-avatar.mjs --video-only --cache-local
 */
import 'dotenv/config';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  heygenConfigured,
  uploadHeygenAsset,
  listVoices,
  createAvatarVideo,
  waitForVideo
} from '../../services/heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORTRAIT = path.join(ROOT, 'public/donuts/assets/pip-baker-portrait.png');
const AVATAR_MD = path.join(ROOT, 'AVATAR-PIP.md');
const DEMO_JSON = path.join(ROOT, 'data/donuts-heygen-demo.json');
const GALLERY_JSON = path.join(ROOT, 'data/donuts-gallery.json');
const LOCAL_REL = '/donuts/assets/video/glazed-pip-intro.mp4';
const LOCAL_ABS = path.join(ROOT, 'public', LOCAL_REL.replace(/^\//, ''));

const WELCOME =
  "Hey! I'm Pip — welcome to Glazed, celebrating Savy Donuts and Smoothies on Harbor. Flip any donut or smoothie card for the recipe and the story. Ask me in chat too — I'm your baker guide.";

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

async function pickWarmFemaleEnglishVoice() {
  const voices = await listVoices();
  const scored = voices
    .map((v) => {
      const name = String(v.name || v.voice_name || '').toLowerCase();
      const gender = String(v.gender || v.sex || '').toLowerCase();
      const lang = String(v.language || v.locale || '').toLowerCase();
      let score = 0;
      if (gender.includes('female') || gender === 'woman' || gender === 'f') score += 6;
      if (lang.includes('english') || lang.startsWith('en')) score += 5;
      if (/italian|spanish|french|german|japanese|chinese|korean|portuguese|hindi|arabic/.test(`${name} ${lang}`)) {
        score -= 10;
      }
      if (/warm|friendly|cheerful|upbeat|playful|soft|sweet|natural|conversational/.test(name)) score += 2;
      return {
        voiceId: v.voice_id || v.id,
        voiceName: v.name || v.voice_name || v.voice_id || v.id,
        score
      };
    })
    .filter((v) => v.voiceId)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) throw new Error('No HeyGen voices available');
  return best;
}

async function createAvatarFull({ name, assetId }) {
  const key = (process.env.HEYGEN_API_KEY || '').trim();
  const res = await fetch('https://api.heygen.com/v3/avatars', {
    method: 'POST',
    headers: {
      'X-Api-Key': key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'photo',
      name,
      file: { type: 'asset_id', asset_id: assetId }
    })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || json?.message || `Create avatar failed (${res.status})`;
    const err = new Error(message);
    err.details = json;
    throw err;
  }
  const data = json?.data ?? json;
  const lookId = data?.avatar_item?.id || data?.id;
  const groupId = data?.avatar_item?.group_id || data?.group_id || '';
  if (!lookId) throw new Error('HeyGen did not return avatar look id');
  return { lookId, groupId, raw: data };
}

async function createVideoWithRetry(opts, maxAttempts = 6) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await createAvatarVideo(opts);
    } catch (err) {
      lastErr = err;
      const msg = err?.message || '';
      if (!/missing image dimensions/i.test(msg) || attempt === maxAttempts) throw err;
      process.stdout.write(`  photo avatar not ready (attempt ${attempt}) — waiting 12s…\n`);
      await sleep(12000);
    }
  }
  throw lastErr;
}

async function updateAvatarMd({ groupId, lookId, voiceId, voiceName }) {
  let md = await readFile(AVATAR_MD, 'utf8');
  const now = new Date().toISOString();
  md = md
    .replace(/- Group ID:.*/, `- Group ID: ${groupId || ''}`)
    .replace(/- Voice ID:.*/, `- Voice ID: ${voiceId}`)
    .replace(/- Voice Name:.*/, `- Voice Name: ${voiceName}`)
    .replace(/- Voice Designed:.*/, `- Voice Designed: false`)
    .replace(/- Looks:.*/, `- Looks: landscape=${lookId}, portrait=${lookId}, square=${lookId}`)
    .replace(/- Last Synced:.*/, `- Last Synced: ${now}`);
  await writeFile(AVATAR_MD, md, 'utf8');
}

async function updateDemoJson(patch) {
  const demo = JSON.parse(await readFile(DEMO_JSON, 'utf8'));
  const { avatar: avatarPatch, ...rest } = patch;
  Object.assign(demo, rest);
  if (avatarPatch) {
    demo.avatar = { ...(demo.avatar || {}), ...avatarPatch };
  }
  await writeFile(DEMO_JSON, JSON.stringify(demo, null, 2) + '\n', 'utf8');
}

async function downloadMp4(remoteUrl, destAbs) {
  await mkdir(path.dirname(destAbs), { recursive: true });
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destAbs, buf);
  process.stdout.write(`Saved ${destAbs} (${buf.length} bytes)\n`);
}

async function ensureAvatarIds() {
  if (hasFlag('--video-only')) {
    const demo = JSON.parse(await readFile(DEMO_JSON, 'utf8'));
    const lookId = demo.heygenAvatarId || demo.avatar?.lookId;
    const groupId = demo.heygenAvatarGroupId || demo.avatar?.groupId || '';
    if (!lookId) throw new Error('--video-only requires heygenAvatarId in donuts-heygen-demo.json');
    return { lookId, groupId };
  }

  process.stdout.write('Preparing Pip portrait upload…\n');
  const uploadPath = await preparePortraitUpload(PORTRAIT);
  try {
    process.stdout.write('Uploading Pip portrait…\n');
    const asset = await uploadHeygenAsset(uploadPath);
    process.stdout.write(`  asset_id: ${asset.asset_id}\n`);

    process.stdout.write('Creating Pip photo avatar…\n');
    const created = await createAvatarFull({
      name: 'Pip — Glazed baker',
      assetId: asset.asset_id
    });
    process.stdout.write(`  look_id: ${created.lookId}\n`);
    process.stdout.write(`  group_id: ${created.groupId || '(none)'}\n`);
    process.stdout.write('Waiting 20s for HeyGen image processing…\n');
    await sleep(20000);
    return created;
  } finally {
    await unlink(uploadPath).catch(() => {});
  }
}

async function main() {
  if (!heygenConfigured()) {
    console.error('HEYGEN_API_KEY is not configured');
    process.exit(1);
  }

  const { lookId, groupId } = await ensureAvatarIds();

  process.stdout.write('Picking warm female English voice…\n');
  const voice = await pickWarmFemaleEnglishVoice();
  process.stdout.write(`  voice: ${voice.voiceName} (${voice.voiceId})\n`);

  await updateAvatarMd({
    groupId,
    lookId,
    voiceId: voice.voiceId,
    voiceName: voice.voiceName
  });
  process.stdout.write(`Updated ${AVATAR_MD}\n`);

  await updateDemoJson({
    heygenAvatarId: lookId,
    heygenAvatarGroupId: groupId || null,
    heygenVoiceId: voice.voiceId,
    heygenVoiceName: voice.voiceName,
    heygenScriptShort: WELCOME,
    avatar: {
      name: 'Pip',
      file: 'AVATAR-PIP.md',
      portrait: '/donuts/assets/pip-baker-portrait.png',
      status: 'heygen-ready',
      lookId,
      groupId: groupId || null,
      voiceId: voice.voiceId
    }
  });
  process.stdout.write(`Updated ${DEMO_JSON}\n`);

  try {
    const gallery = JSON.parse(await readFile(GALLERY_JSON, 'utf8'));
    if (gallery.brand) gallery.brand.welcomeScript = WELCOME;
    await writeFile(GALLERY_JSON, JSON.stringify(gallery, null, 2) + '\n', 'utf8');
  } catch (_) {
    /* optional */
  }

  if (!hasFlag('--video') && !hasFlag('--video-only')) {
    process.stdout.write('\nPip avatar ready. Re-run with --video --cache-local to render the intro MP4.\n');
    return;
  }

  process.stdout.write('Rendering Pip welcome video…\n');
  const created = await createVideoWithRetry({
    avatarId: lookId,
    voiceId: voice.voiceId,
    script: WELCOME,
    title: 'Glazed — Meet Pip',
    resolution: '1080p',
    aspectRatio: '16:9',
    expressiveness: 'medium'
  });
  const videoId = created?.video_id || created?.id;
  if (!videoId) throw new Error('No video_id returned');
  process.stdout.write(`  video_id: ${videoId}\n`);

  const done = await waitForVideo(videoId, { intervalMs: 5000, timeoutMs: 600000 });
  if (done?.status === 'failed') {
    throw new Error(`Video failed: ${JSON.stringify(done)}`);
  }
  const videoUrl = done?.video_url;
  process.stdout.write(`  status: ${done?.status}\n`);
  process.stdout.write(`  url: ${videoUrl || '(none)'}\n`);

  const patch = {
    heygenVideoIdShort: videoId,
    heygenVideoUrlShort: videoUrl || null,
    avatar: { status: 'heygen-ready-with-video' }
  };

  if (hasFlag('--cache-local') && videoUrl) {
    await downloadMp4(videoUrl, LOCAL_ABS);
    patch.heygenVideoLocalShort = LOCAL_REL;
  }

  await updateDemoJson(patch);
  process.stdout.write('\nDone — Pip intro video catalog updated.\n');
}

main().catch((err) => {
  console.error(err.message || err);
  if (err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
});
