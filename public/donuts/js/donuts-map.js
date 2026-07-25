/**
 * Savy shop map + invention origins map — donut markers
 * Development work by David Lane
 */
(function () {
  'use strict';

  const FALLBACK_DONUT_ICON = '/donuts/assets/products/classic-glazed-cutout.png';
  /** Map markers — doubled after the shrink pass (readable type icons) */
  const ORIGIN_MARKER_SIZE = 32;
  const SHOP_MARKER_SIZE = 36;
  const LIST_THUMB_SIZE = 28;

  function absoluteUrl(path) {
    const p = path || FALLBACK_DONUT_ICON;
    try {
      return new URL(p, window.location.origin).href;
    } catch (_) {
      return p;
    }
  }

  function productIconPath(item) {
    if (item?.image) return item.image;
    if (item?.id === 'classic-glazed') return FALLBACK_DONUT_ICON;
    return FALLBACK_DONUT_ICON;
  }

  function donutIcon(imagePath, size) {
    const s = size || ORIGIN_MARKER_SIZE;
    const g = window.google?.maps;
    if (!g?.Size || !g?.Point) return undefined;
    return {
      url: absoluteUrl(imagePath || FALLBACK_DONUT_ICON),
      scaledSize: new g.Size(s, s),
      anchor: new g.Point(Math.round(s / 2), Math.round(s / 2))
    };
  }

  async function loadMaps() {
    if (window.google?.maps) return true;
    if (typeof window.laneFamilyLoadGoogleMaps === 'function') {
      return window.laneFamilyLoadGoogleMaps();
    }
    return false;
  }

  function placeDonutMarker(opts) {
    const g = window.google.maps;
    const icon = donutIcon(opts.imagePath, opts.size || ORIGIN_MARKER_SIZE);
    try {
      return new g.Marker({
        position: opts.position,
        map: opts.map,
        title: opts.title || '',
        icon,
        animation: opts.animation,
        optimized: false
      });
    } catch (err) {
      console.warn('Donut marker icon failed — using default pin', err);
      return new g.Marker({
        position: opts.position,
        map: opts.map,
        title: opts.title || '',
        animation: opts.animation
      });
    }
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

    const marker = placeDonutMarker({
      position: { lat, lng },
      map,
      title: shop.name || 'Savy Donuts & Smoothies',
      imagePath: FALLBACK_DONUT_ICON,
      size: SHOP_MARKER_SIZE,
      animation: google.maps.Animation.DROP
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:#1a100c;max-width:220px">
        <strong>${escapeHtml(shop.name || 'Savy')}</strong><br/>
        <span style="font-size:12px">${escapeHtml(shop.address || '')}</span>
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
      // Still render clickable rows (list-only mode)
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

    const map = new google.maps.Map(el, {
      center: bounds.getCenter(),
      zoom: 2,
      mapTypeId: google.maps.MapTypeId.TERRAIN,
      streetViewControl: false,
      fullscreenControl: true
    });

    try {
      map.fitBounds(bounds, 56);
    } catch (_) {
      map.fitBounds(bounds);
    }

    const info = new google.maps.InfoWindow();
    const byId = {};

    function focusPin(id, { zoom = false } = {}) {
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
      info.open({ map, anchor: marker });
      map.panTo(target);
      // Zoom only when the map marker itself is clicked — not list rows
      if (zoom) {
        const detailZoom = 10;
        const current = Number(map.getZoom()) || 2;
        if (current < detailZoom) map.setZoom(detailZoom);
        else if (current < detailZoom + 2) map.setZoom(Math.min(14, current + 2));
      }
      list?.querySelectorAll('.gz-origin-link').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-id') === id);
      });
    }

    pins.forEach((p) => {
      const marker = placeDonutMarker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: `${p.name} — ${p.origin.place || ''}`,
        imagePath: productIconPath(p),
        size: ORIGIN_MARKER_SIZE
      });
      byId[p.id] = { marker, pin: p };
      marker.addListener('click', () => focusPin(p.id, { zoom: true }));
    });

    if (list) {
      list.innerHTML = pins
        .map((p) => {
          const thumb = productIconPath(p);
          return `<li>
            <button type="button" class="gz-origin-link" data-id="${escapeHtml(p.id)}" aria-label="Show ${escapeHtml(p.name)} on map">
              <img class="gz-origin-thumb" src="${escapeHtml(thumb)}" alt="" width="${LIST_THUMB_SIZE}" height="${LIST_THUMB_SIZE}"/>
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
        focusPin(btn.getAttribute('data-id'), { zoom: false });
      };
    }

    window.GlazedOriginsMap = {
      map,
      byId,
      focusPin
    };
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
