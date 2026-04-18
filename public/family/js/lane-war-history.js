let map = null;
let geocoder = null;
let infoWindow = null;
const markerById = new Map();
const geocodeCache = new Map();
let activeWarSlug = 'king-philips-war';
let allCampaigns = [];
let activeParticipants = [];

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
        `<button class="btn btn-outline-light btn-sm campaign-btn ${c.slug === activeWarSlug ? 'active' : ''}" data-war="${esc(c.slug)}">${esc(c.label)} <span class="badge badge-secondary ml-1">${c.participantCount}</span></button>`
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
  map = new google.maps.Map(document.getElementById('warMap'), {
    center: { lat: 42.4, lng: -71.1 },
    zoom: 6,
    mapTypeControl: false,
    streetViewControl: false
  });
  geocoder = new google.maps.Geocoder();
  infoWindow = new google.maps.InfoWindow();
}

function markerIcon(confidence) {
  const color = confidence === 'high' ? '#2db56b' : confidence === 'medium' ? '#d4a856' : '#9aa6b5';
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: color,
    fillOpacity: 0.95,
    strokeColor: '#0d1016',
    strokeWeight: 1
  };
}

function clearMarkers() {
  markerById.forEach((marker) => marker.setMap(null));
  markerById.clear();
}

async function geocodePlace(place) {
  if (!place) return null;
  const key = place.toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  const result = await new Promise((resolve) => {
    geocoder.geocode({ address: place }, (results, status) => {
      if (status === 'OK' && results && results.length) {
        resolve(results[0].geometry.location);
      } else {
        resolve(null);
      }
    });
  });
  geocodeCache.set(key, result);
  return result;
}

async function renderMarkers() {
  clearMarkers();
  const bounds = new google.maps.LatLngBounds();
  let placed = 0;
  for (const entry of activeParticipants.slice(0, 45)) {
    const p = entry.person || {};
    const place = (entry.places && entry.places[0]) || p.born || '';
    const location = await geocodePlace(place);
    if (!location) continue;
    const marker = new google.maps.Marker({
      map,
      position: location,
      title: p.name || 'Soldier',
      icon: markerIcon(entry.confidence)
    });
    marker.addListener('click', () => {
      infoWindow.setContent(`
        <div style="min-width:220px">
          <strong>${esc(p.name || 'Unknown')}</strong><br/>
          <small>${esc(entry.warLabel || '')} • ${esc(entry.confidence)} confidence</small><br/>
          <small>${esc(place)}</small><br/>
          <button style="margin-top:6px" class="btn btn-sm btn-outline-secondary" onclick="window.__laneWarOpen('${esc(String(p.id))}')">Open profile</button>
        </div>
      `);
      infoWindow.open(map, marker);
    });
    markerById.set(String(p.id), marker);
    bounds.extend(location);
    placed += 1;
  }
  if (placed > 1) {
    map.fitBounds(bounds);
  }
}

function focusParticipant(personId) {
  const marker = markerById.get(String(personId));
  if (!marker) return;
  map.panTo(marker.getPosition());
  map.setZoom(Math.max(map.getZoom(), 8));
  google.maps.event.trigger(marker, 'click');
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
  const keyRes = await getJson('/api/genealogy/google-api-key');
  const campaignsRes = await getJson('/api/genealogy/wars');
  allCampaigns = campaignsRes.campaigns || [];
  if (!allCampaigns.length) throw new Error('No campaigns available');
  if (!allCampaigns.find((c) => c.slug === activeWarSlug)) {
    activeWarSlug = allCampaigns[0].slug;
  }

  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(keyRes.apiKey)}`;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(s);
  });

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
