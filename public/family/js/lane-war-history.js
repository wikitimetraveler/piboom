let map = null;
let mapReady = false;
const markerById = new Map();
const battleMarkerEntries = [];
let geocodeCache = new Map();
let activeWarSlug = 'king-philips-war';
let allCampaigns = [];
let activeParticipants = [];
/** @type {{ version?: number, battles?: Array, generatedNote?: string } | null} */
let battlesCatalog = null;

const API_BASE = '/api/genealogy';
const BATTLES_JSON = '/data/lane-war-battles.json';
const HISTORY_STATE_COPY = {
  loading: 'Loading history records...',
  empty: 'No Lane records available for this view.',
  unavailable: 'History records are unavailable right now.'
};

const CAMPAIGN_CONTEXT = {
  'colonial-frontier-militia': [
    {
      year: 1689,
      event:
        'Colonial northern frontier cycles include Indigenous diplomacy, provincial militia mobilizations, and county administration.'
    },
    {
      year: 1724,
      event:
        'Local correspondence shows frontier officers and inhabitants navigating livestock damage claims and militia conduct.'
    },
    {
      year: 1724,
      event:
        'Father Rale’s War / Dummer’s War era: Norridgewock and upper Kennebec operations appear in standard Maine–New Hampshire frontier histories (context only).'
    },
    {
      year: 1763,
      event:
        'Earlier provincial frontier militia service overlaps this broad administrative window; interpret dates carefully.'
    }
  ],
  'king-philips-war': [
    { year: 1675, event: "War begins after escalating conflict in New England." },
    {
      year: 1675,
      event:
        'Late 1675: Great Swamp Fight and Connecticut Valley raids typify escalation in many general histories (geography on map pins is context only).'
    },
    { year: 1676, event: 'Colonial militias and Native forces clash across frontier towns.' },
    { year: 1676, event: 'Women and families face displacement, supply burdens, captivity, and emergency care roles in frontier settlements.' },
    { year: 1678, event: 'Regional fighting declines; long-term demographic impacts remain.' }
  ],
  'revolutionary-war': [
    { year: 1775, event: 'Lexington and Concord open the war in Massachusetts.' },
    { year: 1776, event: 'Independence declared; militia and continental forces expand.' },
    {
      year: 1777,
      event:
        'Northern theater: Bennington (August) and the Saratoga campaign strain British northern supply in standard U.S. histories; French alliance follows Saratoga in textbook chronology.'
    },
    { year: 1778, event: 'Women sustain wartime economies, travel with camps in support roles, and preserve community records.' },
    { year: 1783, event: 'Treaty of Paris formally ends the war.' }
  ],
  'french-and-indian-war': [
    { year: 1754, event: 'Imperial rivalry expands into North American frontier campaigns.' },
    {
      year: 1755,
      event:
        'Lake George and Monongahela fighting illustrate British regulars and provincials learning frontier warfare at high cost (general histories).'
    },
    { year: 1755, event: 'Fort and supply routes shape local militia service and risks.' },
    { year: 1758, event: 'Families absorb labor and provisioning burdens during long mobilizations.' },
    {
      year: 1759,
      event:
        'Quebec campaign: Wolfe–Montcalm climax on the St. Lawrence often marks the strategic hinge year in Seven Years’ War North American narratives.'
    },
    { year: 1763, event: 'Treaty settlements reshape control and migration pressures.' }
  ],
  'war-of-1812': [
    { year: 1812, event: 'War declared between the United States and Britain.' },
    { year: 1813, event: 'Regional militia and regular units guard coasts and frontiers.' },
    {
      year: 1814,
      event:
        'Chesapeake campaigns (e.g. defense narratives around Baltimore) and Great Lakes fighting dominate many commemorative accounts.'
    },
    { year: 1814, event: 'Supply, transport, and communication networks become decisive.' },
    { year: 1815, event: 'Treaty of Ghent ends formal hostilities.' },
    {
      year: 1815,
      event:
        'New Orleans battle (January) occurs after the treaty in transatlantic mail time—common chronology teaching point in general U.S. histories.'
    }
  ],
  'mexican-american-war': [
    { year: 1846, event: 'War opens across Texas, northern Mexico, and Pacific routes.' },
    { year: 1847, event: 'Campaigns toward Mexico City draw volunteers and regular forces.' },
    { year: 1848, event: 'Treaty of Guadalupe Hidalgo redraws U.S. territorial boundaries.' }
  ],
  'civil-war': [
    { year: 1861, event: 'Secession crisis escalates to national civil war.' },
    { year: 1862, event: 'Large volunteer formations and rail logistics intensify campaigns.' },
    { year: 1863, event: 'Gettysburg and Vicksburg mark turning points in strategy.' },
    { year: 1865, event: 'Confederate collapse ends major combat operations.' }
  ],
  'spanish-american-war': [
    { year: 1898, event: 'Short conflict expands U.S. military operations overseas.' },
    { year: 1898, event: 'Naval and expeditionary campaigns dominate outcomes.' }
  ],
  'world-war-i': [
    { year: 1914, event: 'European war begins before later U.S. entry.' },
    { year: 1917, event: 'U.S. mobilization accelerates recruitment and logistics.' },
    { year: 1918, event: 'Armistice ends major fighting on the Western Front.' }
  ],
  'world-war-ii': [
    { year: 1939, event: 'Global war begins in Europe and expands worldwide.' },
    { year: 1941, event: 'U.S. entry creates full-scale mobilization across services.' },
    { year: 1944, event: 'Multi-theater offensives accelerate allied advances.' },
    { year: 1945, event: 'Axis surrender ends the war in Europe and the Pacific.' }
  ]
};

