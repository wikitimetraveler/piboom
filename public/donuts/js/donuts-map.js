/**
 * Savy shop map + invention origins map — donut markers
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DONUT_ICON_URL = '/donuts/assets/products/classic-glazed-cutout.png';

  function donutIcon(google, size) {
    const s = size || 44;
    return {
      url: DONUT_ICON_URL,
      scaledSize: new google.maps.Size(s, s),
      anchor: new google.maps.Point(s / 2, s / 2)
    };
  }

  async function loadMaps() {
    if (window.google?.maps) return true;
    if (typeof window.laneFamilyLoadGoogleMaps === 'function') {
      return window.laneFamilyLoadGoogleMaps();
    }
    return false;
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
    const map = new google.maps.Map(el, {
      center: { lat, lng },
      zoom: 16,
      mapTypeId: google.maps.MapTypeId.HYBRID,
      disableDefaultUI: false,
      streetViewControl: false,
      fullscreenControl: true
    });

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: shop.name || 'Savy Donuts & Smoothies',
      icon: donutIcon(google.maps, 52),
      animation: google.maps.Animation.DROP
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:#1a100c;max-width:220px">
        <strong>${shop.name || 'Savy'}</strong><br/>
        <span style="font-size:12px">${shop.address || ''}</span>
      </div>`
    });
    marker.addListener('click', () => info.open({ map, anchor: marker }));
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

    if (list) {
      list.innerHTML = pins.length
        ? pins
            .map(
              (p) => `<li>
                <button type="button" class="gz-origin-link" data-lat="${p.lat}" data-lng="${p.lng}" data-id="${p.id}">
                  <strong>${escapeHtml(p.name)}</strong>
                  <span>${escapeHtml(p.origin.place || '')}${p.origin.year ? ` · ${escapeHtml(String(p.origin.year))}` : ''}</span>
                </button>
              </li>`
            )
            .join('')
        : '<li class="text-muted">Origin pins coming soon.</li>';
    }

    if (!pins.length) {
      if (status) {
        status.hidden = false;
        status.textContent = 'No invention pins loaded yet.';
      }
      return;
    }

    const ok = await loadMaps();
    if (!ok || !window.google?.maps) {
      if (status) {
        status.hidden = false;
        status.textContent =
          window.__laneGoogleMapsUnavailableReason ||
          'Origins map couldn’t load — use the place list beside it.';
      }
      return;
    }

    if (status) status.hidden = true;
    const bounds = new google.maps.LatLngBounds();
    pins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));

    const map = new google.maps.Map(el, {
      center: bounds.getCenter(),
      zoom: 2,
      mapTypeId: google.maps.MapTypeId.TERRAIN,
      streetViewControl: false,
      fullscreenControl: true
    });
    map.fitBounds(bounds, 48);

    const info = new google.maps.InfoWindow();
    const byId = {};

    pins.forEach((p) => {
      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: `${p.name} — ${p.origin.place || ''}`,
        icon: donutIcon(google.maps, 40)
      });
      byId[p.id] = { marker, pin: p };
      marker.addListener('click', () => {
        info.setContent(`<div style="color:#1a100c;max-width:260px">
          <strong>${escapeHtml(p.name)}</strong><br/>
          <span style="font-size:12px">${escapeHtml(p.origin.place || '')}${
          p.origin.year ? ` · ${escapeHtml(String(p.origin.year))}` : ''
        }</span>
          <p style="font-size:12px;margin:6px 0 0">${escapeHtml(p.origin.note || p.history || '')}</p>
        </div>`);
        info.open({ map, anchor: marker });
        map.panTo(marker.getPosition());
      });
    });

    list?.addEventListener('click', (e) => {
      const btn = e.target.closest('.gz-origin-link');
      if (!btn) return;
      const entry = byId[btn.getAttribute('data-id')];
      if (!entry) return;
      google.maps.event.trigger(entry.marker, 'click');
    });

    window.GlazedOriginsMap = { map, byId };
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
