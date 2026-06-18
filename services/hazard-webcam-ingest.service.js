/**
 * Multi-source hazard webcam ingest (USGS NIMS, volcano, WebCOOS, UCSD, ALERTCalifornia, ALERTWest, DOT).
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
export const ALERTWEST_CAMERAS_URL = 'https://alertwest.live/api/firecams/v0/cameras';
export const HPWREN_SITES_URL = 'https://www.hpwren.ucsd.edu/cameras/sites.js';
export const CALTRANS_CWWP2_DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const NY511_CAMERAS_URL = 'https://511ny.org/api/v2/get/cameras';

export const HAZARD_WEBCAM_SOURCES = [
  'alertcalifornia',
  'alertwest',
  'usgs_nims',
  'usgs_volcano',
  'faa_weathercam',
  'webcoos',
  'ucsd_hpwren',
  'ucsd_pier',
  'caltrans_cwwp2',
  'dot_511ny',
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
  if (/storm|severe|wind|blizzard|winter|fog|visibility|weather/.test(t)) tags.add('storm');
  if (/traffic|highway|freeway|interstate|bridge|tunnel/.test(t)) tags.add('visibility');
  return Array.from(tags);
}

function inferDotHazardTypes(text) {
  const tags = new Set(inferHazardTypesFromText(text));
  tags.add('hazard');
  tags.add('storm');
  return Array.from(tags);
}

/** Non-CA US states on ALERTWest (CA covered by alertcalifornia ingest). */
export function isAlertWestNonCaUsState(state) {
  const st = String(state || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(st) || st === 'CA') return false;
  if (st === 'AB') return false;
  return true;
}

/** @param {object} cam ALERTWest firecams API camera record */
export function normalizeAlertWestCamera(cam) {
  if (!cam?.name) return null;
  const site = cam.site || {};
  const lat = toNum(site.latitude ?? site.lat);
  const lng = toNum(site.longitude ?? site.lng ?? site.lon);
  const state = String(site.state || '').toUpperCase();
  if (lat == null || lng == null || !isAlertWestNonCaUsState(state)) return null;

  const imageUrl = cam.image?.url || null;
  const county = site.county
    ? String(site.county).replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
  const label = String(cam.name).replace(/^Axis-/, '').replace(/_/g, ' ');

  return {
    source: 'alertwest',
    source_id: String(cam.name),
    name: label,
    lat,
    lng,
    state_abbr: state,
    county_name: county,
    camera_url: `https://alertwest.live/?camera=${encodeURIComponent(cam.name)}`,
    network_url: 'https://alertwest.live/',
    image_url: imageUrl,
    status: 'active',
    hazard_types: ['fire', 'hazard'],
    media_type: imageUrl ? 'still_image' : 'live_stream',
    refresh_minutes: 2,
    raw: {
      alertwest_name: cam.name,
      site_id: site.id || null,
      source_key: cam.source || null,
      attribution: 'ALERTWest / Oregon Hazards Lab partners',
    },
  };
}

/** Extract `var sites = { ... };` object from HPWREN sites.js. */
export function parseHpwrenSitesJs(text) {
  const marker = 'var sites = ';
  const start = text.indexOf(marker);
  if (start < 0) throw new Error('HPWREN sites.js missing sites object');

  let i = start + marker.length;
  while (text[i] === ' ') i += 1;
  if (text[i] !== '{') throw new Error('HPWREN sites.js malformed');

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let end = i; end < text.length; end += 1) {
    const ch = text[end];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(text.slice(i, end + 1));
      }
    }
  }
  throw new Error('HPWREN sites.js unterminated object');
}

/** @param {string} siteKey HPWREN site slug */
export function normalizeHpwrenCamera(siteKey, site, camId, cam) {
  if (!site || !cam || cam.active !== 'y') return null;
  const lat = toNum(site.lat);
  const lng = toNum(site.long ?? site.lng ?? site.lon);
  if (lat == null || lng == null) return null;

  const siteName = site.name || siteKey;
  const camName = cam.name || camId;
  const imager = cam.imager ? ` (${cam.imager})` : '';

  return {
    source: 'ucsd_hpwren',
    source_id: `hpwren:${camId}`,
    name: `${siteName} — ${camName}${imager}`,
    lat,
    lng,
    state_abbr: 'CA',
    county_name: null,
    camera_url: `https://www.hpwren.ucsd.edu/cameras/?site=${encodeURIComponent(siteKey)}`,
    network_url: 'https://www.hpwren.ucsd.edu/cameras/',
    image_url: `https://www.hpwren.ucsd.edu/cameras/LTA/${encodeURIComponent(camId)}/large/latest.jpg`,
    status: 'active',
    hazard_types: ['fire', 'hazard', 'storm'],
    media_type: 'still_image',
    refresh_minutes: 1,
    raw: {
      hpwren_site: siteKey,
      hpwren_cam_id: camId,
      imager: cam.imager || null,
      attribution: 'HPWREN (hpwren.ucsd.edu)',
    },
  };
}

