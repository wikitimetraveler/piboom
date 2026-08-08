/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — API pull, source deck, loadDisasters
 * Loaded in global scope after prior scripts (see disasters-unified.html).
 */

const UNIFIED_SOURCE_KEYS = ['fema', 'firms', 'usgs', 'nws', 'nhc', 'floodzones'];



function normalizeSourceKeyForDeck(source) {
  const s = String(source || '').trim().toLowerCase();
  if (s === 'noaa') return 'nws';
  if (s === 'nfhl' || s === 'flood') return 'floodzones';
  return s;
}

function createSourceBadgeHtml(source) {
  const src = normalizeSourceKeyForDeck(source);
  if (!src) return '';
  const label = src === 'floodzones' ? 'FLOOD' : src.toUpperCase();
  return `<span class="source-badge source-${src}">${label}</span>`;
}

function renderSourceDeckCounts(rows) {
  const counts = {};
  UNIFIED_SOURCE_KEYS.forEach((k) => { counts[k] = 0; });
  (rows || []).forEach((r) => {
    const k = normalizeSourceKeyForDeck(r.source);
    if (Object.prototype.hasOwnProperty.call(counts, k)) counts[k] += 1;
  });
  UNIFIED_SOURCE_KEYS.forEach((k) => {
    const el = document.querySelector(`[data-source-count="${k}"]`);
    if (el) el.textContent = String(counts[k] || 0);
  });
  window.__lastSourceDeckCounts = counts;
  updateSourceFreshnessDots();
  updateSourceHealthLine();
}

async function refreshSourceStatsFromApi() {
  const data = await getDisasterStats();
  const bySource = data?.bySource || [];
  let dbTotal = 0;
  bySource.forEach((row) => {
    const k = normalizeSourceKeyForDeck(row.source);
    const el = document.querySelector(`[data-source-db="${k}"]`);
    const count = Number(row.count) || 0;
    dbTotal += count;
    if (el && row.count != null) {
      el.textContent = `· ${row.count} DB`;
      el.hidden = false;
    }
  });
  if (dbTotal === 0) {
    setDashboardStatus(
      'Postgres has no disaster rows yet. Click Pull all sources to fetch live APIs into the database (takes a few minutes).',
      'warning',
    );
  }
  return dbTotal;
}

function updateSourceFreshnessDots() {
  const counts = window.__lastSourceDeckCounts || {};
  document.querySelectorAll('#unifiedSourceChips .source-chip[data-source]').forEach((chip) => {
    const key = chip.getAttribute('data-source');
    if (!key) return;
    chip.classList.remove('freshness-ok', 'freshness-warn', 'freshness-off');
    const active = chip.classList.contains('source-chip-active');
    const n = counts[key] || 0;
    if (!active) chip.classList.add('freshness-off');
    else if (n > 0) chip.classList.add('freshness-ok');
    else chip.classList.add('freshness-warn');
  });
}

