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
   * @param {{ map: google.maps.Map, position: object, title?: string, icon?: object, zIndex?: number }} opts
   */
  function createMapMarker(opts) {
    const { map, position, title, icon, zIndex } = opts;
    const Adv = global.google?.maps?.marker?.AdvancedMarkerElement;
    if (Adv) {
      return new Adv({
        map,
        position,
        title,
        content: icon ? iconConfigToContent(icon) : undefined,
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

  global.googleAdvancedMarkers = {
    DEFAULT_MAP_ID,
    MAP_LIBRARIES: 'places,marker',
    advancedMarkersAvailable,
    createMapMarker,
    removeMapMarker,
    getMapMarkerPosition,
    openMapInfoWindow,
  };
})(typeof window !== 'undefined' ? window : globalThis);
