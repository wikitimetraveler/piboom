let map = null;
let mapReady = false;
const markerById = new Map();
const geocodeCache = new Map();
let activeWarSlug = 'king-philips-war';
let allCampaigns = [];
let activeParticipants = [];

const API_BASE = '/api/genealogy';

const CAMPAIGN_CONTEXT = {
  'king-philips-war': [
    { year: 1675, event: "War begins after escalating conflict in New England." },
    { year: 1676, event: 'Colonial militias and Native forces clash across frontier towns.' },
    { year: 1678, event: 'Regional fighting declines; long-term demographic impacts remain.' }
  ],
  'revolutionary-war': [
    { year: 1775, event: 'Lexington and Concord open the war in Massachusetts.' },
    { year: 1776, event: 'Independence declared; militia and continental forces expand.' },
    { year: 1783, event: 'Treaty of Paris formally ends the war.' }
  ]
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.json();
}

function confidenceColor(conf) {
  if (conf === 'high') return '#2db56b';
  if (conf === 'medium') return '#d4a856';
  return '#9aa6b5';
}

function confidenceClass(conf) {
  if (conf === 'high') return 'confidence-high';
  if (conf === 'medium') return 'confidence-medium';
  return 'confidence-low';
}

function renderCampaignButtons() {
  const host = document.getElementById('campaignButtons');
  host.innerHTML = allCampaigns
    .map(
      (c) =>
        `<button class="btn btn-outline-light btn-sm campaign-btn ${c.slug === activeWarSlug ? 'active' : ''}" data-war="${esc(c.slug)}">${esc(c.label)} <span class="badge badge-secondary ml-1">${esc(c.participantCount)}</span></button>`
    )
    .join('');
  host.querySelectorAll('.campaign-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      activeWarSlug = btn.dataset.war;
      await loadParticipants();
      renderCampaignButtons();
    });
  });
}

function renderTimeline() {
  const box = document.getElementById('timelineBox');
  const context = CAMPAIGN_CONTEXT[activeWarSlug] || [];
  box.innerHTML = context
    .map(
      (item) => `
      <div class="timeline-item">
        <div class="timeline-year">${esc(item.year)}</div>
        <div>${esc(item.event)}</div>
      </div>
    `
    )
    .join('');
}

function renderParticipantsList() {
  const host = document.getElementById('participantList');
  if (!activeParticipants.length) {
    host.innerHTML = '<div class="text-muted">No participants found for this campaign.</div>';
    return;
  }
  host.innerHTML = activeParticipants
    .map((entry) => {
      const p = entry.person || {};
      const place = (entry.places && entry.places[0]) || p.born || 'Location unresolved';
      return `
        <article class="participant-item" data-person-id="${esc(p.id)}">
          <div class="d-flex justify-content-between align-items-center">
            <strong>${esc(p.name || 'Unknown')}</strong>
            <span class="confidence-badge ${confidenceClass(entry.confidence)}">${esc(entry.confidence)}</span>
          </div>
          <div class="small text-muted">${esc(p.birthYear || '?')} - ${esc(p.deathYear || '?')}</div>
          <div class="small">${esc(place)}</div>
        </article>
      `;
    })
    .join('');

  host.querySelectorAll('.participant-item').forEach((item) => {
    item.addEventListener('click', () => {
      const personId = item.dataset.personId;
      focusParticipant(personId);
      openSoldierModal(personId);
    });
  });
}

function openSoldierModal(personId) {
  const entry = activeParticipants.find((x) => String(x.person?.id) === String(personId));
  if (!entry) return;
  const p = entry.person || {};
  const title = document.getElementById('soldierModalTitle');
  const body = document.getElementById('soldierModalBody');
  title.textContent = p.name || 'Soldier profile';
  body.innerHTML = `
    <div class="mb-2">
      <span class="confidence-badge ${confidenceClass(entry.confidence)}">${esc(entry.confidence)} confidence</span>
      <span class="ml-2 text-muted">${esc(entry.warLabel || '')}</span>
    </div>
    <p><strong>Years:</strong> ${esc(p.birthYear || '?')} - ${esc(p.deathYear || '?')}</p>
    <p><strong>Places:</strong> ${esc((entry.places || []).join(' | ') || 'Unresolved')}</p>
    <div class="evidence-box">
      <strong>Evidence snippets</strong>
      <ul class="mb-0 mt-2">
        ${(entry.evidence || []).slice(0, 8).map((e) => `<li>${esc(e)}</li>`).join('')}
      </ul>
    </div>
  `;
  if (window.jQuery && window.jQuery.fn.modal) {
    window.jQuery('#soldierModal').modal('show');
  }
}

function initMap() {
  const el = document.getElementById('warMap');
  if (!el || !window.google || !google.maps) return;
  map = new google.maps.Map(el, {
    center: { lat: 42.4, lng: -71.1 },
    zoom: 7,
    mapTypeId: google.maps.MapTypeId.HYBRID,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true
  });
  mapReady = true;
}

