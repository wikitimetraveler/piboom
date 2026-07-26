/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — AG Grid, risk intel, NWS filters
 * Loaded in global scope after prior scripts (see disasters-unified.html).
 */

function isDuShowNwsInGridEnabled() {
  const el = document.getElementById('duShowNwsInGrid');
  return !!el?.checked;
}

function updateNwsGridFilterUi() {
  const strip = document.getElementById('duNwsGridFilterStrip');
  const labelEl = document.getElementById('duNwsGridFilterLabel');
  if (!nwsGridFilterActive || !nwsGridFilterContext) {
    if (strip) strip.hidden = true;
    return;
  }
  const locationLabel = nwsGridFilterContext.county
    ? `${nwsGridFilterContext.county}, ${nwsGridFilterContext.state}`
    : nwsGridFilterContext.state;
  const modeLabel =
    nwsGridFilterContext.filterMode === 'nws-only' ? 'NWS alerts only' : 'all sources in area';
  if (labelEl) labelEl.textContent = `${locationLabel || 'selected area'} (${modeLabel})`;
  if (strip) strip.hidden = false;
}

function refreshNwsGridExternalFilter() {
  if (!disastersGridApi) return;
  if (typeof disastersGridApi.onFilterChanged === 'function') {
    disastersGridApi.onFilterChanged();
  } else if (typeof disastersGridApi.refreshClientSideRowModel === 'function') {
    disastersGridApi.refreshClientSideRowModel('filter');
  }
}

function applyNwsGridFilterFromSelection(disasterObj, disasterData) {
  if (!isDuShowNwsInGridEnabled()) {
    clearNwsGridFilter(false);
    return;
  }
  const context = DisasterWeatherAlertFilters.buildGridFilterContextFromDisaster(disasterObj, disasterData);
  if (!context?.state) {
    clearNwsGridFilter(false);
    return;
  }
  nwsGridFilterActive = true;
  nwsGridFilterContext = context;
  updateNwsGridFilterUi();
  refreshNwsGridExternalFilter();
}

function clearNwsGridFilter(uncheckToggle) {
  nwsGridFilterActive = false;
  nwsGridFilterContext = null;
  updateNwsGridFilterUi();
  if (uncheckToggle) {
    const toggle = document.getElementById('duShowNwsInGrid');
    if (toggle) toggle.checked = false;
  }
  refreshNwsGridExternalFilter();
}

function disastersGridExternalFilterPresent() {
  return (nwsGridFilterActive && !!nwsGridFilterContext) || timeRangeFilterHours !== null;
}

function disastersGridExternalFilterPass(node) {
  // Check NWS filter
  if (nwsGridFilterActive && !!nwsGridFilterContext) {
    if (!DisasterWeatherAlertFilters.rowPassesSelectionGridFilter(node.data, nwsGridFilterContext)) {
      return false;
    }
  }
  
  // Check time range filter
  if (timeRangeFilterHours !== null) {
    const row = node.data?.disasterObj;
    if (!row || !row.start_time) return false;
    const hoursAgo = (Date.now() - new Date(row.start_time).getTime()) / (1000 * 60 * 60);
    if (hoursAgo > timeRangeFilterHours) return false;
  }
  
  return true;
}

function htmlCellRenderer(html) {
  const wrap = document.createElement('span');
  wrap.innerHTML = html || '';
  return wrap;
}

function disasterMatchKey(r) {
  if (!r) return '';
  return `${r.source || ''}|${r.source_id || ''}|${r.start_time || ''}|${r.lat ?? r.latitude ?? ''}|${r.lng ?? r.longitude ?? ''}`;
}

function handleDisastersGridRowSelect(rowData) {
  const obj = rowData?.disasterObj;
  if (!obj) return;
  const key = disasterMatchKey(obj);
  const now = Date.now();
  if (key === lastGridSelectKey && now - lastGridSelectAt < 250) return;
  lastGridSelectKey = key;
  lastGridSelectAt = now;
  selectDisaster(null, obj);
}

