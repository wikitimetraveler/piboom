/**
 * Multi-source hazard webcam ingest (USGS NIMS, volcano, WebCOOS, UCSD, ALERTCalifornia).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initFireCamerasSchema,
  ingestCaFireCameras,
  upsertHazardWebcams,
} from './disasters.service.js';
import { getPool } from './database.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NIMS_BASE = 'https://api.waterdata.usgs.gov/nims/v0';
const USGS_VOLCANO_GEOJSON =
  'https://volcview.wr.usgs.gov/ashcam-api/webcamApi/geojson?lat1=90&lat2=-90&long1=-180&long2=180';
const AVO_VOLCANO_GEOJSON =
  'https://avo-volcview.wr.usgs.gov/ashcam-api/webcamApi/geojson?lat1=90&lat2=-90&long1=-180&long2=180';
export const FAA_SITES_URL = 'https://weathercams.faa.gov/api/sites';
export const FAA_SUMMARY_URL = 'https://weathercams.faa.gov/api/summary';
const WEBCOOS_ASSETS = 'https://app.webcoos.org/webcoos/api/v1/assets/';

export const HAZARD_WEBCAM_SOURCES = [
  'alertcalifornia',
  'usgs_nims',
  'usgs_volcano',
  'faa_weathercam',
  'webcoos',
  'ucsd_hpwren',
  'ucsd_pier',
];

const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'DevConnectLabs-DisasterService/1.0',
};

const FAA_HEADERS = {
  Accept: '*/*',
  'User-Agent': 'DevConnectLabs-DisasterService/1.0',
  Referer: 'https://weathercams.faa.gov/',
};

function nimsApiKey() {
  return process.env.USGS_NIMS_API_KEY || process.env.USGS_API_KEY || '';
}

function appendApiKey(url) {
  const key = nimsApiKey();
  if (!key) return url;
  const u = new URL(url);
  u.searchParams.set('api_key', key);
  return u.toString();
}

function toNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function inferStateFromCoords(lat, lng) {
  if (lat == null || lng == null) return null;
  if (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) return null;
  return null;
}

function inferAlaskaStateFromCoords(lat, lng) {
  if (lat == null || lng == null) return null;
  if (lat >= 51 && lat <= 72 && lng >= -180 && lng <= -129) return 'AK';
  return null;
}

function isDeadFaaLegacyUrl(url) {
  return /avcams(?:plus)?\.faa\.gov/i.test(String(url || ''));
}

function resolveVolcanoImageUrl(props) {
  return props?.newestImage?.imageUrl
    || props?.imageUrl
    || props?.latestImageUrl
    || null;
}

function resolveVolcanoPageUrl(props, feed, code) {
  const external = props?.externalUrl;
  if (external && !isDeadFaaLegacyUrl(external)) {
    return external;
  }
  if (feed === 'avo') {
    return code ? `https://avo.alaska.edu/webcam/` : 'https://avo.alaska.edu/webcam/';
  }
  return 'https://volcview.wr.usgs.gov/';
}

function volcanoAshcamImageApiBase(feed) {
  return feed === 'avo'
    ? 'https://avo-volcview.wr.usgs.gov/ashcam-api/imageApi'
    : 'https://volcview.wr.usgs.gov/ashcam-api/imageApi';
}

function inferHazardTypesFromText(text) {
  const t = String(text || '').toLowerCase();
  const tags = new Set(['hazard']);
  if (/river|stream|gage|gauge|hydrol|water/.test(t)) tags.add('river');
  if (/flood|inund|dam|reservoir/.test(t)) tags.add('flood');
  if (/snow|ice|winter/.test(t)) tags.add('snow');
  if (/landslide|debris|mudflow/.test(t)) tags.add('landslide');
  if (/coast|beach|tide|ocean|harbor|bay/.test(t)) tags.add('coastal');
  if (/volcano|ash|lava/.test(t)) tags.add('volcano');
  if (/fire|wildfire|burn/.test(t)) tags.add('fire');
  return Array.from(tags);
}

