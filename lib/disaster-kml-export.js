/**
 * Cinematic Google Earth KML export for unified disaster selection context.
 * Uses gx:Tour and gx:SoundCue (Google Earth 5+); not portable to generic KML viewers.
 */
import { resolveTrack } from './disaster-mood-music.js';

const GX_NS = 'http://www.google.com/kml/ext/2.2';

export const KML_MIME = 'application/vnd.google-earth.kml+xml';

const RISK_STYLES = {
  lowRisk: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  mediumRisk: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
  highRisk: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  notAnalyzed: 'https://maps.google.com/mapfiles/ms/icons/gray-dot.png',
  disaster: 'https://maps.google.com/mapfiles/kml/paddle/red-stars.png',
  camera: 'https://maps.google.com/mapfiles/kml/shapes/camera.png',
};

const MAX_TOUR_LOANS = 12;
const MAX_TOUR_CAMERAS = 10;

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function getLoanRiskStyleId(loan) {
  const score = loan?.disaster_risk_score;
  if (score == null || (score === 0 && !loan?.last_risk_analysis)) {
    return 'notAnalyzed';
  }
  if (score <= 2) return 'lowRisk';
  if (score <= 5) return 'mediumRisk';
  return 'highRisk';
}

export function getRiskLevelText(score) {
  if (score == null || score === 0) return 'Not Analyzed';
  if (score <= 2) return 'Low Risk';
  if (score <= 5) return 'Medium Risk';
  return 'High Risk';
}

export function resolveDisasterCoords(disaster) {
  if (!disaster) return { lat: null, lng: null };
  const tryPair = (latVal, lngVal) => {
    const lat = parseFloat(latVal);
    const lng = parseFloat(lngVal);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
    return { lat: null, lng: null };
  };
  const fromObj = tryPair(
    disaster.latitude ?? disaster.lat,
    disaster.longitude ?? disaster.lng
  );
  if (fromObj.lat != null) return fromObj;
  if (disaster.avg_latitude != null && disaster.avg_longitude != null) {
    return tryPair(disaster.avg_latitude, disaster.avg_longitude);
  }
  return { lat: null, lng: null };
}

/**
 * Approximate circle polygon for radius ring (miles).
 * @returns {string} space-separated "lng,lat,0" pairs for LinearRing
 */
export function buildRadiusRingCoords(lat, lng, radiusMiles, segments = 64) {
  const earthRadiusMiles = 3958.8;
  const latRad = (lat * Math.PI) / 180;
  const angular = radiusMiles / earthRadiusMiles;
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const bearing = (2 * Math.PI * i) / segments;
    const lat2 = Math.asin(
      Math.sin(latRad) * Math.cos(angular)
        + Math.cos(latRad) * Math.sin(angular) * Math.cos(bearing)
    );
    const lng2 = ((lng * Math.PI) / 180)
      + Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(latRad),
        Math.cos(angular) - Math.sin(latRad) * Math.sin(lat2)
      );
    points.push(`${((lng2 * 180) / Math.PI).toFixed(6)},${((lat2 * 180) / Math.PI).toFixed(6)},0`);
  }
  return points.join(' ');
}

export function buildAudioStreamUrl(baseUrl, relativePath) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  if (!base || !relativePath) return null;
  return `${base}/api/audio/stream/${encodeURIComponent(relativePath)}`;
}

function buildStyleBlock() {
  return Object.entries(RISK_STYLES)
    .map(([id, href]) => `
    <Style id="${id}">
      <IconStyle>
        <Icon><href>${href}</href></Icon>
        <scale>${id === 'disaster' ? '1.3' : '1.0'}</scale>
      </IconStyle>
      <LabelStyle><scale>0.9</scale></LabelStyle>
    </Style>`)
    .join('');
}

