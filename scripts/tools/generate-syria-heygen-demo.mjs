/**
 * Generate the Syria atlas guide (Niqula) HeyGen popup clips — English and Arabic.
 * Requires HEYGEN_API_KEY in .env
 *
 * Usage:
 *   node scripts/tools/generate-syria-heygen-demo.mjs --dry-run
 *   node scripts/tools/generate-syria-heygen-demo.mjs --create-avatar
 *   node scripts/tools/generate-syria-heygen-demo.mjs --lang en --direct --cache-local
 *   node scripts/tools/generate-syria-heygen-demo.mjs --lang both --avatar-id <look_id> --direct --cache-local
 *   node scripts/tools/generate-syria-heygen-demo.mjs --lang ar --download-local
 *
 * Flags:
 *   --lang en|ar|both   which read to render (default both)
 *   --create-avatar     upload the Niqula portrait and create a HeyGen photo avatar first
 *   --avatar-only       create the avatar and stop (no render)
 *   --avatar-id <id>    avatar look id; defaults to the id saved in the demo JSON
 *   --voice-id <id>     override the auto-picked voice (single --lang only)
 *   --direct            poll HeyGen directly instead of through the local API
 *   --cache-local       download the finished MP4 into public/syria/assets/video/
 *   --download-local    only download an already-rendered remote URL
 *   --force             re-render even when a clip is already cached
 *   --dry-run           resolve avatar/voice and print the plan without spending credits
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  heygenConfigured,
  createAvatarVideo,
  createPhotoAvatar,
  getVideoStatus,
  listAvatars,
  listVoices,
  uploadHeygenAsset
} from '../../services/heygen.service.js';
import { getNiqulaDemoShort, pickNiqulaVoice, NIQULA_LANGS } from '../../services/syria-heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DEMO_PATH = path.join(ROOT, 'data/syria-heygen-demo.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function requestedLangs() {
  const raw = String(argValue('--lang') || 'both').toLowerCase();
  if (raw === 'both' || raw === 'all') return [...NIQULA_LANGS];
  const langs = raw.split(',').map((l) => l.trim()).filter((l) => NIQULA_LANGS.includes(l));
  if (!langs.length) throw new Error(`--lang must be one of: ${NIQULA_LANGS.join(', ')}, both`);
  return langs;
}

/** Per-language slots are objects in the demo JSON — read/write one language at a time. */
function slot(demo, key, lang) {
  const value = demo[key];
  if (value && typeof value === 'object') return value[lang] ?? null;
  return value ?? null;
}

function setSlot(demo, key, lang, value) {
  if (!demo[key] || typeof demo[key] !== 'object') demo[key] = {};
  demo[key][lang] = value;
}

async function readDemo() {
  return JSON.parse(await readFile(DEMO_PATH, 'utf8'));
}

async function writeDemo(demo) {
  await writeFile(DEMO_PATH, `${JSON.stringify(demo, null, 2)}\n`, 'utf8');
}

async function pollVideoDirect(videoId, timeoutMs = 900000) {
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

async function pollVideoViaApi(videoId, timeoutMs = 900000) {
  const base = (argValue('--base') || process.env.API_BASE || 'http://localhost:3000').replace(/\/$/, '');
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`${base}/api/heygen/videos/${encodeURIComponent(videoId)}`);
    const json = await res.json();
    const status = json.status || json.data?.status;
    if (status === 'completed' && json.videoUrl) return json.videoUrl;
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
  process.stdout.write(`  saved ${destAbs} (${buf.length} bytes)\n`);
}