function clearMarkers() {
  markerById.forEach(({ marker, infoWindow }) => {
    marker.setMap(null);
    if (infoWindow) infoWindow.close();
  });
  markerById.clear();
}

async function geocodePlace(place) {
  if (!place) return null;
  const key = place.toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  try {
    const res = await fetch(`${API_BASE}/geocode-address?q=${encodeURIComponent(place)}`);
    const data = await res.json();
    if (data.success && data.longitude != null && data.latitude != null) {
      const lngLat = [data.longitude, data.latitude];
      geocodeCache.set(key, lngLat);
      return lngLat;
    }
  } catch (e) {
    /* ignore */
  }
  geocodeCache.set(key, null);
  return null;
}

async function renderMarkers() {
  clearMarkers();
  if (!map || !mapReady) return;

  const coords = [];
  const slice = activeParticipants.slice(0, 45);
  for (const entry of slice) {
    const p = entry.person || {};
    const place = (entry.places && entry.places[0]) || p.born || '';
    const lngLat = await geocodePlace(place);
    if (!lngLat) continue;

    const position = { lat: lngLat[1], lng: lngLat[0] };
    const marker = new google.maps.Marker({
      position,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: confidenceColor(entry.confidence),
        fillOpacity: 1,
        strokeColor: '#0d1016',
        strokeWeight: 1
      }
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="min-width:220px;color:#111">
          <strong>${esc(p.name || 'Unknown')}</strong><br/>
          <small>${esc(entry.warLabel || '')} • ${esc(entry.confidence)} confidence</small><br/>
          <small>${esc(place)}</small><br/>
          <button type="button" style="margin-top:6px" class="btn btn-sm btn-outline-secondary" onclick="window.__laneWarOpen('${String(p.id)}')">Open profile</button>
        </div>`
    });

    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });

    markerById.set(String(p.id), { marker, infoWindow });
    coords.push(lngLat);
  }

  if (coords.length > 1) {
    const bounds = new google.maps.LatLngBounds();
    for (const c of coords) {
      bounds.extend({ lat: c[1], lng: c[0] });
    }
    map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
    google.maps.event.addListenerOnce(map, 'idle', () => {
      if (map.getZoom() > 12) map.setZoom(12);
    });
  } else if (coords.length === 1) {
    map.panTo({ lat: coords[0][1], lng: coords[0][0] });
    map.setZoom(10);
  }
}

function focusParticipant(personId) {
  const entry = markerById.get(String(personId));
  if (!entry || !map) return;
  const { marker, infoWindow } = entry;
  map.panTo(marker.getPosition());
  map.setZoom(Math.max(map.getZoom(), 10));
  if (infoWindow) infoWindow.open(map, marker);
}

async function loadParticipants() {
  const data = await getJson(`/api/genealogy/wars/${activeWarSlug}/participants`);
  activeParticipants = data.participants || [];
  const campaign = allCampaigns.find((c) => c.slug === activeWarSlug);
  document.getElementById('campaignTitle').textContent = campaign ? campaign.label : 'War Campaign';
  document.getElementById('campaignCount').textContent = `${activeParticipants.length} participants`;
  renderTimeline();
  renderParticipantsList();
  await renderMarkers();
}

function showWarMapFallback(message) {
  const el = document.getElementById('warMap');
  if (el) {
    el.innerHTML = `<div class="war-map-fallback p-3 small text-muted">${esc(message)}</div>`;
  }
  const warn = document.getElementById('warError');
  if (warn) warn.textContent = message;
}

async function boot() {
  const campaignsRes = await getJson('/api/genealogy/wars');
  allCampaigns = campaignsRes.campaigns || [];
  if (!allCampaigns.length) throw new Error('No campaigns available');
  if (!allCampaigns.find((c) => c.slug === activeWarSlug)) {
    activeWarSlug = allCampaigns[0].slug;
  }

  const loadFn = typeof window.laneFamilyLoadGoogleMaps === 'function' ? window.laneFamilyLoadGoogleMaps : null;
  if (!loadFn) {
    showWarMapFallback('Google Maps loader missing. Include /family/js/lane-family-google-maps.js before this script.');
    renderCampaignButtons();
    await loadParticipants();
    window.__laneWarOpen = (personId) => openSoldierModal(personId);
    return;
  }

  const mapOk = await loadFn();
  if (!mapOk) {
    showWarMapFallback(
      window.__laneGoogleMapsUnavailableReason ||
        'Google Maps could not load. Campaign list and profiles still work below.'
    );
    renderCampaignButtons();
    await loadParticipants();
    window.__laneWarOpen = (personId) => openSoldierModal(personId);
    return;
  }

  initMap();
  renderCampaignButtons();
  await loadParticipants();
  window.__laneWarOpen = (personId) => openSoldierModal(personId);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await boot();
  } catch (error) {
    console.error(error);
    document.getElementById('warError').textContent = `War page failed to load: ${error.message}`;
  }
});