/** @param {object} cam USGS NIMS camera record */
export function normalizeUsgsNimsCamera(cam) {
  if (!cam || !cam.camId) return null;
  const lat = toNum(cam.latitude ?? cam.lat ?? cam.y);
  const lng = toNum(cam.longitude ?? cam.lng ?? cam.x);
  if (lat == null || lng == null) return null;

  const name =
    cam.siteName ||
    cam.cameraName ||
    cam.name ||
    cam.camId ||
    'USGS Webcam';
  const label = `${name} (${cam.camId})`;
  const hazard_types = inferHazardTypesFromText(
    `${name} ${cam.siteDescription || ''} ${cam.waterBody || ''}`
  );

  const thumbDir = cam.thumbDir || cam.overlayDir || cam.smallDir || null;
  let image_url = null;
  if (thumbDir && cam.latestFile) {
    image_url = `${String(thumbDir).replace(/\/$/, '')}/${cam.latestFile}`;
  }

  return {
    source: 'usgs_nims',
    source_id: String(cam.camId),
    name: label,
    lat,
    lng,
    state_abbr: cam.stateCode || cam.state || inferStateFromCoords(lat, lng),
    county_name: cam.countyName || cam.county || null,
    camera_url: cam.siteUrl || cam.url || `https://water.usgs.gov/`,
    network_url: 'https://www.usgs.gov/products/multimedia-gallery/webcams',
    image_url,
    status: cam.status || 'active',
    hazard_types,
    media_type: 'still_image',
    refresh_minutes: 10,
    raw: {
      ...cam,
      nims_cam_id: cam.camId,
      thumbDir: cam.thumbDir,
      overlayDir: cam.overlayDir,
      smallDir: cam.smallDir,
      attribution: 'U.S. Geological Survey (USGS NIMS)',
    },
  };
}

/** @param {object} feature GeoJSON feature */
export function normalizeUsgsVolcanoFeature(feature, opts = {}) {
  if (!feature) return null;
  const props = feature.properties || feature;
  const geom = feature.geometry || {};
  const feed = opts.feed === 'avo' ? 'avo' : 'usgs';
  let lat = null;
  let lng = null;
  if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
    lng = toNum(geom.coordinates[0]);
    lat = toNum(geom.coordinates[1]);
  }
  lat = lat ?? toNum(props.latitude ?? props.lat);
  lng = lng ?? toNum(props.longitude ?? props.lng ?? props.lon);
  if (lat == null || lng == null) return null;

  const code = props.webcamCode || props.code || props.id;
  if (!code) return null;

  const volcanoName = props.volcanoName || props.volcano_name || props.volcano || props.vName || null;
  const cameraName = props.webcamName || props.name || `Volcano cam ${code}`;
  const displayName = volcanoName ? `${volcanoName} — ${cameraName}` : cameraName;
  const image_url = resolveVolcanoImageUrl(props);

  return {
    source: 'usgs_volcano',
    source_id: String(code),
    name: displayName,
    lat,
    lng,
    state_abbr: props.state || inferAlaskaStateFromCoords(lat, lng),
    camera_url: resolveVolcanoPageUrl(props, feed, code),
    image_url,
    status: 'active',
    hazard_types: ['volcano', 'hazard'],
    media_type: 'still_image',
    refresh_minutes: 15,
    raw: {
      ...props,
      feed,
      webcamCode: code,
      volcanoName,
      vnum: props.vnum || props.volcanoNumber || props.volcano_number || null,
      attribution: feed === 'avo'
        ? 'Alaska Volcano Observatory (AVO) / USGS Ashcam'
        : 'USGS Volcano Hazards Program',
    },
  };
}

/** Latest still from USGS/AVO Ashcam image API (on-demand snapshot). */
export async function resolveUsgsVolcanoLatestImage(row) {
  const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {};
  const code = raw.webcamCode || row.source_id;
  if (!code) return null;
  const feed = raw.feed === 'avo' ? 'avo' : 'usgs';
  const base = volcanoAshcamImageApiBase(feed);
  const data = await fetchJson(`${base}/webcam/${encodeURIComponent(code)}/1/newestFirst/1`);
  const images = data?.images || data?.payload?.images || [];
  const first = images[0];
  return first?.imageUrl || first?.image_url || null;
}

/** Refresh FAA still from summary API (on-demand snapshot). */
export async function resolveFaaWeatherCamLatestImage(row) {
  const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {};
  const siteId = raw.siteId ?? String(row.source_id || '').split(':')[0];
  if (!siteId) return null;
  const direction = raw.direction ?? String(row.source_id || '').split(':')[1];
  const summary = await fetchJson(
    `${FAA_SUMMARY_URL}?siteId=${encodeURIComponent(siteId)}&related=true`,
    { headers: FAA_HEADERS }
  );
  const cameras = summary?.payload?.site?.cameras || [];
  for (const cam of cameras) {
    const camDir = cam?.cameraDirection ?? cam?.direction;
    if (direction && camDir && String(camDir) !== String(direction)) continue;
    const images = cam?.currentImages || cam?.images || [];
    const imageUri = images[0]?.imageUri ?? cam?.imageUri;
    if (imageUri) return imageUri;
  }
  return null;
}

