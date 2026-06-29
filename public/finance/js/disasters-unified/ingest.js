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
  updateLoadingStatusDisaster(allRows.length ? 'Rendering disaster data...' : 'No disasters found. Check filters.', allRows.length ? 80 : 100);
  renderTable(allRows);
  renderMap(allRows);
  updateStats(allRows);
  updateLoadingStatusDisaster('Complete!', 100);
  updateFirmsDeferredAlert();
  hideLoading();
}

async function loadDisasters() {
  showLoading();
  setDashboardStatus('');
  activeHotspotKey = null;
  activeHotspot = null;
  updateHotspotFilterUi();
  updateLoadingStatusDisaster('Loading disaster data...', 10);

  const { state, county, sources, events } = readDisasterFilterInputs();

  if (sources.length === 0) {
    setDashboardStatus('Select at least one source in the command deck or Filters.', 'warning');
    finishDisastersLoad([]);
    return;
  }

  let allRows = [];

  const dbSources = sources.filter(s => s !== 'floodzones' && s !== 'alertcalifornia');
  const needsDb = dbSources.length > 0;

  if (needsDb) {
    try {
      updateLoadingStatusDisaster('Loading disasters from database…', 28);
      const sinceIso = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
      const fetchDbSource = async (src) => {
        const qp = new URLSearchParams();
        if (state) qp.set('state', state);
        if (county) qp.set('county', county);
        qp.set('source', src);
        qp.set('since', sinceIso);
        qp.set('limit', '2000');
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
      setDashboardStatus(`Unable to load one or more disaster feeds: ${e.message}`, 'danger');
    }
  }

  if (sources.includes('floodzones')) {
    try {
      updateLoadingStatusDisaster('Loading flood zone data...', 40);
      const floodZoneRows = await loadFloodZones(state, county);
      if (floodZoneRows.length > 0) {
        allRows = allRows.concat(floodZoneRows);
      }
    } catch (e) {
      console.error('❌ Error loading flood zones:', e);
    }
  }

  allRows = applyEventTypeFilter(allRows, events);
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

function setPullButtonsBusy(busy) {
  ['refreshBtnHero', 'refreshBtn', 'duIngestPostgresBtn'].forEach((id) => {
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
      const skipped = row.skipped ?? 0;
      parts.push(`${label} +${inserted}${skipped ? ` (${skipped} dup)` : ''}`);
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

  showLoading();
  setPullButtonsBusy(true);
  setSourcePullStatus('Pulling all disaster APIs into Postgres…');
  setDashboardStatus('Pulling FEMA, FIRMS, USGS, NWS, and NHC — this can take a few minutes.', 'info');
  updateLoadingStatusDisaster(pullSteps[0].msg, pullSteps[0].pct);
  const subtitle = document.getElementById('loadingIngestSubtitle');
  if (subtitle) subtitle.textContent = 'FEMA · NASA FIRMS · USGS · NWS · NHC';

  const progressTimer = setInterval(() => {
    stepIdx = Math.min(stepIdx + 1, pullSteps.length - 1);
    updateLoadingStatusDisaster(pullSteps[stepIdx].msg, pullSteps[stepIdx].pct);
    setSourcePullStatus(pullSteps[stepIdx].msg);
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

    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    const summary = formatIngestSummary(refreshJson.data);
    updateLoadingStatusDisaster('Reloading grid from database…', 92);
    setSourcePullStatus(`${summary} (${elapsedSec}s)`);
    const ingestStatus = document.getElementById('duIngestPostgresStatus');
    if (ingestStatus) ingestStatus.textContent = `Postgres updated — ${summary}`;
    setDashboardStatus(`All sources pulled in ${elapsedSec}s. ${summary}`, 'success');

    await loadDisasters();
    await refreshSourceStatsFromApi();

    if (window.duWebCrawlPanel?.refresh) {
      void window.duWebCrawlPanel.refresh();
    }
  } catch (error) {
    console.error('❌ Pull all sources failed:', error);
    const msg = error.message || 'Pull all sources failed';
    setSourcePullStatus(msg, 'danger');
    const ingestStatus = document.getElementById('duIngestPostgresStatus');
    if (ingestStatus) ingestStatus.textContent = msg;
    setDashboardStatus(
      msg.includes('401') || msg.includes('403') || msg.includes('localhost')
        ? `${msg} — refresh requires localhost access or DISASTER_REFRESH_TOKEN on the server.`
        : msg,
      'danger',
    );
    updateLoadingStatusDisaster('Pull failed — see status banner.', 100);
    hideLoading();
  } finally {
    clearInterval(progressTimer);
    setPullButtonsBusy(false);
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