function buildLoanPlacemark(loan, styleId) {
  const lat = parseFloat(loan.latitude);
  const lng = parseFloat(loan.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';

  const lastAnalysis = loan.last_risk_analysis
    ? new Date(loan.last_risk_analysis).toLocaleDateString()
    : 'Not analyzed';
  const amount = loan.loan_amount != null
    ? `$${Number(loan.loan_amount).toLocaleString()}`
    : '—';

  return `
    <Placemark>
      <name>${escapeXml(loan.loan_number || 'Loan')}</name>
      <description><![CDATA[
        <b>Loan:</b> ${escapeXml(loan.loan_number)}<br/>
        <b>Borrower:</b> ${escapeXml(loan.borrower_name)}<br/>
        <b>Address:</b> ${escapeXml(loan.property_address)}, ${escapeXml(loan.city)}, ${escapeXml(loan.state)} ${escapeXml(loan.zip_code)}<br/>
        <b>County:</b> ${escapeXml(loan.county)}<br/>
        <b>Amount:</b> ${escapeXml(amount)}<br/>
        <b>Milestone:</b> ${escapeXml(loan.milestone)}<br/>
        <b>Risk:</b> ${escapeXml(getRiskLevelText(loan.disaster_risk_score))} (${escapeXml(loan.disaster_risk_score)})<br/>
        <b>Last analysis:</b> ${escapeXml(lastAnalysis)}
      ]]></description>
      <styleUrl>#${styleId}</styleUrl>
      <Point><coordinates>${lng},${lat},0</coordinates></Point>
    </Placemark>`;
}

function buildCameraPlacemark(camera) {
  const lat = parseFloat(camera.lat ?? camera.latitude);
  const lng = parseFloat(camera.lng ?? camera.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';

  const name = camera.title || camera.name || 'Hazard webcam';
  const dist = camera.distance_miles != null ? `${camera.distance_miles} mi` : '—';
  const imageUrl = camera.image_url || '';
  const feedUrl = camera.camera_url || '';

  return `
    <Placemark>
      <name>${escapeXml(name)}</name>
      <description><![CDATA[
        <b>Source:</b> ${escapeXml(camera.source)}<br/>
        <b>Location:</b> ${escapeXml(camera.county_name)}, ${escapeXml(camera.state_abbr)}<br/>
        <b>Distance:</b> ${escapeXml(dist)}<br/>
        ${feedUrl ? `<a href="${escapeXml(feedUrl)}">Open feed</a><br/>` : ''}
        ${imageUrl ? `<img src="${escapeXml(imageUrl)}" width="320" alt="webcam still"/>` : ''}
      ]]></description>
      <styleUrl>#camera</styleUrl>
      <Point><coordinates>${lng},${lat},0</coordinates></Point>
    </Placemark>`;
}

function buildDisasterPlacemark(disaster, coords) {
  const title = disaster.title || disaster.declarationTitle || 'Selected disaster';
  const state = disaster.state_abbr || disaster.state || '';
  const county = disaster.county_name || disaster.county || '';
  const source = disaster.source || '';
  const eventType = disaster.event_type || disaster.eventType || '';

  let body = `
    <Placemark>
      <name>${escapeXml(title)}</name>
      <description><![CDATA[
        <b>Event:</b> ${escapeXml(eventType)}<br/>
        <b>Source:</b> ${escapeXml(source)}<br/>
        <b>County:</b> ${escapeXml(county)}<br/>
        <b>State:</b> ${escapeXml(state)}
      ]]></description>
      <styleUrl>#disaster</styleUrl>`;

  if (coords.lat != null && coords.lng != null) {
    body += `
      <Point><coordinates>${coords.lng},${coords.lat},0</coordinates></Point>`;
  }
  body += `
    </Placemark>`;
  return body;
}

function buildRadiusPlacemark(coords, radiusMiles) {
  if (coords.lat == null || coords.lng == null || !radiusMiles) return '';
  const ring = buildRadiusRingCoords(coords.lat, coords.lng, radiusMiles);
  return `
    <Placemark>
      <name>Search radius (${radiusMiles} mi)</name>
      <description>Loans and webcams filtered within ${radiusMiles} miles of the selected disaster.</description>
      <Style>
        <LineStyle><color>ff0099ff</color><width>2</width></LineStyle>
        <PolyStyle><color>330099ff</color><fill>1</fill><outline>1</outline></PolyStyle>
      </Style>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${ring}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
}

function buildMetadataFolder(meta) {
  const lines = [
    meta?.title ? `<b>Disaster:</b> ${escapeXml(meta.title)}` : '',
    meta?.mode ? `<b>Loan scope:</b> ${escapeXml(meta.mode)}` : '',
    meta?.radiusMiles ? `<b>Radius:</b> ${escapeXml(meta.radiusMiles)} mi` : '',
    meta?.loanCount != null ? `<b>Loans exported:</b> ${meta.loanCount}` : '',
    meta?.cameraCount != null ? `<b>Webcams exported:</b> ${meta.cameraCount}` : '',
    meta?.exportedAt ? `<b>Exported:</b> ${escapeXml(meta.exportedAt)}` : '',
    '<br/><i>Google Earth cinematic tour — gx:Tour and gx:SoundCue require Google Earth.</i>',
    '<br/><i>Audio streams from this server when MP3 files exist under music/disasters/.</i>',
  ].filter(Boolean).join('<br/>');

  return `
    <Folder>
      <name>Export metadata</name>
      <description><![CDATA[${lines}]]></description>
    </Folder>`;
}

function buildLookAtXml(lat, lng, range, tilt = 45, heading = 0) {
  return `
        <LookAt>
          <longitude>${lng}</longitude>
          <latitude>${lat}</latitude>
          <altitude>0</altitude>
          <range>${range}</range>
          <tilt>${tilt}</tilt>
          <heading>${heading}</heading>
        </LookAt>`;
}

function buildFlyTo(lat, lng, range, duration = 4, tilt = 50) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `
      <gx:FlyTo>
        <gx:duration>${duration}</gx:duration>
        <gx:flyToMode>smooth</gx:flyToMode>${buildLookAtXml(lat, lng, range, tilt)}
      </gx:FlyTo>`;
}

function buildSoundCue(audioUrl, duration = 45) {
  if (!audioUrl) return '';
  return `
      <gx:SoundCue>
        <href>${escapeXml(audioUrl)}</href>
      </gx:SoundCue>
      <gx:Wait>
        <gx:duration>${Math.min(duration, 60)}</gx:duration>
      </gx:Wait>`;
}

function sortLoansForTour(loans) {
  return [...(loans || [])]
    .filter((l) => Number.isFinite(parseFloat(l.latitude)) && Number.isFinite(parseFloat(l.longitude)))
    .sort((a, b) => (b.disaster_risk_score || 0) - (a.disaster_risk_score || 0))
    .slice(0, MAX_TOUR_LOANS);
}

function sortCamerasForTour(cameras) {
  return [...(cameras || [])]
    .filter((c) => Number.isFinite(parseFloat(c.lat ?? c.latitude)) && Number.isFinite(parseFloat(c.lng ?? c.longitude)))
    .sort((a, b) => (parseFloat(a.distance_miles) || 9999) - (parseFloat(b.distance_miles) || 9999))
    .slice(0, MAX_TOUR_CAMERAS);
}

function buildTour(disaster, loans, cameras, coords, radiusMiles, audioUrl) {
  const tourLoans = sortLoansForTour(loans);
  const tourCameras = sortCamerasForTour(cameras);
  const title = disaster?.title || disaster?.declarationTitle || 'Disaster impact tour';

  let playlist = `
      <gx:TourControl>
        <gx:playMode>once</gx:playMode>
      </gx:TourControl>`;

  if (coords.lat != null && coords.lng != null) {
    playlist += buildFlyTo(coords.lat, coords.lng, 80000, 3, 35);
    playlist += buildSoundCue(audioUrl, 50);
    const overviewRange = radiusMiles
      ? Math.max(radiusMiles * 1609 * 2.5, 25000)
      : 120000;
    playlist += buildFlyTo(coords.lat, coords.lng, overviewRange, 5, 55);
  } else {
    playlist += buildSoundCue(audioUrl, 30);
    playlist += `
      <gx:Wait><gx:duration>3</gx:duration></gx:Wait>`;
  }

  for (const loan of tourLoans) {
    const lat = parseFloat(loan.latitude);
    const lng = parseFloat(loan.longitude);
    playlist += buildFlyTo(lat, lng, 3500, 3, 60);
    playlist += `
      <gx:Wait><gx:duration>2</gx:duration></gx:Wait>`;
  }

  for (const cam of tourCameras) {
    const lat = parseFloat(cam.lat ?? cam.latitude);
    const lng = parseFloat(cam.lng ?? cam.longitude);
    playlist += buildFlyTo(lat, lng, 6000, 3, 55);
    playlist += `
      <gx:Wait><gx:duration>1.5</gx:duration></gx:Wait>`;
  }

  if (coords.lat != null && coords.lng != null) {
    const finalRange = radiusMiles
      ? Math.max(radiusMiles * 1609 * 4, 40000)
      : 150000;
    playlist += buildFlyTo(coords.lat, coords.lng, finalRange, 6, 40);
  }

  return `
    <gx:Tour id="disasterCinematicTour">
      <name>${escapeXml(title)} — cinematic tour</name>
      <description>Guided flyover of the selected disaster, affected loans, and hazard webcams.</description>
      <gx:Playlist>${playlist}
      </gx:Playlist>
    </gx:Tour>`;
}

/**
 * @param {object} options
 * @param {object} options.disaster
 * @param {Array} options.loans
 * @param {Array} options.cameras
 * @param {object} [options.meta]
 * @param {string} [options.baseUrl] - origin for audio stream URLs
 * @param {boolean} [options.includeAudio=true]
 */
export function generateCinematicDisasterKml(options = {}) {
  const {
    disaster = {},
    loans = [],
    cameras = [],
    meta = {},
    baseUrl = '',
    includeAudio = true,
  } = options;

  const coords = resolveDisasterCoords(disaster);
  const radiusMiles = meta.radiusMiles != null ? Number(meta.radiusMiles) : null;
  const title = disaster.title || disaster.declarationTitle || 'Disaster export';
  const docName = `${title} — loans &amp; webcams`;

  const geocodedLoans = (loans || []).filter(
    (l) => Number.isFinite(parseFloat(l.latitude)) && Number.isFinite(parseFloat(l.longitude))
  );
  const geocodedCameras = (cameras || []).filter(
    (c) => Number.isFinite(parseFloat(c.lat ?? c.latitude)) && Number.isFinite(parseFloat(c.lng ?? c.longitude))
  );

  let audioUrl = null;
  if (includeAudio && baseUrl) {
    const { relativePath } = resolveTrack(disaster);
    audioUrl = buildAudioStreamUrl(baseUrl, relativePath);
  }

  const loanPlacemarks = geocodedLoans
    .map((loan) => buildLoanPlacemark(loan, getLoanRiskStyleId(loan)))
    .join('');
  const cameraPlacemarks = geocodedCameras.map(buildCameraPlacemark).join('');

  const openTag = coords.lat != null
    ? buildLookAtXml(coords.lat, coords.lng, radiusMiles ? Math.max(radiusMiles * 1609 * 3, 50000) : 100000, 45)
    : '';

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="${GX_NS}">
  <Document>
    <name>${escapeXml(docName)}</name>
    <description>Cinematic Google Earth export: disaster, Encompass loans, and hazard webcams from DevConnect Labs unified disasters.</description>${openTag}
    ${buildStyleBlock()}
    <Folder>
      <name>Selected disaster</name>
      ${buildDisasterPlacemark(disaster, coords)}
      ${buildRadiusPlacemark(coords, radiusMiles)}
    </Folder>
    <Folder>
      <name>Affected Encompass loans (${geocodedLoans.length})</name>
      <description>Loans currently shown on the unified disasters page for this selection.</description>
      ${loanPlacemarks}
    </Folder>
    <Folder>
      <name>Nearby hazard webcams (${geocodedCameras.length})</name>
      <description>Fixed hazard webcam mounts near the selected disaster.</description>
      ${cameraPlacemarks}
    </Folder>
    ${buildMetadataFolder({
      ...meta,
      title,
      loanCount: geocodedLoans.length,
      cameraCount: geocodedCameras.length,
    })}
    ${buildTour(disaster, geocodedLoans, geocodedCameras, coords, radiusMiles, audioUrl)}
  </Document>
</kml>`;

  return kml;
}

export function buildExportFilename(disaster) {
  const raw = disaster?.title || disaster?.declarationTitle || 'disaster-export';
  const slug = String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'disaster-export';
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-${date}-cinematic.kml`;
}

export function canExportCinematicKml({ disaster }) {
  return Boolean(disaster);
}

export default {
  escapeXml,
  getLoanRiskStyleId,
  resolveDisasterCoords,
  buildRadiusRingCoords,
  buildAudioStreamUrl,
  generateCinematicDisasterKml,
  buildExportFilename,
  canExportCinematicKml,
};
