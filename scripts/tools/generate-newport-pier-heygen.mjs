/**
 * Generate, cache, and sync Newport Pier HeyGen clips per stop.
 * Updates data/newport-pier-fish.json with local MP4 + PiP WebM paths.
 *
 * Usage:
 *   node scripts/tools/generate-newport-pier-heygen.mjs --sync
 *   node scripts/tools/generate-newport-pier-heygen.mjs --missing --direct --cache-local
 *   node scripts/tools/generate-newport-pier-heygen.mjs --all --force --direct --cache-local --pip
 *   node scripts/tools/generate-newport-pier-heygen.mjs --stop outer-pier --direct --cache-local --pip
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  heygenConfigured,
  createAvatarVideo,
  getVideoStatus
} from '../../services/heygen.service.js';
import { registerHeygenApiVideo } from '../../services/heygen-library.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_PATH = path.join(ROOT, 'data/newport-pier-fish.json');
const REGISTRY_PATH = path.join(ROOT, 'data/heygen-video-library.json');
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

function libraryIdForStop(stopId) {
  return `nature-pier-${stopId}`;
}

function localMp4Rel(stopId) {
  return `/nature/assets/video/nature-pier-${stopId}.mp4`;
}

function localWebmRel(stopId) {
  return `/nature/assets/video/nature-pier-${stopId}-pip.webm`;
}

async function fileExists(absPath) {
  try {
    await access(absPath);
    return true;
  } catch {
    return false;
  }
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

function postprocessPip(inputAbs, outputAbs) {
  const key = '0x00FF00';
  const vf = `chromakey=${key}:0.14:0.06,format=yuva420p`;
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-i', inputAbs, '-vf', vf, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-an', outputAbs],
    { stdio: 'inherit', shell: false, windowsHide: true }
  );
  if (r.status !== 0) throw new Error(`ffmpeg postprocess failed (${r.status})`);
}

function probeVideo(inputAbs) {
  const r = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=codec_name,pix_fmt',
      '-show_entries',
      'stream_tags=alpha_mode',
      '-of',
      'json',
      inputAbs
    ],
    { encoding: 'utf8', shell: false, windowsHide: true }
  );
  if (r.status !== 0) return null;
  try {
    const json = JSON.parse(r.stdout || '{}');
    const stream = json.streams?.[0] || {};
    return {
      codec: stream.codec_name || '',
      pixFmt: stream.pix_fmt || '',
      alphaMode: stream.tags?.alpha_mode === '1'
    };
  } catch {
    return null;
  }
}

function remuxAlphaWebm(inputAbs, outputAbs) {
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-i', inputAbs, '-map', '0:v:0', '-c:v', 'copy', '-an', outputAbs],
    { stdio: 'inherit', shell: false, windowsHide: true }
  );
  if (r.status !== 0) throw new Error(`ffmpeg remux failed (${r.status})`);
}

async function loadRegistryMap() {
  try {
    const registry = JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
    const map = new Map();
    for (const row of registry.videos || []) {
      if (row?.id?.startsWith('nature-pier-')) map.set(row.id, row);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function syncStopFromLocal(stop, registryMap) {
  const libId = libraryIdForStop(stop.id);
  const mp4Rel = localMp4Rel(stop.id);
  const mp4Abs = path.join(PUBLIC_DIR, mp4Rel.replace(/^\//, ''));
  const registryRow = registryMap.get(libId);

  if (await fileExists(mp4Abs)) {
    stop.heygenVideoUrl = mp4Rel;
    if (registryRow?.videoId) stop.heygenVideoId = registryRow.videoId;
    return true;
  }

  if (registryRow?.videoUrl?.startsWith('/')) {
    stop.heygenVideoUrl = registryRow.videoUrl;
    if (registryRow.videoId) stop.heygenVideoId = registryRow.videoId;
    return true;
  }

  if (registryRow?.videoId && heygenConfigured()) {
    const status = await getVideoStatus(registryRow.videoId);
    if (status?.status === 'completed' && status?.video_url) {
      await downloadMp4(status.video_url, mp4Abs);
      stop.heygenVideoUrl = mp4Rel;
      stop.heygenVideoId = registryRow.videoId;
      registryRow.videoUrl = mp4Rel;
      registryRow.hostedLocally = true;
      return true;
    }
  }

  return false;
}

async function generateStop(stop, catalog) {
  if (!heygenConfigured()) throw new Error('HEYGEN_API_KEY is not set in .env');
  const avatarId = argValue('--avatar-id') || catalog.avatar?.avatarId;
  const voiceId = argValue('--voice-id') || catalog.avatar?.voiceId;
  if (!avatarId || !voiceId) throw new Error('avatarId/voiceId missing in catalog.avatar');

  const script = stop.heygenScript?.trim();
  if (!script) {
    console.log(`Skip ${stop.id} — no heygenScript`);
    return false;
  }

  const title = `Newport Pier — ${stop.label}`;
  console.log(`Creating ${stop.id} (${avatarId})…`);
  const created = await createAvatarVideo({
    avatarId,
    voiceId,
    script,
    title,
    aspectRatio: '16:9'
  });

  const videoId = created?.video_id;
  if (!videoId) throw new Error('No videoId returned from HeyGen');

  const libId = libraryIdForStop(stop.id);
  await registerHeygenApiVideo({
    id: libId,
    videoId,
    title,
    domain: 'nature',
    variant: 'generated',
    script,
    sourcePage: '/nature/newport-pier.html',
    studioPage: '/nature/newport-pier.html',
    tags: ['newport-pier', stop.id]
  });

  console.log(`Queued ${videoId} — polling…`);
  const remoteUrl = hasFlag('--direct') ? await pollVideoDirect(videoId) : remoteUrlFromApi(videoId);
  const mp4Rel = localMp4Rel(stop.id);
  const mp4Abs = path.join(PUBLIC_DIR, mp4Rel.replace(/^\//, ''));
  await downloadMp4(remoteUrl, mp4Abs);
  stop.heygenVideoUrl = mp4Rel;
  stop.heygenVideoId = videoId;
  console.log(`${stop.id}: cached at ${mp4Rel}`);
  return true;
}

async function remoteUrlFromApi(videoId) {
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

async function ensurePipWebm(stop) {
  const mp4Rel = stop.heygenVideoUrl;
  if (!mp4Rel?.startsWith('/')) return false;

  const mp4Abs = path.join(PUBLIC_DIR, mp4Rel.replace(/^\//, ''));
  const webmRel = localWebmRel(stop.id);
  const webmAbs = path.join(PUBLIC_DIR, webmRel.replace(/^\//, ''));

  if (!(await fileExists(mp4Abs))) {
    console.log(`Skip PiP ${stop.id} — MP4 missing at ${mp4Rel}`);
    return false;
  }

  if ((await fileExists(webmAbs)) && !hasFlag('--force')) {
    stop.heygenVideoAlphaUrl = webmRel;
    return true;
  }

  await mkdir(path.dirname(webmAbs), { recursive: true });
  const probe = probeVideo(mp4Abs);
  const hasAlpha =
    probe?.alphaMode ||
    probe?.pixFmt?.includes('yuva') ||
    (probe?.codec === 'vp9' && /\.mp4$/i.test(mp4Abs));
  console.log(`PiP ${stop.id}: ${mp4Abs} → ${webmAbs}${hasAlpha ? ' (alpha remux)' : ' (chromakey)'}`);
  if (hasAlpha) remuxAlphaWebm(mp4Abs, webmAbs);
  else postprocessPip(mp4Abs, webmAbs);
  stop.heygenVideoAlphaUrl = webmRel;
  return true;
}

async function saveCatalog(catalog) {
  await writeFile(DATA_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
}

async function saveRegistry(registryMap) {
  const registry = JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
  for (const [id, row] of registryMap.entries()) {
    const idx = registry.videos.findIndex((v) => v.id === id);
    const merged = {
      ...(idx >= 0 ? registry.videos[idx] : {}),
      ...row,
      studioPage: '/nature/newport-pier.html',
      sourcePage: '/nature/newport-pier.html'
    };
    if (idx >= 0) registry.videos[idx] = merged;
    else registry.videos.push(merged);
  }
  await writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

async function main() {
  const catalog = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const registryMap = await loadRegistryMap();
  const stopFilter = argValue('--stop');
  const stops = (catalog.stops || []).filter((s) => !stopFilter || s.id === stopFilter);
  if (!stops.length) throw new Error(stopFilter ? `Unknown stop: ${stopFilter}` : 'No stops in catalog');

  let changed = false;

  if (hasFlag('--sync') || hasFlag('--all') || hasFlag('--missing')) {
    for (const stop of stops) {
      if (await syncStopFromLocal(stop, registryMap)) {
        console.log(`Synced ${stop.id} → ${stop.heygenVideoUrl}`);
        changed = true;
      }
    }
  }

  const shouldGenerate =
    hasFlag('--all') ||
    hasFlag('--missing') ||
    (hasFlag('--force') && !hasFlag('--sync') && !hasFlag('--pip'));

  if (shouldGenerate) {
    for (const stop of stops) {
      const hasLocal =
        stop.heygenVideoUrl?.startsWith('/') && (await fileExists(path.join(PUBLIC_DIR, stop.heygenVideoUrl.slice(1))));
      if (hasLocal && !hasFlag('--force')) continue;
      if (hasFlag('--missing') && hasLocal) continue;
      if (await generateStop(stop, catalog)) changed = true;
    }
  }

  if (hasFlag('--pip') || hasFlag('--all')) {
    for (const stop of stops) {
      if (await ensurePipWebm(stop)) {
        console.log(`PiP ready ${stop.id} → ${stop.heygenVideoAlphaUrl}`);
        changed = true;
      }
    }
  }

  if (changed) {
    await saveCatalog(catalog);
    if (registryMap.size) await saveRegistry(registryMap);
    console.log('Updated data/newport-pier-fish.json');
  } else {
    console.log('No catalog changes.');
  }

  if (!hasFlag('--sync') && !hasFlag('--all') && !hasFlag('--missing') && !hasFlag('--pip') && !hasFlag('--force')) {
    console.error(
      'Usage: node scripts/tools/generate-newport-pier-heygen.mjs [--sync] [--missing|--all] [--stop <id>] [--force] [--direct] [--pip]'
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
