/**
 * Savy shop map — Harbor / Kent corridor
 * Development work by David Lane
 */
(function () {
  'use strict';

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
    if (signEl && shop.signImage) {
      signEl.src = shop.signImage;
      signEl.alt = `${shop.name || 'Savy'} sign`;
      signEl.hidden = false;
    }

    const lat = Number(shop.lat);
    const lng = Number(shop.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (status) status.textContent = 'Map coordinates missing.';
      return;
    }

    const ok =
      typeof window.laneFamilyLoadGoogleMaps === 'function'
        ? await window.laneFamilyLoadGoogleMaps()
        : false;

    if (!ok || !window.google?.maps) {
      if (status) {
        status.textContent =
          window.__laneGoogleMapsUnavailableReason ||
          'Google Maps unavailable — use Directions instead.';
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

  window.GlazedShopMap = { initMap };
})();
