/**
 * Poll HeyGen for completed registry videos and cache MP4s locally.
 * Updates data/heygen-video-library.json with hostedLocally paths.
 *
 * Usage:
 *   node scripts/tools/cache-heygen-library-videos.mjs
 *   node scripts/tools/cache-heygen-library-videos.mjs --id nature-pier-mid-pier
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { heygenConfigured, getVideoStatus } from '../../services/heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const REGISTRY_PATH = path.join(ROOT, 'data/heygen-video-library.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function localRelForEntry(entry) {
  const slug = String(entry.id || entry.videoId || 'heygen-clip')
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  if (entry.domain === 'nature') {
    return `/nature/assets/video/${slug}.mp4`;
  }
  if (entry.domain === 'disasters') {
    return `/finance/assets/video/${slug}.mp4`;
  }
  return `/finance/assets/video/${slug}.mp4`;
}

async function downloadMp4(remoteUrl, destAbs) {
  await mkdir(path.dirname(destAbs), { recursive: true });
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${remoteUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destAbs, buf);
  return buf.length;
}

async function main() {
  if (!heygenConfigured()) {
    throw new Error('HEYGEN_API_KEY is not set in .env');
  }

  const filterId = argValue('--id');
  const registry = JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
  const videos = (registry.videos || []).filter((v) => !filterId || v.id === filterId);
  if (!videos.length) {
    console.log(filterId ? `No registry entry for id ${filterId}` : 'Registry is empty');
    return;
  }

  let updated = 0;
  for (const entry of videos) {
    if (entry.hostedLocally && entry.videoUrl?.startsWith('/')) {
      console.log(`Skip ${entry.id} — already cached at ${entry.videoUrl}`);
      continue;
    }
    if (!entry.videoId) {
      console.log(`Skip ${entry.id} — no videoId`);
      continue;
    }

    const status = await getVideoStatus(entry.videoId);
    const remoteUrl = status?.video_url;
    if (status?.status !== 'completed' || !remoteUrl) {
      console.log(`Skip ${entry.id} — status ${status?.status || 'unknown'}`);
      continue;
    }

    const localRel = localRelForEntry(entry);
    const destAbs = path.join(PUBLIC_DIR, localRel.replace(/^\//, ''));
    const bytes = await downloadMp4(remoteUrl, destAbs);
    entry.videoUrl = localRel;
    entry.hostedLocally = true;
    entry.cachedAt = new Date().toISOString();
    updated += 1;
    console.log(`Cached ${entry.id} → ${localRel} (${bytes} bytes)`);
  }

  if (updated) {
    await writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
    console.log(`Updated ${updated} registry entries.`);
  } else {
    console.log('No videos cached.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