function updateSourceHealthLine() {
  const el = document.getElementById('sourceHealthLine');
  if (!el) return;
  const counts = window.__lastSourceDeckCounts || {};
  const activeChips = [...document.querySelectorAll('#unifiedSourceChips .source-chip-active[data-source]')];
  const stale = activeChips
    .map((c) => c.getAttribute('data-source'))
    .filter((k) => k && (counts[k] || 0) === 0);
  if (!activeChips.length) {
    el.innerHTML = '<i class="bi bi-info-circle me-1"></i>Enable at least one source in the command deck.';
    return;
  }
  if (stale.length) {
    el.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i><span class="text-warning">Active but empty this load:</span> ${stale.map((s) => s.toUpperCase()).join(', ')} — try Refresh or widen filters.`;
  } else {
    el.innerHTML = `<i class="bi bi-check-circle text-success me-1"></i>${activeChips.length} source(s) reporting rows in the current grid.`;
  }
}

function syncSourceChipsFromSelect() {
  const selected = new Set($('#sourceInput').val() || []);
  document.querySelectorAll('#unifiedSourceChips .source-chip[data-source]').forEach((chip) => {
    chip.classList.toggle('source-chip-active', selected.has(chip.getAttribute('data-source')));
  });
  updateFirmsDeferredAlert();
  updateSourceFreshnessDots();
}

function updateFirmsDeferredAlert() {
  const sources = $('#sourceInput').val() || [];
  $('#firmsDeferredAlert').toggleClass('d-none', sources.includes('firms'));
}

function toggleUnifiedSourceChip(btn, sourceKey) {
  btn.classList.toggle('source-chip-active');
  const on = btn.classList.contains('source-chip-active');
  $(`#sourceInput option[value="${sourceKey}"]`).prop('selected', on);
  updateFirmsDeferredAlert();
  updateSourceFreshnessDots();
  scheduleFilterApply();
}

function scheduleFilterApply() {
  if (!duCountyIntelLoaded) return;
  clearTimeout(duFilterApplyTimer);
  duFilterApplyTimer = setTimeout(() => {
    duFilterApplyTimer = null;
    syncSourceChipsFromSelect();
    loadDisasters();
  }, DU_FILTER_APPLY_DEBOUNCE_MS);
}

function applyFiltersNow() {
  clearTimeout(duFilterApplyTimer);
  duFilterApplyTimer = null;
  if (!duCountyIntelLoaded) {
    setDashboardStatus('Select a state or county on the hazard lens map first.', 'warning');
    return;
  }
  syncSourceChipsFromSelect();
  loadDisasters();
}

/** Enable a source in the multiselect + chip (e.g. after combined pull ingests FIRMS). */
function ensureUnifiedSourceSelected(sourceKey) {
  const opt = $(`#sourceInput option[value="${sourceKey}"]`);
  if (!opt.length) return;
  opt.prop('selected', true);
  const chip = document.querySelector(`#unifiedSourceChips .source-chip[data-source="${sourceKey}"]`);
  if (chip) chip.classList.add('source-chip-active');
  updateFirmsDeferredAlert();
  updateSourceFreshnessDots();
}

function readDisasterFilterInputs() {
  const state = $('#stateInput').val().trim().toUpperCase();
  if (state) $('#stateInput').val(state);
  return {
    state,
    county: $('#countyInput').val().trim(),
    sources: $('#sourceInput').val() || [],
    events: $('#eventInput').val() || [],
  };
}

function normalizeCountyKey(name) {
  return String(name || '').replace(/\s+County$/i, '').trim().toLowerCase();
}

function filterRowsByCounty(rows, county) {
  const key = normalizeCountyKey(county);
  if (!key) return rows;
  return (rows || []).filter((r) => {
    const cn = normalizeCountyKey(r.county_name);
    return cn === key || cn.includes(key) || key.includes(cn);
  });
}

function applyCountyDisasterFilter(county) {
  const state = duSelectedGeoState || $('#stateInput').val().trim().toUpperCase();
  const { events } = readDisasterFilterInputs();
  duGeoLoadScope = 'county';
  duSelectedGeoCounty = county;
  $('#countyInput').val(county);

  let rows = filterRowsByCounty(duStateDisasterRows, county);
  rows = applyEventTypeFilter(rows, events);
  finishDisastersLoad(rows);

  const label = `${county}, ${state}`;
  setDashboardStatus(
    rows.length
      ? `Showing ${rows.length} event${rows.length === 1 ? '' : 's'} in ${label} (filtered from statewide data).`
      : `No events in ${label} for current filters — try another county or broaden sources.`,
    rows.length ? 'success' : 'info'
  );

  const crumb = document.getElementById('duGeoActiveCrumb');
  if (crumb) {
    crumb.textContent = label;
    crumb.hidden = false;
  }

  $('#duLoanScopeMode').val('county');
  syncDuLoanRadiusControls();
  loadLoansForDisaster(
    { state_abbr: state, county_name: county, title: label },
    null
  );

  const url = new URL(window.location.href);
  url.searchParams.set('state', state);
  url.searchParams.set('county', county);
  url.searchParams.delete('scope');
  url.searchParams.set('load', '1');
  window.history.replaceState({}, '', url);
}

function clearCountyDisasterFilter() {
  const state = duSelectedGeoState || $('#stateInput').val().trim().toUpperCase();
  if (!state || !duStateDisasterRows.length) return;
  duGeoLoadScope = 'state';
  duSelectedGeoCounty = null;
  $('#countyInput').val('');
  const { events } = readDisasterFilterInputs();
  const rows = applyEventTypeFilter(duStateDisasterRows, events);
  finishDisastersLoad(rows);
  const stateLabel = typeof duGeoData !== 'undefined' && duGeoData.stateName
    ? duGeoData.stateName(state)
    : state;
  setDashboardStatus(`Showing all ${rows.length} statewide event${rows.length === 1 ? '' : 's'} in ${stateLabel}. Pick a county to narrow.`, 'info');
  const crumb = document.getElementById('duGeoActiveCrumb');
  if (crumb) {
    crumb.textContent = `${stateLabel} (all counties)`;
    crumb.hidden = false;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('state', state);
  url.searchParams.delete('county');
  url.searchParams.delete('scope');
  url.searchParams.set('load', '1');
  window.history.replaceState({}, '', url);
}

if (typeof window !== 'undefined') {
  window.clearCountyDisasterFilter = clearCountyDisasterFilter;
  window.applyCountyDisasterFilter = applyCountyDisasterFilter;
}

function applyEventTypeFilter(rows, events) {
  if (!events || events.length === 0) return rows;
  const evSet = new Set(events.map((e) => String(e).toLowerCase()));
  return rows.filter((d) => evSet.has(String(d.event_type || '').toLowerCase()));
}

function finishDisastersLoad(allRows) {
  if (allRows.length === 0) {
    console.warn('⚠️  No disasters found. Check:');
    console.warn('   - Database connection');
    console.warn('   - Date filter (90 days)');
    console.warn('   - Source/event filters');
    setDashboardStatus('No disaster rows matched current filters. Try broadening source, state, or date criteria.', 'info');
  }
  // Never leave the intel stage in pending (pointer-events:none / greyed-out) after a load.
  document.getElementById('duIntelStage')?.classList.remove('du-intel-stage--pending');
  // Clear loading chrome before painting rows so the grid is never non-interactive while visible.
  setDuInlineLoading(false);
  // Progressive: paint grid/stats first, then chunk Google markers so Leaflet stays interactive.
  ++duMapRenderGeneration;
  renderTable(allRows);
  updateStats(allRows);
  updateFirmsDeferredAlert();
  const mapGen = duMapRenderGeneration;
  const rowsForMap = allRows;
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      if (mapGen !== duMapRenderGeneration) return;
      renderMap(rowsForMap);
    }, 0);
  });
}

