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
export const NDBC_BUOYCAMS_URL = 'https://www.ndbc.noaa.gov/buoycams.php';
export const NDBC_BUOYCAM_IMAGE = 'https://www.ndbc.noaa.gov/buoycam.php';
export const DRIVENC_CAMERAS_URL = 'https://www.drivenc.gov/List/GetData/Cameras';
export const FL511_CAMERAS_URL = 'https://fl511.com/List/GetData/Cameras';
export const MD_CHART_CAMERAS_URL =
  'https://chartexp1.sha.maryland.gov/CHARTExportClientService/getCameraMapDataJSON.do';
export const NPS_WEBCAMS_URL = 'https://developer.nps.gov/api/v1/webcams';

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
  'ndbc_buoycam',
  'ioos_coastal',
  'nps_webcams',
  'dot_coastal',
];

export function normalizeCountyKey(county) {
  return String(county || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^saint\b/, 'st');
}

/** DriveNC counties on the Atlantic coastal plain and Outer Banks. */
export const NC_COASTAL_COUNTIES = new Set([
  'beaufort',
  'bertie',
  'brunswick',
  'camden',
  'carteret',
  'chowan',
  'craven',
  'currituck',
  'dare',
  'hyde',
  'new hanover',
  'onslow',
  'pamlico',
  'pasquotank',
  'pender',
  'perquimans',
  'tyrrell',
  'washington',
]);

/** FL511 counties on the Atlantic or Gulf shore. */
export const FL_COASTAL_COUNTIES = new Set([
  'bay', 'brevard', 'broward', 'charlotte', 'citrus', 'collier', 'dixie', 'duval',
  'escambia', 'flagler', 'franklin', 'gulf', 'hernando', 'hillsborough',
  'indian river', 'jefferson', 'lee', 'levy', 'manatee', 'martin', 'miami dade',
  'monroe', 'nassau', 'okaloosa', 'palm beach', 'pasco', 'pinellas', 'santa rosa',
  'sarasota', 'st johns', 'st lucie', 'taylor', 'volusia', 'wakulla', 'walton',
]);

/** MD CHART groups that sit on the Chesapeake or Atlantic shore. */
export const MD_COASTAL_CATEGORIES = new Set([
  'eastern shore',
  'annapolis',
  'southern md',
]);

export const NPS_COASTAL_PARK_CODES = new Set([
  'acad', 'asis', 'bisc', 'caco', 'caha', 'calo', 'chis', 'cuis', 'drto',
  'ever', 'fiis', 'gate', 'goga', 'guis', 'havo', 'hale', 'kefj', 'olym',
  'pais', 'pore', 'viis',
]);

const STATE_NAME_TO_ABBR = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN',
  texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

const STATE_ABBRS = new Set(Object.values(STATE_NAME_TO_ABBR));

/** JS word-boundary test. PostgreSQL retag uses COASTAL_NAME_SQL. */
export const COASTAL_NAME_PATTERN =
  /\b(pier|wharf|inlet|seawall|sea wall|surf|estuary|lagoon|beach|lighthouse|harbor|harbour|ocean|seashore|coast|coastal|gulf|bay|cape|outer banks|galveston|chesapeake|waikiki|boardwalk|jetty|marina|tidal|tide|causeway|pch|hwy\s*1|highway\s*1|sr-?1)\b/i;

/** POSIX pattern for fire_cameras.name (~*). */
export const COASTAL_NAME_SQL =
  '\\y(pier|wharf|inlet|seawall|surf|estuary|lagoon|beach|lighthouse|harbor|harbour|ocean|seashore|coast|coastal|gulf|bay|cape|outer banks|galveston|chesapeake|waikiki|boardwalk|jetty|marina|tidal|tide|causeway|pch)\\y|sea[[:space:]]+wall|highway[[:space:]]*1|hwy[[:space:]]*1|sr-?1';

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

export function textLooksCoastal(text) {
  return COASTAL_NAME_PATTERN.test(String(text || ''));
}

export function withCoastalHazard(types, text) {
  const tags = new Set(Array.isArray(types) ? types : []);
  if (textLooksCoastal(text)) tags.add('coastal');
  if (!tags.size) tags.add('hazard');
  return Array.from(tags);
}