export function flattenHpwrenSites(sites) {
  const rows = [];
  if (!sites || typeof sites !== 'object') return rows;
  for (const [siteKey, site] of Object.entries(sites)) {
    const cams = site?.cams;
    if (!cams || typeof cams !== 'object') continue;
    for (const [camId, cam] of Object.entries(cams)) {
      const row = normalizeHpwrenCamera(siteKey, site, camId, cam);
      if (row) rows.push(row);
    }
  }
  return rows;
}

/** @param {object} entry Caltrans CWWP2 CCTV row */
export function normalizeCaltransCctv(entry) {
  const cctv = entry?.cctv || entry;
  if (!cctv) return null;
  if (String(cctv.inService || '').toLowerCase() !== 'true') return null;

  const loc = cctv.location || {};
  const lat = toNum(loc.latitude ?? loc.lat);
  const lng = toNum(loc.longitude ?? loc.lng ?? loc.lon);
  if (lat == null || lng == null) return null;

  const district = String(loc.district || cctv.district || '').padStart(2, '0');
  const index = String(cctv.index || loc.index || '');
  if (!district || !index) return null;

  const locationName = loc.locationName || loc.nearbyPlace || `District ${district} CCTV`;
  const staticImg = cctv.imageData?.static || {};
  const image_url = staticImg.currentImageURL || null;
  const streamUrl = cctv.imageData?.streamingVideoURL || null;
  const hazardText = `${locationName} ${loc.route || ''} ${loc.direction || ''} ${loc.county || ''}`;

  return {
    source: 'caltrans_cwwp2',
    source_id: `d${district}:${index}`,
    name: locationName,
    lat,
    lng,
    state_abbr: 'CA',
    county_name: loc.county || null,
    camera_url: streamUrl || `https://cwwp2.dot.ca.gov/tools/showImages.htm`,
    network_url: 'https://cwwp2.dot.ca.gov/documentation/cctv/cctv.htm',
    image_url,
    status: 'active',
    hazard_types: inferDotHazardTypes(hazardText),
    media_type: streamUrl ? 'live_stream' : 'still_image',
    refresh_minutes: parseInt(staticImg.currentImageUpdateFrequency, 10) || 2,
    raw: {
      district,
      route: loc.route || null,
      direction: loc.direction || null,
      attribution: 'Caltrans CWWP2',
    },
  };
}