async function loadDisasters() {
  const gen = ++duLoadDisastersGeneration;
  // Invalidate any in-flight marker chunks immediately (before await).
  ++duMapRenderGeneration;
  setDuInlineLoading(true);
  setDashboardStatus('');
  activeHotspotKey = null;
  activeHotspot = null;
  updateHotspotFilterUi();

  const { state, county, sources, events } = readDisasterFilterInputs();
  const scope = duGeoLoadScope || (county ? 'county' : (state ? 'state' : null));

  if (scope === 'county' && county && duStateDisasterRows.length && duSelectedGeoState === state) {
    const rows = applyEventTypeFilter(filterRowsByCounty(duStateDisasterRows, county), events);
    if (gen === duLoadDisastersGeneration) {
      finishDisastersLoad(rows);
    }
    return;
  }

  if ((scope === 'state' || scope === 'county') && !state) {
    if (gen === duLoadDisastersGeneration) {
      finishDisastersLoad([]);
      setDashboardStatus('Select a state on the hazard lens map first.', 'info');
    }
    return;
  }
  if (scope === 'county' && !county) {
    if (gen === duLoadDisastersGeneration) {
      finishDisastersLoad([]);
      setDashboardStatus('Click a county on the map to load hazard intelligence.', 'info');
    }
    return;
  }
  if (scope === 'usa') {
    // nationwide — no state required
  } else if (!scope) {
    if (gen === duLoadDisastersGeneration) {
      finishDisastersLoad([]);
      setDashboardStatus('Pick a county, load an entire state, or load all USA.', 'info');
    }
    return;
  }

  if (sources.length === 0) {
    if (gen === duLoadDisastersGeneration) {
      setDashboardStatus('Select at least one source in the command deck or Filters.', 'warning');
      finishDisastersLoad([]);
    }
    return;
  }

  let allRows = [];

  const dbSources = sources.filter(s => s !== 'floodzones' && s !== 'alertcalifornia');
  const needsDb = dbSources.length > 0;

  if (needsDb) {
    try {
      const sinceIso = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
      const fetchDbSource = async (src) => {
        const qp = new URLSearchParams();
        if (state) qp.set('state', state);
        if (scope === 'county' && county) qp.set('county', county);
        qp.set('source', src);
        qp.set('since', sinceIso);
        qp.set('limit', scope === 'usa' ? '5000' : '2000');
        const resp = await fetch(`/api/disasters?${qp.toString()}`);
        if (!resp.ok) {
          throw new Error(`Disaster source ${src} failed: HTTP ${resp.status}`);
        }
        const json = await resp.json();
        return json.success && json.data?.disasters ? json.data.disasters : [];
      };
      const chunks = await Promise.all(dbSources.map(fetchDbSource));
      allRows = allRows.concat(chunks.flat());
      console.log('📊 Loaded', allRows.length, 'disasters from database (selected sources)');
    } catch (e) {
      console.error('❌ Error loading disasters:', e);
      if (gen === duLoadDisastersGeneration) {
        setDashboardStatus(`Unable to load one or more disaster feeds: ${e.message}`, 'danger');
      }
    }
  }

  if (gen !== duLoadDisastersGeneration) return;

  if (sources.includes('floodzones')) {
    try {
      const floodState = scope === 'usa' ? null : state;
      const floodCounty = scope === 'county' && county ? county : null;
      const floodZoneRows = await loadFloodZones(floodState, floodCounty);
      if (floodZoneRows.length > 0) {
        allRows = allRows.concat(floodZoneRows);
      }
    } catch (e) {
      console.error('❌ Error loading flood zones:', e);
    }
  }

  if (gen !== duLoadDisastersGeneration) return;

  allRows = applyEventTypeFilter(allRows, events);

  if (scope === 'state' && state) {
    duStateDisasterRows = allRows.slice();
  } else if (scope === 'usa') {
    duStateDisasterRows = [];
  }

  finishDisastersLoad(allRows);
}