/** Prefer richer duplicate volcano webcam rows (image URL, AVO feed). */
export function pickBetterVolcanoRow(a, b) {
  const score = (row) => {
    let s = 0;
    if (row?.image_url) s += 2;
    if (row?.raw?.feed === 'avo') s += 1;
    if (row?.raw?.volcanoName) s += 0.5;
    return s;
  };
  return score(b) > score(a) ? b : a;
}

/** Dedupe usgs_volcano mounts by source_id. */
export function mergeVolcanoWebcamRows(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (!row?.source_id) continue;
    const existing = byId.get(row.source_id);
    byId.set(row.source_id, existing ? pickBetterVolcanoRow(existing, row) : row);
  }
  return Array.from(byId.values());
}

/** @param {object} site FAA site record */
export function normalizeFaaWeatherCam(site, camera, image) {
  const siteId = site?.siteId ?? site?.id;
  const direction = camera?.cameraDirection ?? camera?.direction ?? 'UNK';
  const lat = toNum(site?.latitude ?? site?.lat);
  const lng = toNum(site?.longitude ?? site?.lng ?? site?.lon);
  if (siteId == null || lat == null || lng == null) return null;

  const imageUri = image?.imageUri ?? image?.image_url ?? image?.url;
  if (!imageUri) return null;

  const siteName = site?.siteName ?? site?.name ?? `FAA site ${siteId}`;
  return {
    source: 'faa_weathercam',
    source_id: `${siteId}:${direction}`,
    name: `${siteName} — ${direction} view`,
    lat,
    lng,
    state_abbr: site?.state ?? site?.stateCode ?? null,
    county_name: site?.county ?? null,
    camera_url: `https://weathercams.faa.gov/site/${siteId}`,
    network_url: 'https://weathercams.faa.gov/',
    image_url: imageUri,
    status: 'active',
    hazard_types: ['aviation', 'weather', 'hazard'],
    media_type: 'still_image',
    refresh_minutes: 10,
    raw: {
      siteId,
      direction,
      imageTimestamp: image?.imageTimestamp ?? image?.timestamp ?? null,
      attribution: site?.attribution || 'FAA Aviation Weather Camera Program',
    },
  };
}

/** @param {object} asset WebCOOS asset */
export function normalizeWebCoosAsset(asset) {
  if (!asset) return null;
  const slug = asset.slug || asset.id || asset.name;
  if (!slug) return null;

  const lat = toNum(asset.latitude ?? asset.lat ?? asset.location?.latitude);
  const lng = toNum(asset.longitude ?? asset.lng ?? asset.location?.longitude);
  if (lat == null || lng == null) return null;

  let camera_url = asset.url || asset.page_url || `https://webcoos.org/cameras/`;
  let image_url = null;
  let media_type = 'live_stream';

  const services = asset.services || asset.products || [];
  if (Array.isArray(services)) {
    for (const svc of services) {
      const slugSvc = svc.slug || svc.service_slug;
      if (slugSvc && /snapshot|image|thumb/i.test(String(slugSvc))) {
        image_url = svc.url || svc.endpoint || null;
        media_type = 'still_image';
      }
      if (slugSvc && /live|stream|hls|video/i.test(String(slugSvc))) {
        camera_url = svc.url || svc.endpoint || camera_url;
      }
    }
  }

  return {
    source: 'webcoos',
    source_id: String(slug),
    name: asset.title || asset.label || asset.name || slug,
    lat,
    lng,
    state_abbr: asset.state || asset.state_code || null,
    county_name: asset.county || null,
    camera_url,
    image_url,
    status: asset.status || 'active',
    hazard_types: ['coastal', 'hazard'],
    media_type,
    refresh_minutes: 5,
    raw: {
      ...asset,
      attribution: 'NOAA WebCOOS',
    },
  };
}

export function normalizeSeedMount(seed, source) {
  if (!seed?.source_id || seed.lat == null || seed.lng == null) return null;
  return {
    source,
    source_id: String(seed.source_id),
    name: seed.name || seed.source_id,
    lat: seed.lat,
    lng: seed.lng,
    state_abbr: seed.state_abbr || null,
    county_name: seed.county_name || null,
    camera_url: seed.camera_url || null,
    network_url: seed.network_url || null,
    image_url: seed.image_url || null,
    status: seed.status || 'active',
    hazard_types: seed.hazard_types || ['hazard'],
    media_type: seed.media_type || 'still_image',
    refresh_minutes: seed.refresh_minutes ?? 5,
    raw: {
      seed: true,
      attribution: seed.attribution || 'UC San Diego',
    },
  };
}

