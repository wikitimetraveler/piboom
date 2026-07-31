/**
 * Cannabis Origins map — list + Google Maps landrace pins
 * Development work by David Lane
 */
(function (global) {
  'use strict';

  const DATA_URL = '/data/cannabis-origins.json';
  const PIN_COLOR = '#3d7a4a';
  let started = false;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadMaps() {
    if (window.google?.maps) {
      if (window.googleAdvancedMarkers?.ensureMarkerLibrary) {
        await window.googleAdvancedMarkers.ensureMarkerLibrary();
      }
      return true;
    }
    if (typeof window.laneFamilyLoadGoogleMaps === 'function') {
      const ok = await window.laneFamilyLoadGoogleMaps();
      if (ok && window.googleAdvancedMarkers?.ensureMarkerLibrary) {
        await window.googleAdvancedMarkers.ensureMarkerLibrary();
      }
      return ok;
    }
    return false;
  }

  function placeGenericPin(opts) {
    const gam = window.googleAdvancedMarkers;
    const position = opts.position;
    const title = opts.title || '';
    const color = opts.color || PIN_COLOR;
    const label = opts.label || '';

    if (gam?.createMapMarker) {
      const content = gam.createPinContent
        ? gam.createPinContent({ color, label, size: opts.size || 32 })
        : undefined;
      return gam.createMapMarker({
        map: opts.map,
        position,
        title,
        content,
        zIndex: opts.zIndex,
      });
    }

    return new google.maps.Marker({
      position,
      map: opts.map,
      title,
      label: label || undefined,
    });
  }

  function mapOptions(center, zoom, mapTypeId) {
    const gam = window.googleAdvancedMarkers;
    const opts = {
      center,
      zoom,
      mapTypeId: mapTypeId || google.maps.MapTypeId.TERRAIN,
      streetViewControl: false,
      fullscreenControl: true,
      mapTypeControl: true,
    };
    if (gam?.DEFAULT_MAP_ID) opts.mapId = gam.DEFAULT_MAP_ID;
    return opts;
  }

  function renderListFallback(list, pins) {
    if (!list) return;
    list.innerHTML = pins
      .map(
        (p, index) => `<li>
          <button type="button" class="co-origin-link" data-id="${escapeHtml(p.id)}" disabled>
            <span class="co-origin-pin-badge" aria-hidden="true">${index + 1}</span>
            <span class="co-origin-copy">
              <strong>${escapeHtml(p.name)}</strong>
              <span>${escapeHtml(p.origin.place || '')}</span>
              <span class="co-type-tag">${escapeHtml(p.type || '')}</span>
            </span>
          </button>
        </li>`
      )
      .join('');
  }

  async function initOriginsMap(entries) {
    const el = document.getElementById('cannabisOriginsMap');
    const status = document.getElementById('cannabisOriginsMapStatus');
    const list = document.getElementById('cannabisOriginsList');
    if (!el) return;

    const pins = (Array.isArray(entries) ? entries : [])
      .map((d) => {
        const o = d.origin || {};
        const lat = Number(o.lat);
        const lng = Number(o.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { ...d, origin: o, lat, lng };
      })
      .filter(Boolean);

    if (!pins.length) {
      if (list) list.innerHTML = '<li class="text-muted">Origin pins coming soon.</li>';
      if (status) {
        status.hidden = false;
        status.textContent = 'No origin pins loaded yet.';
      }
      return;
    }

    const ok = await loadMaps();
    if (!ok || !window.google?.maps) {
      renderListFallback(list, pins);
      if (status) {
        status.hidden = false;
        status.textContent =
          window.__laneGoogleMapsUnavailableReason ||
          'Origins map couldn’t load — place list is still here.';
      }
      return;
    }

    if (status) status.hidden = true;
    const bounds = new google.maps.LatLngBounds();
    pins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));

    const map = new google.maps.Map(
      el,
      mapOptions(bounds.getCenter(), 2, google.maps.MapTypeId.TERRAIN)
    );

    try {
      map.fitBounds(bounds, 56);
    } catch (_) {
      map.fitBounds(bounds);
    }

    const refreshMap = () => {
      try {
        google.maps.event.trigger(map, 'resize');
        map.fitBounds(bounds, 56);
      } catch (_) {
        try {
          map.fitBounds(bounds);
        } catch (__) {
          /* ignore */
        }
      }
    };
    window.requestAnimationFrame(() => {
      refreshMap();
      window.setTimeout(refreshMap, 150);
      window.setTimeout(refreshMap, 400);
    });

    const info = new google.maps.InfoWindow();
    const byId = {};

    function openInfo(marker) {
      if (window.googleAdvancedMarkers?.openMapInfoWindow) {
        window.googleAdvancedMarkers.openMapInfoWindow(info, map, marker);
      } else {
        info.open({ map, anchor: marker });
      }
    }

    function focusPin(id) {
      const entry = byId[id];
      if (!entry) return;
      const { marker, pin } = entry;
      const target = { lat: pin.lat, lng: pin.lng };
      info.setContent(`<div style="color:#1a100c;max-width:280px">
        <strong>${escapeHtml(pin.name)}</strong>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;margin:2px 0 4px;color:#3d7a4a">${escapeHtml(pin.type || '')}</div>
        <span style="font-size:12px">${escapeHtml(pin.origin.place || '')}</span>
        <p style="font-size:12px;margin:6px 0 0">${escapeHtml(pin.origin.note || '')}</p>
      </div>`);
      openInfo(marker);
      map.panTo(target);
      const current = Number(map.getZoom()) || 2;
      if (current < 5) map.setZoom(5);
      else if (current < 8) map.setZoom(current + 1);
      list?.querySelectorAll('.co-origin-link').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-id') === id);
      });
    }

    pins.forEach((p, index) => {
      const marker = placeGenericPin({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: `${p.name} — ${p.origin.place || ''}`,
        color: PIN_COLOR,
        label: String(index + 1),
        size: 30,
        zIndex: 100 + index,
      });
      byId[p.id] = { marker, pin: p };
      marker.addListener('click', () => focusPin(p.id));
    });

    if (list) {
      list.innerHTML = pins
        .map((p, index) => {
          return `<li>
            <button type="button" class="co-origin-link" data-id="${escapeHtml(p.id)}" aria-label="Show ${escapeHtml(p.name)} on map">
              <span class="co-origin-pin-badge" aria-hidden="true">${index + 1}</span>
              <span class="co-origin-copy">
                <strong>${escapeHtml(p.name)}</strong>
                <span>${escapeHtml(p.origin.place || '')}</span>
                <span class="co-type-tag">${escapeHtml(p.type || '')}</span>
              </span>
            </button>
          </li>`;
        })
        .join('');

      list.onclick = (e) => {
        const btn = e.target.closest('.co-origin-link');
        if (!btn || btn.disabled) return;
        e.preventDefault();
        focusPin(btn.getAttribute('data-id'));
      };
    }

    global.CannabisOriginsMapInstance = {
      map,
      byId,
      focusPin,
    };

    const resetBtn = document.getElementById('cannabisOriginsMapReset');
    if (resetBtn) {
      resetBtn.hidden = false;
      resetBtn.onclick = () => {
        info.close();
        try {
          map.fitBounds(bounds, 56);
        } catch (_) {
          map.fitBounds(bounds);
        }
        list?.querySelectorAll('.co-origin-link').forEach((btn) => {
          btn.classList.remove('is-active');
        });
      };
    }
  }

  async function init() {
    if (started) return;
    started = true;

    const status = document.getElementById('cannabisOriginsMapStatus');
    try {
      const res = await fetch(DATA_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load origins data');
      const data = await res.json();
      await initOriginsMap(data.entries || []);
    } catch (err) {
      console.error('cannabis-origins-map:', err);
      if (status) {
        status.hidden = false;
        status.textContent = 'Could not load origins data.';
      }
      started = false;
    }
  }

  global.CannabisOriginsMap = { init };
})(typeof window !== 'undefined' ? window : globalThis);
