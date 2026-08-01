/**
 * Shenango Valley atlas map — Google Maps pins (park / amish / food).
 * Development work by David Lane
 */
(function () {
  'use strict';

  const CATEGORY_COLOR = {
    park: '#2f5d46',
    amish: '#c48a3a',
    food: '#b5301f'
  };

  const DEFAULT_CENTER = { lat: 41.245889, lng: -80.477848 };

  const state = {
    sites: [],
    filter: 'all',
    map: null,
    info: null,
    markers: {},
    activeId: null,
    center: DEFAULT_CENTER
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

  function visibleSites() {
    if (state.filter === 'all') return state.sites;
    return state.sites.filter((site) => site.category === state.filter);
  }

  function renderList() {
    const list = document.getElementById('svSiteList');
    if (!list) return;
    list.innerHTML = visibleSites()
      .map(
        (site) => `<li>
          <button type="button" class="sv-site-btn${state.activeId === site.id ? ' is-active' : ''}" data-site-id="${esc(site.id)}">
            <span class="sv-site-emoji" aria-hidden="true">${esc(site.emoji || '📍')}</span>
            <span class="sv-site-copy">
              <strong>${esc(pick(site.name))}</strong>
              <span>${esc(pick(site.place))}</span>
            </span>
          </button>
        </li>`
      )
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

    if (gam?.createMapMarker) {
      const content = document.createElement('div');
      content.innerHTML = `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">${site.emoji || '📍'}</div>`;
      return gam.createMapMarker({ map: state.map, position, title, content });
    }

    return new google.maps.Marker({
      position,
      map: state.map,
      title,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: CATEGORY_COLOR[site.category] || '#2f5d46',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2
      }
    });
  }

  function openInfo(site) {
    const entry = state.markers[site.id];
    if (!entry || !state.info) return;
    state.info.setContent(`<div style="color:#1a2420;max-width:280px;font-family:system-ui,sans-serif">
      <strong style="font-size:16px;line-height:1.3">${esc(pick(site.name))}</strong><br/>
      <span style="font-size:13px;color:#3a4a52;font-weight:600">${esc(pick(site.place))}</span>
      <p style="font-size:13px;margin:8px 0 0;line-height:1.55">${esc(pick(site.blurb))}</p>
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

    if (state.filter !== 'all' && site.category !== state.filter) {
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
    resetView();
  }

  function resetView() {
    if (!state.map) return;
    state.info?.close();
    const shown = visibleSites();
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
      mapTypeId: google.maps.MapTypeId.TERRAIN,
      streetViewControl: false,
      fullscreenControl: true,
      mapTypeControl: true
    };
    if (gam?.DEFAULT_MAP_ID) mapOptions.mapId = gam.DEFAULT_MAP_ID;

    state.map = new google.maps.Map(el, mapOptions);
    state.info = new google.maps.InfoWindow();

    state.sites.forEach((site) => {
      const marker = makeMarker(site);
      state.markers[site.id] = { marker, site };
      marker.addListener('click', () => focusSite(site.id, { speak: false }));
    });

    resetView();

    const reset = document.getElementById('svMapReset');
    if (reset) {
      reset.hidden = false;
      reset.onclick = () => {
        state.activeId = null;
        renderList();
        resetView();
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

  window.ShenangoMap = {
    focusSite,
    resetView,
    getSites: () => state.sites
  };
})();