/** Upload the Niqula portrait and register it as a HeyGen photo avatar. */
async function createNiqulaAvatar(demo) {
  const portraitRel = argValue('--portrait') || '/syria/assets/niqula-guide-portrait.png';
  const portraitAbs = path.join(PUBLIC_DIR, portraitRel.replace(/^\//, ''));
  const uploadPath = `${portraitAbs}.heygen-upload.png`;

  process.stdout.write(`Preparing ${portraitRel} for upload…\n`);
  await sharp(portraitAbs).resize(1024, 1024, { fit: 'cover' }).png({ density: 300 }).toFile(uploadPath);

  try {
    const asset = await uploadHeygenAsset(uploadPath);
    process.stdout.write(`  asset_id: ${asset.asset_id}\n`);
    const lookId = await createPhotoAvatar({ name: 'Niqula — Syria guide', assetId: asset.asset_id });
    process.stdout.write(`  look_id: ${lookId}\n`);

    // HeyGen assigns the group at creation; read it back off the look rather than parsing the create payload.
    const looks = await listAvatars({ maxPages: 2 });
    const created = looks.find((l) => (l.id || l.avatar_id) === lookId);
    const groupId = created?.group_id || null;
    process.stdout.write(`  group_id: ${groupId || '(none)'}\n`);
    process.stdout.write('Waiting 20s for HeyGen image processing…\n');
    await sleep(20000);

    demo.heygenAvatarId = lookId;
    demo.heygenAvatarGroupId = groupId;
    demo.avatar = {
      ...(demo.avatar || {}),
      source: portraitRel,
      lookId,
      groupId,
      status: 'heygen-ready'
    };
    return { lookId, groupId };
  } finally {
    await unlink(uploadPath).catch(() => {});
  }
}

/** A photo avatar can report "missing image dimensions" for a while after creation. */
async function createVideoWithRetry(opts, maxAttempts = 6) {
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

/** Niqula has no dedicated avatar yet — fall back to a male look so a render is still possible. */
async function resolveAvatarId(demo) {
  const explicit = argValue('--avatar-id') || demo.heygenAvatarId;
  if (explicit) return { avatarId: explicit, source: 'configured' };

  const looks = await listAvatars({ maxPages: 2 });
  const wantedName = String(argValue('--avatar-name') || '').toLowerCase();
  const byName = wantedName
    ? looks.find((l) => String(l.name || '').toLowerCase().includes(wantedName))
    : null;
  const male = looks.find((l) => String(l.gender || '').toLowerCase() === 'male');
  const chosen = byName || male || looks[0];
  const avatarId = chosen?.id || chosen?.avatar_id || chosen?.look_id;
  if (!avatarId) throw new Error('No avatar looks returned — pass --avatar-id');
  return { avatarId, source: `auto (${chosen.name || avatarId})`, groupId: chosen.group_id || null };
}

async function resolveVoiceId(demo, lang, { single }) {
  const override = single ? argValue('--voice-id') : undefined;
  const saved = slot(demo, 'heygenVoiceId', lang);
  if (override) return { voiceId: override, voiceName: 'override' };
  if (saved && !hasFlag('--repick-voice')) {
    return { voiceId: saved, voiceName: slot(demo, 'heygenVoiceName', lang) || saved };
  }

  const { voiceLanguage } = getNiqulaDemoShort(lang);
  // Only 9 of ~1200 voices are Arabic and they sit deep in the catalog — page past the 200-voice default.
  const voices = await listVoices({ language: voiceLanguage, maxPages: lang === 'en' ? 2 : 12 });
  const picked = pickNiqulaVoice(voices, lang);
  if (!picked) throw new Error(`No ${voiceLanguage} HeyGen voices found — pass --voice-id`);
  return picked;
}

async function renderLang(demo, lang, { single }) {
  const { title, script, localPath, aspectRatio } = getNiqulaDemoShort(lang);
  const localAbs = path.join(PUBLIC_DIR, localPath.replace(/^\//, ''));

  setSlot(demo, 'heygenScriptShort', lang, script);

  if (hasFlag('--download-local')) {
    const remote = argValue('--url') || slot(demo, 'heygenVideoUrlShort', lang);
    if (!remote || remote.startsWith('/')) {
      throw new Error(`[${lang}] no remote heygenVideoUrlShort — render first`);
    }
    await downloadMp4(remote, localAbs);
    setSlot(demo, 'heygenVideoLocalShort', lang, localPath);
    return;
  }

  const cached = slot(demo, 'heygenVideoLocalShort', lang);
  let cachedOnDisk = false;
  if (cached && !hasFlag('--force')) {
    try {
      await access(path.join(PUBLIC_DIR, String(cached).replace(/^\//, '')));
      cachedOnDisk = true;
    } catch (_) {
      cachedOnDisk = false;
    }
  }
  if (cachedOnDisk) {
    process.stdout.write(`[${lang}] already cached at ${cached} — use --force to re-render\n`);
    return;
  }

  const { avatarId, source } = await resolveAvatarId(demo);
  const { voiceId, voiceName } = await resolveVoiceId(demo, lang, { single });
  demo.heygenAvatarId = avatarId;
  setSlot(demo, 'heygenVoiceId', lang, voiceId);
  setSlot(demo, 'heygenVoiceName', lang, voiceName);

  process.stdout.write(
    `[${lang}] avatar ${avatarId} (${source}) · voice ${voiceName} (${voiceId}) · ${script.length} chars\n`
  );

  if (hasFlag('--dry-run')) {
    process.stdout.write(`[${lang}] dry run — no render submitted\n`);
    return;
  }

  const created = await createVideoWithRetry({
    avatarId,
    voiceId,
    script,
    title,
    aspectRatio: aspectRatio || '16:9',
    motionPrompt: demo.heygenMotionPrompt || undefined,
    expressiveness: demo.heygenExpressiveness || undefined
  });
  const videoId = created?.video_id || created?.id;
  if (!videoId) throw new Error(`[${lang}] no video_id returned from HeyGen`);
  process.stdout.write(`[${lang}] queued ${videoId} — polling…\n`);

  const videoUrl = hasFlag('--direct')
    ? await pollVideoDirect(videoId)
    : await pollVideoViaApi(videoId);

  setSlot(demo, 'heygenVideoIdShort', lang, videoId);
  setSlot(demo, 'heygenVideoUrlShort', lang, videoUrl);
  setSlot(demo, 'generatedAt', lang, new Date().toISOString());
  demo.avatar = { ...(demo.avatar || {}), status: 'heygen-ready-with-video' };

  if (hasFlag('--cache-local')) {
    await downloadMp4(videoUrl, localAbs);
    setSlot(demo, 'heygenVideoLocalShort', lang, localPath);
    // HeyGen's signed URLs expire in ~48h — don't leave a dead link in the committed catalog.
    setSlot(demo, 'heygenVideoUrlShort', lang, null);
  }
  process.stdout.write(`[${lang}] done — ${videoUrl}\n`);
}

async function main() {
  if (!heygenConfigured()) {
    throw new Error('HEYGEN_API_KEY is not set in .env');
  }

  const langs = requestedLangs();
  const demo = await readDemo();

  if (hasFlag('--create-avatar') || hasFlag('--avatar-only')) {
    await createNiqulaAvatar(demo);
    await writeDemo(demo);
    process.stdout.write(`Avatar saved to ${path.relative(ROOT, DEMO_PATH)}\n`);
    if (hasFlag('--avatar-only')) return;
  }

  for (const lang of langs) {
    await renderLang(demo, lang, { single: langs.length === 1 });
    if (!hasFlag('--dry-run')) await writeDemo(demo);
  }

  if (hasFlag('--dry-run')) {
    process.stdout.write('Dry run — catalog left unchanged\n');
    return;
  }
  process.stdout.write(`Updated ${path.relative(ROOT, DEMO_PATH)}\n`);
}

main().catch((err) => {
  console.error(err.message || err);
  if (err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
});
