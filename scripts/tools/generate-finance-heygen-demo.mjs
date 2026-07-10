/**
 * Generate finance booth HeyGen demo clips (calc engine, unit tests, Sven UX).
 * Requires HEYGEN_API_KEY in .env
 *
 * Usage:
 *   node scripts/tools/generate-finance-heygen-demo.mjs --demo calc-engine --force --direct --cache-local
 *   node scripts/tools/generate-finance-heygen-demo.mjs --demo unit-tests --force --direct --cache-local
 *   node scripts/tools/generate-finance-heygen-demo.mjs --demo sven-ux --force --direct --cache-local
 *   node scripts/tools/generate-finance-heygen-demo.mjs --all --force --direct --cache-local
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
import { getFinanceHeygenDemoShort, listFinanceHeygenDemoKeys } from '../../services/finance-heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const DEMO_CONFIG = {
  'calc-engine': {
    dataPath: 'data/calc-engine-heygen-demo.json',
    localRel: '/finance/assets/video/calc-engine-heygen-short.mp4',
    libraryId: 'finance-calc-engine-demo'
  },
  'unit-tests': {
    dataPath: 'data/unit-tests-heygen-demo.json',
    localRel: '/finance/assets/video/unit-tests-heygen-short.mp4',
    libraryId: 'finance-unit-tests-demo'
  },
  'sven-ux': {
    dataPath: 'data/sven-ux-heygen-demo.json',
    localRel: '/finance/assets/video/sven-ux-heygen-short.mp4',
    libraryId: 'finance-sven-ux-demo'
  }
};

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

async function generateOne(demoKey) {
  const config = DEMO_CONFIG[demoKey];
  if (!config) throw new Error(`Unknown demo key: ${demoKey}`);

  const demoPath = path.join(ROOT, config.dataPath);
  const demo = JSON.parse(await readFile(demoPath, 'utf8'));
  const { title, script, aspectRatio } = getFinanceHeygenDemoShort(demoKey);
  demo.title = title;
  demo.heygenTitle = title;
  demo.heygenScriptShort = script;

  const existing = demo.heygenVideoLocalShort || demo.heygenVideoUrlShort;
  if (existing && !hasFlag('--force')) {
    console.log(`${demoKey}: already has video — use --force to regenerate`);
    return;
  }

  const { avatarId, voiceId } = await pickAvatarAndVoice(demo);
  demo.heygenAvatarId = avatarId;
  demo.heygenVoiceId = voiceId;

  console.log(`Creating ${demoKey} demo video (avatar ${avatarId})…`);
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
  const videoUrl = hasFlag('--direct') ? await pollVideoDirect(videoId) : videoUrlFromApi(videoId);

  demo.heygenVideoIdShort = videoId;
  demo.heygenVideoUrlShort = videoUrl;
  demo.generatedAt = new Date().toISOString();
  await writeFile(demoPath, `${JSON.stringify(demo, null, 2)}\n`, 'utf8');
  console.log(`${demoKey}: remote URL saved.`);

  if (hasFlag('--cache-local')) {
    const destAbs = path.join(PUBLIC_DIR, config.localRel.replace(/^\//, ''));
    await downloadMp4(videoUrl, destAbs);
    demo.heygenVideoLocalShort = config.localRel;
    demo.heygenVideoUrlShort = config.localRel;
    await writeFile(demoPath, `${JSON.stringify(demo, null, 2)}\n`, 'utf8');
    console.log(`${demoKey}: cached at ${config.localRel}`);
  }
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

  const demoArg = argValue('--demo');
  const keys = hasFlag('--all')
    ? listFinanceHeygenDemoKeys()
    : demoArg
      ? [demoArg]
      : [];

  if (!keys.length) {
    console.error(
      'Usage: node scripts/tools/generate-finance-heygen-demo.mjs --demo <calc-engine|unit-tests|sven-ux> [--force] [--direct] [--cache-local]'
    );
    console.error('   or: node scripts/tools/generate-finance-heygen-demo.mjs --all [--force] [--direct] [--cache-local]');
    process.exit(1);
  }

  for (const key of keys) {
    await generateOne(key);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