function bindDisastersGridEvents(api, gridEl) {
  if (!api || !gridEl) return;

  const onRowSelect = (event) => {
    if (event?.event?.target?.closest('button')) return;
    handleDisastersGridRowSelect(event.data);
  };

  if (typeof api.addEventListener === 'function') {
    api.addEventListener('rowClicked', onRowSelect);
  } else if (typeof api.setGridOption === 'function') {
    api.setGridOption('onRowClicked', onRowSelect);
  }

  gridEl.addEventListener('click', (domEvent) => {
    if (domEvent.target.closest('button, .ag-header, .ag-floating-filter, .ag-paging-panel, .ag-header-row')) return;
    const rowEl = domEvent.target.closest('.ag-row:not(.ag-header-row)');
    if (!rowEl || !api) return;
    const rowIndex = Number(rowEl.getAttribute('row-index'));
    if (Number.isNaN(rowIndex)) return;
    let rowNode = null;
    if (typeof api.getDisplayedRowAtIndex === 'function') {
      rowNode = api.getDisplayedRowAtIndex(rowIndex);
    }
    if (rowNode?.data?.disasterObj) {
      handleDisastersGridRowSelect(rowNode.data);
    }
  });

  const refreshGridLayout = () => refreshDisastersGridLayout();
  ['collapseDisasters', 'collapseMapYouTube'].forEach((id) => {
    document.getElementById(id)?.addEventListener('shown.bs.collapse', refreshGridLayout);
  });
}

function highlightSelectedDisasterInGrid(disasterObj) {
  if (!disastersGridApi || !disasterObj) return;
  const key = disasterMatchKey(disasterObj);
  if (typeof disastersGridApi.deselectAll === 'function') {
    disastersGridApi.deselectAll();
  }
  disastersGridApi.forEachNode?.((node) => {
    if (node.data?.disasterObj && disasterMatchKey(node.data.disasterObj) === key) {
      node.setSelected?.(true);
    }
  });
}

function buildDisasterGridRow(r, allRows, idx) {
  const eventType = String(r.event_type || '').trim();
  const source = String(r.source || '').trim().toLowerCase();
  const county = String(r.county_name || '').trim();
  const state = String(r.state_abbr || '').trim();
  const startMs = r.start_time ? new Date(r.start_time).getTime() : null;
  const endMs = r.end_time ? new Date(r.end_time).getTime() : null;
  const title = String(r.title || '').trim().replace(/\s+/g, ' ');
  const icon = getEventIcon(eventType);
  const eventLabel = icon && eventType
    ? `<span class="event-icon">${icon}</span>${eventType}`
    : (eventType || '');
  const riskScore = calculateDisasterRiskScore(r, allRows);
  const isCamera = eventType === 'camera' || source === 'alertcalifornia'
    || (title && title.toLowerCase().includes('camera'));
  let cameraDataKey = '';
  if (isCamera) {
    cameraDataKey = `camera_grid_${idx}_${Date.now()}`;
    window.cameraDataStore[cameraDataKey] = r;
  }
  let rowClasses = eventType ? [`disaster-${eventType}`] : [];
  if (r.start_time) {
    const hoursAgo = (Date.now() - new Date(r.start_time).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 24) rowClasses.push('disaster-active');
  }
  return {
    source,
    sourceLabel: source.toUpperCase(),
    eventType,
    eventLabel,
    county,
    state,
    startTime: startMs,
    endTime: endMs,
    title,
    riskScore,
    isCamera,
    cameraDataKey,
    rowClasses,
    disasterObj: r
  };
}