/** Default overview embed (general U.S. history context; replace with your preferred video ID). */
const WAR_OVERVIEW_VIDEO_EMBED =
  'https://www.youtube.com/embed/3EiWebRaeoM?rel=0';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip simple **bold** from catalog strings so we never inject HTML. */
function stripInlineMdBold(value) {
  return String(value ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*\*/g, '');
}

/**
 * @param {object} b battle row
 * @param {{ mapPopup?: boolean }} [opts]
 */
function battleLaneBookNoteHtml(b, opts = {}) {
  if (!b || !b.laneBookNote) return '';
  const text = stripInlineMdBold(b.laneBookNote).trim();
  if (!text) return '';
  const mod = opts.mapPopup ? ' battle-lane-book-note--mapPopup' : '';
  return `<div class="battle-lane-book-note small mt-1 mb-1${mod}"><strong>Lane book (verify separately):</strong> ${esc(text)}</div>`;
}

/**
 * @param {object} b battle row
 * @param {{ mapPopup?: boolean }} [opts]
 */
function battleExternalLinksHtml(b, opts = {}) {
  const raw = Array.isArray(b?.externalLinks) ? b.externalLinks : [];
  const safe = raw.filter(
    (x) =>
      x &&
      typeof x.label === 'string' &&
      typeof x.url === 'string' &&
      /^https:\/\//i.test(String(x.url).trim())
  );
  if (!safe.length) return '';
  const items = safe
    .map((l) => {
      const href = String(l.url).trim();
      const label = String(l.label).trim();
      return `<li><a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a></li>`;
    })
    .join('');
  const mod = opts.mapPopup ? ' battle-external-links--mapPopup' : '';
  return `<div class="battle-external-links small mt-1${mod}"><span class="battle-external-links__label text-muted">Further reading (general history):</span><ul class="battle-external-links__list mb-0 pl-3">${items}</ul></div>`;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.json();
}

async function loadBattlesCatalog() {
  try {
    battlesCatalog = await getJson(BATTLES_JSON);
  } catch (e) {
    console.warn('Lane war battles catalog unavailable:', e);
    battlesCatalog = { battles: [] };
  }
}

