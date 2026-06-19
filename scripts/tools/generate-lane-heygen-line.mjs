/**
 * Generate a HeyGen avatar clip for one Lane legacy line entry and update lane-heygen-lines.json.
 * Requires HEYGEN_API_KEY in the environment (loads .env) and server for health check unless --direct.
 *
 * Usage:
 *   node scripts/tools/generate-lane-heygen-line.mjs --person cornet-john-lane --force
 *   node scripts/tools/generate-lane-heygen-line.mjs --person cornet-john-lane --photo
 *   node scripts/tools/generate-lane-heygen-line.mjs --person sarah-dickinson-lane --photo --short --force --direct --cache-local
 *   node scripts/tools/generate-lane-heygen-line.mjs --person jonathan-homer-lane --photo --short --smoke --force --direct --cache-local
 *   node scripts/tools/generate-lane-heygen-line.mjs --person cornet-john-lane --download-local
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  heygenConfigured,
  uploadHeygenAsset,
  createPhotoAvatar,
  createAvatarVideo,
  getVideoStatus,
  listAvatars,
  listVoices
} from '../../services/heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CATALOG_PATH = path.join(ROOT, 'data/lane-heygen-lines.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Request failed ${res.status} ${url}`);
  }
  return json;
}

function portraitFilePath(portraitUrl) {
  if (!portraitUrl || !portraitUrl.startsWith('/')) return null;
  return path.join(PUBLIC_DIR, portraitUrl.replace(/^\//, ''));
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

async function pollVideoApi(base, videoId, timeoutMs = 600000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const data = await fetchJson(`${base}/api/heygen/videos/${encodeURIComponent(videoId)}`);
    const status = data.status || data.data?.status;
    if (status === 'completed' && data.videoUrl) return data.videoUrl;
    if (status === 'failed') throw new Error(`HeyGen render failed for ${videoId}`);
    process.stdout.write(`  status: ${status || 'pending'}…\n`);
    await sleep(5000);
  }
  throw new Error(`Timed out waiting for video ${videoId}`);
}

async function pickStudioAvatarAndVoice(person) {
  const avatarId = argValue('--avatar-id') || person.heygenAvatarId;
  const voiceId = argValue('--voice-id') || person.heygenVoiceId;
  if (avatarId) return { avatarId, voiceId: voiceId || undefined };

  const avatars = await listAvatars();
  const voices = await listVoices();
  const firstAvatar = avatars[0];
  const firstVoice = voices[0];
  const id = firstAvatar?.avatar_id || firstAvatar?.id || firstAvatar?.look_id;
  const vid = firstVoice?.voice_id || firstVoice?.id;
  if (!id) throw new Error('No avatars returned — pass --avatar-id');
  return { avatarId: id, voiceId: voiceId || vid };
}

async function preparePortraitUpload(filePath) {
  const meta = await sharp(filePath).metadata();
  if (meta.width && meta.height) {
    const tmp = `${filePath}.heygen-upload.png`;
    await sharp(filePath).png({ density: 300 }).toFile(tmp);
    return { uploadPath: tmp, cleanup: true };
  }
  return { uploadPath: filePath, cleanup: false };
}

async function resolvePhotoAvatar(person) {
  if (person.heygenPhotoAvatarId && !hasFlag('--new-photo-avatar')) {
    return person.heygenPhotoAvatarId;
  }
  const filePath = portraitFilePath(person.portraitUrl);
  if (!filePath) throw new Error('photo avatar requires portraitUrl under /public');
  const { uploadPath, cleanup } = await preparePortraitUpload(filePath);
  try {
    console.log(`Uploading portrait ${person.portraitUrl}…`);
    const asset = await uploadHeygenAsset(uploadPath);
    const avatarId = await createPhotoAvatar({
      name: `${person.name} — Lane photo line`,
      assetId: asset.asset_id
    });
    console.log(`Photo avatar created: ${avatarId} (waiting for HeyGen to process image…)`);
    await sleep(20000);
    return avatarId;
  } finally {
    if (cleanup) {
      await unlink(uploadPath).catch(() => {});
    }
  }
}

async function downloadMp4(remoteUrl, destAbs) {
  await mkdir(path.dirname(destAbs), { recursive: true });
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destAbs, buf);
  process.stdout.write(`Saved ${destAbs} (${buf.length} bytes)\n`);
}

function localVideoRel(slug, short) {
  return `/family/assets/video/${slug}-heygen${short ? '-short' : ''}.mp4`;
}

async function createVideoWithRetry(opts, maxAttempts = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await createAvatarVideo(opts);
    } catch (err) {
      lastErr = err;
      const msg = err?.message || '';
      if (!/missing image dimensions/i.test(msg) || attempt === maxAttempts) throw err;
      process.stdout.write(`  photo avatar not ready (attempt ${attempt}) — waiting 10s…\n`);
      await sleep(10000);
    }
  }
  throw lastErr;
}

function pickVoiceForPerson(person) {
  if (argValue('--voice-id') || person.heygenVoiceId) {
    return argValue('--voice-id') || person.heygenVoiceId;
  }
  if (person.slug === 'sarah-dickinson-lane') {
    return '42d00d4aac5441279d8536cd6b52c53c';
  }
  // Male English narrator default for colonial / scientific lines
  return '828b59f834fd4c7188da322b6d9b6c75';
}

async function main() {
  const personSlug = argValue('--person');
  if (!personSlug) {
    console.error('Usage: node scripts/tools/generate-lane-heygen-line.mjs --person <slug> [--photo] [--force]');
    process.exit(1);
  }

  if (!heygenConfigured()) {
    throw new Error('HEYGEN_API_KEY is not set in .env');
  }

  const base = (argValue('--base') || process.env.API_BASE || 'http://localhost:3000').replace(/\/$/, '');
  const short = hasFlag('--short');
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  const person = catalog?.people?.[personSlug];
  if (!person) throw new Error(`Unknown person slug: ${personSlug}`);

  if (hasFlag('--download-local')) {
    const remote = argValue('--url') || (short ? person.heygenVideoUrlShort : person.heygenVideoUrl);
    if (!remote || remote.startsWith('/')) {
      throw new Error('No remote video URL — generate first or pass --url');
    }
    const localRel = localVideoRel(personSlug, short);
    const destAbs = path.join(PUBLIC_DIR, localRel.replace(/^\//, ''));
    await downloadMp4(remote, destAbs);
    if (short) {
      person.heygenVideoLocalShort = localRel;
      person.heygenVideoUrlShort = localRel;
    } else {
      person.heygenVideoLocal = localRel;
      person.heygenVideoUrl = localRel;
    }
    catalog.people[personSlug] = person;
    await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    console.log(`Cached ${localRel}`);
    return;
  }

  const existingUrl = short ? person.heygenVideoUrlShort : person.heygenVideoUrl;
  if (existingUrl && !hasFlag('--force')) {
    console.log(`${person.name} already has ${short ? 'heygenVideoUrlShort' : 'heygenVideoUrl'} — use --force to regenerate`);
    return;
  }

  const script = hasFlag('--smoke')
    ? 'HeyGen lane test, ready to ship.'
    : short
      ? person.heygenScriptShort || person.heygenScript
      : person.heygenScript;
  if (!script) throw new Error(short ? 'heygenScriptShort is missing' : 'heygenScript is missing');
  if (hasFlag('--smoke')) {
    console.log('Smoke test (~5s clip, uses API credits)');
  }

  const usePhoto =
    hasFlag('--photo') ||
    person.heygenAvatarMode === 'photo' ||
    personSlug === 'cornet-john-lane' ||
    personSlug === 'jonathan-homer-lane';

  let avatarId;
  let voiceId = pickVoiceForPerson(person);
  let motionPrompt;
  let expressiveness;

  if (usePhoto) {
    avatarId = await resolvePhotoAvatar(person);
    person.heygenPhotoAvatarId = avatarId;
    person.heygenAvatarMode = 'photo';
    motionPrompt = person.heygenMotionPrompt || 'subtle dignified nod, historical portrait speaking';
    expressiveness = person.heygenExpressiveness || 'low';
  } else {
    ({ avatarId, voiceId } = await pickStudioAvatarAndVoice(person));
  }

  if (voiceId) person.heygenVoiceId = voiceId;

  console.log(`Creating video for ${person.name} (${usePhoto ? 'photo' : 'studio'} avatar ${avatarId})…`);

  const created = await createVideoWithRetry({
    avatarId,
    voiceId,
    script,
    title: person.heygenTitle || person.name,
    aspectRatio: '16:9',
    motionPrompt: usePhoto ? motionPrompt : undefined,
    expressiveness: usePhoto ? expressiveness : undefined
  });

  const videoId = created?.video_id;
  if (!videoId) throw new Error('No videoId returned from HeyGen');

  console.log(`Queued ${videoId} — polling…`);
  const videoUrl = hasFlag('--direct')
    ? await pollVideoDirect(videoId)
    : await pollVideoApi(base, videoId);

  if (short) {
    person.heygenVideoIdShort = videoId;
    person.heygenVideoUrlShort = videoUrl;
  } else {
    person.heygenVideoId = videoId;
    person.heygenVideoUrl = videoUrl;
  }
  catalog.people[personSlug] = person;
  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  console.log(`Done. ${short ? 'heygenVideoUrlShort' : 'heygenVideoUrl'} saved for ${personSlug}`);
  console.log(videoUrl);

  if (hasFlag('--cache-local')) {
    const localRel = localVideoRel(personSlug, short);
    const destAbs = path.join(PUBLIC_DIR, localRel.replace(/^\//, ''));
    await downloadMp4(videoUrl, destAbs);
    if (short) {
      person.heygenVideoLocalShort = localRel;
      person.heygenVideoUrlShort = localRel;
    } else {
      person.heygenVideoLocal = localRel;
      person.heygenVideoUrl = localRel;
    }
    catalog.people[personSlug] = person;
    await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    console.log(`Cached locally at ${localRel}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
