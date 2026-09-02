/**
 * Unified Disasters — Leaflet state/county picker (Engine A).
 * Google Maps event layer loads after county confirmation (Engine B).
 */
(function (global) {
  'use strict';

  const US_CENTER = [39.8, -98.6];
  const US_ZOOM = 4;
  const STATE_ZOOM = 6;

  let pickerMap = null;
  let statesLayer = null;
  let countiesLayer = null;
  let selectedState = null;
  let selectedCounty = null;
  let countySummary = {};
  let countyRiskSummary = {};
  let countyCameraSummary = {};
  /** Cached max metric for county heat styling (avoid Math.max per feature). */
  let countySummaryMax = 1;
  /** @type {'events'|'opsTriage'|'cameras'} */
  let choroplethMode = 'events';
  const COUNTY_PERMANENT_TOOLTIP_MAX = 60;

  function $(sel) { return document.querySelector(sel); }

  function countyMetric(summaryKey) {
    const key = String(summaryKey || '').toLowerCase();
    if (choroplethMode === 'opsTriage') {
      const row = countyRiskSummary[key] || {};
      const avg = Number(row.avg_ops_triage) || 0;
      const n = Number(row.loan_count) || 0;
      return {
        value: avg,
        display: n ? avg.toFixed(1) : '',
        label: n
          ? `ops triage avg ${avg.toFixed(1)} · ${n} loan${n === 1 ? '' : 's'} (not probability)`
          : 'No loans',
        meta: n ? `${avg.toFixed(1)} triage` : 'No loans',
      };
    }
    if (choroplethMode === 'cameras') {
      const row = countyCameraSummary[key] || {};
      const n = Number(row.camera_count) || 0;
      return {
        value: n,
        display: n ? String(n) : '',
        label: n ? `${n} camera${n === 1 ? '' : 's'}` : 'No cameras',
        meta: n ? `${n} cam${n === 1 ? '' : 's'}` : 'No cameras',
      };
    }
    const row = countySummary[key] || {};
    const n = Number(row.event_count) || 0;
    return {
      value: n,
      display: n ? String(n) : '',
      label: n ? `${n} event${n === 1 ? '' : 's'}` : 'No events',
      meta: n ? `${n} event${n === 1 ? '' : 's'}` : 'No events',
    };
  }

  function refreshCountySummaryMax() {
    let max = 1;
    if (choroplethMode === 'opsTriage') {
      Object.keys(countyRiskSummary).forEach((k) => {
        const n = Number(countyRiskSummary[k]?.avg_ops_triage) || 0;
        if (n > max) max = n;
      });
    } else if (choroplethMode === 'cameras') {
      Object.keys(countyCameraSummary).forEach((k) => {
        const n = Number(countyCameraSummary[k]?.camera_count) || 0;
        if (n > max) max = n;
      });
    } else {
      Object.keys(countySummary).forEach((k) => {
        const n = Number(countySummary[k]?.event_count) || 0;
        if (n > max) max = n;
      });
    }
    countySummaryMax = max;
  }

  function countyFillColor(value) {
    if (choroplethMode === 'opsTriage') return duGeoData.opsTriageHeatColor(value, countySummaryMax);
    if (choroplethMode === 'cameras') return duGeoData.cameraHeatColor(value, countySummaryMax);
    return duGeoData.heatColor(value, countySummaryMax);
  }

  function updateChoroplethLegend() {
    const el = document.getElementById('duGeoChoroplethLegend');
    if (!el) return;
    if (choroplethMode === 'opsTriage') {
      el.innerHTML = `
        <span class="du-geo-legend-item"><span class="du-geo-legend-swatch" style="background:#e2e8f0"></span> None</span>
        <span class="du-geo-legend-item"><span class="du-geo-legend-swatch" style="background:#fde68a"></span> Low triage</span>
        <span class="du-geo-legend-item"><span class="du-geo-legend-swatch" style="background:#f59e0b"></span> Moderate</span>
        <span class="du-geo-legend-item"><span class="du-geo-legend-swatch" style="background:#b45309"></span> High ops triage</span>
        <span class="text-muted ms-1">(rank, not probability)</span>`;
      return;
    }
    if (choroplethMode === 'cameras') {
      el.innerHTML = `
        <span class="du-geo-legend-item"><span class="du-geo-legend-swatch" style="background:#e2e8f0"></span> None</span>
        <span class="du-geo-legend-item"><span class="du-geo-legend-swatch" style="background:#99f6e4"></span> Sparse</span>
        <span class="du-geo-legend-item"><span class="du-geo-legend-swatch" style="background:#2dd4bf"></span> Moderate</span>
        <span class="du-geo-legend-item"><span class="du-geo-legend-swatch" style="background:#0f766e"></span> Dense cameras</span>`;
      return;
    }
    el.innerHTML = `
      <span class="du-geo-legend-item"><span class="du-geo-legend-swatch du-geo-legend--none"></span> None</span>
      <span class="du-geo-legend-item"><span class="du-geo-legend-swatch du-geo-legend--low"></span> Low</span>
      <span class="du-geo-legend-item"><span class="du-geo-legend-swatch du-geo-legend--medium"></span> Moderate</span>
      <span class="du-geo-legend-item"><span class="du-geo-legend-swatch du-geo-legend--high"></span> High</span>`;
  }

  function bindFeatureTooltip(layer, { name, count, preferPermanent, tipLabel }) {
    if (preferPermanent && count > 0) {
      layer.bindTooltip(String(count), {
        permanent: true,
        direction: 'center',
        className: 'du-geo-tooltip du-geo-count-label',
        opacity: 0.95,
      });
      return;
    }
    const label = tipLabel || (count > 0 ? `${name}: ${count}` : (name || ''));
    layer.bindTooltip(label, { sticky: true, className: 'du-geo-tooltip' });
  }

  function setBreadcrumb(parts) {
    const el = $('#duGeoBreadcrumb');
    if (!el) return;
    el.innerHTML = parts.map((p, i) => {
      const isLast = i === parts.length - 1;
      return isLast
        ? `<span class="du-geo-crumb du-geo-crumb--active">${p.label}</span>`
        : `<button type="button" class="du-geo-crumb du-geo-crumb--link" data-du-geo-nav="${p.action || ''}">${p.label}</button>`;
    }).join('<i class="bi bi-chevron-right du-geo-crumb-sep" aria-hidden="true"></i>');
    el.querySelectorAll('[data-du-geo-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-du-geo-nav');
        if (action === 'us') resetToUs();
        else if (action === 'state' && selectedState) selectState(selectedState, { skipFit: false });
      });
    });
  }

  function setPickerStatus(msg, variant) {
    const el = $('#duGeoPickerStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = `du-geo-picker-status small mb-2 text-${variant || 'muted'}`;
  }

  function styleStateLayer(feature) {
    const fill = feature?.properties?.fill || '#cbd5e1';
    const abbr = feature?.properties?.state_abbr;
    const selected = abbr && abbr === selectedState;
    return {
      color: selected ? '#1d4ed8' : '#64748b',
      weight: selected ? 2.5 : 1,
      fillColor: fill,
      fillOpacity: selected ? 0.72 : 0.55,
    };
  }

  function styleCountyLayer(feature) {
    const name = duGeoData.normalizeCountyName(feature?.properties?.name);
    const metric = countyMetric(name);
    const selected = selectedCounty && name.toLowerCase() === selectedCounty.toLowerCase();
    return {
      color: selected ? '#1d4ed8' : '#475569',
      weight: selected ? 2.5 : 1,
      fillColor: countyFillColor(metric.value),
      fillOpacity: selected ? 0.78 : 0.5,
    };
  }

  function renderCountyList(stateAbbr, geojson) {
    const list = $('#duGeoCountyList');
    if (!list) return;
    const features = geojson.features || [];
    const q = ($('#duGeoCountySearch')?.value || '').trim().toLowerCase();

    const rows = features
      .map((f) => {
        const name = duGeoData.normalizeCountyName(f.properties?.name);
        const metric = countyMetric(name);
        return { name, fips: f.properties?.county_fips, count: metric.value, meta: metric.meta };
      })
      .filter((r) => r.name && (!q || r.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!rows.length) {
      list.innerHTML = '<p class="text-muted small mb-0">No counties match your search.</p>';
      return;
    }

    list.innerHTML = rows.map((r) => {
      const active = selectedCounty && r.name.toLowerCase() === selectedCounty.toLowerCase();
      return `<button type="button" class="du-geo-county-row${active ? ' du-geo-county-row--active' : ''}" data-county="${r.name.replace(/"/g, '&quot;')}">
        <span class="du-geo-county-name">${r.name}</span>
        <span class="du-geo-county-meta">${r.meta}</span>
      </button>`;
    }).join('');

    list.querySelectorAll('.du-geo-county-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        pickCounty(btn.getAttribute('data-county'));
      });
    });
  }

  function updateLoadButton() {
    const stateBtn = $('#duGeoLoadStateBtn');
    const clearBtn = $('#duGeoClearCountyBtn');
    if (stateBtn) {
      const ready = !!selectedState;
      stateBtn.disabled = !ready;
      const stateLabel = ready && typeof duGeoData !== 'undefined'
        ? duGeoData.stateName(selectedState)
        : selectedState;
      stateBtn.innerHTML = ready
        ? `<i class="bi bi-map"></i> Load all of ${duEscapeHtml(stateLabel || selectedState)}`
        : '<i class="bi bi-map"></i> Load entire state';
    }
    if (clearBtn) {
      clearBtn.style.display = selectedState && selectedCounty && duStateDisasterRows.length ? 'block' : 'none';
    }
  }

  function pickCounty(name) {
    selectedCounty = duGeoData.normalizeCountyName(name);
    if (countiesLayer) countiesLayer.setStyle(styleCountyLayer);
    renderCountyList(selectedState, geoCacheCounties());
    updateLoadButton();
    setPickerStatus(`Selected ${selectedCounty}, ${selectedState}. Loading county hazards…`, 'primary');

    const feature = (geoCacheCounties().features || []).find(
      (f) => duGeoData.normalizeCountyName(f.properties?.name).toLowerCase() === selectedCounty.toLowerCase()
    );
    if (feature && pickerMap) {
      pickerMap.fitBounds(L.geoJSON(feature).getBounds(), { padding: [24, 24], maxZoom: 10 });
    }

    if (typeof global.onDuCountyFiltered === 'function') {
      global.onDuCountyFiltered(selectedState, selectedCounty);
    }
  }

  let cachedCountyGeo = null;
  function geoCacheCounties() { return cachedCountyGeo || { features: [] }; }

  async function selectState(stateAbbr, opts = {}) {
    const st = String(stateAbbr || '').toUpperCase();
    if (!st || !duGeoData.ST_TO_FIPS[st]) return;

    selectedState = st;
    selectedCounty = null;
    setBreadcrumb([
      { label: 'United States', action: 'us' },
      { label: duGeoData.stateName(st), action: 'state' },
      { label: 'Choose county' },
    ]);
    setPickerStatus(`Loading counties for ${duGeoData.stateName(st)}…`, 'muted');
    $('#duGeoCountyPanel')?.classList.remove('d-none');
    $('#duGeoStateSelect').value = st;

    if (statesLayer) statesLayer.setStyle(styleStateLayer);

    try {
      const [geojson, summary, riskSummary, cameraSummary] = await Promise.all([
        duGeoData.loadStateCounties(st),
        duGeoData.loadCountySummary(st),
        duGeoData.loadCountyRiskSummary(st),
        duGeoData.loadCountyCameraSummary(st),
      ]);
      cachedCountyGeo = geojson;
      countySummary = summary || {};
      countyRiskSummary = riskSummary || {};
      countyCameraSummary = cameraSummary || {};
      refreshCountySummaryMax();
      updateChoroplethLegend();
      renderCountyList(st, geojson);

      if (countiesLayer) countiesLayer.remove();
      const featureCount = (geojson.features || []).length;
      // Permanent count labels are cheap for small states; sticky-only for dense county layers.
      const preferPermanentCounts = featureCount <= COUNTY_PERMANENT_TOOLTIP_MAX;
      countiesLayer = L.geoJSON(geojson, {
        style: styleCountyLayer,
        onEachFeature: (feature, layer) => {
          const name = duGeoData.normalizeCountyName(feature.properties?.name);
          const metric = countyMetric(name);
          bindFeatureTooltip(layer, {
            name,
            count: metric.display || metric.value,
            preferPermanent: preferPermanentCounts && metric.value > 0,
            tipLabel: `${name}: ${metric.label}`,
          });
          layer.on({
            mouseover: (e) => e.target.setStyle({ weight: 2, fillOpacity: 0.75 }),
            mouseout: (e) => countiesLayer.resetStyle(e.target),
            click: () => pickCounty(name),
          });
        },
      }).addTo(pickerMap);

      if (!opts.skipFit) {
        pickerMap.fitBounds(countiesLayer.getBounds(), { padding: [20, 20], maxZoom: 8 });
      }
      const modeHint =
        choroplethMode === 'opsTriage'
          ? 'ops triage heat'
          : choroplethMode === 'cameras'
            ? 'camera sightedness'
            : 'event density';
      setPickerStatus(
        `${geojson.features.length} counties · ${modeHint} — click a county to load hazards, or load entire state.`,
        'success'
      );
    } catch (e) {
      console.error(e);
      setPickerStatus(`Could not load counties for ${st}. Run npm run build:us-geo.`, 'danger');
    }
    updateLoadButton();
    setTimeout(() => pickerMap?.invalidateSize(), 150);
  }

  function resetToUs() {
    selectedState = null;
    selectedCounty = null;
    cachedCountyGeo = null;
    countySummary = {};
    countyRiskSummary = {};
    countyCameraSummary = {};
    countySummaryMax = 1;
    duStateDisasterRows = [];
    duGeoLoadScope = null;
    if (countiesLayer) {
      countiesLayer.remove();
      countiesLayer = null;
    }
    if (statesLayer) statesLayer.setStyle(styleStateLayer);
    $('#duGeoCountyPanel')?.classList.add('d-none');
    $('#duGeoCountySearch').value = '';
    $('#duGeoStateSelect').value = '';
    setBreadcrumb([{ label: 'United States' }, { label: 'Select a state' }]);
    setPickerStatus('Nationwide monitoring on standby. Click a state or choose from the list.', 'muted');
    pickerMap?.setView(US_CENTER, US_ZOOM);
    updateLoadButton();
  }

  async function initStatesLayer() {
    const [statesFc, stats] = await Promise.all([
      duGeoData.loadStatesGeoJson(),
      duGeoData.loadStateEventStats(),
    ]);
    const geojson = duGeoData.decorateStatesGeoJson(statesFc, stats);

    statesLayer = L.geoJSON(geojson, {
      style: styleStateLayer,
      onEachFeature: (feature, layer) => {
        const abbr = feature.properties?.state_abbr;
        const name = feature.properties?.state_name || abbr;
        const count = Number(feature.properties?.event_count) || 0;
        // US zoom: sticky hover labels only — permanent tooltips on all states fight the main thread.
        bindFeatureTooltip(layer, { name: name || abbr || '', count, preferPermanent: false });
        layer.on({
          mouseover: (e) => e.target.setStyle({ weight: 2, fillOpacity: 0.72 }),
          mouseout: (e) => statesLayer.resetStyle(e.target),
          click: () => { if (abbr) selectState(abbr); },
        });
      },
    }).addTo(pickerMap);

    const withEvents = (geojson.features || []).filter((f) => Number(f.properties?.event_count) > 0).length;
    const totalEvents = (geojson.features || []).reduce((sum, f) => sum + (Number(f.properties?.event_count) || 0), 0);
    if (totalEvents > 0) {
      setPickerStatus(
        `${totalEvents.toLocaleString()} events across ${withEvents} state${withEvents === 1 ? '' : 's'} — hover a state for counts, click to drill in.`,
        'success'
      );
    }
  }

  function populateStateSelect() {
    const sel = $('#duGeoStateSelect');
    if (!sel) return;
    const options = Object.keys(duGeoData.STATE_NAMES)
      .sort((a, b) => duGeoData.stateName(a).localeCompare(duGeoData.stateName(b)))
      .map((abbr) => `<option value="${abbr}">${duGeoData.stateName(abbr)} (${abbr})</option>`)
      .join('');
    sel.innerHTML = `<option value="">— Select state —</option>${options}`;
    sel.addEventListener('change', () => {
      const v = sel.value;
      if (v) selectState(v);
      else resetToUs();
    });
  }

  function confirmStateLoad() {
    if (!selectedState) return;
    selectedCounty = null;
    if (countiesLayer) countiesLayer.setStyle(styleCountyLayer);
    if (cachedCountyGeo) renderCountyList(selectedState, cachedCountyGeo);
    updateLoadButton();
    if (typeof global.onDuStateConfirmed === 'function') {
      global.onDuStateConfirmed(selectedState);
    }
  }

  function confirmClearCountyFilter() {
    if (!selectedState) return;
    selectedCounty = null;
    updateLoadButton();
    renderCountyList(selectedState, geoCacheCounties());
    if (countiesLayer) countiesLayer.setStyle(styleCountyLayer);
    if (typeof global.clearCountyDisasterFilter === 'function') {
      global.clearCountyDisasterFilter();
    }
    setPickerStatus(`Showing all counties in ${selectedState}. Click a county to filter.`, 'info');
  }

  async function initDuGeoPicker() {
    const mapEl = document.getElementById('duGeoPickerMap');
    if (!mapEl || typeof L === 'undefined' || !global.duGeoData) {
      console.warn('Geo picker prerequisites missing (Leaflet / duGeoData / map element)');
      hideLoading();
      return;
    }

    pickerMap = L.map(mapEl, {
      center: US_CENTER,
      zoom: US_ZOOM,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(pickerMap);

    if (typeof global.duGeoOverlays?.bindPickerMap === 'function') {
      global.duGeoOverlays.bindPickerMap(pickerMap);
    }
    if (typeof global.duGeoOverlays?.initChips === 'function') {
      global.duGeoOverlays.initChips();
    }

    populateStateSelect();
    setBreadcrumb([{ label: 'United States' }, { label: 'Select a state' }]);
    setPickerStatus('Nationwide monitoring on standby. Click a state or choose from the list.', 'muted');
    updateLoadButton();
    updateChoroplethLegend();

    const modeSel = $('#duGeoChoroplethMode');
    if (modeSel) {
      choroplethMode = modeSel.value || 'events';
      modeSel.addEventListener('change', async () => {
        choroplethMode = modeSel.value || 'events';
        updateChoroplethLegend();
        if (!selectedState || !cachedCountyGeo) return;
        refreshCountySummaryMax();
        if (countiesLayer) {
          countiesLayer.setStyle(styleCountyLayer);
          countiesLayer.eachLayer((layer) => {
            const name = duGeoData.normalizeCountyName(layer.feature?.properties?.name);
            const metric = countyMetric(name);
            layer.unbindTooltip();
            const preferPermanent =
              (cachedCountyGeo.features || []).length <= COUNTY_PERMANENT_TOOLTIP_MAX && metric.value > 0;
            bindFeatureTooltip(layer, {
              name,
              count: metric.display || metric.value,
              preferPermanent,
              tipLabel: `${name}: ${metric.label}`,
            });
          });
        }
        renderCountyList(selectedState, cachedCountyGeo);
        const modeHint =
          choroplethMode === 'opsTriage'
            ? 'ops triage heat'
            : choroplethMode === 'cameras'
              ? 'camera sightedness'
              : 'event density';
        setPickerStatus(`Choropleth: ${modeHint}`, 'info');
      });
    }

    $('#duGeoCountySearch')?.addEventListener('input', () => {
      if (selectedState && cachedCountyGeo) renderCountyList(selectedState, cachedCountyGeo);
    });
    $('#duGeoLoadStateBtn')?.addEventListener('click', confirmStateLoad);
    $('#duGeoClearCountyBtn')?.addEventListener('click', confirmClearCountyFilter);
    $('#duGeoLoadUsaBtn')?.addEventListener('click', () => {
      if (typeof global.onDuUsaConfirmed === 'function') global.onDuUsaConfirmed();
    });
    $('#duGeoChangeCountyBtn')?.addEventListener('click', () => {
      duCountyIntelLoaded = false;
      duMultiPanelMode = false;
      duStateDisasterRows = [];
      duGeoLoadScope = null;
      document.getElementById('duGeoStage')?.classList.remove('du-geo-stage--collapsed');
      document.getElementById('duIntelStage')?.classList.add('du-intel-stage--pending');
      document.getElementById('duGeoActiveCrumb')?.setAttribute('hidden', '');
      document.getElementById('duGeoChangeCountyBtn')?.setAttribute('hidden', '');
      const statsRow = document.getElementById('statsRow');
      statsRow?.classList.add('du-stats-row--placeholder');
      statsRow?.classList.remove('du-stats-row--hidden');
      resetToUs();
    });

    let stateLayerReady = false;
    try {
      await initStatesLayer();
      stateLayerReady = true;
    } catch (e) {
      console.warn('US state boundary overlay unavailable; continuing with base map and selector.', e);
      setPickerStatus(
        `Map loaded. State outlines unavailable (${e.message || 'geo asset error'}). Use the state list or Load all USA.`,
        'warning'
      );
    }

    const params = new URLSearchParams(window.location.search);
    const urlState = params.get('state')?.toUpperCase();
    const urlCounty = params.get('county');
    // Prefer explicit state/county over leftover scope=usa from a prior USA view.
    if (urlState && duGeoData.ST_TO_FIPS[urlState]) {
      await selectState(urlState);
      if (urlCounty) {
        pickCounty(urlCounty);
      } else if (params.get('load') === '1') {
        confirmStateLoad();
      }
    } else if (params.get('scope') === 'usa' && typeof global.onDuUsaConfirmed === 'function') {
      global.onDuUsaConfirmed();
    } else if (!urlState && !urlCounty && typeof global.onDuUsaConfirmed === 'function') {
      global.onDuUsaConfirmed();
    }

    hideLoading();
    setTimeout(() => pickerMap?.invalidateSize(), stateLayerReady ? 200 : 150);
  }

  global.initDuGeoPicker = initDuGeoPicker;
  global.duGeoPickerReset = resetToUs;
  global.duGeoPickerInvalidate = function duGeoPickerInvalidate() {
    pickerMap?.invalidateSize();
  };
})(typeof window !== 'undefined' ? window : globalThis);
