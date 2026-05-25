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
const WEBCOOS_ASSETS = 'https://app.webcoos.org/webcoos/api/v1/assets/';

export const HAZARD_WEBCAM_SOURCES = [
  'alertcalifornia',
  'usgs_nims',
  'usgs_volcano',
  'webcoos',
  'ucsd_hpwren',
  'ucsd_pier',
];

const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'DevConnectLabs-DisasterService/1.0',
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
export function normalizeUsgsVolcanoFeature(feature) {
  if (!feature) return null;
  const props = feature.properties || feature;
  const geom = feature.geometry || {};
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

  return {
    source: 'usgs_volcano',
    source_id: String(code),
    name: props.webcamName || props.name || `Volcano cam ${code}`,
    lat,
    lng,
    state_abbr: props.state || null,
    camera_url: props.externalUrl || `https://volcview.wr.usgs.gov/`,
    image_url: props.imageUrl || props.latestImageUrl || null,
    status: 'active',
    hazard_types: ['volcano', 'hazard'],
    media_type: 'still_image',
    refresh_minutes: 15,
    raw: {
      ...props,
      attribution: 'USGS Volcano Hazards Program',
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

export async function ingestUsgsNimsWebcams() {
  await initFireCamerasSchema();
  const url = appendApiKey(`${NIMS_BASE}/cameras`);
  const data = await fetchJson(url);
  const list = Array.isArray(data) ? data : (data.cameras || data.items || data.data || []);
  const batch = list.map(normalizeUsgsNimsCamera).filter(Boolean);
  const result = await upsertHazardWebcams(batch);
  return { upserted: result.upserted || 0, fetched: list.length, normalized: batch.length };
}

export async function ingestUsgsVolcanoWebcams() {
  await initFireCamerasSchema();
  const data = await fetchJson(USGS_VOLCANO_GEOJSON);
  const features = data.features || (Array.isArray(data) ? data : []);
  const batch = features.map(normalizeUsgsVolcanoFeature).filter(Boolean);
  const result = await upsertHazardWebcams(batch);
  return { upserted: result.upserted || 0, fetched: features.length, normalized: batch.length };
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
