/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — Leaflet hazard-lens overlays (live /near ring + graph NEAR rays).
 * Density choropleth stays in geo-picker.js; this module adds selection overlays.
 */
(function (global) {
  'use strict';

  const MILES_TO_METERS = 1609.34;

  let map = null;
  let liveRingLayer = null;
  let graphNearLayer = null;
  let overlayControl = null;
  let liveRingVisible = true;
  let graphNearVisible = true;
  let lastLive = null;
  let lastRays = [];
  let lastSeededAt = null;

  function prefersReducedMotion() {
    return global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  }

  function hasFiniteCoords(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng);
  }

  function ensureMap(pickerMap) {
    if (!pickerMap || typeof L === 'undefined') return false;
    map = pickerMap;
    if (!liveRingLayer) {
      liveRingLayer = L.layerGroup();
    }
    if (!graphNearLayer) {
      graphNearLayer = L.layerGroup();
    }
    return true;
  }

  function syncLayerControl() {
    if (!map || overlayControl || !liveRingLayer || !graphNearLayer) return;
    // Density choropleth stays in geo-picker; register selection overlays only.
    overlayControl = L.control
      .layers(null, {
        'Live /near ring': liveRingLayer,
        'Graph NEAR (reseed)': graphNearLayer
      }, { collapsed: true, position: 'topright' })
      .addTo(map);

    map.on('overlayadd', (e) => {
      if (e.name === 'Live /near ring') liveRingVisible = true;
      if (e.name === 'Graph NEAR (reseed)') graphNearVisible = true;
      syncChipState();
    });
    map.on('overlayremove', (e) => {
      if (e.name === 'Live /near ring') liveRingVisible = false;
      if (e.name === 'Graph NEAR (reseed)') graphNearVisible = false;
      syncChipState();
    });
  }

  function syncChipState() {
    document.querySelectorAll('[data-du-overlay]').forEach((btn) => {
      const key = btn.getAttribute('data-du-overlay');
      const on =
        key === 'live' ? liveRingVisible : key === 'graphNear' ? graphNearVisible : true;
      btn.classList.toggle('du-overlay-chip--active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function setLayerOnMap(layer, visible) {
    if (!map || !layer) return;
    const has = map.hasLayer(layer);
    if (visible && !has) layer.addTo(map);
    if (!visible && has) map.removeLayer(layer);
  }

  function updateLiveAsOfChrome() {
    const el = document.getElementById('duOverlayGraphAsOf');
    if (!el) return;
    if (!lastSeededAt) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    const d = new Date(lastSeededAt);
    const label = Number.isNaN(d.getTime())
      ? String(lastSeededAt)
      : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    el.hidden = false;
    el.textContent = `NEAR as-of ${label}`;
  }

  function setLiveRing(lat, lng, radiusMiles) {
    lastLive =
      hasFiniteCoords(lat, lng) && Number.isFinite(radiusMiles) && radiusMiles > 0
        ? { lat, lng, radiusMiles }
        : null;

    if (!map || !liveRingLayer) return;
    liveRingLayer.clearLayers();
    if (!lastLive) {
      setLayerOnMap(liveRingLayer, false);
      return;
    }

    const circle = L.circle([lastLive.lat, lastLive.lng], {
      radius: lastLive.radiusMiles * MILES_TO_METERS,
      color: '#2563eb',
      weight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
      className: 'du-overlay-live-ring'
    });
    circle.bindTooltip(
      `Live /near · ${lastLive.radiusMiles} mi — operational truth (not graph NEAR)`,
      { sticky: true }
    );
    liveRingLayer.addLayer(circle);

    const center = L.circleMarker([lastLive.lat, lastLive.lng], {
      radius: 5,
      color: '#1d4ed8',
      weight: 2,
      fillColor: '#93c5fd',
      fillOpacity: 0.95
    });
    liveRingLayer.addLayer(center);

    setLayerOnMap(liveRingLayer, liveRingVisible);
    syncLayerControl();
    syncChipState();
  }

  function setGraphNearRays(nearLinks, options) {
    lastRays = Array.isArray(nearLinks) ? nearLinks : [];
    lastSeededAt = options?.seededAtMax || null;
    updateLiveAsOfChrome();

    if (!map || !graphNearLayer) return;
    graphNearLayer.clearLayers();
    const rays = lastRays.filter(
      (r) =>
        hasFiniteCoords(r?.from?.lat, r?.from?.lng) &&
        hasFiniteCoords(r?.to?.lat, r?.to?.lng)
    );

    rays.slice(0, 40).forEach((r) => {
      const conf = r.confidence === 0 ? 0 : Number.isFinite(r.confidence) ? r.confidence : 0.5;
      const weight = 1.2 + Math.max(0, Math.min(1, conf)) * 2;
      const line = L.polyline(
        [
          [r.from.lat, r.from.lng],
          [r.to.lat, r.to.lng]
        ],
        {
          color: '#d97706',
          weight,
          opacity: 0.78,
          dashArray: prefersReducedMotion() ? null : '6 5',
          className: 'du-overlay-graph-near'
        }
      );
      const miles =
        Number.isFinite(r.distanceMeters) ? (r.distanceMeters / MILES_TO_METERS).toFixed(1) : null;
      line.bindTooltip(
        [
          'Graph NEAR (reseed)',
          r.to?.label || 'loan',
          miles ? `${miles} mi at seed` : null,
          r.seededAt ? `seeded ${r.seededAt}` : null,
          `confidence ${conf}`
        ]
          .filter(Boolean)
          .join(' · '),
        { sticky: true }
      );
      graphNearLayer.addLayer(line);
    });

    setLayerOnMap(graphNearLayer, graphNearVisible && rays.length > 0);
    syncLayerControl();
    syncChipState();
  }

  function setLiveRingFromSelection(disasterObj, radiusMiles) {
    const lat = Number(
      disasterObj?.lat ?? disasterObj?.latitude ?? disasterObj?.avg_latitude
    );
    const lng = Number(
      disasterObj?.lng ?? disasterObj?.longitude ?? disasterObj?.avg_longitude
    );
    if (!hasFiniteCoords(lat, lng)) {
      setLiveRing(null, null, null);
      return;
    }
    const miles = Number(radiusMiles);
    setLiveRing(lat, lng, Number.isFinite(miles) && miles > 0 ? miles : 50);
  }

  function initChips() {
    document.querySelectorAll('[data-du-overlay]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-du-overlay');
        if (key === 'live') {
          liveRingVisible = !liveRingVisible;
          setLayerOnMap(liveRingLayer, liveRingVisible && !!lastLive);
        } else if (key === 'graphNear') {
          graphNearVisible = !graphNearVisible;
          setLayerOnMap(graphNearLayer, graphNearVisible && lastRays.length > 0);
        }
        syncChipState();
      });
    });
    syncChipState();
  }

  function bindPickerMap(pickerMap) {
    if (!ensureMap(pickerMap)) return;
    syncLayerControl();
    if (lastLive) setLiveRing(lastLive.lat, lastLive.lng, lastLive.radiusMiles);
    if (lastRays.length) setGraphNearRays(lastRays, { seededAtMax: lastSeededAt });
  }

  global.duGeoOverlays = {
    bindPickerMap,
    setLiveRing,
    setLiveRingFromSelection,
    setGraphNearRays,
    initChips
  };
})(typeof window !== 'undefined' ? window : globalThis);
