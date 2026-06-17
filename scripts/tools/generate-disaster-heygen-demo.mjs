/**
 * Generate the Unified Disasters shirt / booth HeyGen demo clip.
 * Requires HEYGEN_API_KEY in .env
 *
 * Usage:
 *   node scripts/tools/generate-disaster-heygen-demo.mjs --force --direct
 *   node scripts/tools/generate-disaster-heygen-demo.mjs --download-local
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  heygenConfigured,
  createAvatarVideo,
  getVideoStatus,
  listAvatars,
  listVoices
} from '../../services/heygen.service.js';
import { getSchemaDemoShort } from '../../services/disaster-heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DEMO_PATH = path.join(ROOT, 'data/disaster-heygen-demo.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const LOCAL_REL = '/finance/assets/disaster-heygen-demo.mp4';

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

async function pickAvatarAndVoice(demo) {
  const avatarId = argValue('--avatar-id') || demo.heygenAvatarId;
  const voiceId = argValue('--voice-id') || demo.heygenVoiceId || '828b59f834fd4c7188da322b6d9b6c75';
  if (avatarId) return { avatarId, voiceId };

  const avatars = await listAvatars();
  const voices = await listVoices();
  const firstAvatar = avatars[0];
  const firstVoice = voices[0];
  const id = firstAvatar?.avatar_id || firstAvatar?.id || firstAvatar?.look_id;
  const vid = firstVoice?.voice_id || firstVoice?.id;
  if (!id) throw new Error('No avatars returned — pass --avatar-id');
  return { avatarId: id, voiceId: voiceId || vid };
}

async function videoUrlFromApi(videoId) {
  const base = (argValue('--base') || process.env.API_BASE || 'http://localhost:3000').replace(/\/$/, '');
  const started = Date.now();
  while (Date.now() - started < 600000) {
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

async function main() {
  if (!heygenConfigured()) {
    throw new Error('HEYGEN_API_KEY is not set in .env');
  }

  const demo = JSON.parse(await readFile(DEMO_PATH, 'utf8'));
  const { title, script, aspectRatio } = getSchemaDemoShort();
  demo.title = title;

  if (hasFlag('--download-local') && !hasFlag('--force')) {
    const remote = argValue('--url') || demo.heygenVideoUrl;
    if (!remote || remote.startsWith('/')) {
      throw new Error('No remote heygenVideoUrl — generate first');
    }
    const destAbs = path.join(PUBLIC_DIR, LOCAL_REL.replace(/^\//, ''));
    await downloadMp4(remote, destAbs);
    demo.heygenVideoLocal = LOCAL_REL;
    demo.heygenVideoUrl = LOCAL_REL;
    await writeFile(DEMO_PATH, `${JSON.stringify(demo, null, 2)}\n`, 'utf8');
    console.log(`Local demo MP4 ready at ${LOCAL_REL}`);
    return;
  }

  if (demo.heygenVideoUrl && !demo.heygenVideoUrl.startsWith('/') && !hasFlag('--force')) {
    console.log('disaster-heygen-demo.json already has heygenVideoUrl — use --force to regenerate');
    return;
  }

  const { avatarId, voiceId } = await pickAvatarAndVoice(demo);
  demo.heygenAvatarId = avatarId;
  demo.heygenVoiceId = voiceId;

  console.log(`Creating Unified Disasters demo video (avatar ${avatarId})…`);
  const created = await createAvatarVideo({
    avatarId,
    voiceId,
    script,
    title,
    aspectRatio: aspectRatio || '16:9'
  });

  const videoId = created?.video_id;
  if (!videoId) throw new Error('No videoId returned from HeyGen');

  console.log(`Queued ${videoId} — polling…`);
  const videoUrl = hasFlag('--direct')
    ? await pollVideoDirect(videoId)
    : await videoUrlFromApi(videoId);

  demo.heygenVideoId = videoId;
  demo.heygenVideoUrl = videoUrl;
  demo.generatedAt = new Date().toISOString();
  await writeFile(DEMO_PATH, `${JSON.stringify(demo, null, 2)}\n`, 'utf8');
  console.log('Done. heygenVideoUrl saved.');
  console.log(videoUrl);

  if (hasFlag('--cache-local')) {
    const destAbs = path.join(PUBLIC_DIR, LOCAL_REL.replace(/^\//, ''));
    await downloadMp4(videoUrl, destAbs);
    demo.heygenVideoLocal = LOCAL_REL;
    demo.heygenVideoUrl = LOCAL_REL;
    await writeFile(DEMO_PATH, `${JSON.stringify(demo, null, 2)}\n`, 'utf8');
    console.log(`Cached locally at ${LOCAL_REL}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
