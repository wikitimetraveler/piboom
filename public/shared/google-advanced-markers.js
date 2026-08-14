/**
 * Google Maps AdvancedMarkerElement helpers (Unified Disasters + shared camera markers).
 * Falls back to legacy Marker when the marker library is unavailable.
 */
(function (global) {
  'use strict';

  /** Cloud Console map ID; DEMO_MAP_ID works for Advanced Markers without custom styling. */
  const DEFAULT_MAP_ID = 'DEMO_MAP_ID';

  function advancedMarkersAvailable() {
    return !!global.google?.maps?.marker?.AdvancedMarkerElement;
  }

  function readIconSize(icon, fallback) {
    const size = icon?.scaledSize;
    if (!size) return fallback;
    if (typeof size.width === 'number' && typeof size.height === 'number') {
      return { width: size.width, height: size.height };
    }
    return fallback;
  }

  function iconConfigToContent(icon) {
    const img = document.createElement('img');
    img.src = typeof icon === 'string' ? icon : (icon?.url || '');
    const { width, height } = readIconSize(icon, { width: 24, height: 24 });
    img.width = width;
    img.height = height;
    img.alt = '';
    img.draggable = false;
    img.style.display = 'block';
    return img;
  }

  /**
   * Generic teardrop pin (for origins / place maps without product photos).
   * @param {{ color?: string, label?: string, size?: number }} [opts]
   */
  function createPinContent(opts) {
    const color = opts?.color || '#c45c26';
    const label = String(opts?.label || '').slice(0, 2);
    const size = Number(opts?.size) || 36;
    const wrap = document.createElement('div');
    wrap.className = 'gam-pin';
    wrap.style.cssText = [
      'width:' + size + 'px',
      'height:' + size + 'px',
      'display:grid',
      'place-items:center',
      'transform:translateY(-4px)',
      'filter:drop-shadow(0 2px 3px rgba(15,23,42,0.35))',
    ].join(';');
    wrap.innerHTML =
      '<svg viewBox="0 0 24 36" width="' +
      size +
      '" height="' +
      Math.round(size * 1.5) +
      '" aria-hidden="true">' +
      '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="' +
      color +
      '"/>' +
      '<circle cx="12" cy="12" r="5.5" fill="#fff"/>' +
      (label
        ? '<text x="12" y="15.5" text-anchor="middle" font-size="7" font-weight="700" fill="' +
          color +
          '" font-family="system-ui,sans-serif">' +
          label.replace(/[<>&]/g, '') +
          '</text>'
        : '') +
      '</svg>';
    return wrap;
  }

  /**
   * @param {{ map: google.maps.Map, position: object, title?: string, icon?: object, content?: HTMLElement, zIndex?: number }} opts
   */
  function createMapMarker(opts) {
    const { map, position, title, icon, zIndex } = opts;
    const Adv = global.google?.maps?.marker?.AdvancedMarkerElement;
    const content = opts.content || (icon ? iconConfigToContent(icon) : undefined);
    if (Adv) {
      return new Adv({
        map,
        position,
        title,
        content,
        zIndex,
      });
    }
    return new global.google.maps.Marker({
      position,
      map,
      title,
      icon,
      zIndex,
    });
  }

  /** Ensure marker library is available after Maps JS has loaded. */
  async function ensureMarkerLibrary() {
    if (advancedMarkersAvailable()) return true;
    try {
      if (global.google?.maps?.importLibrary) {
        await global.google.maps.importLibrary('marker');
      }
    } catch (_) {}
    return advancedMarkersAvailable();
  }

  function removeMapMarker(marker) {
    if (!marker) return;
    if ('map' in marker) marker.map = null;
    else marker.setMap?.(null);
  }

  function getMapMarkerPosition(marker) {
    if (!marker) return null;
    const pos = marker.position;
    if (pos) {
      if (typeof pos.lat === 'function') return { lat: pos.lat(), lng: pos.lng() };
      return pos;
    }
    const legacy = marker.getPosition?.();
    if (!legacy) return null;
    if (typeof legacy.lat === 'function') return { lat: legacy.lat(), lng: legacy.lng() };
    return legacy;
  }

  function openMapInfoWindow(infoWindow, gmap, anchor) {
    if (!infoWindow || !gmap) return;
    if (advancedMarkersAvailable() && anchor && 'position' in anchor) {
      infoWindow.open({ map: gmap, anchor });
      return;
    }
    infoWindow.open(gmap, anchor);
  }

  /** Advanced markers use gmp-click; legacy Marker still uses click. */
  function onMapMarkerClick(marker, handler) {
    if (!marker || typeof handler !== 'function') return;
    if (advancedMarkersAvailable() && typeof marker.addEventListener === 'function') {
      marker.addEventListener('gmp-click', handler);
      return;
    }
    if (typeof marker.addListener === 'function') marker.addListener('click', handler);
    else marker.addEventListener?.('click', handler);
  }

  global.googleAdvancedMarkers = {
    DEFAULT_MAP_ID,
    MAP_LIBRARIES: 'places,marker',
    advancedMarkersAvailable,
    createPinContent,
    createMapMarker,
    ensureMarkerLibrary,
    removeMapMarker,
    getMapMarkerPosition,
    openMapInfoWindow,
    onMapMarkerClick,
  };
})(typeof window !== 'undefined' ? window : globalThis);