function initDisastersGrid() {
  const gridEl = document.getElementById('disastersGrid');
  if (!gridEl || disastersGridApi || typeof agGrid === 'undefined') return;

  const columnDefs = [
    {
      field: 'sourceLabel',
      headerName: 'Source',
      width: 110,
      filter: 'agTextColumnFilter',
      cellRenderer: (params) => htmlCellRenderer(createSourceBadgeHtml(params.data?.source))
    },
    {
      field: 'eventType',
      headerName: 'Event',
      width: 130,
      filter: 'agTextColumnFilter',
      cellRenderer: (params) => htmlCellRenderer(params.data?.eventLabel || '')
    },
    { field: 'county', headerName: 'County', minWidth: 120, flex: 1, filter: 'agTextColumnFilter' },
    { field: 'state', headerName: 'State', width: 90, filter: 'agTextColumnFilter' },
    {
      field: 'startTime',
      headerName: 'Start',
      width: 175,
      filter: 'agDateColumnFilter',
      valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString() : '')
    },
    {
      field: 'endTime',
      headerName: 'End',
      width: 175,
      filter: 'agDateColumnFilter',
      valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString() : '')
    },
    { field: 'title', headerName: 'Title', minWidth: 200, flex: 2, filter: 'agTextColumnFilter' },
    {
      field: 'riskScore',
      headerName: 'Event intensity',
      headerTooltip: 'Relative event intensity from loaded hazard data — not a loan ops triage score',
      width: 150,
      filter: 'agNumberColumnFilter',
      cellRenderer: (params) => htmlCellRenderer(getRiskBadge(params.value ?? 0))
    },
    {
      colId: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      filter: false,
      floatingFilter: false,
      cellRenderer: (params) => {
        if (!params.data?.isCamera || !params.data.cameraDataKey) return '';
        const key = params.data.cameraDataKey;
        return `<button type="button" class="btn btn-sm btn-warning camera-view-btn" data-camera-key="${key}" title="View Camera Feed">
          <i class="bi-camera-video"></i> View
        </button>`;
      }
    }
  ];

  const gridOptions = {
    columnDefs,
    defaultColDef: {
      sortable: true,
      resizable: true,
      floatingFilter: true
    },
    rowData: [],
    pagination: true,
    paginationPageSize: 25,
    paginationPageSizeSelector: [10, 25, 50, 100],
    animateRows: true,
    rowSelection: {
      mode: 'singleRow',
      enableClickSelection: true,
    },
    isExternalFilterPresent: disastersGridExternalFilterPresent,
    doesExternalFilterPass: disastersGridExternalFilterPass,
    getRowClass: (params) => (params.data?.rowClasses || []).join(' '),
    onRowClicked: (event) => {
      if (event.event?.target?.closest('button')) return;
      handleDisastersGridRowSelect(event.data);
    },
    onCellClicked: (event) => {
      if (event.column?.getColId() !== 'actions') return;
      const key = event.event?.target?.closest('[data-camera-key]')?.getAttribute('data-camera-key');
      if (key && window.openCameraViewerFromTable) {
        window.openCameraViewerFromTable(key);
      }
    }
  };

  if (typeof agGrid.createGrid === 'function') {
    disastersGridApi = agGrid.createGrid(gridEl, gridOptions);
  } else {
    new agGrid.Grid(gridEl, gridOptions);
    disastersGridApi = gridOptions.api;
  }
  bindDisastersGridEvents(disastersGridApi, gridEl);

  $('#disastersQuickFilter').on('input', function () {
    const text = $(this).val();
    if (disastersGridApi?.setGridOption) {
      disastersGridApi.setGridOption('quickFilterText', text);
    } else if (disastersGridApi?.setQuickFilter) {
      disastersGridApi.setQuickFilter(text);
    }
    maybeNudgeFirmsForQuickFilter(text);
  });
}

function maybeNudgeFirmsForQuickFilter(text) {
  const q = String(text || '').toLowerCase().trim();
  if (!q) return;
  if (!/\b(fire|wildfire|firms|hotspot)\b/.test(q)) return;
  const sources = $('#sourceInput').val() || [];
  if (sources.includes('firms')) return;
  setDashboardStatus('Enable NASA FIRMS for active fire hotspots — use the NASA FIRMS source chip above.', 'info');
}

function buildEncompassLoanGridRow(loan) {
  const riskLevel = getRiskLevel(loan.disaster_risk_score);
  const riskClass = getRiskClass(loan.disaster_risk_score);
  const distanceKm = DisasterLoanFilters.getDistanceValue(loan, selectedDisasterObj, selectedDisasterRow);
  return {
    loan_number: loan.loan_number,
    borrower_name: loan.borrower_name,
    property_address: loan.property_address,
    cityState: `${loan.city || ''}, ${loan.state || ''}`,
    county: loan.county || '',
    loan_amountDisplay: `$${loan.loan_amount ? loan.loan_amount.toLocaleString() : '0'}`,
    milestone: loan.milestone,
    riskBadge: `<span class="badge ${riskClass}">${riskLevel}</span>`,
    distanceKm: Number.isFinite(distanceKm) ? distanceKm : 999999,
    distanceHtml: DisasterLoanFilters.formatDistance(loan, selectedDisasterObj, selectedDisasterRow),
    encompass_loan_guid: loan.encompass_loan_guid || 'Not assigned',
    lastAnalysis: loan.last_risk_analysis
      ? new Date(loan.last_risk_analysis).toLocaleDateString()
      : 'Not analyzed',
    loanObj: loan
  };
}

