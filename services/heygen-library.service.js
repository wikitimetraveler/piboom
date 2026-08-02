/**
 * Unified HeyGen + HyperFrames catalog — Lane lines, disaster/music demos, reels, API registry.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data/heygen-video-library.json');
const LANE_LINES_PATH = path.join(ROOT, 'data/lane-heygen-lines.json');
const DISASTER_DEMO_PATH = path.join(ROOT, 'data/disaster-heygen-demo.json');
const MUSIC_DEMO_PATH = path.join(ROOT, 'data/music-heygen-demo.json');
const CALC_ENGINE_DEMO_PATH = path.join(ROOT, 'data/calc-engine-heygen-demo.json');
const UNIT_TESTS_DEMO_PATH = path.join(ROOT, 'data/unit-tests-heygen-demo.json');
const SVEN_UX_DEMO_PATH = path.join(ROOT, 'data/sven-ux-heygen-demo.json');
const JORDAN_DEMO_PATH = path.join(ROOT, 'data/jordan-heygen-demo.json');
const SYRIA_DEMO_PATH = path.join(ROOT, 'data/syria-heygen-demo.json');
const HYPERFRAMES_LIBRARY_PATH = path.join(ROOT, 'data/hyperframes-library.json');

function pickUrl(...candidates) {
  for (const raw of candidates) {
    const val = String(raw || '').trim();
    if (val) return val;
  }
  return null;
}

function entryBase({
  id,
  kind = 'heygen',
  videoId,
  title,
  domain,
  variant,
  videoUrl,
  portraitUrl,
  sourcePage,
  studioPage,
  projectDir,
  subtitle,
  script,
  tags,
  generatedAt
}) {
  return {
    id,
    kind,
    videoId: videoId || null,
    title: title || (kind === 'hyperframes' ? 'HyperFrames reel' : 'HeyGen video'),
    domain: domain || 'other',
    variant: variant || (kind === 'hyperframes' ? 'reel' : 'full'),
    videoUrl: videoUrl || null,
    portraitUrl: portraitUrl || null,
    sourcePage: sourcePage || null,
    studioPage: studioPage || null,
    projectDir: projectDir || null,
    subtitle: subtitle || null,
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

function musicDemoEntry(demo) {
  if (!demo) return [];
  const url = pickUrl(demo.heygenVideoLocalShort, demo.heygenVideoUrlShort);
  if (!url && !demo.heygenVideoIdShort) return [];
  return [
    entryBase({
      id: 'music-research-demo',
      videoId: demo.heygenVideoIdShort,
      title: demo.title || 'Music Research Demo',
      domain: 'music',
      variant: 'demo',
      videoUrl: url,
      sourcePage: demo.qrLandingPath || '/music/music-research.html?demo=heygen',
      studioPage: demo.qrPopupPath || '/music/music-historian-line.html?short=1',
      script: demo.heygenScriptShort || null,
      tags: ['music', 'demo', 'popup', 'historian'],
      generatedAt: demo.generatedAt || null
    })
  ];
}

/** Jordan ships one clip per page language, so each language is its own library entry. */
function jordanDemoEntries(demo) {
  if (!demo) return [];
  const langs = [
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'Arabic' }
  ];
  return langs.flatMap(({ code, label }) => {
    const url = pickUrl(demo.heygenVideoLocalShort?.[code], demo.heygenVideoUrlShort?.[code]);
    const videoId = demo.heygenVideoIdShort?.[code] || null;
    if (!url && !videoId) return [];
    return [
      entryBase({
        id: `jordan-rami-intro-${code}`,
        videoId,
        title: `${demo.title?.en || 'Jordan — Meet Rami'} (${label})`,
        domain: 'jordan',
        variant: 'demo',
        videoUrl: url,
        portraitUrl: demo.avatar?.portrait || null,
        sourcePage: demo.qrLandingPath || '/jordan/?demo=heygen',
        studioPage: demo.ctaHref || '/jordan/',
        script: demo.heygenScriptShort?.[code] || null,
        tags: ['jordan', 'demo', 'popup', 'bilingual', code],
        generatedAt: demo.generatedAt?.[code] || null
      })
    ];
  });
}

/** Syria ships one clip per page language, so each language is its own library entry. */
function syriaDemoEntries(demo) {
  if (!demo) return [];
  const langs = [
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'Arabic' }
  ];
  return langs.flatMap(({ code, label }) => {
    const url = pickUrl(demo.heygenVideoLocalShort?.[code], demo.heygenVideoUrlShort?.[code]);
    const videoId = demo.heygenVideoIdShort?.[code] || null;
    if (!url && !videoId) return [];
    return [
      entryBase({
        id: `syria-niqula-intro-${code}`,
        videoId,
        title: `${demo.title?.en || 'Syria — Meet Niqula'} (${label})`,
        domain: 'syria',
        variant: 'demo',
        videoUrl: url,
        portraitUrl: demo.avatar?.portrait || null,
        sourcePage: demo.qrLandingPath || '/syria/?demo=heygen',
        studioPage: demo.ctaHref || '/syria/',
        script: demo.heygenScriptShort?.[code] || null,
        tags: ['syria', 'demo', 'popup', 'bilingual', code],
        generatedAt: demo.generatedAt?.[code] || null
      })
    ];
  });
}

