/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — Leaflet hazard-lens overlays:
 * live /near ring, graph NEAR rays, live /near arcs, source markers,
 * FIRMS intensity heat, flood-zone halo.
 * Density choropleth modes stay in geo-picker.js.
 */
(function (global) {
  'use strict';

  const MILES_TO_METERS = 1609.34;

  const SOURCE_KEYS = ['fema', 'firms', 'usgs', 'nws', 'nhc'];
  const SOURCE_COLORS = {
    fema: '#7c3aed',
    firms: '#ea580c',
    usgs: '#0d9488',
    nws: '#0284c7',
    nhc: '#c026d3'
  };
  const SOURCE_LABELS = {
    fema: 'FEMA',
    firms: 'FIRMS',
    usgs: 'USGS',
    nws: 'NWS',
    nhc: 'NHC'
  };

  /** Visual flood halo miles by zone weight band — not NFHL polygons. */
  const FLOOD_HALO_MILES = {
    4: 1.25,
    3: 1.0,
    2: 0.75,
    1: 0.5,
    0.5: 0.35,
    0: 0.2
  };

  let map = null;
  let liveRingLayer = null;
  let graphNearLayer = null;
  let firmsHeatLayer = null;
  let floodHaloLayer = null;
  let sourceLayers = {};
  let overlayControl = null;

  let liveRingVisible = true;
  let graphNearVisible = true;
  let firmsHeatVisible = false;
  let floodHaloVisible = true;
  const sourceVisible = {
    fema: true,
    firms: true,
    usgs: true,
    nws: true,
    nhc: true
  };

  let lastLive = null;
  let lastRays = [];
  let lastSeededAt = null;
  let lastDisasterRows = [];
  let lastFloodLoan = null;
  let webgpuHeat = null;
  let pulseGlobe = null;

  function prefersReducedMotion() {
    return global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  }

  function hasFiniteCoords(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng);
  }

  function normalizeSource(raw) {
    const s = String(raw || '').toLowerCase().trim();
    if (s === 'nfhl' || s === 'flood' || s === 'floodzones') return null;
    if (s === 'alertcalifornia') return null;
    if (SOURCE_KEYS.includes(s)) return s;
    return null;
  }

  function parseFirmsIntensity(row) {
    const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {};
    const frpRaw = raw.frp ?? raw.FRP;
    const brightRaw = raw.brightness ?? raw.bright_ti4 ?? raw.bright_ti5;
    const frp = frpRaw != null && frpRaw !== '' ? Number(frpRaw) : NaN;
    const brightness = brightRaw != null && brightRaw !== '' ? Number(brightRaw) : NaN;
    const frpOk = Number.isFinite(frp) ? frp : 0;
    const brightOk = Number.isFinite(brightness) ? brightness : 0;
    // Blend FRP (MW) with brightness (K) into a 0–1-ish weight for marker size.
    const weight = Math.max(frpOk / 40, brightOk > 0 ? (brightOk - 280) / 80 : 0, 0.15);
    return {
      frp: Number.isFinite(frp) ? frp : null,
      brightness: Number.isFinite(brightness) ? brightness : null,
      weight: Math.min(3, Math.max(0.15, weight))
    };
  }

  function floodHaloMilesForLoan(loan) {
    const z = String(loan?.flood_zone || '').toUpperCase().trim();
    const type = loan?.flood_zone_type;
    let weight = 0;
    if (z === 'VE' || z === 'V' || z === 'AO' || z === 'AE') weight = 4;
    else if (z === 'AH' || z === 'A99') weight = 3;
    else if (z === 'A' || z.startsWith('A')) weight = z.startsWith('A99') ? 3 : 2;
    else if (z === 'D') weight = 0.5;
    else if (z === 'X' && type && String(type).toLowerCase().includes('shaded')) weight = 1;
    else if (z.startsWith('VE') || z.startsWith('AE') || z.startsWith('AO')) weight = 4;
    else if (z.startsWith('AH')) weight = 3;
    else if (z.startsWith('V')) weight = 4;
    const keys = Object.keys(FLOOD_HALO_MILES).map(Number).sort((a, b) => b - a);
    for (const k of keys) {
      if (weight >= k) return FLOOD_HALO_MILES[k];
    }
    return FLOOD_HALO_MILES[0];
  }

  function ensureLayers() {
    if (!liveRingLayer) liveRingLayer = L.layerGroup();
    if (!graphNearLayer) graphNearLayer = L.layerGroup();
    if (!firmsHeatLayer) firmsHeatLayer = L.layerGroup();
    if (!floodHaloLayer) floodHaloLayer = L.layerGroup();
    SOURCE_KEYS.forEach((key) => {
      if (!sourceLayers[key]) sourceLayers[key] = L.layerGroup();
    });
  }

  function ensureMap(pickerMap) {
    if (!pickerMap || typeof L === 'undefined') return false;
    map = pickerMap;
    ensureLayers();
    return true;
  }

  function overlayEntries() {
    const entries = {
      'Live /near ring': liveRingLayer,
      'Graph NEAR (reseed)': graphNearLayer,
      'FIRMS intensity': firmsHeatLayer,
      'Flood zone halo': floodHaloLayer
    };
    SOURCE_KEYS.forEach((key) => {
      entries[`${SOURCE_LABELS[key]} markers`] = sourceLayers[key];
    });
    return entries;
  }

  function syncLayerControl() {
    if (!map || !liveRingLayer) return;
    if (overlayControl) {
      map.removeControl(overlayControl);
      overlayControl = null;
    }
    overlayControl = L.control.layers(null, overlayEntries(), {
      collapsed: true,
      position: 'topright'
    }).addTo(map);

    map.off('overlayadd', onOverlayAdd);
    map.off('overlayremove', onOverlayRemove);
    map.on('overlayadd', onOverlayAdd);
    map.on('overlayremove', onOverlayRemove);
  }

  function onOverlayAdd(e) {
    applyVisibilityFromControlName(e.name, true);
    syncChipState();
  }

  function onOverlayRemove(e) {
    applyVisibilityFromControlName(e.name, false);
    syncChipState();
  }

  function applyVisibilityFromControlName(name, on) {
    if (name === 'Live /near ring') liveRingVisible = on;
    else if (name === 'Graph NEAR (reseed)') graphNearVisible = on;
    else if (name === 'FIRMS intensity') firmsHeatVisible = on;
    else if (name === 'Flood zone halo') floodHaloVisible = on;
    else {
      SOURCE_KEYS.forEach((key) => {
        if (name === `${SOURCE_LABELS[key]} markers`) sourceVisible[key] = on;
      });
    }
  }

  function syncChipState() {
    document.querySelectorAll('[data-du-overlay]').forEach((btn) => {
      const key = btn.getAttribute('data-du-overlay');
      let on = true;
      if (key === 'live') on = liveRingVisible;
      else if (key === 'graphNear') on = graphNearVisible;
      else if (key === 'firmsHeat') on = firmsHeatVisible;
      else if (key === 'floodHalo') on = floodHaloVisible;
      else if (SOURCE_KEYS.includes(key)) on = sourceVisible[key];
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
    webgpuHeat?.setGraphNearRays?.(rays, { seededAtMax: lastSeededAt });
    webgpuHeat?.setArcsVisible?.(graphNearVisible);
  }

  function setDisasterRows(rows) {
    lastDisasterRows = Array.isArray(rows) ? rows : [];
    paintSourceMarkers();
    paintFirmsHeat();
    webgpuHeat?.setFirmsRows?.(lastDisasterRows);
    syncPulseGlobeFromRows();
  }

  function syncPulseGlobeFromRows() {
    if (!pulseGlobe) return;
    const events = [];
    lastDisasterRows.slice(0, 80).forEach((r) => {
      const lat = Number(r.lat ?? r.latitude ?? r.avg_latitude);
      const lng = Number(r.lng ?? r.longitude ?? r.avg_longitude);
      if (!hasFiniteCoords(lat, lng)) return;
      const key = normalizeSource(r.source);
      const colors = {
        firms: 'rgba(234,88,12,0.9)',
        usgs: 'rgba(13,148,136,0.9)',
        nws: 'rgba(2,132,199,0.9)',
        nhc: 'rgba(192,38,211,0.9)',
        fema: 'rgba(124,58,237,0.9)',
      };
      let strength = 0.45;
      if (key === 'firms') strength = Math.min(1, parseFirmsIntensity(r).weight / 2);
      else if (key === 'usgs') {
        const mag = Number(r.raw?.mag ?? r.severity ?? r.raw?.magnitude);
        strength = Number.isFinite(mag) ? Math.min(1, mag / 7) : 0.5;
      }
      events.push({ lat, lng, strength, color: colors[key] || 'rgba(255,200,80,0.85)' });
    });
    pulseGlobe.setEvents(events);
  }

  function paintSourceMarkers() {
    if (!map) return;
    ensureLayers();
    SOURCE_KEYS.forEach((key) => sourceLayers[key]?.clearLayers());

    const caps = { fema: 80, firms: 120, usgs: 80, nws: 80, nhc: 40 };
    const counts = { fema: 0, firms: 0, usgs: 0, nws: 0, nhc: 0 };

    lastDisasterRows.forEach((r) => {
      const key = normalizeSource(r.source);
      if (!key || counts[key] >= caps[key]) return;
      const lat = Number(r.lat ?? r.latitude ?? r.avg_latitude);
      const lng = Number(r.lng ?? r.longitude ?? r.avg_longitude);
      if (!hasFiniteCoords(lat, lng)) return;
      counts[key] += 1;
      const marker = L.circleMarker([lat, lng], {
        radius: key === 'firms' ? 4 : 5,
        color: SOURCE_COLORS[key],
        weight: 1.5,
        fillColor: SOURCE_COLORS[key],
        fillOpacity: 0.75,
        className: `du-overlay-source du-overlay-source--${key}`
      });
      marker.bindTooltip(
        `${SOURCE_LABELS[key]} · ${r.title || r.event_type || 'event'}${r.county_name ? ` · ${r.county_name}` : ''}`,
        { sticky: true }
      );
      sourceLayers[key].addLayer(marker);
    });

    SOURCE_KEYS.forEach((key) => {
      setLayerOnMap(sourceLayers[key], sourceVisible[key] && counts[key] > 0);
    });
    syncLayerControl();
    syncChipState();
  }

  function paintFirmsHeat() {
    if (!map || !firmsHeatLayer) return;
    firmsHeatLayer.clearLayers();

    const firms = lastDisasterRows.filter((r) => normalizeSource(r.source) === 'firms');
    firms.slice(0, 200).forEach((r) => {
      const lat = Number(r.lat ?? r.latitude ?? r.avg_latitude);
      const lng = Number(r.lng ?? r.longitude ?? r.avg_longitude);
      if (!hasFiniteCoords(lat, lng)) return;
      const { frp, brightness, weight } = parseFirmsIntensity(r);
      const radiusPx = 6 + weight * 10;
      const marker = L.circleMarker([lat, lng], {
        radius: radiusPx,
        color: '#9a3412',
        weight: 1,
        fillColor: weight > 1.2 ? '#dc2626' : weight > 0.6 ? '#ea580c' : '#fbbf24',
        fillOpacity: 0.35 + Math.min(0.45, weight * 0.2),
        className: 'du-overlay-firms-heat'
      });
      marker.bindTooltip(
        [
          'FIRMS intensity',
          frp != null ? `FRP ${frp} MW` : null,
          brightness != null ? `${brightness} K` : null,
          r.title || null
        ]
          .filter(Boolean)
          .join(' · '),
        { sticky: true }
      );
      firmsHeatLayer.addLayer(marker);
    });

    setLayerOnMap(firmsHeatLayer, firmsHeatVisible && firms.length > 0);
    syncLayerControl();
    syncChipState();
  }

  function setFloodHalo(loan) {
    lastFloodLoan = loan || null;
    if (!map || !floodHaloLayer) return;
    floodHaloLayer.clearLayers();

    if (!loan) {
      setLayerOnMap(floodHaloLayer, false);
      syncChipState();
      return;
    }

    const lat = Number(loan.latitude ?? loan.lat);
    const lng = Number(loan.longitude ?? loan.lng);
    if (!hasFiniteCoords(lat, lng)) {
      setLayerOnMap(floodHaloLayer, false);
      return;
    }

    const miles = floodHaloMilesForLoan(loan);
    const zone = loan.flood_zone || '—';
    const circle = L.circle([lat, lng], {
      radius: miles * MILES_TO_METERS,
      color: '#0369a1',
      weight: 2,
      fillColor: '#38bdf8',
      fillOpacity: 0.12,
      className: 'du-overlay-flood-halo'
    });
    circle.bindTooltip(
      `Flood zone halo · ${zone} · ~${miles} mi visual buffer (not NFHL polygon)`,
      { sticky: true }
    );
    floodHaloLayer.addLayer(circle);

    const pin = L.circleMarker([lat, lng], {
      radius: 6,
      color: '#0c4a6e',
      weight: 2,
      fillColor: '#7dd3fc',
      fillOpacity: 0.95
    });
    pin.bindTooltip(
      `Loan ${loan.loan_number || ''} · flood ${zone} · ops triage ${loan.disaster_risk_score ?? '—'}`,
      { sticky: true }
    );
    floodHaloLayer.addLayer(pin);

    setLayerOnMap(floodHaloLayer, floodHaloVisible);
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

  function toggleOverlayKey(key) {
    if (key === 'live') {
      liveRingVisible = !liveRingVisible;
      setLayerOnMap(liveRingLayer, liveRingVisible && !!lastLive);
    } else if (key === 'firmsHeat') {
      firmsHeatVisible = !firmsHeatVisible;
      setLayerOnMap(
        firmsHeatLayer,
        firmsHeatVisible && firmsHeatLayer && firmsHeatLayer.getLayers().length > 0
      );
      webgpuHeat?.setHeatVisible?.(firmsHeatVisible);
    } else if (key === 'graphNear') {
      graphNearVisible = !graphNearVisible;
      setLayerOnMap(graphNearLayer, graphNearVisible && lastRays.length > 0);
      webgpuHeat?.setArcsVisible?.(graphNearVisible);
    } else if (key === 'floodHalo') {
      floodHaloVisible = !floodHaloVisible;
      setLayerOnMap(floodHaloLayer, floodHaloVisible && !!lastFloodLoan);
    } else if (SOURCE_KEYS.includes(key)) {
      sourceVisible[key] = !sourceVisible[key];
      setLayerOnMap(
        sourceLayers[key],
        sourceVisible[key] && sourceLayers[key] && sourceLayers[key].getLayers().length > 0
      );
    }
    syncChipState();
  }

  function initChips() {
    document.querySelectorAll('[data-du-overlay]').forEach((btn) => {
      if (btn.dataset.duOverlayBound) return;
      btn.dataset.duOverlayBound = '1';
      btn.addEventListener('click', () => {
        toggleOverlayKey(btn.getAttribute('data-du-overlay'));
      });
    });
    syncChipState();
  }

  async function bindWebGpuOverlay(pickerMap) {
    if (!pickerMap || !global.DuWebGpuHeat || webgpuHeat) return;
    const host = document.getElementById('duGeoPickerMapHost') || document.getElementById('duGeoPickerMap')?.parentElement;
    const canvas = document.getElementById('duWebgpuHeatCanvas');
    if (!host || !canvas) return;
    try {
      webgpuHeat = await global.DuWebGpuHeat.mount({
        map: pickerMap,
        canvas,
        heatOn: firmsHeatVisible,
        arcsOn: graphNearVisible,
      });
      if (lastDisasterRows.length) webgpuHeat?.setFirmsRows?.(lastDisasterRows);
      if (lastRays.length) webgpuHeat?.setGraphNearRays?.(lastRays, { seededAtMax: lastSeededAt });
    } catch (err) {
      console.warn('WebGPU heat overlay failed', err);
    }

    const globeCanvas = document.getElementById('duWebgpuPulseGlobe');
    if (globeCanvas && !pulseGlobe) {
      try {
        pulseGlobe = await global.DuWebGpuHeat.mountPulseGlobe({ canvas: globeCanvas });
        syncPulseGlobeFromRows();
      } catch (_) {
        /* optional */
      }
    }
  }

  function bindPickerMap(pickerMap) {
    if (!ensureMap(pickerMap)) return;
    syncLayerControl();
    if (lastLive) setLiveRing(lastLive.lat, lastLive.lng, lastLive.radiusMiles);
    if (lastRays.length) setGraphNearRays(lastRays, { seededAtMax: lastSeededAt });
    if (lastDisasterRows.length) {
      paintSourceMarkers();
      paintFirmsHeat();
    }
    if (lastFloodLoan) setFloodHalo(lastFloodLoan);
    bindWebGpuOverlay(pickerMap);
  }

  global.duGeoOverlays = {
    bindPickerMap,
    setLiveRing,
    setLiveRingFromSelection,
    setGraphNearRays,
    setDisasterRows,
    setFloodHalo,
    initChips,
    SOURCE_KEYS,
    SOURCE_LABELS
  };
})(typeof window !== 'undefined' ? window : globalThis);
