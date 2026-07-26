/**
 * Savy shop map + invention origins map — generic place pins
 * Development work by David Lane
 */
(function () {
  'use strict';

  const SHOP_PIN_COLOR = '#c45c26';
  const ORIGIN_PIN_COLOR = '#4a90a4';
  const LIST_THUMB_SIZE = 28;

  function absoluteUrl(path) {
    if (!path) return '';
    try {
      return new URL(path, window.location.origin).href;
    } catch (_) {
      return path;
    }
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
    const color = opts.color || ORIGIN_PIN_COLOR;
    const label = opts.label || '';

    if (gam?.createMapMarker) {
      return gam.createMapMarker({
        map: opts.map,
        position,
        title,
        content: gam.createPinContent({ color, label, size: opts.size || 32 }),
        zIndex: opts.zIndex,
      });
    }

    return new google.maps.Marker({
      position,
      map: opts.map,
      title,
      animation: opts.animation,
    });
  }

  function mapOptions(center, zoom, mapTypeId) {
    const gam = window.googleAdvancedMarkers;
    const opts = {
      center,
      zoom,
      mapTypeId: mapTypeId || google.maps.MapTypeId.ROADMAP,
      streetViewControl: false,
      fullscreenControl: true,
      mapTypeControl: true,
    };
    if (gam?.DEFAULT_MAP_ID) opts.mapId = gam.DEFAULT_MAP_ID;
    return opts;
  }

  async function initMap(shop) {
    const el = document.getElementById('gzShopMap');
    const status = document.getElementById('gzShopMapStatus');
    if (!el || !shop) return;

    const nameEl = document.getElementById('gzShopName');
    const addrEl = document.getElementById('gzShopAddress');
    const noteEl = document.getElementById('gzShopNote');
    const linkEl = document.getElementById('gzShopDirections');
    const signEl = document.getElementById('gzShopSign');

    if (nameEl) nameEl.textContent = shop.name || 'Savy Donuts & Smoothies';
    if (addrEl) {
      addrEl.textContent = [shop.address, shop.crossStreets].filter(Boolean).join(' · ');
    }
    if (noteEl) noteEl.textContent = shop.note || '';
    if (linkEl && shop.mapsUrl) {
      linkEl.href = shop.mapsUrl;
      linkEl.hidden = false;
    }
    const phoneEl = document.getElementById('gzShopPhone');
    const phoneLabel = document.getElementById('gzShopPhoneLabel');
    const phone = String(shop.phone || '').trim();
    if (phoneEl && phone) {
      const digits = phone.replace(/[^\d+]/g, '');
      phoneEl.href = `tel:${digits}`;
      if (phoneLabel) phoneLabel.textContent = phone;
      phoneEl.hidden = false;
    }
    if (signEl && shop.signImage) {
      signEl.src = shop.signImage;
      signEl.alt = `${shop.name || 'Savy'} sign`;
      signEl.hidden = false;
    }

    const lat = Number(shop.lat);
    const lng = Number(shop.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (status) {
        status.hidden = false;
        status.textContent = 'Map pin unavailable — use phone or Directions below.';
      }
      return;
    }

    const ok = await loadMaps();
    if (!ok || !window.google?.maps) {
      if (status) {
        status.hidden = false;
        status.textContent =
          window.__laneGoogleMapsUnavailableReason ||
          'Map couldn’t load here — tap Directions or call the shop.';
      }
      return;
    }

    if (status) status.hidden = true;
    const map = new google.maps.Map(
      el,
      mapOptions({ lat, lng }, 16, google.maps.MapTypeId.HYBRID)
    );

    const marker = placeGenericPin({
      position: { lat, lng },
      map,
      title: shop.name || 'Savy Donuts & Smoothies',
      color: SHOP_PIN_COLOR,
      label: 'S',
      size: 36,
      animation: google.maps.Animation?.DROP,
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:#1a100c;max-width:220px">
        <strong>${escapeHtml(shop.name || 'Savy')}</strong><br/>
        <span style="font-size:12px">${escapeHtml(shop.address || '')}</span>
      </div>`,
    });
    marker.addListener('click', () => {
      if (window.googleAdvancedMarkers?.openMapInfoWindow) {
        window.googleAdvancedMarkers.openMapInfoWindow(info, map, marker);
      } else {
        info.open({ map, anchor: marker });
      }
    });
  }

  async function initOriginsMap(donuts) {
    const el = document.getElementById('gzOriginsMap');
    const status = document.getElementById('gzOriginsMapStatus');
    const list = document.getElementById('gzOriginsList');
    if (!el) return;

    const pins = (Array.isArray(donuts) ? donuts : [])
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
        status.textContent = 'No invention pins loaded yet.';
      }
      return;
    }

    const ok = await loadMaps();
    if (!ok || !window.google?.maps) {
      if (list) {
        list.innerHTML = pins
          .map(
            (p) => `<li>
              <button type="button" class="gz-origin-link" data-id="${escapeHtml(p.id)}" disabled>
                <strong>${escapeHtml(p.name)}</strong>
                <span>${escapeHtml(p.origin.place || '')}${
              p.origin.year ? ` · ${escapeHtml(String(p.origin.year))}` : ''
            }</span>
              </button>
            </li>`
          )
          .join('');
      }
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
      info.setContent(`<div style="color:#1a100c;max-width:260px">
        <strong>${escapeHtml(pin.name)}</strong><br/>
        <span style="font-size:12px">${escapeHtml(pin.origin.place || '')}${
        pin.origin.year ? ` · ${escapeHtml(String(pin.origin.year))}` : ''
      }</span>
        <p style="font-size:12px;margin:6px 0 0">${escapeHtml(pin.origin.note || pin.history || '')}</p>
      </div>`);
      openInfo(marker);
      map.panTo(target);
      const current = Number(map.getZoom()) || 2;
      if (current < 12) map.setZoom(current + 1);
      list?.querySelectorAll('.gz-origin-link').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-id') === id);
      });
    }

    pins.forEach((p, index) => {
      const marker = placeGenericPin({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: `${p.name} — ${p.origin.place || ''}`,
        color: ORIGIN_PIN_COLOR,
        label: String(index + 1),
        size: 32,
        zIndex: 100 + index,
      });
      byId[p.id] = { marker, pin: p };
      marker.addListener('click', () => focusPin(p.id));
    });

    if (list) {
      list.innerHTML = pins
        .map((p, index) => {
          return `<li>
            <button type="button" class="gz-origin-link" data-id="${escapeHtml(p.id)}" aria-label="Show ${escapeHtml(p.name)} on map">
              <span class="gz-origin-pin-badge" aria-hidden="true">${index + 1}</span>
              <span class="gz-origin-copy">
                <strong>${escapeHtml(p.name)}</strong>
                <span>${escapeHtml(p.origin.place || '')}${
            p.origin.year ? ` · ${escapeHtml(String(p.origin.year))}` : ''
          }</span>
              </span>
            </button>
          </li>`;
        })
        .join('');

      list.onclick = (e) => {
        const btn = e.target.closest('.gz-origin-link');
        if (!btn || btn.disabled) return;
        e.preventDefault();
        focusPin(btn.getAttribute('data-id'));
      };
    }

    window.GlazedOriginsMap = {
      map,
      byId,
      focusPin,
    };

    const resetBtn = document.getElementById('gzOriginsMapReset');
    if (resetBtn) {
      resetBtn.hidden = false;
      resetBtn.onclick = () => {
        info.close();
        try {
          map.fitBounds(bounds, 56);
        } catch (_) {
          map.fitBounds(bounds);
        }
        list?.querySelectorAll('.gz-origin-link').forEach((btn) => {
          btn.classList.remove('is-active');
        });
      };
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.GlazedShopMap = { initMap, initOriginsMap };
})();
