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

function loadMapboxCssOnce() {
  if (document.getElementById('mapbox-gl-css')) return;
  const l = document.createElement('link');
  l.id = 'mapbox-gl-css';
  l.rel = 'stylesheet';
  l.href = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css';
  document.head.appendChild(l);
}

let mapboxScriptPromise = null;

async function ensureMapboxGl() {
  if (window.mapboxgl) return;
  loadMapboxCssOnce();
  if (!mapboxScriptPromise) {
    mapboxScriptPromise = fetch(`${API_BASE}/mapbox-access-token`)
      .then((res) => {
        if (!res.ok) throw new Error(`Mapbox token (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!data || !data.success || !data.accessToken) throw new Error('Mapbox token unavailable');
        const token = data.accessToken;
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js';
          script.async = true;
          script.onload = () => {
            window.mapboxgl.accessToken = token;
            resolve();
          };
          script.onerror = () => reject(new Error('Mapbox GL failed to load'));
          document.head.appendChild(script);
        });
      });
  }
  await mapboxScriptPromise;
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
  map = new mapboxgl.Map({
    container: 'warMap',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [-71.1, 42.4],
    zoom: 7
  });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));
  mapReady = true;
}

function clearMarkers() {
  markerById.forEach((marker) => marker.remove());
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

    const el = document.createElement('div');
    el.style.width = '14px';
    el.style.height = '14px';
    el.style.borderRadius = '50%';
    el.style.background = confidenceColor(entry.confidence);
    el.style.border = '1px solid #0d1016';
    el.style.cursor = 'pointer';

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat(lngLat)
      .setPopup(
        new mapboxgl.Popup({ offset: 12 }).setHTML(`
        <div style="min-width:220px;color:#111">
          <strong>${esc(p.name || 'Unknown')}</strong><br/>
          <small>${esc(entry.warLabel || '')} • ${esc(entry.confidence)} confidence</small><br/>
          <small>${esc(place)}</small><br/>
          <button type="button" style="margin-top:6px" class="btn btn-sm btn-outline-secondary" onclick="window.__laneWarOpen('${String(p.id)}')">Open profile</button>
        </div>`)
      )
      .addTo(map);

    markerById.set(String(p.id), marker);
    coords.push(lngLat);
  }

  if (coords.length > 1) {
    const bounds = new mapboxgl.LngLatBounds(coords[0], coords[0]);
    for (let i = 1; i < coords.length; i++) bounds.extend(coords[i]);
    map.fitBounds(bounds, { padding: 48, maxZoom: 12 });
  } else if (coords.length === 1) {
    map.flyTo({ center: coords[0], zoom: 10 });
  }
}

function focusParticipant(personId) {
  const marker = markerById.get(String(personId));
  if (!marker || !map) return;
  const lngLat = marker.getLngLat();
  map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 10) });
  marker.togglePopup();
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

async function boot() {
  const campaignsRes = await getJson('/api/genealogy/wars');
  allCampaigns = campaignsRes.campaigns || [];
  if (!allCampaigns.length) throw new Error('No campaigns available');
  if (!allCampaigns.find((c) => c.slug === activeWarSlug)) {
    activeWarSlug = allCampaigns[0].slug;
  }

  await ensureMapboxGl();
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
