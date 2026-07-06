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

  function $(sel) { return document.querySelector(sel); }

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
    const summary = countySummary[name.toLowerCase()] || {};
    const count = Number(summary.event_count) || 0;
    const max = Math.max(1, ...Object.values(countySummary).map((r) => Number(r.event_count) || 0));
    const selected = selectedCounty && name.toLowerCase() === selectedCounty.toLowerCase();
    return {
      color: selected ? '#1d4ed8' : '#475569',
      weight: selected ? 2.5 : 1,
      fillColor: duGeoData.heatColor(count, max),
      fillOpacity: selected ? 0.78 : 0.5,
    };
  }

  function renderCountyList(stateAbbr, geojson) {
    const list = $('#duGeoCountyList');
    if (!list) return;
    const st = stateAbbr.toUpperCase();
    const features = geojson.features || [];
    const q = ($('#duGeoCountySearch')?.value || '').trim().toLowerCase();

    const rows = features
      .map((f) => {
        const name = duGeoData.normalizeCountyName(f.properties?.name);
        const summary = countySummary[name.toLowerCase()] || {};
        const count = Number(summary.event_count) || 0;
        return { name, fips: f.properties?.county_fips, count };
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
        <span class="du-geo-county-meta">${r.count ? `${r.count} event${r.count === 1 ? '' : 's'}` : 'No events'}</span>
      </button>`;
    }).join('');

    list.querySelectorAll('.du-geo-county-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        pickCounty(btn.getAttribute('data-county'));
      });
    });
  }

  function updateLoadButton() {
    const btn = $('#duGeoLoadBtn');
    if (!btn) return;
    const ready = selectedState && selectedCounty;
    btn.disabled = !ready;
    btn.classList.toggle('du-geo-load-ready', !!ready);
    btn.innerHTML = ready
      ? `<i class="bi bi-radar"></i> Load ${duEscapeHtml(selectedCounty)}, ${duEscapeHtml(selectedState)}`
      : '<i class="bi bi-radar"></i> Select a county to load intelligence';
  }

  function pickCounty(name) {
    selectedCounty = duGeoData.normalizeCountyName(name);
    if (countiesLayer) countiesLayer.setStyle(styleCountyLayer);
    renderCountyList(selectedState, geoCacheCounties());
    updateLoadButton();
    setPickerStatus(`Selected ${selectedCounty}, ${selectedState}. Click load to fetch hazard data.`, 'primary');

    const feature = (geoCacheCounties().features || []).find(
      (f) => duGeoData.normalizeCountyName(f.properties?.name).toLowerCase() === selectedCounty.toLowerCase()
    );
    if (feature && pickerMap) {
      pickerMap.fitBounds(L.geoJSON(feature).getBounds(), { padding: [24, 24], maxZoom: 10 });
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
      const [geojson, summary] = await Promise.all([
        duGeoData.loadStateCounties(st),
        duGeoData.loadCountySummary(st),
      ]);
      cachedCountyGeo = geojson;
      countySummary = summary;
      renderCountyList(st, geojson);

      if (countiesLayer) countiesLayer.remove();
      countiesLayer = L.geoJSON(geojson, {
        style: styleCountyLayer,
        onEachFeature: (feature, layer) => {
          const name = duGeoData.normalizeCountyName(feature.properties?.name);
          layer.bindTooltip(name, { sticky: true, className: 'du-geo-tooltip' });
          layer.on({
            mouseover: (e) => {
              e.target.setStyle({ weight: 2, fillOpacity: 0.75 });
            },
            mouseout: (e) => countiesLayer.resetStyle(e.target),
            click: () => pickCounty(name),
          });
        },
      }).addTo(pickerMap);

      if (!opts.skipFit) {
        pickerMap.fitBounds(countiesLayer.getBounds(), { padding: [20, 20], maxZoom: 8 });
      }
      setPickerStatus(`${geojson.features.length} counties — click map or list, then load intelligence.`, 'success');
    } catch (e) {
      console.error(e);
      setPickerStatus(`Could not load counties for ${st}. Run npm run build:us-geo.`, 'danger');
    }
    updateLoadButton();
  }

  function resetToUs() {
    selectedState = null;
    selectedCounty = null;
    cachedCountyGeo = null;
    countySummary = {};
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
    const [topo, stats] = await Promise.all([
      duGeoData.loadStatesTopo(),
      duGeoData.loadStateEventStats(),
    ]);
    const geojson = duGeoData.statesGeoJson(topo, stats);

    statesLayer = L.geoJSON(geojson, {
      style: styleStateLayer,
      onEachFeature: (feature, layer) => {
        const abbr = feature.properties?.state_abbr;
        const name = feature.properties?.state_name || abbr;
        const count = feature.properties?.event_count || 0;
        layer.bindTooltip(`${name}${count ? ` · ${count} events` : ''}`, {
          sticky: true,
          className: 'du-geo-tooltip',
        });
        layer.on({
          mouseover: (e) => e.target.setStyle({ weight: 2, fillOpacity: 0.72 }),
          mouseout: (e) => statesLayer.resetStyle(e.target),
          click: () => { if (abbr) selectState(abbr); },
        });
      },
    }).addTo(pickerMap);
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

  function confirmCountyLoad() {
    if (!selectedState || !selectedCounty) return;
    if (typeof global.onDuCountyConfirmed === 'function') {
      global.onDuCountyConfirmed(selectedState, selectedCounty);
    }
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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(pickerMap);

    populateStateSelect();
    setBreadcrumb([{ label: 'United States' }, { label: 'Select a state' }]);
    setPickerStatus('Nationwide monitoring on standby. Click a state or choose from the list.', 'muted');
    updateLoadButton();

    $('#duGeoCountySearch')?.addEventListener('input', () => {
      if (selectedState && cachedCountyGeo) renderCountyList(selectedState, cachedCountyGeo);
    });
    $('#duGeoLoadBtn')?.addEventListener('click', confirmCountyLoad);
    $('#duGeoChangeCountyBtn')?.addEventListener('click', () => {
      duCountyIntelLoaded = false;
      duMultiPanelMode = false;
      document.getElementById('duGeoStage')?.classList.remove('du-geo-stage--collapsed');
      document.getElementById('duIntelStage')?.classList.add('du-intel-stage--pending');
      document.getElementById('duGeoActiveCrumb')?.setAttribute('hidden', '');
      document.getElementById('duGeoChangeCountyBtn')?.setAttribute('hidden', '');
      const statsRow = document.getElementById('statsRow');
      statsRow?.classList.add('du-stats-row--placeholder');
      statsRow?.classList.remove('du-stats-row--hidden');
      resetToUs();
    });

    try {
      await initStatesLayer();
    } catch (e) {
      console.error(e);
      setPickerStatus('Could not load US state boundaries. Run npm run build:us-geo.', 'danger');
    }

    const params = new URLSearchParams(window.location.search);
    const urlState = params.get('state')?.toUpperCase();
    const urlCounty = params.get('county');
    if (urlState && duGeoData.ST_TO_FIPS[urlState]) {
      await selectState(urlState);
      if (urlCounty) {
        pickCounty(urlCounty);
        if (params.get('load') === '1') confirmCountyLoad();
      }
    }

    hideLoading();
    setTimeout(() => pickerMap?.invalidateSize(), 200);
  }

  global.initDuGeoPicker = initDuGeoPicker;
  global.duGeoPickerReset = resetToUs;
})(typeof window !== 'undefined' ? window : globalThis);