function initEncompassLoansGrid() {
  const gridEl = document.getElementById('encompassLoansGrid');
  if (!gridEl || encompassLoansGridApi || typeof agGrid === 'undefined') return;

  const columnDefs = [
    { field: 'loan_number', headerName: 'Loan #', width: 110, filter: 'agTextColumnFilter' },
    { field: 'borrower_name', headerName: 'Borrower', minWidth: 140, flex: 1, filter: 'agTextColumnFilter' },
    { field: 'property_address', headerName: 'Address', minWidth: 160, flex: 1, filter: 'agTextColumnFilter' },
    { field: 'cityState', headerName: 'City, State', width: 130, filter: 'agTextColumnFilter' },
    { field: 'county', headerName: 'County', width: 120, filter: 'agTextColumnFilter' },
    { field: 'loan_amountDisplay', headerName: 'Amount', width: 110, filter: 'agTextColumnFilter' },
    { field: 'milestone', headerName: 'Milestone', width: 120, filter: 'agTextColumnFilter' },
    {
      field: 'riskBadge',
      headerName: 'Ops triage',
      headerTooltip: 'FEMA declarations + flood zone weights (0–15) — not a loss probability',
      width: 120,
      filter: 'agTextColumnFilter',
      cellRenderer: (params) => htmlCellRenderer(params.value)
    },
    {
      field: 'distanceKm',
      headerName: 'Live /near',
      headerTooltip: 'Distance from live GET /api/disasters/near — not graph NEAR edges',
      width: 120,
      filter: 'agNumberColumnFilter',
      cellRenderer: (params) => htmlCellRenderer(params.data?.distanceHtml || '')
    },
    { field: 'encompass_loan_guid', headerName: 'GUID', width: 120, filter: 'agTextColumnFilter' },
    { field: 'lastAnalysis', headerName: 'Last analysis', width: 120, filter: 'agTextColumnFilter' }
  ];

  const gridOptions = {
    columnDefs,
    defaultColDef: {
      sortable: true,
      resizable: true,
      floatingFilter: true
    },
    rowData: [],
    pagination: true,
    paginationPageSize: 10,
    paginationPageSizeSelector: [10, 25, 50],
    animateRows: true,
    rowSelection: {
      mode: 'singleRow',
      enableClickSelection: true,
    },
    onRowClicked: (event) => {
      const loan = event.data?.loanObj;
      if (!loan) return;
      selectedLoan = loan;
      cameraLoadContext = 'loan';
      if (encompassLoansGridApi?.deselectAll) encompassLoansGridApi.deselectAll();
      if (event.node?.setSelected) event.node.setSelected(true);
      loadNearbyCamerasForLoan(loan);
      refreshAIOnSelection();
      if (loan.latitude && loan.longitude && map) {
        const pos = { lat: parseFloat(loan.latitude), lng: parseFloat(loan.longitude) };
        map.setCenter(pos);
        map.setZoom(10);
      }
    }
  };

  if (typeof agGrid.createGrid === 'function') {
    encompassLoansGridApi = agGrid.createGrid(gridEl, gridOptions);
  } else {
    new agGrid.Grid(gridEl, gridOptions);
    encompassLoansGridApi = gridOptions.api;
  }
  bindEncompassLoansGridEvents(encompassLoansGridApi, gridEl);

  $('#loansQuickFilter').on('input', function () {
    const text = $(this).val();
    if (encompassLoansGridApi?.setGridOption) {
      encompassLoansGridApi.setGridOption('quickFilterText', text);
    } else if (encompassLoansGridApi?.setQuickFilter) {
      encompassLoansGridApi.setQuickFilter(text);
    }
  });
}

