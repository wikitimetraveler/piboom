/**
 * Development work by David Lane
 */
/**
 * Couches map — one pin per person in the theater.
 * GPS is used when shared; otherwise the pin sits nearby until it arrives.
 * Uses the shared Google Maps loader + AdvancedMarkerElement helpers.
 */
(function (global) {
  'use strict';

  const PIN_COLORS = [
    '#ff3d4d',
    '#3d9eff',
    '#f5c14a',
    '#5ad18a',
    '#c07bff',
    '#ff8a3d',
    '#3de0d4',
    '#ff5ad5',
    '#9ad14a',
    '#6b8cff',
  ];
  const DEFAULT_COUCH = { lat: 41.233, lng: -80.493 };
  let map = null;
  let info = null;
  let markers = {};
  let lastGps = {};
  let lastViewers = [];
  let lastFrameKey = '';

  function setStatus(message) {
    const el = document.getElementById('wtMapStatus');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function parseCoords(lat, lng) {
    if (lat == null || lng == null || lat === '' || lng === '') return null;
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
    if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
    // Number(null) is 0 — drop the Gulf of Guinea so missing GPS cannot pull the camera to the world.
    if (Math.abs(la) < 1e-5 && Math.abs(ln) < 1e-5) return null;
    return { lat: la, lng: ln };
  }

  function viewerId(viewer, index) {
    return String(viewer?.id || viewer?.name || `couch-${index}`);
  }

  function framePins(points) {
    if (!map || !points.length || !global.google?.maps) return;
    const bounds = new global.google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const latSpan = Math.abs(ne.lat() - sw.lat());
    const lngSpan = Math.abs(ne.lng() - sw.lng());
    const clustered = points.length === 1 || (latSpan < 0.02 && lngSpan < 0.02);

    if (clustered) {
      map.setCenter(bounds.getCenter());
      map.setZoom(15);
      return;
    }

    map.fitBounds(bounds, { top: 56, right: 56, bottom: 56, left: 56 });
    global.google.maps.event.addListenerOnce(map, 'idle', () => {
      const z = map.getZoom();
      if (!Number.isFinite(z)) return;
      if (z < 6) {
        map.setCenter(bounds.getCenter());
        map.setZoom(15);
        return;
      }
      if (z > 16) map.setZoom(16);
    });
  }

  async function loadMaps() {
    if (global.google?.maps) {
      await global.googleAdvancedMarkers?.ensureMarkerLibrary?.();
      return true;
    }
    if (typeof global.laneFamilyLoadGoogleMaps === 'function') {
      const ok = await global.laneFamilyLoadGoogleMaps();
      if (ok) await global.googleAdvancedMarkers?.ensureMarkerLibrary?.();
      return ok;
    }
    return false;
  }

  function pinColor(id) {
    const text = String(id || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return PIN_COLORS[hash % PIN_COLORS.length];
  }

  function offsetAround(home, index) {
    const angle = (2 * Math.PI * index) / 10;
    const meters = 70 + index * 35;
    const dLat = (meters / 111320) * Math.cos(angle);
    const cosLat = Math.cos((home.lat * Math.PI) / 180) || 1;
    const dLng = (meters / (111320 * cosLat)) * Math.sin(angle);
    return { lat: home.lat + dLat, lng: home.lng + dLng };
  }

  function setMarkerPosition(marker, position) {
    if (!marker || !position) return;
    if ('position' in marker) marker.position = position;
    else marker.setPosition?.(position);
  }

  function removeMarker(id) {
    const gam = global.googleAdvancedMarkers;
    const marker = markers[id];
    if (!marker) return;
    if (gam?.removeMapMarker) gam.removeMapMarker(marker);
    else marker.map = null;
    delete markers[id];
  }

  function attachInfo(marker, title, approximate) {
    const gam = global.googleAdvancedMarkers;
    const openInfo = () => {
      if (!info) return;
      const note = approximate ? 'On this couch · nearby until GPS arrives' : 'On this couch';
      info.setContent(
        '<div style="color:#111;font:650 13px Inter,system-ui,sans-serif">' +
          String(title).replace(/[<>&]/g, '') +
          '</div><div style="color:#555;font:12px Inter,system-ui,sans-serif">' +
          note +
          '</div>'
      );
      if (gam?.openMapInfoWindow) gam.openMapInfoWindow(info, map, marker);
      else info.open(map, marker);
    };
    if (marker._wtInfoBound) return;
    marker._wtInfoBound = true;
    if (gam?.onMapMarkerClick) gam.onMapMarkerClick(marker, openInfo);
    else if (typeof marker.addEventListener === 'function') marker.addEventListener('gmp-click', openInfo);
    else if (marker.addListener) marker.addListener('click', openInfo);
    marker._wtOpenInfo = openInfo;
  }

  function createPersonMarker(viewer, position, approximate) {
    const gam = global.googleAdvancedMarkers;
    const title = viewer.name || 'Guest';
    const color = pinColor(viewer.id || title);
    let marker;
    if (gam?.createMapMarker) {
      const content = gam.createPinContent
        ? gam.createPinContent({ color, label: pinLabel(title), size: 34 })
        : undefined;
      marker = gam.createMapMarker({ map, position, title, content });
    } else {
      marker = new global.google.maps.Marker({ map, position, title });
    }
    attachInfo(marker, title, approximate);
    return marker;
  }

  function frameKey(points) {
    return points
      .map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`)
      .sort()
      .join('|');
  }

  function maybeFrame(points) {
    if (!points.length) return;
    const key = points.length + ':' + frameKey(points);
    if (key === lastFrameKey) return;
    lastFrameKey = key;
    framePins(points);
  }

  function pinLabel(name) {
    const text = String(name || 'G').trim();
    return (text.charAt(0) || 'G').toUpperCase();
  }

  function renderMarkers(viewers) {
    if (!map || !global.google?.maps) return;
    const list = Array.isArray(viewers) ? viewers : [];
    const gpsPoints = [];
    list.forEach((viewer, index) => {
      const coords = parseCoords(viewer.lat, viewer.lng);
      if (!coords) return;
      lastGps[viewerId(viewer, index)] = coords;
      gpsPoints.push(coords);
    });
    const home = gpsPoints[0] || DEFAULT_COUCH;
    const present = new Set();
    const framePoints = [];
    const placed = [];
    let missingGps = 0;
    let fallbackIndex = 0;

    function unstack(position) {
      const tooClose = (a, b) =>
        Math.abs(a.lat - b.lat) < 0.00018 && Math.abs(a.lng - b.lng) < 0.00018;
      let pos = position;
      let n = 0;
      while (placed.some((p) => tooClose(p, pos)) && n < 12) {
        pos = offsetAround(position, n + 1);
        n += 1;
      }
      placed.push(pos);
      return pos;
    }

    list.forEach((viewer, index) => {
      const id = viewerId(viewer, index);
      present.add(id);
      const gps = parseCoords(viewer.lat, viewer.lng) || lastGps[id] || null;
      const approximate = !gps;
      if (approximate) missingGps += 1;
      const position = unstack(gps || offsetAround(home, fallbackIndex++));
      framePoints.push(position);
      if (markers[id]) {
        setMarkerPosition(markers[id], position);
        return;
      }
      markers[id] = createPersonMarker({ ...viewer, id }, position, approximate);
    });

    Object.keys(markers).forEach((id) => {
      if (!present.has(id)) {
        removeMarker(id);
        delete lastGps[id];
      }
    });

    if (!list.length) {
      setStatus('Waiting for couches to join.');
      return;
    }
    if (missingGps) {
      setStatus(
        missingGps === list.length
          ? 'One pin per person. Sharing location will snap the pin to the real couch.'
          : 'One pin per person. Couches without GPS sit nearby until they share location.'
      );
    } else {
      setStatus('');
    }
    maybeFrame(framePoints);
  }

  async function init() {
    const host = document.getElementById('wtMap');
    if (!host) return false;
    const ok = await loadMaps();
    if (!ok || !global.google?.maps) {
      setStatus(
        global.__laneGoogleMapsUnavailableReason ||
          'Google Maps is not available. The theater still syncs.'
      );
      return false;
    }

    const mapId = global.googleAdvancedMarkers?.DEFAULT_MAP_ID || 'DEMO_MAP_ID';
    map = new global.google.maps.Map(host, {
      mapId,
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      minZoom: 3,
      maxZoom: 18,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      cameraControl: false,
    });
    info = new global.google.maps.InfoWindow();
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(() => {
        if (!map || !global.google?.maps?.event) return;
        global.google.maps.event.trigger(map, 'resize');
      }).observe(host);
    }
    if (lastViewers.length) renderMarkers(lastViewers);
    return true;
  }

  function updateViewers(viewers) {
    lastViewers = Array.isArray(viewers) ? viewers : [];
    if (map) renderMarkers(lastViewers);
  }

  global.WatchTogetherMap = {
    init,
    updateViewers,
  };
})(window);
