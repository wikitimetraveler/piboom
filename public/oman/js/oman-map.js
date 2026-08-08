/**
 * Oman atlas map — Google Maps pins for historic, food, music, and living sites.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const CATEGORY_COLOR = {
    history: '#b5301f',
    food: '#d4a24c',
    music: '#6f7f52',
    living: '#3d6b7a'
  };

  const state = {
    sites: [],
    filter: 'all',
    map: null,
    info: null,
    bounds: null,
    markers: {},
    activeId: null
  };

  const i18n = () => window.OmanI18N;
  const pick = (value) => (i18n() ? i18n().pick(value) : String(value?.en || value || ''));
  const t = (key) => (i18n() ? i18n().t(key) : '');

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(message) {
    const el = document.getElementById('omMapStatus');
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

  /* ---------------------------------------------------------------- list */

  function renderList() {
    const list = document.getElementById('omSiteList');
    if (!list) return;
    list.innerHTML = visibleSites()
      .map(
        (site) => `<li>
          <button type="button" class="om-site-btn${state.activeId === site.id ? ' is-active' : ''}" data-site-id="${esc(site.id)}">
            <span class="om-site-emoji" aria-hidden="true">${esc(site.emoji || '📍')}</span>
            <span class="om-site-copy">
              <strong>${esc(pick(site.name))}</strong>
              <span>${esc(pick(site.place))}</span>
              ${site.unesco ? `<span class="om-site-unesco">${esc(t('unesco'))}</span>` : ''}
            </span>
          </button>
        </li>`
      )
      .join('');
  }

  function renderFilters() {
    document.querySelectorAll('#omMapFilters .om-chip').forEach((chip) => {
      const active = chip.getAttribute('data-filter') === state.filter;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  /* ----------------------------------------------------------------- map */

  function makeMarker(site) {
    const gam = window.googleAdvancedMarkers;
    const position = { lat: site.lat, lng: site.lng };
    const title = `${pick(site.name)} — ${pick(site.place)}`;

    if (gam?.createMapMarker) {
      const content = document.createElement('div');
      content.innerHTML =
        `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">${site.emoji || '📍'}</div>`;
      return gam.createMapMarker({ map: state.map, position, title, content });
    }

    return new google.maps.Marker({
      position,
      map: state.map,
      title,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: CATEGORY_COLOR[site.category] || '#b5301f',
        fillOpacity: 1,
        strokeColor: '#fffdf8',
        strokeWeight: 2
      }
    });
  }

  function openInfo(site) {
    const entry = state.markers[site.id];
    if (!entry || !state.info) return;
    state.info.setContent(`<div style="color:#1c1510;max-width:280px;font-family:system-ui,sans-serif">
      <strong style="font-size:16px;line-height:1.3">${esc(pick(site.name))}</strong><br/>
      <span style="font-size:13px;color:#4a3c2e;font-weight:600">${esc(pick(site.place))}</span>
      <p style="font-size:13px;margin:8px 0 0;line-height:1.55;color:#2a201a">${esc(pick(site.blurb))}</p>
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
      const line = `${pick(site.name)}. ${pick(site.blurb)}`;
      if (typeof window.OmanContent?.toggleGuideSpeech === 'function') {
        window.OmanContent.toggleGuideSpeech(`site:${siteId}`, () => i18n()?.speakAsGuide(line));
      } else {
        i18n()?.speakAsGuide(line);
      }
    }

    const activeBtn = document.querySelector(`#omSiteList [data-site-id="${siteId}"]`);
    activeBtn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    if (!state.map) return;
    openInfo(site);
    state.map.panTo({ lat: site.lat, lng: site.lng });
    const zoom = Number(state.map.getZoom()) || 6;
    if (zoom < 11) state.map.setZoom(11);
    document.getElementById('omMapReset')?.removeAttribute('hidden');
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
    const bounds = new google.maps.LatLngBounds();
    const shown = visibleSites();
    if (!shown.length) return;
    shown.forEach((site) => bounds.extend({ lat: site.lat, lng: site.lng }));
    try {
      state.map.fitBounds(bounds, 60);
    } catch (_) {
      state.map.fitBounds(bounds);
    }
  }

  async function initMap() {
    const el = document.getElementById('omMapCanvas');
    if (!el || !state.sites.length) return;

    const ok = await loadMaps();
    if (!ok || !window.google?.maps) {
      setStatus(
        window.__laneGoogleMapsUnavailableReason ||
          'The map could not load here — the site list below still works.'
      );
      return;
    }

    setStatus('');
    const gam = window.googleAdvancedMarkers;
    const mapOptions = {
      center: { lat: 21.5, lng: 57.0 },
      zoom: 6,
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
      marker.addListener('click', () => focusSite(site.id));
    });

    resetView();

    const reset = document.getElementById('omMapReset');
    if (reset) {
      reset.hidden = false;
      reset.onclick = () => {
        state.activeId = null;
        renderList();
        resetView();
      };
    }
  }

  /* -------------------------------------------------------------- binding */

  function bind() {
    document.getElementById('omMapFilters')?.addEventListener('click', (event) => {
      const chip = event.target.closest('.om-chip');
      if (!chip) return;
      state.filter = chip.getAttribute('data-filter') || 'all';
      renderFilters();
      applyFilter();
    });

    document.getElementById('omSiteList')?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-site-id]');
      if (!btn) return;
      i18n()?.unlockAudio();
      focusSite(btn.getAttribute('data-site-id'));
    });

    i18n()?.onChange(() => {
      renderList();
      setStatus(state.map ? '' : t('mapLoading'));
      if (state.activeId) {
        const site = state.sites.find((s) => s.id === state.activeId);
        if (site) openInfo(site);
      }
    });
  }

  function refreshMapSize() {
    if (!state.map || !window.google?.maps?.event) return;
    try {
      google.maps.event.trigger(state.map, 'resize');
      if (state.activeId) {
        const site = state.sites.find((s) => s.id === state.activeId);
        if (site) state.map.panTo({ lat: site.lat, lng: site.lng });
      } else {
        resetView();
      }
    } catch (_) {
      /* ignore */
    }
  }

  document.addEventListener('oman:content-ready', (event) => {
    state.sites = event.detail?.sites || [];
    renderFilters();
    renderList();
    bind();
    initMap();
  });

  document.addEventListener('hl:section-expanded', (event) => {
    if (event.detail?.id === 'omMap') {
      requestAnimationFrame(() => setTimeout(refreshMapSize, 80));
    }
  });

  window.OmanMap = {
    focusSite,
    resetView,
    getSites: () => state.sites,
    refreshMapSize
  };
})();