function battlesForActiveWar() {
  const list = Array.isArray(battlesCatalog?.battles) ? battlesCatalog.battles : [];
  return list.filter((b) => b && b.warSlug === activeWarSlug);
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

function associationLabel(entry) {
  return entry?.associationType === 'family-associated' ? 'Family-associated' : 'Service member';
}

function renderCampaignButtons() {
  const host = document.getElementById('campaignButtons');
  host.setAttribute('role', 'tablist');
  host.setAttribute('aria-label', 'War campaign tabs');
  host.innerHTML = allCampaigns
    .map(
      (c) =>
        `<button class="btn btn-outline-light btn-sm campaign-btn ${c.slug === activeWarSlug ? 'active' : ''}" role="tab" aria-selected="${c.slug === activeWarSlug ? 'true' : 'false'}" data-war="${esc(c.slug)}">${esc(c.label)} <span class="badge bg-secondary ms-1">${esc(c.participantCount)}</span></button>`
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
  const context = campaignContextFor(activeWarSlug);
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

function campaignContextFor(warSlug) {
  const listed = CAMPAIGN_CONTEXT[warSlug];
  if (Array.isArray(listed) && listed.length) return listed;
  const campaign = allCampaigns.find((c) => c.slug === warSlug);
  const years = Array.isArray(campaign?.years) ? campaign.years : [];
  const start = Number(years[0]);
  const end = Number(years[1]);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    return [
      { year: start, event: `${campaign?.label || 'Campaign'} begins in this record window.` },
      { year: Math.floor((start + end) / 2), event: 'Military movement, logistics, and local civilian support shape outcomes.' },
      { year: end, event: 'Campaign window closes; evidence confidence remains person-specific.' }
    ];
  }
  return [{ year: '—', event: 'Context timeline not yet curated for this campaign.' }];
}

function renderCampaignContextPanel() {
  const host = document.getElementById('warContextHost');
  if (!host) return;
  const campaign = allCampaigns.find((c) => c.slug === activeWarSlug);
  const contextItems = campaignContextFor(activeWarSlug);
  const itemsHtml = contextItems
    .map(
      (item) => `
      <li class="war-context-item mb-2">
        <span class="war-context-year">${esc(item.year)}</span>
        <span class="war-context-event">${esc(item.event)}</span>
      </li>
    `
    )
    .join('');

  host.innerHTML = `
    <div class="war-context-card">
      <h4 class="h6 mb-2">${esc(campaign?.label || 'Campaign context')}</h4>
      <p class="small text-muted mb-2">Campaign range: ${esc((campaign?.years || []).join(' - ') || 'Unknown')}</p>
      <ul class="list-unstyled mb-0">${itemsHtml}</ul>
      <p class="small text-muted mt-2 mb-0">Use each participant evidence panel for Lane-specific proof and confidence.</p>
    </div>
  `;
}

function renderParticipantsList() {
  const host = document.getElementById('participantList');
  if (!activeParticipants.length) {
    host.innerHTML = `<div class="text-muted">${HISTORY_STATE_COPY.empty}</div>`;
    return;
  }
  host.innerHTML = activeParticipants
    .map((entry) => {
      const p = entry.person || {};
      const place = (entry.places && entry.places[0]) || p.born || 'Location unresolved';
      const association = associationLabel(entry);
      const metaId = `participantMeta-${esc(String(p.id || 'unknown'))}`;
      return `
        <button type="button" class="participant-item participant-item-btn" data-person-id="${esc(p.id)}" aria-describedby="${metaId}">
          <div class="d-flex justify-content-between align-items-center">
            <strong>${esc(p.name || 'Unknown')}</strong>
            <span class="confidence-badge ${confidenceClass(entry.confidence)}">${esc(entry.confidence)}</span>
          </div>
          <div id="${metaId}" class="small text-muted">${esc(p.birthYear || '?')} - ${esc(p.deathYear || '?')}</div>
          <div class="small ${entry.associationType === 'family-associated' ? 'text-warning' : 'text-muted'}">${esc(association)}</div>
          <div class="small">${esc(place)}</div>
        </button>
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

function renderBattleSidebarList() {
  const host = document.getElementById('battleListHost');
  if (!host) return;
  const battles = battlesForActiveWar();
  const note = battlesCatalog?.generatedNote
    ? `<p class="small text-muted battle-catalog-note mb-2">${esc(battlesCatalog.generatedNote)}</p>`
    : '';
  if (!battles.length) {
    host.innerHTML = `${note}<div class="text-muted small">${HISTORY_STATE_COPY.empty}</div>`;
    return;
  }
  host.innerHTML = `${note}
    <ul class="battle-pin-list list-unstyled mb-0">
      ${battles
        .map(
          (b) => `
        <li class="battle-pin-item mb-2">
          <strong class="battle-pin-title">${esc(b.title)}</strong>
          <span class="text-muted small d-block">${esc(b.approxWhen || '')}</span>
          <span class="small d-block">${esc(b.summary || '')}</span>
          ${battleLaneBookNoteHtml(b)}
          ${battleExternalLinksHtml(b)}
        </li>`
        )
        .join('')}
    </ul>`;
}

function openSoldierModal(personId) {
  const entry = activeParticipants.find((x) => String(x.person?.id) === String(personId));
  if (!entry) return;
  const p = entry.person || {};
  const title = document.getElementById('soldierModalTitle');
  const body = document.getElementById('soldierModalBody');
  title.textContent = p.name || 'Participant profile';
  const relationNotes = (entry.associationNotes || [])
    .slice(0, 3)
    .map((n) => `<li>${esc(n)}</li>`)
    .join('');
  const associatedPeopleText = (entry.associatedPeople || []).join(' | ');
  body.innerHTML = `
    <div class="mb-2">
      <span class="confidence-badge ${confidenceClass(entry.confidence)}">${esc(entry.confidence)} confidence</span>
      <span class="ms-2 text-muted">${esc(entry.warLabel || '')}</span>
    </div>
    <p><strong>Classification:</strong> ${esc(associationLabel(entry))}</p>
    ${
      associatedPeopleText
        ? `<p><strong>Associated service person(s):</strong> ${esc(associatedPeopleText)}</p>`
        : ''
    }
    <p><strong>Years:</strong> ${esc(p.birthYear || '?')} - ${esc(p.deathYear || '?')}</p>
    <p><strong>Places:</strong> ${esc((entry.places || []).join(' | ') || 'Unresolved')}</p>
    <div class="evidence-box">
      <strong>Evidence snippets</strong>
      <ul class="mb-0 mt-2">
        ${(entry.evidence || []).slice(0, 8).map((e) => `<li>${esc(e)}</li>`).join('')}
      </ul>
    </div>
    ${
      relationNotes
        ? `<div class="evidence-box mt-2"><strong>Association notes</strong><ul class="mb-0 mt-2">${relationNotes}</ul></div>`
        : ''
    }
  `;
  const soldierModal = document.getElementById('soldierModal');
  if (soldierModal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(soldierModal).show();
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

function clearPersonMarkers() {
  markerById.forEach(({ marker, infoWindow }) => {
    marker.setMap(null);
    if (infoWindow) infoWindow.close();
  });
  markerById.clear();
}

function clearBattleMarkers() {
  battleMarkerEntries.forEach(({ marker, infoWindow }) => {
    marker.setMap(null);
    if (infoWindow) infoWindow.close();
  });
  battleMarkerEntries.length = 0;
}

function clearAllMarkers() {
  clearPersonMarkers();
  clearBattleMarkers();
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

function renderBattleMapMarkers() {
  if (!map || !mapReady) return;
  clearBattleMarkers();
  const battles = battlesForActiveWar();
  for (const b of battles) {
    if (b.lat == null || b.lng == null) continue;
    const position = { lat: Number(b.lat), lng: Number(b.lng) };
    const marker = new google.maps.Marker({
      position,
      map,
      title: b.title || 'Battle',
      icon: {
        path: google.maps.SymbolPath.STAR,
        scale: 10,
        fillColor: '#caa56c',
        fillOpacity: 0.95,
        strokeColor: '#1a1510',
        strokeWeight: 1.5
      }
    });
    const bell =
      Array.isArray(b.belligerents) && b.belligerents.length
        ? `<div class="small"><strong>Opposition / forces (general):</strong> ${esc(b.belligerents.join(' vs '))}</div>`
        : '';
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="min-width:240px;max-width:320px;color:#111">
          <strong>${esc(b.title || 'Engagement')}</strong><br/>
          <small class="text-muted">${esc(b.approxWhen || '')}</small>
          <p class="small mt-1 mb-1">${esc(b.summary || '')}</p>
          ${bell}
          ${battleLaneBookNoteHtml(b, { mapPopup: true })}
          ${battleExternalLinksHtml(b, { mapPopup: true })}
          <p class="small text-muted mb-0 mt-1"><em>Context only — not proof any Lane ancestor fought here.</em></p>
        </div>`
    });
    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });
    battleMarkerEntries.push({ marker, infoWindow });
  }
}