function setEncompassLoansGridRows(rows) {
  if (!encompassLoansGridApi) initEncompassLoansGrid();
  if (!encompassLoansGridApi) return;
  if (typeof encompassLoansGridApi.setGridOption === 'function') {
    encompassLoansGridApi.setGridOption('rowData', rows);
  } else if (typeof encompassLoansGridApi.setRowData === 'function') {
    encompassLoansGridApi.setRowData(rows);
  }
  refreshEncompassLoansGridLayout();
}

function setDisastersGridRows(rows) {
  if (!disastersGridApi) initDisastersGrid();
  if (!disastersGridApi) return;
  if (typeof disastersGridApi.setGridOption === 'function') {
    disastersGridApi.setGridOption('rowData', rows);
  } else if (typeof disastersGridApi.setRowData === 'function') {
    disastersGridApi.setRowData(rows);
  }
}

function refreshDisastersGridLayout() {
  if (!disastersGridApi) return;
  if (typeof disastersGridApi.sizeColumnsToFit === 'function') {
    disastersGridApi.sizeColumnsToFit();
  }
  if (map && typeof google !== 'undefined' && google.maps?.event) {
    google.maps.event.trigger(map, 'resize');
  }
}

function bindEncompassLoansGridEvents(api, gridEl) {
  if (!api || !gridEl) return;
  const onLoanRowSelect = (event) => {
    const loan = event?.data?.loanObj;
    if (!loan) return;
    selectedLoan = loan;
    cameraLoadContext = 'loan';
    if (api.deselectAll) api.deselectAll();
    if (event.node?.setSelected) event.node.setSelected(true);
    loadNearbyCamerasForLoan(loan);
    refreshAIOnSelection();
    if (loan.latitude && loan.longitude && map) {
      map.setCenter({ lat: parseFloat(loan.latitude), lng: parseFloat(loan.longitude) });
      map.setZoom(10);
    }
  };
  if (typeof api.addEventListener === 'function') {
    api.addEventListener('rowClicked', onLoanRowSelect);
  }
  gridEl.addEventListener('click', (domEvent) => {
    if (domEvent.target.closest('button, .ag-header, .ag-floating-filter, .ag-paging-panel, .ag-header-row')) return;
    const rowEl = domEvent.target.closest('.ag-row:not(.ag-header-row)');
    if (!rowEl || !api) return;
    const rowIndex = Number(rowEl.getAttribute('row-index'));
    if (Number.isNaN(rowIndex)) return;
    const rowNode = typeof api.getDisplayedRowAtIndex === 'function'
      ? api.getDisplayedRowAtIndex(rowIndex)
      : null;
    if (rowNode?.data?.loanObj) {
      onLoanRowSelect({ data: rowNode.data, node: rowNode });
    }
  });
  document.getElementById('collapseLoans')?.addEventListener('shown.bs.collapse', refreshEncompassLoansGridLayout);
}