function loadSeedFile() {
  const filePath = path.resolve(__dirname, '..', 'data', 'hazard-webcam-seeds.json');
  if (!fs.existsSync(filePath)) return { ucsd_pier: [], ucsd_hpwren: [] };
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...FETCH_HEADERS, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${url}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function mapPoolLimit(items, limit, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        const value = await fn(items[i], i);
        if (Array.isArray(value)) results.push(...value);
        else if (value) results.push(value);
      } catch (e) {
        console.warn('Pool task failed:', e.message);
      }
    }
  }
  const workers = Math.min(Math.max(1, limit), items.length || 1);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function parseFaaSitesPayload(data) {
  if (Array.isArray(data?.payload)) return data.payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.payload?.sites)) return data.payload.sites;
  return [];
}

export async function ingestUsgsVolcanoWebcams() {
  await initFireCamerasSchema();
  const [globalResult, avoResult] = await Promise.allSettled([
    fetchJson(USGS_VOLCANO_GEOJSON),
    fetchJson(AVO_VOLCANO_GEOJSON),
  ]);

  const tagged = [];
  if (globalResult.status === 'fulfilled') {
    const features = globalResult.value.features || [];
    for (const feature of features) tagged.push({ feature, feed: 'usgs' });
  } else {
    console.warn('⚠️  USGS volcano GeoJSON failed:', globalResult.reason?.message);
  }
  if (avoResult.status === 'fulfilled') {
    const features = avoResult.value.features || [];
    for (const feature of features) tagged.push({ feature, feed: 'avo' });
  } else {
    console.warn('⚠️  AVO volcano GeoJSON failed:', avoResult.reason?.message);
  }

  if (!tagged.length) {
    throw new Error('No volcano webcam feeds available');
  }

  const rows = tagged
    .map(({ feature, feed }) => normalizeUsgsVolcanoFeature(feature, { feed }))
    .filter(Boolean);
  const batch = mergeVolcanoWebcamRows(rows);
  const result = await upsertHazardWebcams(batch);
  return {
    upserted: result.upserted || 0,
    fetched: tagged.length,
    normalized: batch.length,
    dedupedFrom: rows.length,
  };
}

export async function ingestFaaWeatherCams() {
  await initFireCamerasSchema();
  const data = await fetchJson(FAA_SITES_URL, { headers: FAA_HEADERS });
  const sites = parseFaaSitesPayload(data);
  let sitesProcessed = 0;

  const batch = await mapPoolLimit(sites, 8, async (site) => {
    const siteId = site?.siteId ?? site?.id;
    const lat = toNum(site?.latitude ?? site?.lat);
    const lng = toNum(site?.longitude ?? site?.lng ?? site?.lon);
    if (siteId == null || lat == null || lng == null) return [];

    const summary = await fetchJson(
      `${FAA_SUMMARY_URL}?siteId=${encodeURIComponent(siteId)}&related=true`,
      { headers: FAA_HEADERS }
    );
    sitesProcessed += 1;
    if (sitesProcessed % 50 === 0) {
      console.log(`📹 FAA WeatherCams: ${sitesProcessed}/${sites.length} sites`);
    }

    const sitePayload = summary?.payload?.site ?? summary?.site ?? {};
    const mergedSite = {
      ...site,
      siteId,
      siteName: sitePayload.siteName ?? site.siteName ?? site.name,
      latitude: lat,
      longitude: lng,
    };
    const cameras = sitePayload.cameras || [];
    const rows = [];
    for (const cam of cameras) {
      const images = cam.currentImages || cam.images || [];
      if (images.length) {
        for (const img of images) {
          const row = normalizeFaaWeatherCam(mergedSite, cam, img);
          if (row) rows.push(row);
        }
      } else if (cam.imageUri) {
        const row = normalizeFaaWeatherCam(mergedSite, cam, { imageUri: cam.imageUri });
        if (row) rows.push(row);
      }
    }
    return rows;
  });

  const result = await upsertHazardWebcams(batch);
  return {
    upserted: result.upserted || 0,
    fetched: sites.length,
    normalized: batch.length,
    sitesProcessed,
  };
}

export async function ingestUsgsNimsWebcams() {
  await initFireCamerasSchema();
  const url = appendApiKey(`${NIMS_BASE}/cameras`);
  const data = await fetchJson(url);
  const list = Array.isArray(data) ? data : (data.cameras || data.items || data.data || []);
  const batch = list.map(normalizeUsgsNimsCamera).filter(Boolean);
  const result = await upsertHazardWebcams(batch);
  return { upserted: result.upserted || 0, fetched: list.length, normalized: batch.length };
}