async function loadFloodZones(state = null, county = null) {
  try {
    const qp = new URLSearchParams();
    if (state) qp.set('state', state);
    if (county) qp.set('county', county);
    
    const url = `/api/loan-pipeline/flood-zones-loans?${qp.toString()}`;
    const resp = await fetch(url);
    const json = await resp.json();
    
    if (!json.success || !json.data) {
      return [];
    }
    
    // Transform flood zone loan data to unified format
    const floodZoneRows = json.data.map(item => ({
      source: 'floodzones',
      event_type: 'flood',
      county_name: item.county || '',
      state_abbr: item.state || '',
      start_time: item.last_flood_zone_check || new Date().toISOString(),
      end_time: null,
      severity: item.high_risk_count || 0,
      title: `Flood Zone ${item.flood_zone || 'Unknown'} - ${item.loan_count || 0} loans`,
      lat: item.avg_latitude || null,
      lng: item.avg_longitude || null,
      source_id: `floodzone_${item.state}_${item.county}_${item.flood_zone || 'unknown'}`,
      raw: item,
      flood_zone: item.flood_zone,
      loan_count: item.loan_count
    }));
    
    return floodZoneRows;
  } catch (error) {
    console.error('❌ Error loading flood zones:', error);
    return [];
  }
}

function setSourcePullStatus(message, tone = 'muted') {
  const el = document.getElementById('duSourcePullStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = `small du-source-pull-status text-${tone === 'muted' ? 'muted' : tone}`;
}

function setDuPullProgress(message, pct, { visible = true } = {}) {
  const wrap = document.getElementById('duPullProgress');
  const bar = document.getElementById('duPullProgressBar');
  const msgEl = document.getElementById('duPullProgressMsg');
  if (wrap) {
    if (!visible || (!message && pct == null)) {
      wrap.hidden = true;
    } else {
      wrap.hidden = false;
      if (bar && pct != null) bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      if (msgEl) msgEl.textContent = message || '';
    }
  }
  setSourcePullStatus(message, 'muted');
  const ingestStatus = document.getElementById('duIngestPostgresStatus');
  if (ingestStatus && message) ingestStatus.textContent = message;
}

function setPullButtonsBusy(busy) {
  ['refreshBtnHero', 'duIngestPostgresBtn'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = !!busy;
    if (busy) {
      btn.dataset.duOriginalHtml = btn.innerHTML;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Pulling…';
    } else if (btn.dataset.duOriginalHtml) {
      btn.innerHTML = btn.dataset.duOriginalHtml;
      delete btn.dataset.duOriginalHtml;
    }
  });
}