/** @param {object} cam 511NY camera record */
export function normalize511NyCamera(cam) {
  if (!cam) return null;
  const id = cam.ID ?? cam.Id ?? cam.id ?? cam.CameraID ?? cam.cameraId;
  const lat = toNum(cam.Latitude ?? cam.latitude ?? cam.lat);
  const lng = toNum(cam.Longitude ?? cam.longitude ?? cam.lng ?? cam.lon);
  if (id == null || lat == null || lng == null) return null;

  const name =
    cam.Name ??
    cam.name ??
    cam.Location ??
    cam.location ??
    cam.Roadway ??
    `NY DOT cam ${id}`;
  const image_url =
    cam.URL ??
    cam.Url ??
    cam.url ??
    cam.ImageUrl ??
    cam.imageUrl ??
    cam.ViewImage ??
    null;
  const video_url = cam.VideoUrl ?? cam.videoUrl ?? cam.VideoURL ?? null;
  const hazardText = `${name} ${cam.Roadway || ''} ${cam.Direction || ''}`;

  return {
    source: 'dot_511ny',
    source_id: String(id),
    name: String(name),
    lat,
    lng,
    state_abbr: 'NY',
    county_name: cam.County ?? cam.county ?? null,
    camera_url: video_url || image_url || 'https://511ny.org/',
    network_url: 'https://511ny.org/',
    image_url,
    status: 'active',
    hazard_types: inferDotHazardTypes(hazardText),
    media_type: video_url ? 'live_stream' : 'still_image',
    refresh_minutes: 2,
    raw: {
      roadway: cam.Roadway ?? cam.roadway ?? null,
      direction: cam.Direction ?? cam.direction ?? null,
      attribution: '511NY / NYSDOT',
    },
  };
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
  if (!fs.existsSync(filePath)) return { ucsd_pier: [] };
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

async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...FETCH_HEADERS, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${url}: ${text.slice(0, 200)}`);
  }
  return res.text();
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

export async function ingestAlertWestWebcams() {
  await initFireCamerasSchema();
  const list = await fetchJson(ALERTWEST_CAMERAS_URL);
  const cameras = Array.isArray(list) ? list : (list.cameras || list.data || []);
  const batch = cameras.map(normalizeAlertWestCamera).filter(Boolean);
  const result = await upsertHazardWebcams(batch);
  return {
    upserted: result.upserted || 0,
    fetched: cameras.length,
    normalized: batch.length,
    skippedCa: cameras.length - batch.length,
  };
}

export async function ingestHpwrenWebcams() {
  await initFireCamerasSchema();
  const text = await fetchText(HPWREN_SITES_URL);
  const sites = parseHpwrenSitesJs(text);
  const batch = flattenHpwrenSites(sites);
  const result = await upsertHazardWebcams(batch);
  return {
    upserted: result.upserted || 0,
    fetched: batch.length,
    normalized: batch.length,
    sites: Object.keys(sites || {}).length,
  };
}

export async function ingestCaltransCwwp2Webcams() {
  await initFireCamerasSchema();
  const batch = [];
  let fetched = 0;

  for (const district of CALTRANS_CWWP2_DISTRICTS) {
    const d = String(district).padStart(2, '0');
    const url = `https://cwwp2.dot.ca.gov/data/d${district}/cctv/cctvStatusD${d}.json`;
    try {
      const data = await fetchJson(url);
      const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      fetched += rows.length;
      for (const row of rows) {
        const normalized = normalizeCaltransCctv(row);
        if (normalized) batch.push(normalized);
      }
    } catch (e) {
      console.warn(`⚠️  Caltrans district ${district} failed:`, e.message);
    }
  }

  const result = await upsertHazardWebcams(batch);
  return {
    upserted: result.upserted || 0,
    fetched,
    normalized: batch.length,
    districts: CALTRANS_CWWP2_DISTRICTS.length,
  };
}

export async function ingestDot511NyWebcams() {
  const apiKey = String(process.env.NY511_API_KEY || process.env.NY511_DEVELOPER_KEY || '').trim();
  if (!apiKey) {
    console.warn('⚠️  NY511_API_KEY not set; skipping 511NY ingest');
    return { upserted: 0, skipped: true, reason: 'missing NY511_API_KEY' };
  }

  await initFireCamerasSchema();
  const url = `${NY511_CAMERAS_URL}?key=${encodeURIComponent(apiKey)}`;
  const data = await fetchJson(url);
  const list = Array.isArray(data)
    ? data
    : (data.cameras || data.Cameras || data.results || data.data || []);
  const batch = list.map(normalize511NyCamera).filter(Boolean);
  const result = await upsertHazardWebcams(batch);
  return {
    upserted: result.upserted || 0,
    fetched: list.length,
    normalized: batch.length,
  };
}

export async function ingestUcsdPierWebcams() {
  await initFireCamerasSchema();
  const seeds = loadSeedFile();
  const batch = [];
  for (const row of seeds.ucsd_pier || []) {
    const n = normalizeSeedMount(row, 'ucsd_pier');
    if (n) batch.push(n);
  }
  const result = await upsertHazardWebcams(batch);
  return { upserted: result.upserted || 0, fetched: batch.length };
}

export async function ingestUcsdWebcams() {
  return ingestUcsdPierWebcams();
}

const INGEST_HANDLERS = {
  alertcalifornia: ingestCaFireCameras,
  alertwest: ingestAlertWestWebcams,
  usgs_nims: ingestUsgsNimsWebcams,
  usgs_volcano: ingestUsgsVolcanoWebcams,
  faa_weathercam: ingestFaaWeatherCams,
  webcoos: ingestWebCoosWebcams,
  ucsd_hpwren: ingestHpwrenWebcams,
  ucsd_pier: ingestUcsdPierWebcams,
  caltrans_cwwp2: ingestCaltransCwwp2Webcams,
  dot_511ny: ingestDot511NyWebcams,
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