export async function ingestWebCoosWebcams() {
  const token = String(process.env.WEBCOOS_API_TOKEN || '').trim();
  if (!token) {
    console.warn('⚠️  WEBCOOS_API_TOKEN not set; skipping WebCOOS ingest');
    return { upserted: 0, skipped: true, reason: 'missing WEBCOOS_API_TOKEN' };
  }
  await initFireCamerasSchema();
  const data = await fetchJson(WEBCOOS_ASSETS, {
    headers: { Authorization: `Token ${token}` },
  });
  const list = Array.isArray(data) ? data : (data.results || data.assets || data.data || []);
  const batch = list.map(normalizeWebCoosAsset).filter(Boolean);
  const result = await upsertHazardWebcams(batch);
  return { upserted: result.upserted || 0, fetched: list.length, normalized: batch.length };
}

export async function ingestUcsdWebcams() {
  await initFireCamerasSchema();
  const seeds = loadSeedFile();
  const batch = [];
  for (const row of seeds.ucsd_pier || []) {
    const n = normalizeSeedMount(row, 'ucsd_pier');
    if (n) batch.push(n);
  }
  for (const row of seeds.ucsd_hpwren || []) {
    const n = normalizeSeedMount(row, 'ucsd_hpwren');
    if (n) batch.push(n);
  }
  const result = await upsertHazardWebcams(batch);
  return { upserted: result.upserted || 0, fetched: batch.length };
}

const INGEST_HANDLERS = {
  alertcalifornia: ingestCaFireCameras,
  usgs_nims: ingestUsgsNimsWebcams,
  usgs_volcano: ingestUsgsVolcanoWebcams,
  faa_weathercam: ingestFaaWeatherCams,
  webcoos: ingestWebCoosWebcams,
  ucsd_hpwren: ingestUcsdWebcams,
  ucsd_pier: ingestUcsdWebcams,
};

function parseSourcesArg(sources) {
  if (!sources || sources === 'all') return HAZARD_WEBCAM_SOURCES;
  const list = String(sources)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.filter((s) => HAZARD_WEBCAM_SOURCES.includes(s));
}

/**
 * @param {{ sources?: string|string[] }} opts
 */
export async function ingestHazardWebcams(opts = {}) {
  const raw = opts.sources ?? 'all';
  const wanted = Array.isArray(raw) ? raw : parseSourcesArg(raw);
  const unique = [...new Set(wanted)];
  const results = {};

  for (const src of unique) {
    const handler = INGEST_HANDLERS[src];
    if (!handler) {
      results[src] = { error: 'unknown source' };
      continue;
    }
    try {
      console.log(`📹 Ingest hazard webcams: ${src}`);
      if (src === 'ucsd_hpwren' || src === 'ucsd_pier') {
        if (results.ucsd_hpwren || results.ucsd_pier) continue;
      }
      results[src] = await handler();
    } catch (e) {
      console.warn(`⚠️  Ingest ${src} failed:`, e.message);
      results[src] = { error: e.message, upserted: 0 };
    }
  }

  return results;
}

/**
 * Resolve latest still image for USGS NIMS camera (on-demand snapshot).
 * @param {object} row fire_cameras row
 */
export async function resolveUsgsNimsLatestImage(row) {
  const camId = row.raw?.nims_cam_id || row.source_id;
  if (!camId) return null;
  const listUrl = appendApiKey(
    `${NIMS_BASE}/listFiles?camId=${encodeURIComponent(camId)}&recent=true&limit=1`
  );
  const data = await fetchJson(listUrl);
  const files = Array.isArray(data) ? data : (data.files || data.items || []);
  const filename = typeof files[0] === 'string' ? files[0] : files[0]?.fileName || files[0]?.name;
  if (!filename) return null;

  const base =
    row.raw?.thumbDir ||
    row.raw?.overlayDir ||
    row.raw?.smallDir ||
    null;
  if (!base) return null;
  return `${String(base).replace(/\/$/, '')}/${filename}`;
}

export async function getHazardWebcamById(id) {
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');
  const res = await pool.query(
    `SELECT * FROM fire_cameras WHERE id = $1`,
    [parseInt(id, 10)]
  );
  return res.rows[0] || null;
}

export async function getHazardWebcamStats() {
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');
  const bySource = await pool.query(`
    SELECT source, COUNT(*)::int AS count, MAX(updated_at) AS last_updated
    FROM fire_cameras
    GROUP BY source
    ORDER BY count DESC
  `);
  const total = await pool.query(`SELECT COUNT(*)::int AS total FROM fire_cameras`);
  return {
    total: total.rows[0]?.total || 0,
    bySource: bySource.rows,
  };
}