function calculateDisasterRiskScore(disaster, allDisasters) {
  let score = 0;
  const state = disaster.state_abbr || '';
  const county = disaster.county_name || '';
  
  if (!state && !county) return 0;
  
  // Count disasters in same county/state from all sources
  const relatedDisasters = allDisasters.filter(d => 
    (d.state_abbr === state && d.county_name === county) ||
    (d.state_abbr === state && !d.county_name)
  );
  
  // Base score: number of disasters in area
  score += Math.min(relatedDisasters.length * 0.5, 5);
  
  // Source-specific risk weights
  const sourceWeights = {
    'fema': 2.0,        // FEMA declarations are significant
    'firms': 1.5,       // Active fires are high risk
    'usgs': 1.5,        // Earthquakes are high risk
    'alertcalifornia': 0.5, // Cameras are monitoring tools (lower risk weight)
    'nhc': 2.5,         // Hurricanes are very high risk
    'nws': 1.0,         // Weather warnings
    'floodzones': 1.0   // Flood zones add risk
  };
  
  // Add risk based on source
  const sourceWeight = sourceWeights[disaster.source] || 1.0;
  score += sourceWeight;
  
  // Recency bonus (more recent = higher risk)
  if (disaster.start_time) {
    const daysAgo = (Date.now() - new Date(disaster.start_time).getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo < 7) score += 2;      // Last week
    else if (daysAgo < 30) score += 1; // Last month
    else if (daysAgo < 90) score += 0.5; // Last 90 days
  }
  
  // Event type risk
  const eventType = (disaster.event_type || '').toLowerCase();
  if (eventType.includes('hurricane') || eventType.includes('tornado')) score += 2;
  else if (eventType.includes('wildfire') || eventType.includes('fire')) score += 1.5;
  else if (eventType.includes('earthquake')) score += 1.5;
  else if (eventType.includes('flood')) score += 1;
  
  // Flood zone specific risk
  if (disaster.flood_zone) {
    const fz = disaster.flood_zone.toUpperCase();
    if (fz.startsWith('A') || fz.startsWith('V')) score += 2;
    else if (fz.includes('X')) score += 0.5;
  }
  
  // High risk count from flood zones
  if (disaster.high_risk_count && disaster.high_risk_count > 0) {
    score += Math.min(disaster.high_risk_count * 0.1, 2);
  }
  
  return Math.min(Math.round(score * 10) / 10, 15); // Cap at 15
}

function getRiskBadge(score) {
  if (score === 0) return '<span class="risk-badge risk-low">None</span>';
  if (score < 3) return `<span class="risk-badge risk-low">Low (${score.toFixed(1)})</span>`;
  if (score < 6) return `<span class="risk-badge risk-medium">Moderate (${score.toFixed(1)})</span>`;
  if (score < 10) return `<span class="risk-badge risk-high">High (${score.toFixed(1)})</span>`;
  return `<span class="risk-badge risk-critical">Critical (${score.toFixed(1)})</span>`;
}

function formatDominantEventType(eventType) {
  const et = String(eventType || '').trim().toLowerCase();
  if (!et) return '—';
  if (et.includes('wildfire') || et === 'fire') return 'Wildfire';
  if (et.includes('earthquake')) return 'Earthquake';
  if (et.includes('hurricane') || et.includes('tornado')) return 'Storm';
  if (et.includes('flood')) return 'Flood';
  if (et.includes('severe')) return 'Severe';
  if (et === 'camera') return 'Camera';
  return et.charAt(0).toUpperCase() + et.slice(1);
}

function hotspotKeyForRow(row) {
  const state = String(row.state || row.state_abbr || '').trim().toUpperCase();
  const county = String(row.county || row.county_name || '').trim();
  if (!state) return '';
  return county ? `${county}|${state}` : `*|${state}`;
}

function aggregateRiskHotspots(gridRows) {
  const map = new Map();
  (gridRows || []).forEach((row) => {
    if (!row || row.isCamera) return;
    const state = String(row.state || '').trim().toUpperCase();
    if (!state) return;
    const county = String(row.county || '').trim();
    const key = hotspotKeyForRow(row);
    let agg = map.get(key);
    if (!agg) {
      agg = {
        key,
        state,
        county,
        eventCount: 0,
        peakRisk: 0,
        dominantTypes: {},
        topRow: null
      };
      map.set(key, agg);
    }
    agg.eventCount += 1;
    const risk = Number(row.riskScore) || 0;
    agg.peakRisk = Math.max(agg.peakRisk, risk);
    const et = String(row.eventType || 'other').toLowerCase();
    agg.dominantTypes[et] = (agg.dominantTypes[et] || 0) + 1;
    if (!agg.topRow || risk > (agg.topRow.riskScore || 0)) {
      agg.topRow = row;
    }
  });
  return [...map.values()]
    .map((agg) => {
      const dominantEntry = Object.entries(agg.dominantTypes).sort((a, b) => b[1] - a[1])[0];
      return {
        key: agg.key,
        state: agg.state,
        county: agg.county,
        eventCount: agg.eventCount,
        peakRisk: agg.peakRisk,
        dominantType: dominantEntry ? dominantEntry[0] : '',
        topRow: agg.topRow
      };
    })
    .sort((a, b) => b.peakRisk - a.peakRisk || b.eventCount - a.eventCount)
    .slice(0, 10);
}

