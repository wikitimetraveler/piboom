/**
 * Shenango Valley atlas map — Buhl Park hub with spokes to steel / amish / sports / music / food.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const CATEGORY_COLOR = {
    park: '#2f5d46',
    steel: '#5c6570',
    amish: '#c48a3a',
    sports: '#2a5f9e',
    music: '#8b3a62',
    food: '#b5301f',
    mob: '#3d2a4a'
  };

  const DEFAULT_CENTER = { lat: 41.245889, lng: -80.477848 };

  const state = {
    sites: [],
    filter: 'all',
    map: null,
    info: null,
    markers: {},
    spokes: [],
    activeId: null,
    center: DEFAULT_CENTER,
    hubId: 'buhl-park'
  };

  function pick(value) {
    return window.ShenangoContent?.pick(value) || String(value?.en || value || '');
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(message) {
    const el = document.getElementById('svMapStatus');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  async function loadMaps() {
    if (window.google?.maps) {
      await window.googleAdvancedMarkers?.ensureMarkerLibrary?.();
      return true;
    }
    if (typeof window.laneFamilyLoadGoogleMaps === 'function') {
      const ok = await window.laneFamilyLoadGoogleMaps();
      if (ok) await window.googleAdvancedMarkers?.ensureMarkerLibrary?.();
      return ok;
    }
    return false;
  }

  function hubSite() {
    return state.sites.find((s) => s.hub || s.id === state.hubId) || state.sites[0] || null;
  }

  function visibleSites() {
    if (state.filter === 'all') return state.sites;
    return state.sites.filter((site) => site.category === state.filter || site.hub);
  }

  function renderList() {
    const list = document.getElementById('svSiteList');
    if (!list) return;
    list.innerHTML = visibleSites()
      .map((site) => {
        const hub = site.hub || site.id === state.hubId;
        return `<li>
          <button type="button" class="sv-site-btn${state.activeId === site.id ? ' is-active' : ''}${hub ? ' is-hub' : ''}" data-site-id="${esc(site.id)}">
            <span class="sv-site-emoji" aria-hidden="true">${hub ? '◎' : esc(site.emoji || '📍')}</span>
            <span class="sv-site-copy">
              <strong>${esc(pick(site.name))}${hub ? ' · hub' : ''}</strong>
              <span>${esc(pick(site.place))}</span>
            </span>
          </button>
        </li>`;
      })
      .join('');
  }

  function renderFilters() {
    document.querySelectorAll('#svMapFilters .sv-chip').forEach((chip) => {
      const active = chip.getAttribute('data-filter') === state.filter;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function makeMarker(site) {
    const gam = window.googleAdvancedMarkers;
    const position = { lat: site.lat, lng: site.lng };
    const title = `${pick(site.name)} — ${pick(site.place)}`;
    const hub = site.hub || site.id === state.hubId;

    if (gam?.createMapMarker) {
      const content = document.createElement('div');
      content.className = hub ? 'sv-map-pin sv-map-pin--hub' : 'sv-map-pin';
      content.innerHTML = hub
        ? `<div style="width:36px;height:36px;border-radius:50%;background:#2f5d46;border:3px solid #f4f8f5;box-shadow:0 2px 8px rgba(0,0,0,.4);display:grid;place-items:center;font-size:16px;line-height:1">◎</div>`
        : `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">${site.emoji || '📍'}</div>`;
      return gam.createMapMarker({ map: state.map, position, title, content, zIndex: hub ? 1000 : 1 });
    }

    return new google.maps.Marker({
      position,
      map: state.map,
      title,
      zIndex: hub ? 1000 : 1,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: hub ? 12 : 8,
        fillColor: CATEGORY_COLOR[site.category] || '#2f5d46',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: hub ? 3 : 2
      }
    });
  }

  function clearSpokes() {
    state.spokes.forEach((line) => line.setMap?.(null));
    state.spokes = [];
  }

  function drawSpokes() {
    clearSpokes();
    if (!state.map || !window.google?.maps) return;
    const hub = hubSite();
    if (!hub) return;
    const shown = visibleSites().filter((s) => s.id !== hub.id);
    shown.forEach((site) => {
      const line = new google.maps.Polyline({
        path: [
          { lat: hub.lat, lng: hub.lng },
          { lat: site.lat, lng: site.lng }
        ],
        geodesic: true,
        strokeColor: CATEGORY_COLOR[site.category] || '#2f5d46',
        strokeOpacity: 0.45,
        strokeWeight: 2,
        map: state.map,
        zIndex: 0
      });
      state.spokes.push(line);
    });
  }

  function openInfo(site) {
    const entry = state.markers[site.id];
    if (!entry || !state.info) return;
    const img = site.image
      ? `<img src="${esc(site.image)}" alt="" style="width:100%;max-height:120px;object-fit:cover;border-radius:6px;margin:0 0 8px" loading="lazy"/>`
      : '';
    const link = site.website
      ? `<p style="margin:10px 0 0"><a href="${esc(site.website)}" target="_blank" rel="noopener noreferrer" style="color:#1e5c3a;font-weight:700;font-size:13px">Official site ↗</a></p>`
      : '';
    state.info.setContent(`<div style="color:#1a2420;max-width:280px;font-family:system-ui,sans-serif">
      ${img}
      <strong style="font-size:16px;line-height:1.3">${esc(pick(site.name))}</strong><br/>
      <span style="font-size:13px;color:#3a4a52;font-weight:600">${esc(pick(site.place))}</span>
      <p style="font-size:13px;margin:8px 0 0;line-height:1.55">${esc(pick(site.blurb))}</p>
      ${link}
    </div>`);
    if (window.googleAdvancedMarkers?.openMapInfoWindow) {
      window.googleAdvancedMarkers.openMapInfoWindow(state.info, state.map, entry.marker);
    } else {
      state.info.open({ map: state.map, anchor: entry.marker });
    }
  }

  function focusSite(siteId, options = {}) {
    const site = state.sites.find((s) => s.id === siteId);
    if (!site) return;

    if (state.filter !== 'all' && site.category !== state.filter && !site.hub) {
      state.filter = 'all';
      renderFilters();
      applyFilter();
    }

    state.activeId = siteId;
    renderList();

    if (options.speak !== false) {
      window.ShenangoContent?.speak?.(`${pick(site.name)}. ${pick(site.blurb)}`);
    }

    document.querySelector(`#svSiteList [data-site-id="${siteId}"]`)?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });

    if (!state.map) return;
    openInfo(site);
    state.map.panTo({ lat: site.lat, lng: site.lng });
    const zoom = Number(state.map.getZoom()) || 11;
    if (zoom < 12) state.map.setZoom(13);
    document.getElementById('svMapReset')?.removeAttribute('hidden');
  }

  function applyFilter() {
    renderList();
    if (!state.map) return;
    const shown = visibleSites().map((s) => s.id);
    Object.entries(state.markers).forEach(([id, entry]) => {
      const visible = shown.includes(id);
      if ('map' in entry.marker) entry.marker.map = visible ? state.map : null;
      else entry.marker.setMap?.(visible ? state.map : null);
    });
    drawSpokes();
    resetView();
  }

  function resetView() {
    if (!state.map) return;
    state.info?.close();
    const shown = visibleSites();
    const hub = hubSite();
    if (!shown.length) {
      state.map.setCenter(state.center);
      state.map.setZoom(11);
      return;
    }
    if (shown.length === 1) {
      state.map.setCenter({ lat: shown[0].lat, lng: shown[0].lng });
      state.map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    shown.forEach((site) => bounds.extend({ lat: site.lat, lng: site.lng }));
    if (hub) bounds.extend({ lat: hub.lat, lng: hub.lng });
    try {
      state.map.fitBounds(bounds, 60);
    } catch (_) {
      state.map.fitBounds(bounds);
    }
  }

  async function initMap() {
    const el = document.getElementById('svMapCanvas');
    if (!el || !state.sites.length) return;

    const ok = await loadMaps();
    if (!ok || !window.google?.maps) {
      setStatus(
        window.__laneGoogleMapsUnavailableReason ||
          'The map could not load here — the site list still works.'
      );
      return;
    }

    setStatus('');
    const gam = window.googleAdvancedMarkers;
    const mapOptions = {
      center: state.center,
      zoom: 11,
      mapTypeId: google.maps.MapTypeId.HYBRID,
      streetViewControl: false,
      fullscreenControl: true,
      mapTypeControl: true,
      mapTypeControlOptions: {
        mapTypeIds: [
          google.maps.MapTypeId.HYBRID,
          google.maps.MapTypeId.SATELLITE,
          google.maps.MapTypeId.ROADMAP,
          google.maps.MapTypeId.TERRAIN
        ]
      }
    };
    if (gam?.DEFAULT_MAP_ID) mapOptions.mapId = gam.DEFAULT_MAP_ID;

    state.map = new google.maps.Map(el, mapOptions);
    state.info = new google.maps.InfoWindow();

    state.sites.forEach((site) => {
      const marker = makeMarker(site);
      state.markers[site.id] = { marker, site };
      marker.addListener('click', () => focusSite(site.id, { speak: false }));
    });

    drawSpokes();
    resetView();

    const reset = document.getElementById('svMapReset');
    if (reset) {
      reset.hidden = false;
      reset.onclick = () => {
        state.activeId = null;
        state.filter = 'all';
        renderFilters();
        applyFilter();
        const hub = hubSite();
        if (hub) {
          state.map.setCenter({ lat: hub.lat, lng: hub.lng });
          state.map.setZoom(11);
          openInfo(hub);
        } else {
          resetView();
        }
      };
    }
  }

  function bind() {
    document.getElementById('svMapFilters')?.addEventListener('click', (event) => {
      const chip = event.target.closest('.sv-chip');
      if (!chip) return;
      state.filter = chip.getAttribute('data-filter') || 'all';
      renderFilters();
      applyFilter();
    });

    document.getElementById('svSiteList')?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-site-id]');
      if (!btn) return;
      focusSite(btn.getAttribute('data-site-id'));
    });
  }

  let bound = false;

  document.addEventListener('shenango:content-ready', (event) => {
    state.sites = event.detail?.sites || [];
    state.center = event.detail?.center || DEFAULT_CENTER;
    renderFilters();
    renderList();
    if (!bound) {
      bind();
      bound = true;
    }
    initMap();
  });

  function setFilter(filter) {
    state.filter = filter || 'all';
    renderFilters();
    applyFilter();
  }

  window.ShenangoMap = {
    focusSite,
    resetView,
    setFilter,
    getSites: () => state.sites
  };
})();