function formatIngestSummary(data) {
  const labels = {
    fema: 'FEMA',
    firms: 'FIRMS',
    usgs: 'USGS',
    nws: 'NWS',
    nhc: 'NHC',
  };
  const parts = [];
  for (const [key, label] of Object.entries(labels)) {
    const row = data?.[key];
    if (!row) continue;
    if (row.error) {
      parts.push(`${label} failed`);
    } else if (row.skipped === 'skipped') {
      parts.push(`${label} skipped`);
    } else {
      const inserted = row.inserted ?? 0;
      const fetched = row.fetched ?? row.prepared ?? null;
      const skipped = row.skipped ?? 0;
      if (fetched != null && row.likelyFire != null && row.likelyFire !== fetched) {
        parts.push(`${label} +${inserted}/${row.likelyFire} likely (${fetched} scanned)`);
      } else if (fetched != null && inserted === 0 && skipped > 0) {
        parts.push(`${label} ${fetched} ok (${skipped} dup)`);
      } else if (fetched != null) {
        parts.push(`${label} +${inserted}/${fetched}`);
      } else {
        parts.push(`${label} +${inserted}${skipped ? ` (${skipped} dup)` : ''}`);
      }
    }
  }
  return parts.join(' · ');
}

async function refreshDisasters() {
  const startedAt = Date.now();
  const qp = new URLSearchParams();
  if ($('#skipFemaCheck').is(':checked')) qp.set('skipFema', '1');

  const pullSteps = [
    { pct: 12, msg: 'Pulling FEMA disaster declarations…' },
    { pct: 28, msg: 'Pulling NASA FIRMS wildfire detections…' },
    { pct: 44, msg: 'Pulling USGS earthquake feed…' },
    { pct: 60, msg: 'Pulling NOAA/NWS weather alerts…' },
    { pct: 76, msg: 'Pulling NHC tropical alerts…' },
    { pct: 88, msg: 'Refreshing impact graph…' },
  ];
  let stepIdx = 0;

  showLoadingOverlay(pullSteps[0].msg, pullSteps[0].pct);
  setPullButtonsBusy(true);
  setDuPullProgress(pullSteps[0].msg, pullSteps[0].pct);
  setDashboardStatus('Pulling FEMA, FIRMS, USGS, NWS, and NHC — this can take a few minutes.', 'info');
  const subtitle = document.getElementById('loadingIngestSubtitle');
  if (subtitle) subtitle.textContent = 'FEMA · NASA FIRMS · USGS · NWS · NHC';

  const progressTimer = setInterval(() => {
    stepIdx = Math.min(stepIdx + 1, pullSteps.length - 1);
    updateLoadingStatusDisaster(pullSteps[stepIdx].msg, pullSteps[stepIdx].pct);
    setDuPullProgress(pullSteps[stepIdx].msg, pullSteps[stepIdx].pct);
  }, 12000);

  try {
    console.log('🔄 Pulling all disaster sources...');
    const { postDisasterRefresh } = await import('/shared/disaster-refresh-client.js');
    const { resp: refreshResp, json: refreshJson } = await postDisasterRefresh('/api/disasters/refresh', {
      searchParams: qp,
    });
    console.log('🔄 Pull all sources response:', refreshJson);

    if (!refreshResp.ok || !refreshJson?.success) {
      const err = refreshJson?.error || refreshJson?.details || `HTTP ${refreshResp.status}`;
      throw new Error(err);
    }

    if (refreshJson.data?.fema?.error) {
      console.warn('FEMA ingest error during combined pull:', refreshJson.data.fema.error);
    }

    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    const summary = formatIngestSummary(refreshJson.data);
    updateLoadingStatusDisaster('Reloading grid from database…', 92);
    setDuPullProgress(`${summary} (${elapsedSec}s)`, 92);
    const femaFetched = refreshJson.data?.fema?.fetched;
    const statusMsg = femaFetched != null
      ? `All sources pulled in ${elapsedSec}s. FEMA: ${femaFetched} declarations. ${summary}`
      : `All sources pulled in ${elapsedSec}s. ${summary}`;
    setDashboardStatus(statusMsg, refreshJson.data?.fema?.error ? 'warning' : 'success');

    await refreshSourceStatsFromApi();

    const firmsResult = refreshJson.data?.firms;
    if (firmsResult && !firmsResult.error && (firmsResult.prepared > 0 || firmsResult.likelyFire > 0)) {
      ensureUnifiedSourceSelected('firms');
    }

    if (typeof duCountyIntelLoaded !== 'undefined' && duCountyIntelLoaded) {
      await loadDisasters();
      hideLoadingOverlay();
      setDuPullProgress('', null, { visible: false });
    } else {
      updateLoadingStatusDisaster('Complete!', 100);
      hideLoadingOverlay();
      setDuPullProgress('', null, { visible: false });
      if (!refreshJson.data?.fema?.error) {
        setDashboardStatus(`${statusMsg} Select a county on the hazard lens to view rows.`, 'success');
      }
    }

    if (window.duWebCrawlPanel?.refresh) {
      void window.duWebCrawlPanel.refresh();
    }
  } catch (error) {
    console.error('❌ Pull all sources failed:', error);
    const msg = error.message || 'Pull all sources failed';
    setDuPullProgress(msg, 100);
    setSourcePullStatus(msg, 'danger');
    setDashboardStatus(
      msg.includes('401') || msg.includes('403') || msg.includes('localhost')
        ? `${msg} — refresh requires localhost access or DISASTER_REFRESH_TOKEN on the server.`
        : msg,
      'danger',
    );
    updateLoadingStatusDisaster('Pull failed — see status banner.', 100);
    hideLoadingOverlay();
  } finally {
    clearInterval(progressTimer);
    setPullButtonsBusy(false);
    setTimeout(() => setDuPullProgress('', null, { visible: false }), 4000);
  }
}

async function getDisasterStats() {
  try {
    const res = await fetch('/api/disasters/stats');
    const json = await res.json();
    if (json.success) return json.data;
  } catch (e) {
    console.warn('Could not load disaster stats:', e);
  }
  return { bySource: [], byEvent: [], byState: [], displayedRows: disastersGridApi?.getDisplayedRowCount?.() ?? 0 };
}



window.duRefreshAllSources = refreshDisasters;