function getTopRiskEvents(gridRows, limit = 8) {
  return (gridRows || [])
    .filter((row) => row && !row.isCamera)
    .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0) || (b.startTime || 0) - (a.startTime || 0))
    .slice(0, limit);
}

function renderRiskIntelligencePanel(gridRows) {
  const hotspots = aggregateRiskHotspots(gridRows);
  const topEvents = getTopRiskEvents(gridRows);
  const tbody = document.getElementById('duHotspotTableBody');
  const topList = document.getElementById('duTopEventsList');
  const legend = document.getElementById('duRiskMapLegend');

  if (tbody) {
    if (!hotspots.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-muted small">No geocoded events in the current load — widen sources or filters.</td></tr>';
    } else {
      tbody.innerHTML = hotspots.map((h) => {
        const location = h.county
          ? `${h.county}, ${h.state}`
          : `${h.state} (statewide)`;
        const active = activeHotspotKey === h.key ? ' du-hotspot-row--active' : '';
        return `<tr class="du-hotspot-row${active}" data-hotspot-key="${h.key}" tabindex="0" role="button" aria-label="Filter to ${location}">
          <td><strong>${location}</strong></td>
          <td class="text-end">${h.eventCount}</td>
          <td class="text-end">${getRiskBadge(h.peakRisk)}</td>
          <td>${formatDominantEventType(h.dominantType)}</td>
        </tr>`;
      }).join('');
    }
  }

  if (topList) {
    if (!topEvents.length) {
      topList.innerHTML = '<p class="text-muted small mb-0">No events to rank yet.</p>';
    } else {
      topList.innerHTML = topEvents.map((row) => {
        const loc = [row.county, row.state].filter(Boolean).join(', ');
        const title = row.title || row.eventType || 'Event';
        return `<button type="button" class="du-top-event-item" data-event-title="${title.replace(/"/g, '&quot;')}">
          <span class="du-top-event-title">${title}</span>
          <span class="du-top-event-meta text-muted">${loc} · ${getRiskBadge(row.riskScore || 0)}</span>
        </button>`;
      }).join('');
      topList.querySelectorAll('.du-top-event-item').forEach((btn, idx) => {
        btn.addEventListener('click', () => {
          const row = topEvents[idx];
          if (row?.disasterObj) selectDisaster(null, row.disasterObj);
        });
      });
    }
  }

  if (legend) {
    legend.hidden = !gridRows || gridRows.length === 0;
  }

  document.querySelectorAll('.du-hotspot-row').forEach((tr) => {
    tr.addEventListener('click', () => {
      const key = tr.getAttribute('data-hotspot-key');
      const hotspot = hotspots.find((h) => h.key === key);
      if (hotspot) applyHotspotSelection(hotspot);
    });
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tr.click();
      }
    });
  });
}

function updateHotspotFilterUi() {
  const badge = document.getElementById('duHotspotFilterBadge');
  if (!activeHotspot) {
    if (badge) {
      badge.hidden = true;
      badge.textContent = '';
      badge.removeAttribute('title');
      badge.removeAttribute('role');
      badge.removeAttribute('tabindex');
    }
    return;
  }
  const locationLabel = activeHotspot.county
    ? `${activeHotspot.county}, ${activeHotspot.state}`
    : activeHotspot.state;
  if (badge) {
    badge.textContent = locationLabel;
    badge.hidden = false;
    badge.title = 'Clear location filter';
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
  }
}

function initHotspotFilterBadge() {
  const badge = document.getElementById('duHotspotFilterBadge');
  if (!badge || badge.dataset.clearBound) return;
  badge.dataset.clearBound = '1';
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    clearHotspotGridFilter();
  });
  badge.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      clearHotspotGridFilter();
    }
  });
}

function applyHotspotGridFilter(hotspot) {
  if (!disastersGridApi || !hotspot) return;
  const model = { state: {
    filterType: 'text',
    type: 'equals',
    filter: hotspot.state
  } };
  if (hotspot.county) {
    model.county = {
      filterType: 'text',
      type: 'contains',
      filter: hotspot.county
    };
  }
  if (typeof disastersGridApi.setFilterModel === 'function') {
    disastersGridApi.setFilterModel(model);
  } else if (disastersGridApi.setGridOption) {
    disastersGridApi.setGridOption('filterModel', model);
  }
  activeHotspotKey = hotspot.key;
  activeHotspot = hotspot;
  updateHotspotFilterUi();
  renderRiskIntelligencePanel(lastGridRows);
}

