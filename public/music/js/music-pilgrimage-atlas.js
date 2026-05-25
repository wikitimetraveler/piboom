/**
 * Live Music Pilgrimage Atlas — Grateful Dead v1 UI.
 */
(function () {
  const CLIENT_KEY = 'dc_music_pilgrimage_client_id';
  const API = '/api/music-pilgrimage';

  let map = null;
  let markers = [];
  let stops = [];
  let selectedStopId = null;
  let overview = null;

  function getClientId() {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function buildQueryParams() {
    const mode = document.getElementById('filterMode').value;
    const year = document.getElementById('filterYear').value;
    const city = document.getElementById('filterCity').value.trim();
    const state = document.getElementById('filterState').value.trim();
    const params = new URLSearchParams({ clientId: getClientId(), mode, limit: '250' });
    if (year) params.set('year', year);
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    if (mode === 'on_this_date') {
      const month = document.getElementById('filterMonth').value;
      const day = document.getElementById('filterDay').value;
      if (month) params.set('month', month);
      if (day) params.set('day', day);
    }
    const show = qs('show');
    if (show) params.set('showId', show);
    return params;
  }

  function syncUrl() {
    const params = buildQueryParams();
    params.delete('clientId');
    params.delete('limit');
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', next);
  }

  function applyQueryToForm() {
    const year = qs('year');
    const city = qs('city');
    const state = qs('state');
    const mode = qs('mode');
    const month = qs('month');
    const day = qs('day');
    if (mode) document.getElementById('filterMode').value = mode;
    if (year) document.getElementById('filterYear').value = year;
    if (city) document.getElementById('filterCity').value = city;
    if (state) document.getElementById('filterState').value = state;
    if (month) document.getElementById('filterMonth').value = month;
    if (day) document.getElementById('filterDay').value = day;
    toggleMonthDay();
  }

  function toggleMonthDay() {
    const onDate = document.getElementById('filterMode').value === 'on_this_date';
    document.getElementById('monthDayGroup').style.display = onDate ? '' : 'none';
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }

  function personalBadges(p) {
    if (!p) return '';
    const bits = [];
    if (p.visited) bits.push('<span class="badge bg-success badge-personal">visited</span>');
    if (p.wishlist) bits.push('<span class="badge bg-warning text-dark badge-personal">wishlist</span>');
    if (p.favorite) bits.push('<span class="badge bg-danger badge-personal">favorite</span>');
    return bits.join('');
  }

  async function loadOverview() {
    try {
      const res = await fetch(`${API}/atlas/overview`);
      const json = await res.json();
      if (!json.success) return;
      overview = json.data;
      renderOverviewStats();
      populateYearSelect();
    } catch (e) {
      console.warn('overview load failed', e);
    }
  }

  function renderOverviewStats() {
    if (!overview) return;
    const el = document.getElementById('overviewStats');
    el.innerHTML = `
      <span class="stat-pill"><i class="bi-calendar-event"></i> ${overview.totalShows.toLocaleString()} shows</span>
      <span class="stat-pill"><i class="bi-geo"></i> ${overview.mappedShows.toLocaleString()} mapped</span>
      <span class="stat-pill"><i class="bi-building"></i> ${overview.topVenues?.length || 0}+ landmark venues</span>
    `;
  }

  function populateYearSelect() {
    const sel = document.getElementById('filterYear');
    const current = sel.value;
    sel.innerHTML = '<option value="">All years</option>';
    const chips = document.getElementById('yearChips');
    chips.innerHTML = '';
    for (const row of overview?.showsByYear || []) {
      const opt = document.createElement('option');
      opt.value = row.year;
      opt.textContent = `${row.year} (${row.show_count})`;
      sel.appendChild(opt);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'btn btn-sm btn-outline-light year-chip';
      chip.textContent = row.year;
      chip.dataset.year = row.year;
      chip.addEventListener('click', () => {
        sel.value = row.year;
        document.querySelectorAll('.year-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        loadAtlas();
      });
      chips.appendChild(chip);
    }
    if (current) sel.value = current;
    document.querySelectorAll('.year-chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.year === sel.value);
    });
  }

  async function loadAtlas() {
    syncUrl();
    const params = buildQueryParams();
    document.getElementById('timelineList').innerHTML =
      '<div class="detail-empty"><span class="spinner-border spinner-border-sm"></span> Loading journey…</div>';

    try {
      const res = await fetch(`${API}/atlas?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Load failed');
      stops = data.stops || [];
      document.getElementById('stopCountLabel').textContent = `${data.stats.returned} / ${data.stats.total} stops`;
      renderTimeline(stops);
      await ensureMap();
      renderMapMarkers(stops, data.mapBounds);
      const showParam = qs('show');
      if (showParam) {
        selectStop(parseInt(showParam, 10), false);
      } else if (stops.length) {
        selectStop(stops[0].id, false);
      }
    } catch (e) {
      document.getElementById('timelineList').innerHTML =
        `<div class="detail-empty text-danger">${e.message}</div>`;
    }
  }

  function renderTimeline(list) {
    const container = document.getElementById('timelineList');
    if (!list.length) {
      container.innerHTML = '<div class="detail-empty">No stops match these filters.</div>';
      return;
    }
    container.innerHTML = list
      .map(
        (s) => `
      <div class="stop-card${selectedStopId === s.id ? ' active' : ''}" data-id="${s.id}" role="button" tabindex="0">
        <div class="stop-date">${formatDate(s.showDate)} · #${s.routeOrder || ''}</div>
        <div class="stop-venue">${escapeHtml(s.venueName)}</div>
        <div class="stop-location">${escapeHtml([s.city, s.state].filter(Boolean).join(', '))}</div>
        ${s.setlistPreview ? `<div class="stop-setlist">${escapeHtml(s.setlistPreview)}</div>` : ''}
        <div class="mt-1">${personalBadges(s.personal)}</div>
      </div>`
      )
      .join('');

    container.querySelectorAll('.stop-card').forEach((card) => {
      card.addEventListener('click', () => selectStop(parseInt(card.dataset.id, 10), true));
    });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function ensureMap() {
    if (map) return;
    const keyRes = await fetch('/api/music-research/google-api-key');
    const keyJson = await keyRes.json();
    if (!keyJson.apiKey) {
      document.getElementById('atlasMap').innerHTML =
        '<div class="detail-empty p-4">Google Maps API key not configured.</div>';
      return;
    }
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${keyJson.apiKey}`;
      script.onload = resolve;
      document.head.appendChild(script);
    });
    map = new google.maps.Map(document.getElementById('atlasMap'), {
      zoom: 4,
      center: { lat: 39, lng: -98 },
      mapTypeId: 'roadmap',
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
      ],
    });
  }

  function clearMarkers() {
    markers.forEach((m) => m.setMap(null));
    markers = [];
  }

  function renderMapMarkers(list, bounds) {
    if (!map) return;
    clearMarkers();
    const latLngBounds = new google.maps.LatLngBounds();
    let hasPoint = false;

    list.forEach((s, idx) => {
      if (s.lat == null || s.lng == null) return;
      hasPoint = true;
      const pos = { lat: s.lat, lng: s.lng };
      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: s.venueName,
        label: { text: String(idx + 1), color: '#fff', fontSize: '10px' },
      });
      marker.addListener('click', () => selectStop(s.id, true));
      markers.push(marker);
      latLngBounds.extend(pos);
    });

    if (hasPoint && list.length > 1) {
      map.fitBounds(latLngBounds, 48);
    } else if (hasPoint && list.length === 1) {
      map.setCenter({ lat: list[0].lat, lng: list[0].lng });
      map.setZoom(10);
    }
  }

  async function selectStop(id, scrollTimeline) {
    selectedStopId = id;
    renderTimeline(stops);
    if (scrollTimeline) {
      const card = document.querySelector(`.stop-card[data-id="${id}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const stop = stops.find((s) => s.id === id);
    if (stop?.lat != null && map) {
      map.panTo({ lat: stop.lat, lng: stop.lng });
      map.setZoom(Math.max(map.getZoom(), 8));
    }

    document.getElementById('detailPanel').innerHTML =
      '<div class="detail-empty"><span class="spinner-border spinner-border-sm"></span> Loading stop…</div>';

    try {
      const res = await fetch(`${API}/atlas/stops/${id}?clientId=${getClientId()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Not found');
      renderDetail(json.stop);
    } catch (e) {
      document.getElementById('detailPanel').innerHTML = `<div class="detail-empty text-danger">${e.message}</div>`;
    }
  }

  function renderDetail(stop) {
    const setlistHtml = Array.isArray(stop.setlist)
      ? stop.setlist
          .map((set, i) => {
            const songs = (set.song || []).map((s) => s.name).filter(Boolean);
            return songs.length
              ? `<div class="mb-2"><strong>Set ${i + 1}:</strong> ${escapeHtml(songs.join(' · '))}</div>`
              : '';
          })
          .join('')
      : '';

    document.getElementById('detailPanel').innerHTML = `
      <div class="row">
        <div class="col-lg-8">
          <h4 class="text-white mb-1">${escapeHtml(stop.venueName)}</h4>
          <p class="text-white-50 mb-2">${formatDate(stop.showDate)} · ${escapeHtml([stop.city, stop.state, stop.country].filter(Boolean).join(', '))}</p>
          ${personalBadges(stop.personal)}
          ${stop.setlistPreview ? `<p class="mt-2 small text-white-50">${escapeHtml(stop.setlistPreview)}</p>` : ''}
          ${setlistHtml ? `<div class="mt-3 small">${setlistHtml}</div>` : ''}
          ${stop.notes ? `<p class="mt-2 fst-italic text-white-50">${escapeHtml(stop.notes)}</p>` : ''}
        </div>
        <div class="col-lg-4">
          <div class="d-flex flex-wrap gap-2 mb-3">
            <button type="button" class="btn btn-sm btn-success" data-bookmark="visited" data-show="${stop.id}">
              <i class="bi-check-circle"></i> Visited
            </button>
            <button type="button" class="btn btn-sm btn-warning" data-bookmark="wishlist" data-show="${stop.id}">
              <i class="bi-star"></i> Wishlist
            </button>
            <button type="button" class="btn btn-sm btn-danger" data-bookmark="favorite" data-show="${stop.id}">
              <i class="bi-heart"></i> Favorite
            </button>
          </div>
          <a href="${stop.enrichments?.youtubeSearch || '#'}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-light w-100 mb-2">
            <i class="bi-youtube"></i> Find performances
          </a>
          <a href="${stop.enrichments?.timeMachineUrl || '#'}" class="btn btn-sm btn-outline-info w-100 mb-2">
            <i class="bi-clock-history"></i> Time Machine
          </a>
          ${
            stop.recordingAvailable
              ? '<span class="badge bg-info">Recording available</span>'
              : ''
          }
        </div>
      </div>
      ${
        stop.nearbyStops?.length
          ? `<div class="mt-3 pt-3 border-top border-secondary"><h6 class="text-white-50">Nearby in ${escapeHtml(stop.city)}</h6><ul class="small mb-0">${stop.nearbyStops
              .map(
                (n) =>
                  `<li><a href="#" class="link-light" data-nearby="${n.id}">${formatDate(n.showDate)} — ${escapeHtml(n.venueName)}</a></li>`
              )
              .join('')}</ul></div>`
          : ''
      }
    `;

    document.querySelectorAll('[data-bookmark]').forEach((btn) => {
      btn.addEventListener('click', () => saveBookmark(btn.dataset.bookmark, parseInt(btn.dataset.show, 10)));
    });
    document.querySelectorAll('[data-nearby]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        selectStop(parseInt(a.dataset.nearby, 10), true);
      });
    });
  }

  async function saveBookmark(type, showId) {
    try {
      const res = await fetch(`${API}/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: getClientId(), bookmarkType: type, showId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await loadAtlas();
      selectStop(showId, false);
    } catch (e) {
      alert(e.message);
    }
  }

  async function loadSavedRoutes() {
    try {
      const res = await fetch(`${API}/routes?clientId=${getClientId()}`);
      const json = await res.json();
      const sel = document.getElementById('savedRoutesSelect');
      sel.innerHTML = '<option value="">Saved routes…</option>';
      for (const route of json.routes || []) {
        const opt = document.createElement('option');
        opt.value = JSON.stringify(route.filterConfig || {});
        opt.textContent = route.label;
        sel.appendChild(opt);
      }
    } catch (_) {}
  }

  async function saveCurrentRoute() {
    const label = prompt('Name this route (e.g. "1977 West Coast run"):');
    if (!label) return;
    const filterConfig = Object.fromEntries(buildQueryParams());
    delete filterConfig.clientId;
    delete filterConfig.limit;
    try {
      const res = await fetch(`${API}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: getClientId(), label, filterConfig }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await loadSavedRoutes();
    } catch (e) {
      alert(e.message);
    }
  }

  function init() {
    applyQueryToForm();
    document.getElementById('filterMode').addEventListener('change', toggleMonthDay);
    document.getElementById('btnApplyFilters').addEventListener('click', loadAtlas);
    document.getElementById('btnSaveRoute').addEventListener('click', saveCurrentRoute);
    document.getElementById('savedRoutesSelect').addEventListener('change', (e) => {
      if (!e.target.value) return;
      try {
        const cfg = JSON.parse(e.target.value);
        if (cfg.mode) document.getElementById('filterMode').value = cfg.mode;
        if (cfg.year) document.getElementById('filterYear').value = cfg.year;
        if (cfg.city) document.getElementById('filterCity').value = cfg.city;
        if (cfg.state) document.getElementById('filterState').value = cfg.state;
        if (cfg.month) document.getElementById('filterMonth').value = cfg.month;
        if (cfg.day) document.getElementById('filterDay').value = cfg.day;
        toggleMonthDay();
        loadAtlas();
      } catch (_) {}
      e.target.value = '';
    });

    loadOverview().then(() => loadAtlas());
    loadSavedRoutes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