function hasAnyMappableParticipants() {
  return activeParticipants.some((entry) => {
    const p = entry.person || {};
    const place = (entry.places && entry.places[0]) || p.born || '';
    return Boolean(place && String(place).trim());
  });
}

function isWithinUsBounds(lngLat) {
  if (!Array.isArray(lngLat) || lngLat.length < 2) return false;
  const lng = Number(lngLat[0]);
  const lat = Number(lngLat[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;

  // Rough bounding boxes for U.S. plotting (contiguous + Alaska + Hawaii).
  const contiguousUs = lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66;
  const alaska = lat >= 51 && lat <= 72 && lng >= -170 && lng <= -129;
  const hawaii = lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154;

  return contiguousUs || alaska || hawaii;
}

async function renderPersonMarkers() {
  const coords = [];
  const slice = activeParticipants.slice(0, 45);
  for (const entry of slice) {
    const p = entry.person || {};
    const place = (entry.places && entry.places[0]) || p.born || '';
    const lngLat = await geocodePlace(place);
    if (!lngLat) continue;
    if (!isWithinUsBounds(lngLat)) continue;

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
          <button type="button" style="margin-top:6px" class="btn btn-sm btn-outline-secondary lane-war-popup-open" data-person-id="${esc(String(p.id))}">Open profile</button>
        </div>`
    });

    google.maps.event.addListener(infoWindow, 'domready', () => {
      const button = document.querySelector('.lane-war-popup-open[data-person-id="' + String(p.id) + '"]');
      if (!button) return;
      button.addEventListener(
        'click',
        () => {
          openSoldierModal(p.id);
        },
        { once: true }
      );
    });

    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });

    markerById.set(String(p.id), { marker, infoWindow });
    coords.push(lngLat);
  }
  return coords;
}

function fitMapBoundsFromCoords(coords) {
  if (!map || !coords.length) return;
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

async function renderAllMapLayers() {
  clearAllMarkers();
  renderBattleSidebarList();
  if (!map || !mapReady) return;

  // Avoid visual implication that Lane evidence ties directly to context battles.
  // Show battle/theater pins only when we do not have participant locations to map.
  const showContextBattlePins = !hasAnyMappableParticipants();
  if (showContextBattlePins) {
    renderBattleMapMarkers();
  }

  const personCoords = await renderPersonMarkers();
  const battleCoords = showContextBattlePins
    ? battlesForActiveWar()
        .filter((b) => b.lat != null && b.lng != null)
        .map((b) => [Number(b.lng), Number(b.lat)])
    : [];

  const merged = [...battleCoords, ...personCoords];
  fitMapBoundsFromCoords(merged);
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
  renderCampaignContextPanel();
  renderParticipantsList();
  await renderAllMapLayers();
}

function showWarMapFallback(message) {
  const el = document.getElementById('warMap');
  if (el) {
    el.innerHTML = `<div class="war-map-fallback p-3 small text-muted">${esc(message)}</div>`;
  }
  const warn = document.getElementById('warError');
  if (warn) warn.textContent = `${HISTORY_STATE_COPY.unavailable} ${message}`;
}

function applyWarVideoEmbed() {
  const iframe = document.getElementById('warOverviewVideo');
  if (iframe && WAR_OVERVIEW_VIDEO_EMBED) {
    iframe.src = WAR_OVERVIEW_VIDEO_EMBED;
  }
}

async function boot() {
  await loadBattlesCatalog();
  applyWarVideoEmbed();
  if (typeof window.initHistoryQuickNav === 'function') {
    window.initHistoryQuickNav({ selector: '.history-quick-link[href^="#"]' });
  }

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
    renderBattleSidebarList();
    await loadParticipants();
    return;
  }

  const mapOk = await loadFn();
  if (!mapOk) {
    showWarMapFallback(
      window.__laneGoogleMapsUnavailableReason ||
        'Google Maps could not load. Campaign list and profiles still work below.'
    );
    renderCampaignButtons();
    renderBattleSidebarList();
    await loadParticipants();
    return;
  }

  initMap();
  renderCampaignButtons();
  await loadParticipants();
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const warn = document.getElementById('warError');
    if (warn) warn.textContent = HISTORY_STATE_COPY.loading;
    await boot();
    if (warn && warn.textContent === HISTORY_STATE_COPY.loading) warn.textContent = '';
  } catch (error) {
    console.error(error);
    document.getElementById('warError').textContent = `${HISTORY_STATE_COPY.unavailable} ${error.message}. Verify GET /api/genealogy/wars and campaign endpoints.`;
  }
});