function clearHotspotGridFilter() {
  activeHotspotKey = null;
  activeHotspot = null;
  updateHotspotFilterUi();
  if (disastersGridApi?.setFilterModel) {
    disastersGridApi.setFilterModel(null);
  } else if (disastersGridApi?.setGridOption) {
    disastersGridApi.setGridOption('filterModel', null);
  }
  renderRiskIntelligencePanel(lastGridRows);
  setDashboardStatus('Location filter cleared.', 'info');
}

function applyHotspotSelection(hotspot) {
  if (!hotspot) return;
  $('#stateInput').val(hotspot.state);
  $('#countyInput').val(hotspot.county || '');
  applyHotspotGridFilter(hotspot);

  const locationLabel = hotspot.county
    ? `${hotspot.county}, ${hotspot.state}`
    : hotspot.state;
  setDashboardStatus(`Filtered to ${locationLabel} — loading loans for this area.`, 'info');

  openDuDashboardSection('collapseLoans', 4);

  if (hotspot.topRow?.disasterObj) {
    selectDisaster(null, hotspot.topRow.disasterObj);
    return;
  }

  showMockedLoansWorkspace();
  openDuDashboardSection('collapseLoans', 4);
  $('#duLoanScopeMode').val('county');
  syncDuLoanRadiusControls();
  loadLoansForDisaster(
    { state_abbr: hotspot.state, county_name: hotspot.county, title: locationLabel },
    null
  );
}

function renderTable(rows) {
  lastLoadedDisasterRows = rows || [];
  const seen = new Set();
  const uniqueRows = rows.filter((r) => {
    const key = `${r.source || ''}_${r.source_id || ''}_${r.start_time || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const gridRows = uniqueRows.map((r, idx) => buildDisasterGridRow(r, uniqueRows, idx));
  lastGridRows = gridRows;
  setDisastersGridRows(gridRows);
  updateStats(rows);
  renderRiskIntelligencePanel(gridRows);

  if (disastersGridApi?.applyColumnState) {
    disastersGridApi.applyColumnState({
      state: [
        { colId: 'riskScore', sort: 'desc', sortIndex: 0 },
        { colId: 'startTime', sort: 'desc', sortIndex: 1 }
      ],
      defaultState: { sort: null }
    });
  }
  if (disastersGridExternalFilterPresent()) {
    refreshNwsGridExternalFilter();
  }
}

function updateStats(rows) {
  const total = rows.length;
  const fires = rows.filter(r => r.event_type?.toLowerCase() === 'wildfire').length;
  const quakes = rows.filter(r => r.event_type?.toLowerCase() === 'earthquake').length;
  const counties = new Set(rows.filter(r => r.county_name).map(r => `${r.county_name}, ${r.state_abbr}`)).size;

  renderSourceDeckCounts(rows);
  void refreshSourceStatsFromApi();

  $('#totalDisasters').text(total).css('animation', 'none').offset().offset; // Trigger reflow
  $('#activeFires').text(fires);
  $('#earthquakes').text(quakes);
  $('#affectedCounties').text(counties);

  animateNumber('#totalDisasters', total);
  animateNumber('#activeFires', fires);
  animateNumber('#earthquakes', quakes);
  animateNumber('#affectedCounties', counties);
}

function animateNumber(selector, target) {
  const $el = $(selector);
  const raw = $el.text().trim();
  const current = raw === '—' ? 0 : (parseInt(raw, 10) || 0);
  if (target === 0 && !$el.closest('.du-stats-row--placeholder').length) {
    $el.text(target);
    return;
  }
  const duration = 1000;
  const steps = 30;
  const increment = (target - current) / steps;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    const value = Math.round(current + (increment * step));
    $el.text(value);
    if (step >= steps) {
      clearInterval(timer);
      $el.text(target);
    }
  }, duration / steps);
}
