/**
 * Unified HeyGen video catalog — Lane lines, disaster demos, and API registry.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data/heygen-video-library.json');
const LANE_LINES_PATH = path.join(ROOT, 'data/lane-heygen-lines.json');
const DISASTER_DEMO_PATH = path.join(ROOT, 'data/disaster-heygen-demo.json');

function pickUrl(...candidates) {
  for (const raw of candidates) {
    const val = String(raw || '').trim();
    if (val) return val;
  }
  return null;
}

function entryBase({ id, videoId, title, domain, variant, videoUrl, portraitUrl, sourcePage, studioPage, script, tags, generatedAt }) {
  return {
    id,
    videoId: videoId || null,
    title: title || 'HeyGen video',
    domain: domain || 'other',
    variant: variant || 'full',
    videoUrl,
    portraitUrl: portraitUrl || null,
    sourcePage: sourcePage || null,
    studioPage: studioPage || null,
    scriptPreview: script ? String(script).slice(0, 280) : null,
    tags: tags || [],
    generatedAt: generatedAt || null,
    hostedLocally: Boolean(videoUrl && videoUrl.startsWith('/'))
  };
}

function laneEntries(catalog) {
  const items = [];
  const people = catalog?.people || {};
  for (const [slug, person] of Object.entries(people)) {
    const name = person.name || slug;
    const portrait = person.portraitUrl || null;
    const linePage = `/family/lane-heygen-line.html?person=${encodeURIComponent(slug)}`;
    const printPage = `/family/lane-heygen-print.html?person=${encodeURIComponent(slug)}`;

    const fullUrl = pickUrl(person.heygenVideoLocal, person.heygenVideoUrl);
    if (fullUrl || person.heygenVideoId) {
      items.push(
        entryBase({
          id: `lane-${slug}-full`,
          videoId: person.heygenVideoId,
          title: person.heygenTitle || `${name} — Lane Legacy Line`,
          domain: 'lane',
          variant: 'full',
          videoUrl: fullUrl,
          portraitUrl: portrait,
          sourcePage: linePage,
          studioPage: printPage,
          script: person.heygenScript,
          tags: ['lane', person.heygenAvatarMode === 'photo' ? 'photo-avatar' : 'studio-avatar', 'full'],
          generatedAt: person.generatedAt || null
        })
      );
    }

    const shortUrl = pickUrl(person.heygenVideoLocalShort, person.heygenVideoUrlShort);
    if (shortUrl || person.heygenVideoIdShort) {
      items.push(
        entryBase({
          id: `lane-${slug}-short`,
          videoId: person.heygenVideoIdShort,
          title: `${name} — short line`,
          domain: 'lane',
          variant: 'short',
          videoUrl: shortUrl,
          portraitUrl: portrait,
          sourcePage: `${linePage}&short=1`,
          studioPage: printPage,
          script: person.heygenScriptShort || person.heygenScript,
          tags: ['lane', 'short', 'popup'],
          generatedAt: person.generatedAtShort || null
        })
      );
    }
  }
  return items;
}

function disasterDemoEntry(demo) {
  if (!demo) return [];
  const url = pickUrl(demo.heygenVideoLocal, demo.heygenVideoUrl);
  if (!url && !demo.heygenVideoId) return [];
  return [
    entryBase({
      id: 'disaster-unified-demo',
      videoId: demo.heygenVideoId,
      title: demo.title || 'Unified Disasters Demo',
      domain: 'disasters',
      variant: 'demo',
      videoUrl: url,
      portraitUrl: '/family/assets/jonathan-homer-lane.png',
      sourcePage: '/finance/disasters-unified.html?demo=heygen',
      studioPage: '/finance/disasters-unified.html#duHeygenStudio',
      script: demo.script || null,
      tags: ['disasters', 'demo', 'popup'],
      generatedAt: demo.generatedAt || null
    })
  ];
}

async function readJsonSafe(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function loadRegistry() {
  const data = await readJsonSafe(REGISTRY_PATH);
  if (data?.videos && Array.isArray(data.videos)) return data;
  return { version: 1, videos: [] };
}

async function saveRegistry(registry) {
  await writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

/** Merge Lane catalog, disaster demo, and API registry (registry wins on duplicate id). */
export async function getHeygenVideoLibrary({ domain } = {}) {
  const [laneCatalog, disasterDemo, registry] = await Promise.all([
    readJsonSafe(LANE_LINES_PATH),
    readJsonSafe(DISASTER_DEMO_PATH),
    loadRegistry()
  ]);

  const byId = new Map();
  for (const item of laneEntries(laneCatalog || {})) byId.set(item.id, item);
  for (const item of disasterDemoEntry(disasterDemo)) byId.set(item.id, item);
  for (const item of registry.videos || []) {
    if (item?.id) byId.set(item.id, { ...byId.get(item.id), ...item });
  }

  let videos = [...byId.values()].filter((v) => v.videoUrl || v.videoId);
  if (domain) {
    videos = videos.filter((v) => v.domain === domain);
  }
  videos.sort((a, b) => {
    const da = a.generatedAt || '';
    const db = b.generatedAt || '';
    if (da !== db) return db.localeCompare(da);
    return String(a.title).localeCompare(String(b.title));
  });

  return {
    configured: Boolean(process.env.HEYGEN_API_KEY?.trim()),
    count: videos.length,
    videos
  };
}

/**
 * Register or update a video created via /api/heygen/*.
 * @param {object} entry — must include id; videoId and/or videoUrl recommended
 */
export async function registerHeygenVideo(entry) {
  if (!entry?.id) throw new Error('registerHeygenVideo requires id');
  const registry = await loadRegistry();
  const videos = registry.videos.filter((v) => v.id !== entry.id);
  videos.push({
    ...entry,
    generatedAt: entry.generatedAt || new Date().toISOString()
  });
  registry.videos = videos;
  await saveRegistry(registry);
  return entry;
}

export async function registerHeygenApiVideo({
  id,
  videoId,
  title,
  domain = 'disasters',
  variant = 'generated',
  videoUrl = null,
  script = null,
  sourcePage = null,
  studioPage = null,
  tags = []
}) {
  return registerHeygenVideo(
    entryBase({
      id,
      videoId,
      title,
      domain,
      variant,
      videoUrl,
      sourcePage: sourcePage || '/finance/heygen-library.html',
      studioPage: studioPage || '/finance/disasters-unified.html#duHeygenStudio',
      script,
      tags: ['heygen-api', domain, variant, ...tags],
      generatedAt: new Date().toISOString()
    })
  );
}