export function inferStateFromLabel(text) {
  const raw = String(text || '');
  const tail = raw.match(/,\s*([A-Z]{2})\b/);
  if (tail && STATE_ABBRS.has(tail[1])) return tail[1];
  const lower = raw.toLowerCase();
  const names = Object.keys(STATE_NAME_TO_ABBR).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (lower.includes(name)) return STATE_NAME_TO_ABBR[name];
  }
  return null;
}

export function isNcCoastalCounty(county) {
  return NC_COASTAL_COUNTIES.has(normalizeCountyKey(county));
}

export function isFlCoastalCounty(county) {
  return FL_COASTAL_COUNTIES.has(normalizeCountyKey(county));
}

export function isMdCoastalChartCamera(cam) {
  const cats = Array.isArray(cam?.cameraCategories) ? cam.cameraCategories : [];
  if (cats.some((c) => MD_COASTAL_CATEGORIES.has(String(c || '').trim().toLowerCase()))) {
    return true;
  }
  return textLooksCoastal(`${cam?.name || ''} ${cam?.description || ''}`);
}

function parsePointWkt(wkt) {
  const match = /POINT\s*\(\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*\)/i.exec(String(wkt || ''));
  if (!match) return null;
  const lng = toNum(match[1]);
  const lat = toNum(match[2]);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function inferHazardTypesFromText(text) {
  const t = String(text || '').toLowerCase();
  const tags = new Set(['hazard']);
  if (/river|stream|gage|gauge|hydrol|water/.test(t)) tags.add('river');
  if (/flood|inund|dam|reservoir/.test(t)) tags.add('flood');
  if (/snow|ice|winter/.test(t)) tags.add('snow');
  if (/landslide|debris|mudflow/.test(t)) tags.add('landslide');
  if (textLooksCoastal(t)) tags.add('coastal');
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
    hazard_types: withCoastalHazard(['fire', 'hazard'], `${label} ${county || ''}`),
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
    hazard_types: withCoastalHazard(['fire', 'hazard', 'storm'], `${siteName} ${camName}`),
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

/** @param {object} station NDBC buoycams.php record */
export function normalizeNdbcBuoyCam(station) {
  if (!station) return null;
  const id = station.id ?? station.stationId ?? station.station;
  const lat = toNum(station.lat ?? station.latitude);
  const lng = toNum(station.lng ?? station.lon ?? station.longitude);
  if (id == null || lat == null || lng == null) return null;

  const name = String(station.name || `NDBC ${id}`).trim();
  const still = station.img
    ? `https://www.ndbc.noaa.gov/images/buoycam/${station.img}`
    : null;

  return {
    source: 'ndbc_buoycam',
    source_id: String(id),
    name: `NDBC ${id} — ${name}`,
    lat,
    lng,
    state_abbr: inferStateFromLabel(name),
    county_name: null,
    camera_url: `https://www.ndbc.noaa.gov/station_page.php?station=${encodeURIComponent(id)}`,
    network_url: 'https://www.ndbc.noaa.gov/',
    image_url: `${NDBC_BUOYCAM_IMAGE}?station=${encodeURIComponent(id)}`,
    status: 'active',
    hazard_types: ['coastal', 'storm', 'hazard'],
    media_type: 'still_image',
    refresh_minutes: 10,
    raw: {
      ndbc_id: String(id),
      latest_still: still,
      attribution: 'NOAA National Data Buoy Center',
    },
  };
}

/**
 * Shared 511 list row (DriveNC, FL511). Coordinates come from the feed.
 * @param {object} cam
 * @param {{ idPrefix: string, state: string, origin: string, network: string, counties: Set<string>, provider: string, attribution: string }} opts
 */
export function normalize511CoastalCamera(cam, opts) {
  if (!cam || cam.visible === false || !opts?.counties) return null;
  const id = cam.id ?? cam.DT_RowId;
  const point = parsePointWkt(cam.latLng?.geography?.wellKnownText || cam.latLng?.wellKnownText);
  const lat = point?.lat ?? toNum(cam.latitude ?? cam.lat);
  const lng = point?.lng ?? toNum(cam.longitude ?? cam.lng ?? cam.lon);
  if (id == null || lat == null || lng == null) return null;
  if (!opts.counties.has(normalizeCountyKey(cam.county))) return null;

  const images = Array.isArray(cam.images) ? cam.images : [];
  const image = images.find((img) => img && !img.disabled && !img.blocked) || null;
  let image_url = image?.imageUrl || null;
  if (image_url && image_url.startsWith('/')) {
    image_url = `${opts.origin.replace(/\/$/, '')}${image_url}`;
  }
  const video_url = image?.videoUrl || null;
  const location = cam.location || cam.roadway || `${opts.state} camera ${id}`;
  const name = [cam.roadway, location].filter(Boolean).join(' — ');

  return {
    source: 'dot_coastal',
    source_id: `${opts.idPrefix}:${id}`,
    name,
    lat,
    lng,
    state_abbr: opts.state,
    county_name: cam.county || null,
    camera_url: video_url || image_url || opts.network,
    network_url: opts.network,
    image_url,
    status: 'active',
    hazard_types: withCoastalHazard(
      ['coastal', ...inferDotHazardTypes(`${name} ${cam.county || ''} ${cam.direction || ''}`)],
      `${name} ${cam.county || ''}`
    ),
    media_type: image_url ? 'still_image' : 'live_stream',
    refresh_minutes: 2,
    raw: {
      provider: opts.provider,
      roadway: cam.roadway || null,
      direction: cam.direction || null,
      video_url,
      attribution: opts.attribution,
    },
  };
}

/** @param {object} cam DriveNC /List/GetData/Cameras row */
export function normalizeDriveNcCamera(cam) {
  return normalize511CoastalCamera(cam, {
    idPrefix: 'nc',
    state: 'NC',
    origin: 'https://www.drivenc.gov',
    network: 'https://www.drivenc.gov/cctv',
    counties: NC_COASTAL_COUNTIES,
    provider: 'ncdot',
    attribution: 'DriveNC / NCDOT',
  });
}

/** @param {object} cam FL511 /List/GetData/Cameras row */
export function normalizeFl511Camera(cam) {
  return normalize511CoastalCamera(cam, {
    idPrefix: 'fl',
    state: 'FL',
    origin: 'https://fl511.com',
    network: 'https://fl511.com/cctv',
    counties: FL_COASTAL_COUNTIES,
    provider: 'fl511',
    attribution: 'FL511 / FDOT',
  });
}

/** @param {object} cam MD CHART camera map record */
export function normalizeMdChartCamera(cam) {
  if (!cam || !isMdCoastalChartCamera(cam)) return null;
  const id = cam.id;
  const lat = toNum(cam.lat ?? cam.latitude);
  const lng = toNum(cam.lon ?? cam.lng ?? cam.longitude);
  if (id == null || lat == null || lng == null) return null;

  const name = cam.description || cam.name || `MD CHART ${id}`;
  const videoPage = cam.publicVideoURL || `https://chart.maryland.gov/Video/GetVideo/${id}`;
  const online = String(cam.opStatus || '').toUpperCase() === 'OK'
    || String(cam.commMode || '').toUpperCase() === 'ONLINE';

  return {
    source: 'dot_coastal',
    source_id: `md:${id}`,
    name: String(name),
    lat,
    lng,
    state_abbr: 'MD',
    county_name: null,
    camera_url: videoPage,
    network_url: 'https://chart.maryland.gov/',
    image_url: null,
    status: online ? 'active' : 'inactive',
    hazard_types: withCoastalHazard(
      ['coastal', ...inferDotHazardTypes(name)],
      `${name} ${(cam.cameraCategories || []).join(' ')}`
    ),
    media_type: 'live_stream',
    refresh_minutes: 1,
    raw: {
      provider: 'md_chart',
      categories: cam.cameraCategories || [],
      route: [cam.routePrefix, cam.routeNumber].filter(Boolean).join('-') || null,
      attribution: 'MDOT SHA CHART',
    },
  };
}

/** @param {object} item NPS developer webcams API record */
export function normalizeNpsWebcam(item) {
  if (!item) return null;
  const parks = Array.isArray(item.relatedParks) ? item.relatedParks : [];
  const park = parks[0] || {};
  const parkCode = String(park.parkCode || '').toLowerCase();
  const title = item.title || item.name || park.fullName || '';
  const text = `${title} ${item.description || ''} ${park.fullName || ''}`;
  if (!NPS_COASTAL_PARK_CODES.has(parkCode) && !textLooksCoastal(text)) return null;

  const lat = toNum(item.latitude ?? item.lat);
  const lng = toNum(item.longitude ?? item.lng ?? item.lon);
  const id = item.id || item.webcamId;
  if (id == null || lat == null || lng == null) return null;

  const images = Array.isArray(item.images) ? item.images : [];
  const image_url = images[0]?.url || images[0]?.imageUrl || null;
  const states = String(park.states || item.states || '');
  const state_abbr = states.split(',')[0].trim().toUpperCase() || inferStateFromLabel(text);

  return {
    source: 'nps_webcams',
    source_id: String(id),
    name: title || `NPS webcam ${id}`,
    lat,
    lng,
    state_abbr: state_abbr && state_abbr.length === 2 ? state_abbr : null,
    county_name: null,
    camera_url: item.url || (parkCode ? `https://www.nps.gov/${parkCode}/` : 'https://www.nps.gov/'),
    network_url: 'https://www.nps.gov/',
    image_url,
    status: 'active',
    hazard_types: ['coastal', 'hazard'],
    media_type: image_url ? 'still_image' : 'live_stream',
    refresh_minutes: 15,
    raw: {
      parkCode: parkCode || null,
      parkName: park.fullName || null,
      attribution: 'National Park Service',
    },
  };
}

function dedupeWebcamRows(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (!row?.source_id) continue;
    const key = `${row.source}:${row.source_id}`;
    const existing = byId.get(key);
    if (!existing || (!existing.image_url && row.image_url)) byId.set(key, row);
  }
  return Array.from(byId.values());
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
    hazard_types: withCoastalHazard(['aviation', 'weather', 'hazard'], siteName),
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

export async function ingestNdbcBuoyCams() {
  await initFireCamerasSchema();
  const data = await fetchJson(NDBC_BUOYCAMS_URL);
  const list = Array.isArray(data) ? data : (data.stations || data.buoys || []);
  const batch = list.map(normalizeNdbcBuoyCam).filter(Boolean);
  const result = await upsertHazardWebcams(batch);
  return {
    upserted: result.upserted || 0,
    fetched: list.length,
    normalized: batch.length,
  };
}

async function fetch511CameraPages(url, referer) {
  const pageSize = 250;
  const cameras = [];
  let start = 0;
  let total = Infinity;

  while (start < total && start < 8000) {
    const body = new URLSearchParams({
      draw: '1',
      start: String(start),
      length: String(pageSize),
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...FETCH_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: referer,
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${url}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const page = Array.isArray(data?.data) ? data.data : [];
    const reported = Number(data?.recordsTotal);
    if (Number.isFinite(reported)) total = reported;
    cameras.push(...page);
    if (!page.length) break;
    start += page.length;
    if (page.length < pageSize) break;
  }
  return cameras;
}

export async function ingestDotCoastalWebcams() {
  await initFireCamerasSchema();
  const [ncResult, mdResult, flResult] = await Promise.allSettled([
    fetch511CameraPages(DRIVENC_CAMERAS_URL, 'https://www.drivenc.gov/cctv'),
    fetchJson(MD_CHART_CAMERAS_URL),
    fetch511CameraPages(FL511_CAMERAS_URL, 'https://fl511.com/cctv'),
  ]);

  const batch = [];
  let fetched = 0;
  if (ncResult.status === 'fulfilled') {
    fetched += ncResult.value.length;
    for (const cam of ncResult.value) {
      const row = normalizeDriveNcCamera(cam);
      if (row) batch.push(row);
    }
  } else {
    console.warn('⚠️  DriveNC cameras failed:', ncResult.reason?.message);
  }

  if (mdResult.status === 'fulfilled') {
    const list = Array.isArray(mdResult.value?.data)
      ? mdResult.value.data
      : (Array.isArray(mdResult.value) ? mdResult.value : []);
    fetched += list.length;
    for (const cam of list) {
      const row = normalizeMdChartCamera(cam);
      if (row) batch.push(row);
    }
  } else {
    console.warn('⚠️  MD CHART cameras failed:', mdResult.reason?.message);
  }

  if (flResult.status === 'fulfilled') {
    fetched += flResult.value.length;
    for (const cam of flResult.value) {
      const row = normalizeFl511Camera(cam);
      if (row) batch.push(row);
    }
  } else {
    console.warn('⚠️  FL511 cameras failed:', flResult.reason?.message);
  }

  if (!batch.length
    && ncResult.status === 'rejected'
    && mdResult.status === 'rejected'
    && flResult.status === 'rejected') {
    throw new Error('No coastal DOT camera feeds available');
  }

  const result = await upsertHazardWebcams(batch);
  return {
    upserted: result.upserted || 0,
    fetched,
    normalized: batch.length,
    nc: ncResult.status === 'fulfilled' ? ncResult.value.length : 0,
    md: mdResult.status === 'fulfilled'
      ? (Array.isArray(mdResult.value?.data) ? mdResult.value.data.length : 0)
      : 0,
    fl: flResult.status === 'fulfilled' ? flResult.value.length : 0,
  };
}

function npsApiKey() {
  return String(process.env.NPS_API_KEY || process.env.NPS_API_TOKEN || '').trim();
}

export async function ingestIoosCoastalWebcams() {
  await initFireCamerasSchema();
  const seeds = loadSeedFile();
  const batch = [];
  for (const row of seeds.ioos_coastal || []) {
    const normalized = normalizeSeedMount(row, 'ioos_coastal');
    if (normalized) {
      normalized.hazard_types = withCoastalHazard(normalized.hazard_types, normalized.name);
      batch.push(normalized);
    }
  }
  const result = await upsertHazardWebcams(batch);
  return { upserted: result.upserted || 0, fetched: batch.length, normalized: batch.length };
}

export async function ingestNpsWebcams() {
  await initFireCamerasSchema();
  const seeds = loadSeedFile();
  const batch = [];
  for (const row of seeds.nps_webcams || []) {
    const normalized = normalizeSeedMount(row, 'nps_webcams');
    if (normalized) {
      normalized.hazard_types = withCoastalHazard(normalized.hazard_types, normalized.name);
      batch.push(normalized);
    }
  }

  const key = npsApiKey();
  let apiFetched = 0;
  if (key) {
    try {
      const url = `${NPS_WEBCAMS_URL}?limit=500&api_key=${encodeURIComponent(key)}`;
      const data = await fetchJson(url);
      const list = Array.isArray(data?.data) ? data.data : [];
      apiFetched = list.length;
      for (const item of list) {
        const row = normalizeNpsWebcam(item);
        if (row) batch.push(row);
      }
    } catch (e) {
      console.warn('⚠️  NPS webcams API failed:', e.message);
    }
  } else {
    console.warn('⚠️  NPS_API_KEY not set; using curated coastal park seeds');
  }

  const merged = dedupeWebcamRows(batch);
  const result = await upsertHazardWebcams(merged);
  return {
    upserted: result.upserted || 0,
    fetched: apiFetched || batch.length,
    normalized: merged.length,
    seeded: (seeds.nps_webcams || []).length,
    api: Boolean(key),
  };
}

export async function retagCoastalHazardTypes() {
  const pool = getPool();
  if (!pool) return { updated: 0, skipped: true, reason: 'database unavailable' };
  const res = await pool.query(
    `UPDATE fire_cameras
     SET hazard_types = (
       SELECT COALESCE(jsonb_agg(DISTINCT tag), '["coastal"]'::jsonb)
       FROM (
         SELECT jsonb_array_elements_text(COALESCE(hazard_types, '[]'::jsonb)) AS tag
         UNION ALL
         SELECT 'coastal'
       ) tags
     ),
     updated_at = NOW()
     WHERE NOT COALESCE(hazard_types, '[]'::jsonb) @> '["coastal"]'::jsonb
       AND (
         source IN ('webcoos','ucsd_pier','ndbc_buoycam','ioos_coastal','nps_webcams','dot_coastal')
         OR COALESCE(name, '') ~* $1
       )`,
    [COASTAL_NAME_SQL]
  );
  return { updated: res.rowCount || 0 };
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
  ndbc_buoycam: ingestNdbcBuoyCams,
  ioos_coastal: ingestIoosCoastalWebcams,
  nps_webcams: ingestNpsWebcams,
  dot_coastal: ingestDotCoastalWebcams,
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

  try {
    results.coastalRetag = await retagCoastalHazardTypes();
  } catch (e) {
    console.warn('⚠️  Coastal hazard retag failed:', e.message);
    results.coastalRetag = { error: e.message, updated: 0 };
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
  const coastal = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM fire_cameras
     WHERE COALESCE(hazard_types, '[]'::jsonb) @> '["coastal"]'::jsonb`
  );
  return {
    total: total.rows[0]?.total || 0,
    coastal: coastal.rows[0]?.count || 0,
    bySource: bySource.rows,
  };
}