function financeBoothEntry(demo, { id, tags }) {
  if (!demo) return [];
  const url = pickUrl(demo.heygenVideoLocalShort, demo.heygenVideoUrlShort);
  if (!url && !demo.heygenVideoIdShort) return [];
  return [
    entryBase({
      id,
      videoId: demo.heygenVideoIdShort,
      title: demo.title || demo.heygenTitle || 'Finance Demo',
      domain: 'finance',
      variant: 'demo',
      videoUrl: url,
      sourcePage: demo.qrLandingPath || null,
      studioPage: demo.ctaHref || null,
      script: demo.heygenScriptShort || null,
      tags: ['finance', 'demo', 'popup', ...(tags || [])],
      generatedAt: demo.generatedAt || null
    })
  ];
}

function financeDemoEntries(calcDemo, unitDemo, svenDemo) {
  return [
    ...financeBoothEntry(calcDemo, { id: 'finance-calc-engine-demo', tags: ['calc-engine', 'dag-lite'] }),
    ...financeBoothEntry(unitDemo, { id: 'finance-unit-tests-demo', tags: ['unit-tests'] }),
    ...financeBoothEntry(svenDemo, { id: 'finance-sven-ux-demo', tags: ['sven', 'ux'] })
  ];
}

function hyperframesEntries(catalog) {
  const projects = catalog?.projects || [];
  return projects.map((project) =>
    entryBase({
      id: `hf-${project.id}`,
      kind: 'hyperframes',
      title: project.title || project.id,
      domain: project.domain || 'other',
      variant: 'reel',
      videoUrl: project.videoUrl || null,
      sourcePage: project.sourcePage || null,
      projectDir: project.projectDir || null,
      subtitle: project.subtitle || null,
      tags: ['hyperframes', project.domain || 'other', 'google-tts']
    })
  );
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'heygen' ? -1 : 1;
    const da = a.generatedAt || '';
    const db = b.generatedAt || '';
    if (da !== db) return db.localeCompare(da);
    return String(a.title).localeCompare(String(b.title));
  });
}

function filterItems(items, { domain, kind } = {}) {
  let filtered = items;
  if (kind === 'heygen' || kind === 'hyperframes') {
    filtered = filtered.filter((v) => v.kind === kind);
  }
  if (domain) {
    filtered = filtered.filter((v) => v.domain === domain);
  }
  return filtered;
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

export async function getHeygenRegistryEntry(id) {
  const registry = await loadRegistry();
  return registry.videos.find((v) => v.id === id) || null;
}

async function saveRegistry(registry) {
  await writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

/** Merge HeyGen avatar videos, HyperFrames reels, and API registry (registry wins on duplicate id). */
export async function getHeygenVideoLibrary({ domain, kind } = {}) {
  const [
    laneCatalog,
    disasterDemo,
    musicDemo,
    calcDemo,
    unitDemo,
    svenDemo,
    jordanDemo,
    syriaDemo,
    hyperframesCatalog,
    registry
  ] = await Promise.all([
    readJsonSafe(LANE_LINES_PATH),
    readJsonSafe(DISASTER_DEMO_PATH),
    readJsonSafe(MUSIC_DEMO_PATH),
    readJsonSafe(CALC_ENGINE_DEMO_PATH),
    readJsonSafe(UNIT_TESTS_DEMO_PATH),
    readJsonSafe(SVEN_UX_DEMO_PATH),
    readJsonSafe(JORDAN_DEMO_PATH),
    readJsonSafe(SYRIA_DEMO_PATH),
    readJsonSafe(HYPERFRAMES_LIBRARY_PATH),
    loadRegistry()
  ]);

  const byId = new Map();
  for (const item of laneEntries(laneCatalog || {})) byId.set(item.id, item);
  for (const item of disasterDemoEntry(disasterDemo)) byId.set(item.id, item);
  for (const item of musicDemoEntry(musicDemo)) byId.set(item.id, item);
  for (const item of financeDemoEntries(calcDemo, unitDemo, svenDemo)) byId.set(item.id, item);
  for (const item of jordanDemoEntries(jordanDemo)) byId.set(item.id, item);
  for (const item of syriaDemoEntries(syriaDemo)) byId.set(item.id, item);
  for (const item of registry.videos || []) {
    if (item?.id) byId.set(item.id, { ...byId.get(item.id), ...item, kind: item.kind || 'heygen' });
  }

  const heygenVideos = [...byId.values()].filter((v) => v.videoUrl || v.videoId);
  const hyperframes = hyperframesEntries(hyperframesCatalog || {});
  const allItems = sortItems([...heygenVideos, ...hyperframes]);
  const items = filterItems(allItems, { domain, kind });

  return {
    configured: Boolean(process.env.HEYGEN_API_KEY?.trim()),
    count: heygenVideos.length,
    hyperframesCount: hyperframes.length,
    totalCount: allItems.length,
    videos: kind === 'hyperframes' ? [] : filterItems(heygenVideos, { domain }),
    hyperframes: kind === 'heygen' ? [] : filterItems(hyperframes, { domain }),
    items
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
      sourcePage: sourcePage || '/heygen-hub.html',
      studioPage: studioPage || '/finance/disasters-unified.html#duHeygenStudio',
      script,
      tags: ['heygen-api', domain, variant, ...tags],
      generatedAt: new Date().toISOString()
    })
  );
}
