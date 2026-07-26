/**
 * Development work by David Lane
 */
/**
 * Unified Disasters dashboard — grid, map, ingest, AI, and selection cascade.
 * Loaded by public/finance/disasters-unified.html.
 */

      let disastersGridApi = null;
      let map, markers = [], disasterMarkerEntries = [], loanMarkers = [];
      let activeDisasterInfoWindow = null;
      let lastGridSelectKey = '';
      let lastGridSelectAt = 0;
      let encompassLoansGridApi = null;
      let selectedDisaster = null;
      let youtubeBrowserApiKey = null;
      let youtubeBrowserApiKeyPromise = null;
      let selectedDisasterObj = null;
      let selectedDisasterRow = null;
      let selectedLoan = null;
      let cameraMarkers = [];
      let cameraLoadContext = 'disaster';
      let lastAffectedLoans = [];
      let lastLoanFilterMeta = null;
      let lastNearbyCameras = [];
      let lastNearbyWeatherAlerts = [];
      let nwsGridFilterActive = false;
      let nwsGridFilterContext = null;
      let timeRangeFilterHours = null;
      let aiChatWidget = null;
      let aiInsightsCard = null;
      let voiceRecognition = null;
      let isVoiceListening = false;
      let lastGridRows = [];
      let lastLoadedDisasterRows = [];
      let activeHotspotKey = null;
      let activeHotspot = null;
      let heygenStudio = null;

      function clearCameraMarkers() {
        cameraMarkers.forEach((entry) => entry.marker && entry.marker.setMap(null));
        cameraMarkers = [];
      }

      function renderNearbyCamerasUI(cameras, meta) {
        const subtitle = DisasterCameraFilters.formatCameraFilterSubtitle(meta, cameras.length);
        $('#duNearbyCamerasSubtitle').text(subtitle);
        const emptyMsg = meta.hasGeo === false
          ? 'No coordinates for distance filter — showing county/state matches if available.'
          : `No cameras within ${meta.radiusMiles || DisasterLoanFilters.DEFAULT_RADIUS_MILES} mi of this location.`;
        $('#duNearbyCamerasList').html(
          DisasterCameraFilters.buildNearbyCamerasListHtml(cameras, emptyMsg)
        );
        const camerasCard = document.getElementById('duNearbyCamerasCard');
        const camerasIdle = document.getElementById('duNearbyCamerasIdle');
        if (camerasCard) {
          camerasCard.style.display = '';
          camerasCard.hidden = false;
        }
        if (camerasIdle) camerasIdle.hidden = true;
        clearCameraMarkers();
        if (map) {
          DisasterCameraFilters.addCameraMarkersToMap(map, cameras, cameraMarkers);
        }
        lastNearbyCameras = cameras;
        updateSelectionContextStrip();
        refreshAIContext();
      }

      async function loadNearbyCamerasForDisaster(disasterObj, disasterData) {
        cameraLoadContext = 'disaster';
        const radiusMiles = DisasterLoanFilters.getSelectedRadiusMiles('duLoanRadiusMiles', 'duLoanRadiusCustom');
        const req = DisasterCameraFilters.buildDisasterCameraRequest(disasterObj, disasterData, radiusMiles);
        try {
          const { cameras, meta } = await DisasterCameraFilters.fetchNearbyCameras(req.center, {
            ...req.options,
            radiusMiles
          });
          meta.hasGeo = !!req.center;
          meta.radiusMiles = req.center ? radiusMiles : null;
          renderNearbyCamerasUI(cameras, meta);
        } catch (err) {
          console.error('Error loading nearby cameras:', err);
          $('#duNearbyCamerasSubtitle').text('Failed to load cameras');
          $('#duNearbyCamerasList').html('<p class="text-danger small mb-0">Could not load fire cameras.</p>');
        }
      }

      async function loadNearbyCamerasForLoan(loan) {
        cameraLoadContext = 'loan';
        const radiusMiles = DisasterLoanFilters.getSelectedRadiusMiles('duLoanRadiusMiles', 'duLoanRadiusCustom');
        const req = DisasterCameraFilters.buildLoanCameraRequest(loan, radiusMiles);
        try {
          const { cameras, meta } = await DisasterCameraFilters.fetchNearbyCameras(req.center, {
            ...req.options,
            radiusMiles
          });
          meta.hasGeo = !!req.center;
          meta.radiusMiles = req.center ? radiusMiles : null;
          renderNearbyCamerasUI(cameras, meta);
        } catch (err) {
          console.error('Error loading cameras for loan:', err);
        }
      }

      function refreshNearbyCameras() {
        if (cameraLoadContext === 'loan' && selectedLoan) {
          loadNearbyCamerasForLoan(selectedLoan);
        } else if (selectedDisasterObj || selectedDisasterRow) {
          loadNearbyCamerasForDisaster(selectedDisasterObj, selectedDisasterRow);
        }
      }

      function renderNearbyWeatherAlertsUI(alerts, meta) {
        const subtitle = DisasterWeatherAlertFilters.formatWeatherAlertFilterSubtitle(meta, alerts.length);
        $('#duNearbyWeatherAlertsSubtitle').text(subtitle);
        const emptyMsg = meta.hasGeo === false
          ? 'No coordinates for distance filter — showing NWS alerts for county/state if available.'
          : `No NOAA/NWS alerts within ${meta.radiusMiles || DisasterLoanFilters.DEFAULT_RADIUS_MILES} mi of this location.`;
        $('#duNearbyWeatherAlertsList').html(
          DisasterWeatherAlertFilters.buildNearbyWeatherAlertsListHtml(alerts, emptyMsg)
        );
        const alertsCard = document.getElementById('duNearbyWeatherAlertsCard');
        const alertsIdle = document.getElementById('duNearbyWeatherAlertsIdle');
        if (alertsCard) {
          alertsCard.style.display = '';
          alertsCard.hidden = false;
        }
        if (alertsIdle) alertsIdle.hidden = true;
        lastNearbyWeatherAlerts = alerts;
        updateSelectionContextStrip();
        refreshAIContext();
      }

      async function loadNearbyWeatherAlertsForDisaster(disasterObj, disasterData) {
        const scopeMode = $('#duLoanScopeMode').val() || 'distance';
        const radiusMiles = DisasterLoanFilters.getSelectedRadiusMiles('duLoanRadiusMiles', 'duLoanRadiusCustom');
        const req = DisasterWeatherAlertFilters.buildDisasterWeatherAlertRequest(
          disasterObj,
          disasterData,
          radiusMiles,
          lastLoadedDisasterRows,
          scopeMode
        );
        try {
          const { alerts, meta } = await DisasterWeatherAlertFilters.fetchNearbyWeatherAlerts(req.center, {
            ...req.options,
            radiusMiles: req.center ? radiusMiles : null,
            scopeMode
          });
          meta.hasGeo = !!req.center && scopeMode === 'distance';
          meta.radiusMiles = req.center && scopeMode === 'distance' ? radiusMiles : null;
          renderNearbyWeatherAlertsUI(alerts, meta);
        } catch (err) {
          console.error('Error loading nearby weather alerts:', err);
          $('#duNearbyWeatherAlertsSubtitle').text('Failed to load weather alerts');
          $('#duNearbyWeatherAlertsList').html('<p class="text-danger small mb-0">Could not load NOAA/NWS alerts.</p>');
        }
      }

      function refreshNearbyWeatherAlerts() {
        if (selectedDisasterObj || selectedDisasterRow) {
          loadNearbyWeatherAlertsForDisaster(selectedDisasterObj, selectedDisasterRow);
        }
      }

      window.selectNearbyWeatherAlert = function selectNearbyWeatherAlert(index) {
        const alert = lastNearbyWeatherAlerts[index];
        if (!alert) return;
        selectDisaster(null, alert);
      };

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
        if (labelEl) labelEl.textContent = locationLabel || 'selected area';
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
        return nwsGridFilterActive && !!nwsGridFilterContext;
      }

      function disastersGridExternalFilterPass(node) {
        if (!disastersGridExternalFilterPresent()) return true;
        return DisasterWeatherAlertFilters.rowPassesNwsGridFilter(node.data, nwsGridFilterContext);
      }

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

      function focusMapOnDisaster(disasterObj) {
        if (!map || !disasterObj) return;
        const key = disasterMatchKey(disasterObj);
        const entry = disasterMarkerEntries.find((e) => disasterMatchKey(e.row) === key);
        const lat = parseFloat(disasterObj.lat ?? disasterObj.latitude ?? disasterObj.avg_latitude);
        const lng = parseFloat(disasterObj.lng ?? disasterObj.longitude ?? disasterObj.avg_longitude);

        if (activeDisasterInfoWindow) {
          activeDisasterInfoWindow.close();
          activeDisasterInfoWindow = null;
        }

        if (entry) {
          map.setCenter(entry.marker.getPosition());
          map.setZoom(Math.max(map.getZoom() || 8, 10));
          entry.info.open(map, entry.marker);
          activeDisasterInfoWindow = entry.info;
          return;
        }

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          map.setCenter({ lat, lng });
          map.setZoom(10);
        }
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
            headerName: 'Risk Score',
            width: 140,
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
            headerName: 'Risk',
            width: 110,
            filter: 'agTextColumnFilter',
            cellRenderer: (params) => htmlCellRenderer(params.value)
          },
          {
            field: 'distanceKm',
            headerName: 'Distance',
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

      // Show/hide loading overlay
      function showLoading() {
        $('#roadRunnerLoading').removeClass('hidden');
        updateLoadingStatusDisaster('Initializing disaster monitoring...', 0);
      }

      function hideLoading() {
        setTimeout(() => {
          $('#roadRunnerLoading').addClass('hidden');
        }, 500);
      }

      function setDashboardStatus(message, variant = 'warning') {
        const el = document.getElementById('dashboardStatusBanner');
        if (!el) return;
        if (!message) {
          el.style.display = 'none';
          el.textContent = '';
          el.className = 'alert alert-warning dashboard-status-banner mt-3 mb-0';
          return;
        }
        el.className = `alert alert-${variant} dashboard-status-banner mt-3 mb-0`;
        el.textContent = message;
        el.style.display = 'block';
      }

      // Update loading status and progress
      function updateLoadingStatusDisaster(message, progress = null) {
        const statusEl = document.getElementById('loadingStatusDisaster');
        const progressBar = document.getElementById('loadingProgressBarDisaster');
        
        if (statusEl) {
          statusEl.textContent = message;
        }
        
        if (progressBar && progress !== null) {
          progressBar.style.width = `${progress}%`;
        }
      }

      $(function init() {
        import('/shared/disaster-refresh-client.js')
          .then(({ captureDisasterRefreshTokenFromUrl }) => captureDisasterRefreshTokenFromUrl())
          .catch((err) => console.warn('Disaster refresh client unavailable:', err));

        // Show loading initially (skip in shirt / booth popup demo mode)
        if (!window.__DU_POPUP_DEMO__) {
          showLoading();
        }
        
        initializeVoiceRecognition();
        initializeAIComponents().catch((err) => console.error('AI init failed:', err));
        import('/finance/js/disaster-heygen-studio.js')
          .then(({ initDisasterHeygenStudio }) =>
            initDisasterHeygenStudio({
              getBriefingContext() {
                const radiusEl = document.getElementById('radiusInput');
                const radiusMiles = radiusEl ? Number(radiusEl.value) || DisasterLoanFilters.DEFAULT_RADIUS_MILES : DisasterLoanFilters.DEFAULT_RADIUS_MILES;
                return {
                  disaster: selectedDisasterObj,
                  loanCount: lastAffectedLoans.length,
                  cameraCount: lastNearbyCameras.length,
                  radiusMiles
                };
              }
            })
          )
          .then((studio) => {
            heygenStudio = studio;
          })
          .catch((err) => console.warn('HeyGen studio unavailable:', err));
        import('/finance/js/disaster-daily-briefing-tts.js')
          .then(({ initDisasterDailyBriefingTts }) => initDisasterDailyBriefingTts())
          .catch((err) => console.warn('Daily briefing TTS unavailable:', err));
        import('/finance/js/disaster-web-crawl-panel.js')
          .then(({ initDisasterWebCrawlPanel }) => {
            window.duWebCrawlPanel = initDisasterWebCrawlPanel();
          })
          .catch((err) => console.warn('Web crawl panel unavailable:', err));
        // Initialize camera data store and functions BEFORE table is created
        window.cameraDataStore = window.cameraDataStore || {};
        
        // Global function to open camera viewer from table button (must be defined early)
        window.openCameraViewerFromTable = function(cameraDataKey) {
          console.log('📹 openCameraViewerFromTable called with key:', cameraDataKey);
          const cameraData = window.cameraDataStore[cameraDataKey];
          if (cameraData) {
            console.log('📹 Opening camera viewer from table button:', cameraData);
            if (window.showCameraViewer) {
              window.showCameraViewer(cameraData);
            } else {
              console.error('❌ showCameraViewer function not found');
              alert('Error: Camera viewer function not available');
            }
          } else {
            console.error('❌ Could not find camera data for key:', cameraDataKey);
            console.log('📹 Available keys:', Object.keys(window.cameraDataStore || {}));
          }
          return false; // Prevent default
        };
        
        // Global function to open camera viewer from marker info window
        window.openCameraViewerFromMarker = function(cameraDataKey) {
          const cameraData = window.cameraDataStore[cameraDataKey];
          if (cameraData) {
            console.log('📹 Opening camera viewer from marker:', cameraData);
            if (window.showCameraViewer) {
              window.showCameraViewer(cameraData);
            } else {
              console.error('❌ showCameraViewer function not found');
            }
          } else {
            console.error('❌ Could not find camera data for key:', cameraDataKey);
          }
        };
        
        // Initialize showCameraViewer placeholder (will be defined later, but this prevents errors)
        window.showCameraViewer = window.showCameraViewer || function(cameraData) {
          console.warn('⚠️  showCameraViewer called before definition, will retry...');
          setTimeout(() => {
            if (window.showCameraViewer && typeof window.showCameraViewer === 'function') {
              window.showCameraViewer(cameraData);
            }
          }, 100);
        };
        
        initDisastersGrid();
        initEncompassLoansGrid();
        initializeDuLoanFilterControls();
        initDisastersMap();
        syncSourceChipsFromSelect();
        $('#sourceInput').on('change', syncSourceChipsFromSelect);
        function onApplyFiltersClick() {
          syncSourceChipsFromSelect();
          loadDisasters();
        }
        $('#applyBtn, .du-apply-filters-btn').on('click', function() {
          onApplyFiltersClick();
        });
        $('#refreshBtn').on('click', refreshDisasters);
        document.getElementById('refreshBtnHero')?.addEventListener('click', refreshDisasters);
        document.getElementById('duIngestPostgresBtn')?.addEventListener('click', refreshDisasters);
        document.getElementById('duClearNwsGridFilter')?.addEventListener('click', (e) => {
          e.stopPropagation();
          clearNwsGridFilter(true);
        });
        document.getElementById('duShowNwsInGrid')?.addEventListener('change', () => {
          if (isDuShowNwsInGridEnabled() && (selectedDisasterObj || selectedDisasterRow)) {
            applyNwsGridFilterFromSelection(selectedDisasterObj, selectedDisasterRow);
          } else {
            clearNwsGridFilter(false);
          }
        });
        
        // Time range filter event listeners
        document.querySelectorAll('input[name="duTimeRange"]').forEach((radio) => {
          radio.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value === 'all') {
              timeRangeFilterHours = null;
            } else {
              const hours = {
                '24h': 24,
                '48h': 48,
                '72h': 72,
                '7d': 168,
                '30d': 720
              };
              timeRangeFilterHours = hours[value] || null;
            }
            refreshNwsGridExternalFilter();
            
            if (timeRangeFilterHours) {
              const label = value === '7d' ? 'week' : value === '30d' ? '30 days' : value.replace('h', ' hours').replace('d', ' days');
              setDashboardStatus(`Filtered to events from the last ${label}`, 'info');
            } else {
              setDashboardStatus('Showing all events (90-day window)', 'info');
            }
          });
        });
        initDuSectionCards();
        initHotspotFilterBadge();
        initDuSectionSidebar();
        if (typeof initSectionSidebarShell === 'function') {
          initSectionSidebarShell({ storageKey: 'duSectionSidebarOpen' });
        }
        initDuWorkflowPills();
        initDuLoanPillsMenu();

        refreshSourceStatsFromApi().then((dbTotal) => {
          const params = new URLSearchParams(window.location.search);
          if (params.get('pull') === '1' || params.get('ingest') === '1') {
            void refreshDisasters();
          } else if (dbTotal === 0) {
            setSourcePullStatus('Database empty — use Pull all sources for live API ingest.');
          }
        });
        loadYouTubeBrowserApiKey();
        loadDisasters();
        // Load all encompass loans on map on page load
        loadAllLoansOnMap();
      });

      function initDisastersMap() {
        const mapEl = document.getElementById('map');
        if (!mapEl) return;

        const bootMap = () => {
          if (map || typeof google === 'undefined' || !google.maps?.Map) return;
          map = new google.maps.Map(mapEl, {
            zoom: 4,
            center: { lat: 39.8, lng: -98.6 },
            mapTypeId: 'satellite'
          });
          if (lastLoadedDisasterRows.length) {
            renderMap(lastLoadedDisasterRows);
          }
          if (selectedDisasterObj) {
            focusMapOnDisaster(selectedDisasterObj);
          }
        };

        if (typeof google !== 'undefined' && google.maps?.Map) {
          bootMap();
          return;
        }

        loadYouTubeBrowserApiKey().then((apiKey) => {
          if (!apiKey) {
            console.warn('Google Maps API key not available');
            return;
          }
          if (document.querySelector('script[data-du-google-maps]')) {
            const wait = setInterval(() => {
              if (typeof google !== 'undefined' && google.maps?.Map) {
                clearInterval(wait);
                bootMap();
              }
            }, 100);
            return;
          }
          window.__duInitGoogleMap = bootMap;
          const script = document.createElement('script');
          script.dataset.duGoogleMaps = '1';
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&callback=__duInitGoogleMap`;
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
        });
      }

      function syncDuWorkflowPill(stepNum) {
        const hint = document.getElementById('workflowHint');
        if (!hint || !stepNum) return;
        hint.querySelectorAll('li').forEach((li, idx) => {
          li.classList.toggle('du-workflow-pill-active', idx + 1 === stepNum);
        });
      }

      function initDuSectionCards() {
        function updateDuSectionHeaderState(sectionId, expanded) {
          const id = String(sectionId || '').replace(/^#/, '').trim();
          const trigger = document.querySelector(
            `[data-bs-target="#${id}"], [data-bs-target="${id}"]`
          );
          if (!trigger) return;
          trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          trigger.classList.toggle('collapsed', !expanded);
        }

        function syncDuWorkflowPillLocal(stepNum) {
          syncDuWorkflowPill(stepNum);
        }

        document.querySelectorAll('.du-section-card-header[role="button"]').forEach((header) => {
          header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              header.click();
            }
          });
          header.querySelectorAll('.du-section-header-action, button, a.btn').forEach((action) => {
            action.addEventListener('click', (e) => e.stopPropagation());
          });
        });

        ['collapseCommandDeck', 'collapseRiskIntel', 'collapseLoans'].forEach((sectionId, idx) => {
          const el = document.getElementById(sectionId);
          if (!el) return;
          const step = sectionId === 'collapseLoans' ? 4 : idx + 1;
          updateDuSectionHeaderState(sectionId, el.classList.contains('show'));
          el.addEventListener('shown.bs.collapse', () => {
            updateDuSectionHeaderState(sectionId, true);
            syncDuWorkflowPillLocal(step);
            if (sectionId === 'collapseLoans') {
              setDuSectionPillActive('collapseLoans');
            }
          });
          el.addEventListener('hidden.bs.collapse', () => {
            updateDuSectionHeaderState(sectionId, false);
          });
        });

        syncDuWorkflowPill(3);
      }

      const DU_SIDEBAR_SECTION_IDS = [
        'collapseCommandDeck',
        'collapseRiskIntel',
        'collapseFilters',
        'collapseDisasters',
        'collapseMapYouTube',
        'collapseLoans',
      ];

      function duBsCollapseShow(el) {
        if (!el || typeof bootstrap === 'undefined') return;
        bootstrap.Collapse.getOrCreateInstance(el, { toggle: false }).show();
      }

      function duBsCollapseHide(el, onHidden) {
        if (!el || typeof bootstrap === 'undefined') return;
        const instance = bootstrap.Collapse.getOrCreateInstance(el, { toggle: false });
        if (onHidden) {
          el.addEventListener('hidden.bs.collapse', function handler() {
            el.removeEventListener('hidden.bs.collapse', handler);
            onHidden();
          });
        }
        instance.hide();
      }

      function getDuNavSectionForCollapse(sectionId) {
        const id = String(sectionId || '').replace(/^#/, '').trim();
        const el = document.getElementById(id);
        if (!el) return null;
        if (id === 'collapseLoans') return document.getElementById('duMockedLoansSection');
        if (id === 'collapseRiskIntel') return document.getElementById('duRiskIntelCard');
        const navSection = el.closest('.du-nav-section');
        if (navSection) return navSection;
        return el.closest('.du-section-card');
      }

      function updateDuSectionHeaderState(sectionId, expanded) {
        const id = String(sectionId || '').replace(/^#/, '').trim();
        const trigger = document.querySelector(
          `[data-bs-target="#${id}"], [data-bs-target="${id}"]`
        );
        if (!trigger) return;
        trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        trigger.classList.toggle('collapsed', !expanded);
      }

      function setDuSectionPillActive(targetId) {
        const nav = document.getElementById('duSectionSidebarNav');
        if (!nav) return;
        nav.querySelectorAll('[data-bs-target], [data-du-section-target]').forEach((link) => {
          const linkTarget =
            (link.getAttribute('data-bs-target') || link.getAttribute('data-du-section-target') || '').replace(/^#/, '');
          link.classList.toggle('active-section', linkTarget === targetId);
        });
      }

      function updateDuSectionSidebarActiveState(sectionId, isExpanded) {
        const nav = document.getElementById('duSectionSidebarNav');
        if (!nav) return;
        const id = String(sectionId || '').replace(/^#/, '').trim();
        const link = nav.querySelector(
          'a[data-bs-target="#' + id + '"], a[data-bs-target="' + id + '"], a[data-du-section-target="' + id + '"]'
        );
        if (link) {
          link.classList.toggle('active-section', isExpanded);
        }
        if (isExpanded) {
          const step = link?.getAttribute('data-du-section-step');
          if (step) syncDuWorkflowPill(Number(step));
        }
      }

      function showDuDashboardSectionCard(sectionId) {
        const id = String(sectionId || '').replace(/^#/, '').trim();
        const section = document.getElementById(id);
        if (!section || section.classList.contains('show')) return;
        const card = getDuNavSectionForCollapse(id);
        if (card) card.classList.remove('du-section-card-hidden');
        updateDuSectionHeaderState(id, true);
        duBsCollapseShow(section);
        setDuSectionPillActive(id);
      }

      function hideDuDashboardSectionCard(sectionId) {
        const id = String(sectionId || '').replace(/^#/, '').trim();
        const section = document.getElementById(id);
        if (!section || !section.classList.contains('show')) return;
        const card = getDuNavSectionForCollapse(id);
        updateDuSectionHeaderState(id, false);
        duBsCollapseHide(section, card ? function () { card.classList.add('du-section-card-hidden'); } : undefined);
        updateDuSectionSidebarActiveState(id, false);
      }

      function showExclusiveDuDashboardSection(sectionId) {
        const id = String(sectionId || '').replace(/^#/, '').trim();
        DU_SIDEBAR_SECTION_IDS.forEach((sid) => {
          if (sid !== id) hideDuDashboardSectionCard(sid);
        });
        showDuDashboardSectionCard(id);
      }

      function toggleDuDashboardSectionCard(sectionId) {
        const id = String(sectionId || '').replace(/^#/, '').trim();
        const section = document.getElementById(id);
        if (!section) return;
        const card = getDuNavSectionForCollapse(id);
        const isExpanded = section.classList.contains('show');
        if (isExpanded) {
          updateDuSectionHeaderState(id, false);
          duBsCollapseHide(section, card ? function () { card.classList.add('du-section-card-hidden'); } : undefined);
          updateDuSectionSidebarActiveState(id, false);
        } else {
          if (card) card.classList.remove('du-section-card-hidden');
          updateDuSectionHeaderState(id, true);
          duBsCollapseShow(section);
          updateDuSectionSidebarActiveState(id, true);
        }
      }

      function showDuAccordionSection(targetId, { exclusive = true } = {}) {
        const accordionIds = ['collapseFilters', 'collapseDisasters', 'collapseMapYouTube'];
        if (!accordionIds.includes(targetId) || typeof bootstrap === 'undefined') return;
        accordionIds.forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          const instance = bootstrap.Collapse.getOrCreateInstance(el, { toggle: false });
          if (id === targetId) instance.show();
          else if (exclusive) instance.hide();
        });
        const btn = document.querySelector(`[data-bs-target="#${targetId}"]`);
        if (btn) {
          btn.classList.toggle('collapsed', false);
          btn.setAttribute('aria-expanded', 'true');
        }
      }

      function revealDisasterSelectionPanels() {
        showDuDashboardSectionCard('collapseDisasters');
        showDuDashboardSectionCard('collapseMapYouTube');
        expandDuLoansSection();
        setDuSectionPillActive('collapseMapYouTube');
        syncDuWorkflowPill(3);
        setTimeout(() => {
          refreshDisastersGridLayout();
          refreshEncompassLoansGridLayout();
          document.querySelector('.du-youtube-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 200);
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

      function openDuDashboardSection(targetId, stepNum) {
        if (!targetId) return;
        const accordionIds = ['collapseFilters', 'collapseDisasters', 'collapseMapYouTube'];
        const sectionCardIds = ['collapseCommandDeck', 'collapseRiskIntel', 'collapseLoans'];
        const sectionHeadingIds = {
          collapseCommandDeck: 'headingCommandDeck',
          collapseRiskIntel: 'headingRiskIntel',
          collapseLoans: 'headingLoans',
          collapseFilters: 'headingFilters',
          collapseDisasters: 'headingDisasters',
          collapseMapYouTube: 'headingMapYouTube',
        };

        if (accordionIds.includes(targetId) || sectionCardIds.includes(targetId)) {
          DU_SIDEBAR_SECTION_IDS.forEach((sid) => {
            if (sid !== targetId) hideDuDashboardSectionCard(sid);
          });
          showDuDashboardSectionCard(targetId);
          document.getElementById(sectionHeadingIds[targetId])?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        if (targetId === 'duBottomDock') {
          document.getElementById('duBottomDock')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        setDuSectionPillActive(targetId);
        if (stepNum) syncDuWorkflowPill(Number(stepNum));
      }

      function initDuWorkflowPills() {
        document.querySelectorAll('#workflowHint [data-du-section-target]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            openDuDashboardSection(
              btn.getAttribute('data-du-section-target'),
              btn.getAttribute('data-du-section-step')
            );
          });
        });
      }

      function initDuSectionSidebar() {
        const nav = document.getElementById('duSectionSidebarNav');
        if (!nav) return;

        DU_SIDEBAR_SECTION_IDS.forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el.classList.remove('show');
            try {
              const inst = bootstrap?.Collapse?.getInstance(el);
              if (inst) inst.hide();
            } catch (_) {}
          }
          const card = getDuNavSectionForCollapse(id);
          if (card) card.classList.add('du-section-card-hidden');
        });
        nav.querySelectorAll('.active-section').forEach((a) => a.classList.remove('active-section'));

        nav.addEventListener('click', (e) => {
          const link = e.target.closest('a[data-bs-target], a[data-du-section-target]');
          if (!link) return;
          e.preventDefault();
          const bottomDockTarget = link.getAttribute('data-du-section-target');
          if (bottomDockTarget === 'duBottomDock') {
            openDuDashboardSection('duBottomDock', link.getAttribute('data-du-section-step'));
            return;
          }
          const target = link.getAttribute('data-bs-target');
          if (!target) return;
          showExclusiveDuDashboardSection(target.replace(/^#/, ''));
          const heading = document.getElementById(link.getAttribute('data-heading'));
          if (heading) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                heading.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              });
            });
          }
        });

        DU_SIDEBAR_SECTION_IDS.forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.addEventListener('shown.bs.collapse', () => updateDuSectionSidebarActiveState(id, true));
          el.addEventListener('hidden.bs.collapse', () => updateDuSectionSidebarActiveState(id, false));
        });

        const defaultOpenId = 'collapseDisasters';
        showDuDashboardSectionCard(defaultOpenId);
        updateDuSectionSidebarActiveState(defaultOpenId, true);
        syncDuWorkflowPill(3);
      }

      function setDuLoanPanel(panel) {
        const loansPanel = document.getElementById('duLoanPanelLoans');
        const camerasPanel = document.getElementById('duLoanPanelCameras');
        const camerasCard = document.getElementById('duNearbyCamerasCard');
        const camerasIdle = document.getElementById('duNearbyCamerasIdle');
        const isLoans = panel !== 'cameras';
        if (loansPanel) loansPanel.hidden = !isLoans;
        if (camerasPanel) camerasPanel.hidden = isLoans;
        // Cameras card lives outside the tab panels so it stays visible on the loans tab (stacked layout).
        if (camerasCard && camerasCard.style.display !== 'none') {
          camerasCard.hidden = false;
        }
        if (camerasIdle && camerasCard && camerasCard.style.display !== 'none') {
          camerasIdle.hidden = true;
        }
        document.querySelectorAll('#duLoanPanelPills [data-du-loan-panel]').forEach((btn) => {
          const active = btn.getAttribute('data-du-loan-panel') === (isLoans ? 'loans' : 'cameras');
          btn.classList.toggle('active', active);
          btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (!isLoans && camerasCard && camerasCard.style.display !== 'none') {
          camerasCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }

      function syncDuLoanFilterPillsFromSelects() {
        const scope = $('#duLoanScopeMode').val() || 'distance';
        const radius = $('#duLoanRadiusMiles').val() || String(DisasterLoanFilters.DEFAULT_RADIUS_MILES);
        document.querySelectorAll('[data-du-loan-scope]').forEach((btn) => {
          btn.classList.toggle('du-filter-pill-active', btn.getAttribute('data-du-loan-scope') === scope);
        });
        document.querySelectorAll('[data-du-loan-radius]').forEach((btn) => {
          btn.classList.toggle('du-filter-pill-active', btn.getAttribute('data-du-loan-radius') === radius);
        });
        const radiusGroup = document.getElementById('duLoanRadiusPills');
        if (radiusGroup) {
          radiusGroup.classList.toggle('du-loan-filter-pills--disabled', scope !== 'distance');
        }
        const customBar = document.getElementById('duLoanRadiusCustomBar');
        if (customBar) {
          customBar.hidden = scope !== 'distance' || radius !== 'custom';
        }
      }

      function initDuLoanPillsMenu() {
        setDuLoanPanel('loans');
        syncDuLoanFilterPillsFromSelects();

        document.querySelectorAll('#duLoanPanelPills [data-du-loan-panel]').forEach((btn) => {
          btn.addEventListener('click', () => setDuLoanPanel(btn.getAttribute('data-du-loan-panel')));
        });

        document.querySelectorAll('[data-du-loan-scope]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const scope = btn.getAttribute('data-du-loan-scope');
            $('#duLoanScopeMode').val(scope).trigger('change');
            syncDuLoanFilterPillsFromSelects();
          });
        });

        document.querySelectorAll('[data-du-loan-radius]').forEach((btn) => {
          btn.addEventListener('click', () => {
            if ($('#duLoanScopeMode').val() !== 'distance') return;
            const radius = btn.getAttribute('data-du-loan-radius');
            $('#duLoanRadiusMiles').val(radius).trigger('change');
            syncDuLoanFilterPillsFromSelects();
          });
        });
      }

      function showMockedLoansWorkspace() {
        $('#duMockedLoansIdle').hide();
        $('#encompassLoansCard').show();
        $('#duNearbyCamerasCard').show();
        $('#duNearbyCamerasIdle').hide();
        $('#duNearbyWeatherAlertsCard').show();
        $('#duNearbyWeatherAlertsIdle').hide();
      }

      function refreshEncompassLoansGridLayout() {
        if (!encompassLoansGridApi) return;
        if (typeof encompassLoansGridApi.sizeColumnsToFit === 'function') {
          encompassLoansGridApi.sizeColumnsToFit();
        }
        if (map && typeof google !== 'undefined' && google.maps?.event) {
          google.maps.event.trigger(map, 'resize');
        }
      }

      function expandDuLoansSection() {
        showMockedLoansWorkspace();
        setDuLoanPanel('loans');
        showDuDashboardSectionCard('collapseLoans');
        setTimeout(refreshEncompassLoansGridLayout, 150);
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
      
      // Calculate risk score for a disaster based on all data sources
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
      
      // Get risk badge HTML
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

      function getDisasterMarkerIconForRisk(r, allRows, riskScore) {
        const score = riskScore != null ? riskScore : calculateDisasterRiskScore(r, allRows);
        if (window.mapIcons?.getDisasterRiskTierIconForMarker) {
          return window.mapIcons.getDisasterRiskTierIconForMarker(score);
        }
        if (window.mapIcons?.getDisasterIconForMarker) {
          return window.mapIcons.getDisasterIconForMarker(r.event_type, r.source);
        }
        return {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize: new google.maps.Size(24, 24)
        };
      }
      
      // Load flood zones as disaster-like entries
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

      window.duRefreshAllSources = refreshDisasters;

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

      // Store camera data by index for marker info windows
      window.cameraDataStore = window.cameraDataStore || {};
      let cameraIndex = 0;
      
      function renderMap(rows) {
        if (!map) return;
        if (activeDisasterInfoWindow) {
          activeDisasterInfoWindow.close();
          activeDisasterInfoWindow = null;
        }
        markers.forEach((m) => m.setMap(null));
        markers = [];
        disasterMarkerEntries = [];
        const bounds = new google.maps.LatLngBounds();
        let any = false;
        cameraIndex = 0; // Reset camera index
        const mapRows = [];
        const allRows = rows || lastLoadedDisasterRows || [];
        rows.forEach(r => {
          // Support lat/lng, latitude/longitude, avg_latitude/avg_longitude
          const lat = r.lat ?? r.latitude ?? r.avg_latitude;
          const lng = r.lng ?? r.longitude ?? r.avg_longitude;
          if (lat != null && lng != null && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
            mapRows.push({ row: r, lat: parseFloat(lat), lng: parseFloat(lng) });
          }
        });
        const chunkSize = 120;
        function renderChunk(startIndex = 0) {
          const endIndex = Math.min(startIndex + chunkSize, mapRows.length);
          for (let i = startIndex; i < endIndex; i += 1) {
            const item = mapRows[i];
            const r = item.row;
            const pos = { lat: item.lat, lng: item.lng };
            const isCameraMarker = r.event_type === 'camera' || r.source === 'alertcalifornia' ||
              (r.title && r.title.toLowerCase().includes('camera'));
            const riskScore = calculateDisasterRiskScore(r, allRows);
            const disasterIcon = isCameraMarker && window.mapIcons?.getDisasterIconForMarker
              ? window.mapIcons.getDisasterIconForMarker('camera', r.source)
              : getDisasterMarkerIconForRisk(r, allRows, riskScore);
            let cameraDataKey = null;
            const marker = new google.maps.Marker({
              position: pos,
              map,
              title: isCameraMarker
                ? (r.title || 'Camera')
                : `${r.title || r.event_type} (risk ${riskScore.toFixed(1)})`,
              icon: disasterIcon,
              zIndex: isCameraMarker ? 50 : Math.round(100 + riskScore * 10)
            });
            if (isCameraMarker) {
              cameraDataKey = `camera_${cameraIndex++}`;
              window.cameraDataStore[cameraDataKey] = r;
            }
            let infoContent = `<div><strong>${r.title || r.event_type}</strong><br>${r.county_name || ''}, ${r.state_abbr || ''}<br>${r.start_time ? new Date(r.start_time).toLocaleString() : ''}<br><span class="text-muted small">Risk: ${riskScore.toFixed(1)}</span>`;
            if (isCameraMarker && cameraDataKey) {
              infoContent += `<br><br><button class="btn btn-sm btn-warning" onclick="window.openCameraViewerFromMarker('${cameraDataKey}')" style="margin-top: 8px;">
                <i class="bi-camera-video"></i> View Camera Feed
              </button>`;
            }
            infoContent += '</div>';
            const info = new google.maps.InfoWindow({
              content: infoContent
            });
            marker.addListener('click', () => {
              if (activeDisasterInfoWindow) activeDisasterInfoWindow.close();
              info.open(map, marker);
              activeDisasterInfoWindow = info;
              if (!isCameraMarker) {
                selectDisaster([r.source, r.event_type, r.county_name, r.state_abbr, r.start_time, r.end_time, r.title], r);
              }
            });
            markers.push(marker);
            if (!isCameraMarker) {
              disasterMarkerEntries.push({ marker, info, row: r });
            }
            bounds.extend(pos);
            any = true;
          }
          if (endIndex < mapRows.length) {
            window.requestAnimationFrame(() => renderChunk(endIndex));
            return;
          }
          if (selectedDisasterObj) {
            focusMapOnDisaster(selectedDisasterObj);
            highlightSelectedDisasterInGrid(selectedDisasterObj);
          } else if (any) {
            map.fitBounds(bounds);
          }
        }
        renderChunk(0);
      }

      function syncDuLoanRadiusControls() {
        const isDistance = $('#duLoanScopeMode').val() === 'distance';
        $('#duLoanRadiusMiles').prop('disabled', !isDistance);
        $('#duLoanRadiusCustom').prop('disabled', !isDistance);
        syncDuLoanFilterPillsFromSelects();
      }

      function applyDuLoanFilterIfReady() {
        if (selectedDisasterObj || selectedDisasterRow) {
          loadLoansForDisaster(selectedDisasterObj, selectedDisasterRow);
          refreshNearbyCameras();
          refreshNearbyWeatherAlerts();
          return;
        }
        if (cameraLoadContext === 'loan' && selectedLoan) {
          loadNearbyCamerasForLoan(selectedLoan);
          return;
        }
        setDashboardStatus('Select a disaster in the grid first, then adjust loan radius/county.', 'info');
      }

      function initializeDuLoanFilterControls() {
        const stored = DisasterLoanFilters.getStoredRadiusMiles();
        const presetValues = ['10', '25', '50', '100'];
        if (presetValues.includes(String(stored))) {
          $('#duLoanRadiusMiles').val(String(stored));
        } else {
          $('#duLoanRadiusMiles').val('custom');
          $('#duLoanRadiusCustom').val(stored);
        }
        syncDuLoanRadiusControls();

        $('#duLoanRadiusMiles').on('change', function () {
          syncDuLoanRadiusControls();
          applyDuLoanFilterIfReady();
        });
        $('#duLoanRadiusCustom').on('change', function () {
          applyDuLoanFilterIfReady();
        });
        $('#duLoanScopeMode').on('change', function () {
          syncDuLoanRadiusControls();
          applyDuLoanFilterIfReady();
        });
      }

      // Select disaster and show YouTube/Encompass data
      function selectDisaster(disasterData, disasterObj) {
        selectedDisaster = disasterObj || disasterData;
        selectedDisasterObj = disasterObj || null;
        selectedDisasterRow = Array.isArray(disasterData) ? disasterData : null;
        const title = disasterObj?.title || disasterData[6] || '';
        const state = disasterObj?.state_abbr || disasterData[3] || '';
        const county = disasterObj?.county_name || disasterData[2] || '';
        const riskScore = disasterObj?.risk_score || 0;
        
        const eventType = disasterObj?.event_type || disasterData?.[1] || '';
        
        console.log('Selecting disaster:', title, state, county, 'Risk:', riskScore);
        
        if (riskScore > 0) {
          console.log(`⚠️  Risk Score: ${riskScore.toFixed(1)}`);
        }

        if (state) $('#stateInput').val(state);
        if (county) $('#countyInput').val(county);

        const defaultMode = DisasterLoanFilters.defaultScopeMode(disasterObj, selectedDisasterRow);
        $('#duLoanScopeMode').val(defaultMode);
        syncDuLoanRadiusControls();

        loadLoansForDisaster(disasterObj, selectedDisasterRow);
        loadNearbyCamerasForDisaster(disasterObj, selectedDisasterRow);
        loadNearbyWeatherAlertsForDisaster(disasterObj, selectedDisasterRow);
        applyNwsGridFilterFromSelection(disasterObj, selectedDisasterRow);
        searchYouTubeForDisaster(title, state, county, eventType, disasterObj);
        revealDisasterSelectionPanels();
        highlightSelectedDisasterInGrid(disasterObj);
        focusMapOnDisaster(disasterObj);
        refreshAIOnSelection();
      }

      // Load all encompass loans on map on page load
      async function loadAllLoansOnMap() {
        try {
          if (!map) {
            setTimeout(loadAllLoansOnMap, 500);
            return;
          }

          console.log('Loading all encompass loans on map…');
          const response = await fetch('/api/loan-pipeline/loans');
          const data = await response.json();

          if (data.success && data.data.loans) {
            const loans = data.data.loans;
            updateMapWithLoans(loans);
            const rows = loans.map((loan) => buildEncompassLoanGridRow(loan));
            rows.sort((a, b) => (a.distanceKm || 999999) - (b.distanceKm || 999999));
            setEncompassLoansGridRows(rows);
            lastAffectedLoans = loans;
            lastLoanFilterMeta = {
              mode: 'all',
              state: '',
              county: '',
              title: 'All mocked loans',
              radiusMiles: null,
            };
            const n = loans.length;
            const defaultMi = DisasterLoanFilters.DEFAULT_RADIUS_MILES;
            $('#encompassLoansSubtitle').text(
              `${n} mocked loan${n === 1 ? '' : 's'} on map — open Mocked loans or select a disaster to filter within ${defaultMi} mi (default).`
            );
            updateSelectionContextStrip();
            console.log(`Loaded ${n} loans on map (grid preloaded; ${defaultMi} mi default radius)`);
          }
        } catch (error) {
          console.error('Error loading all loans on map:', error);
        }
      }

      async function loadLoansForDisaster(disasterObj, disasterData) {
        expandDuLoansSection();
        $('#encompassLoansSubtitle').text('Loading mocked loans near selected disaster…');

        const normalizedDisaster = DisasterLoanFilters.normalizeDisasterForFilters(disasterObj, disasterData);
        let mode = $('#duLoanScopeMode').val() || DisasterLoanFilters.defaultScopeMode(normalizedDisaster, disasterData);
        const radiusMiles = DisasterLoanFilters.getSelectedRadiusMiles('duLoanRadiusMiles', 'duLoanRadiusCustom');

        if (mode === 'distance' && !DisasterLoanFilters.disasterHasCoords(normalizedDisaster, disasterData)) {
          mode = 'county';
          $('#duLoanScopeMode').val('county');
          syncDuLoanRadiusControls();
          setDashboardStatus('No disaster coordinates — showing county/state matches instead.', 'info');
        }

        const built = DisasterLoanFilters.buildLoanQueryParams(normalizedDisaster, disasterData, {
          mode,
          radiusMiles
        });

        if (!built.state) {
          setEncompassLoansGridRows([]);
          $('#encompassLoansSubtitle').text('Selected disaster has no state — cannot match mocked loans.');
          setDashboardStatus('Selected disaster has no state — cannot load loans.', 'warning');
          return;
        }

        try {
          const loanUrl = `/api/loan-pipeline/loans?${built.params.toString()}`;
          console.log('📍 Loading loans:', loanUrl, { mode: built.mode, radiusMiles });
          const response = await fetch(loanUrl);
          const data = await response.json();

          if (data.success) {
            const loans = data.data.loans || [];
            populateEncompassLoansTable(loans);
            updateMapWithLoans(loans);
            const meta = {
              mode: built.mode,
              state: built.state,
              county: built.county,
              title: built.title,
              radiusMiles: mode === 'distance' ? radiusMiles : null
            };
            let loanSub = DisasterLoanFilters.formatLoanFilterSubtitle(meta, loans.length);
            if (!loans.length) {
              loanSub += ' — No mocked loans in this radius/county; widen radius or verify county.';
            }
            $('#encompassLoansSubtitle').text(loanSub);
            lastAffectedLoans = loans;
            lastLoanFilterMeta = meta;
          } else {
            setEncompassLoansGridRows([]);
            lastAffectedLoans = [];
            lastLoanFilterMeta = null;
          }
          updateSelectionContextStrip();
          refreshAIContext();
        } catch (error) {
          console.error('Error loading Encompass loans:', error);
          setEncompassLoansGridRows([]);
          lastAffectedLoans = [];
          lastLoanFilterMeta = null;
          $('#encompassLoansSubtitle').text('Failed to load mocked loans — try again.');
        }
      }

      function populateEncompassLoansTable(loans) {
        expandDuLoansSection();
        if (!loans || loans.length === 0) {
          setEncompassLoansGridRows([]);
          return;
        }
        const rows = loans.map((loan) => buildEncompassLoanGridRow(loan));
        rows.sort((a, b) => (a.distanceKm || 999999) - (b.distanceKm || 999999));
        setEncompassLoansGridRows(rows);
      }

      // Get risk level text
      function getRiskLevel(score) {
        if (!score) return 'Not Analyzed';
        if (score >= 10) return 'Critical';
        if (score >= 7) return 'High';
        if (score >= 4) return 'Moderate';
        return 'Low';
      }

      // Get risk class for badge
      function getRiskClass(score) {
        if (!score) return 'bg-secondary';
        if (score >= 7) return 'bg-danger';
        if (score >= 4) return 'bg-warning';
        return 'bg-success';
      }

      // Update map with loan markers
      function updateMapWithLoans(loans) {
        if (!map) return;
        loanMarkers.forEach(m => m.marker && m.marker.setMap(null));
        loanMarkers = [];
        
        if (!loans) return;
        
        loans.forEach(loan => {
          if (loan.latitude && loan.longitude) {
            const loanIcon = window.mapIcons && window.mapIcons.getLoanIconForMarker
              ? window.mapIcons.getLoanIconForMarker(loan.disaster_risk_score)
              : { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png', scaledSize: new google.maps.Size(24, 24) };
            const marker = new google.maps.Marker({
              position: { lat: parseFloat(loan.latitude), lng: parseFloat(loan.longitude) },
              map: map,
              title: `Loan ${loan.loan_number}`,
              icon: loanIcon,
              zIndex: 10
            });
            const infoWindow = new google.maps.InfoWindow({
              content: `<div>
                <h6>Loan ${loan.loan_number}</h6>
                <div>${loan.property_address}</div>
                <div>${loan.city}, ${loan.state} ${loan.zip_code || ''}</div>
                <div>County: ${loan.county || ''}</div>
                <div>Ops triage: ${getRiskLevel(loan.disaster_risk_score)}</div>
              </div>`
            });
            marker.addListener('click', () => infoWindow.open(map, marker));
            loanMarkers.push({ loanId: loan.id, marker });
          }
        });
      }

      function loadYouTubeBrowserApiKey() {
        if (youtubeBrowserApiKey) return Promise.resolve(youtubeBrowserApiKey);
        if (youtubeBrowserApiKeyPromise) return youtubeBrowserApiKeyPromise;
        youtubeBrowserApiKeyPromise = fetch('/api/music-research/google-api-key')
          .then((resp) => resp.json())
          .then((data) => {
            youtubeBrowserApiKey = data.apiKey || null;
            return youtubeBrowserApiKey;
          })
          .catch((err) => {
            console.error('YouTube API key fetch failed:', err);
            youtubeBrowserApiKey = null;
            return null;
          });
        return youtubeBrowserApiKeyPromise;
      }

      // Browser-side YouTube search (referrer-restricted key works from the page, not server-side)
      async function searchYouTubeForDisaster(disasterTitle, state, county, eventType, disasterObj) {
        const youtubeResultsDiv = document.getElementById('youtubeResults');
        if (!youtubeResultsDiv) return;

        const queryParts = [
          disasterTitle,
          county,
          state,
          eventType && !disasterTitle?.toLowerCase().includes(String(eventType).toLowerCase()) ? eventType : '',
        ].filter(Boolean);
        const query = queryParts.join(' ').trim() || `${state || ''} ${county || ''} disaster`.trim();
        if (!query) {
          youtubeResultsDiv.innerHTML = '<div class="text-center text-muted">No search terms for this disaster.</div>';
          return;
        }

        youtubeResultsDiv.innerHTML = '<div class="text-center text-muted py-3"><div class="spinner-border spinner-border-sm"></div> Searching videos…</div>';

        try {
          const apiKey = await loadYouTubeBrowserApiKey();
          if (!apiKey) throw new Error('Google browser API key not configured');

          const params = new URLSearchParams({
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults: '5',
            key: apiKey,
          });
          const lat = disasterObj?.lat;
          const lng = disasterObj?.lng;
          if (lat != null && lng != null) {
            params.set('location', `${lat},${lng}`);
            params.set('locationRadius', '50mi');
          }

          const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
          const data = await resp.json();
          if (!resp.ok) {
            throw new Error(data.error?.message || `HTTP ${resp.status}`);
          }

          const videos = (data.items || []).map((item) => ({
            videoId: item.id?.videoId,
            title: item.snippet?.title,
            description: item.snippet?.description,
            thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
          }));
          displayYouTubeResults(videos);
        } catch (error) {
          console.error('YouTube search error:', error);
          youtubeResultsDiv.innerHTML = `<div class="text-center text-danger">Error searching YouTube: ${error.message || 'Please try again.'}</div>`;
        }
      }

      function displayYouTubeResults(videos) {
        const youtubeResultsDiv = document.getElementById('youtubeResults');
        if (!youtubeResultsDiv) return;
        if (videos && videos.length > 0) {
          youtubeResultsDiv.innerHTML = videos.slice(0, 5).map((video) => {
            const thumb = video.thumbnail || '';
            const title = video.title || 'Video';
            const desc = (video.description || '').substring(0, 100);
            const watchUrl = video.videoId
              ? `https://www.youtube.com/watch?v=${video.videoId}`
              : (video.url || '#');
            return `
            <div class="card mb-2">
              <img src="${thumb}" class="card-img-top" alt="${title}">
              <div class="card-body p-2">
                <h6 class="card-title small">${title}</h6>
                <p class="card-text small">${desc}${desc ? '…' : ''}</p>
                <a href="${watchUrl}" target="_blank" rel="noopener" class="btn btn-sm btn-primary"><i class="bi-play-circle"></i> Watch</a>
              </div>
            </div>`;
          }).join('');
        } else {
          youtubeResultsDiv.innerHTML = '<div class="text-center text-muted"><i class="bi-youtube"></i><br>No videos found</div>';
        }
      }

      // Get event icon
      function getEventIcon(eventType) {
        const icons = {
          'wildfire': '🔥',
          'earthquake': '🌍',
          'hurricane': '🌀',
          'flood': '💧',
          'severe': '⚡'
        };
        return icons[eventType?.toLowerCase()] || '⚠️';
      }

      // Update stats cards
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

      // Animate number counting
      function animateNumber(selector, target) {
        const $el = $(selector);
        const current = parseInt($el.text()) || 0;
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

      async function buildAIContext() {
        return {
          page: 'disasters-unified',
          expertProfile: 'processor',
          filters: getCurrentFilters(),
          selectedDisaster: selectedDisasterObj,
          selectedLoan: selectedLoan || null,
          loanFilterMeta: lastLoanFilterMeta,
          nearbyLoans: {
            count: lastAffectedLoans.length,
            sample: lastAffectedLoans.slice(0, 15)
          },
          nearbyCameras: {
            count: lastNearbyCameras.length,
            sample: lastNearbyCameras.slice(0, 5)
          },
          nearbyWeatherAlerts: {
            count: lastNearbyWeatherAlerts.length,
            sample: lastNearbyWeatherAlerts.slice(0, 10)
          },
          nwsGridFilterActive: disastersGridExternalFilterPresent(),
          stats: await getDisasterStats()
        };
      }

      async function refreshAIContext() {
        if (!aiChatWidget) return;
        const ctx = await buildAIContext();
        aiChatWidget.updateContext(ctx);
      }

      function openProcessorExpert() {
        if (window.aiChatWidget && typeof window.aiChatWidget.toggle === 'function') {
          window.aiChatWidget.toggle();
        }
      }

      function showInsightsIdlePlaceholder() {
        const container = document.getElementById('aiInsightsContainer');
        if (!container) return;
        container.innerHTML = `
          <div id="aiInsightsIdle" class="card border bg-light shadow-sm mb-0">
            <div class="card-body py-2 small text-muted mb-0">
              <i class="bi bi-lightbulb"></i> Select a disaster in the grid for tailored AI insights.
            </div>
          </div>`;
      }

      function updateSelectionContextStrip() {
        const el = document.getElementById('selectionContextStrip');
        if (!el || !selectedDisasterObj) {
          if (el) el.style.display = 'none';
          updateKmlExportButtons();
          return;
        }
        const title = selectedDisasterObj.title || selectedDisasterObj.declarationTitle || 'Selected disaster';
        const state = selectedDisasterObj.state_abbr || '';
        const county = selectedDisasterObj.county_name || '';
        const loanLine = lastLoanFilterMeta
          ? DisasterLoanFilters.formatLoanFilterSubtitle(lastLoanFilterMeta, lastAffectedLoans.length)
          : `${lastAffectedLoans.length} mocked loan(s)`;
        const camLine = lastNearbyCameras.length
          ? `${lastNearbyCameras.length} fire camera(s) nearby`
          : 'No nearby cameras in range';
        const nwsLine = lastNearbyWeatherAlerts.length
          ? `${lastNearbyWeatherAlerts.length} weather alert(s) nearby`
          : 'No nearby NWS alerts in range';
        el.innerHTML = `<strong>${title}</strong> · ${county}${county && state ? ', ' : ''}${state}
          · ${loanLine} · ${camLine} · ${nwsLine}
          · <button type="button" class="btn btn-sm btn-info py-0 px-2 align-baseline text-white" onclick="openDisasterHeygenBriefing()" title="Generate a HeyGen avatar briefing for this event"><i class="bi bi-camera-reels"></i> AI video briefing</button>
          · <button type="button" class="btn btn-sm btn-warning py-0 px-2 align-baseline" onclick="exportCinematicDisasterKml()" title="Google Earth tour with loans, webcams, and disaster mood audio"><i class="bi bi-globe-americas"></i> Google Earth KML</button>
          · <button type="button" class="btn btn-sm btn-light py-0 px-2 align-baseline" onclick="openProcessorExpert()"><i class="bi bi-robot"></i> Ask processor expert</button>
          · <a href="disasters-webcams.html" class="alert-link">Hazard webcams</a>
          · <a href="pipeline-risk-dashboard.html" class="alert-link">FEMA pipeline risk</a>`;
        el.style.display = 'block';
        updateKmlExportButtons();
      }

      function updateKmlExportButtons() {
        const ready = !!selectedDisasterObj
          && window.DisasterKmlExport?.canExportCinematicKml?.({ disaster: selectedDisasterObj });
        const title = ready
          ? `Export Google Earth KML (${lastAffectedLoans.length} mocked loans, ${lastNearbyCameras.length} webcams)`
          : 'Select a disaster in the grid first';
        ['duExportCinematicKmlToolbarBtn', 'duExportCinematicKmlLoansBtn'].forEach((id) => {
          const btn = document.getElementById(id);
          if (!btn) return;
          btn.disabled = !ready;
          btn.title = title;
        });
      }

      function exportCinematicDisasterKml() {
        if (!window.DisasterKmlExport?.exportCinematicKmlFromPageState) {
          setDashboardStatus('KML export is still loading — try again in a moment.', 'warning');
          return;
        }
        const result = window.DisasterKmlExport.exportCinematicKmlFromPageState({
          selectedDisaster: selectedDisasterObj,
          lastAffectedLoans,
          lastNearbyCameras,
          lastLoanFilterMeta,
        });
        setDashboardStatus(
          result.message || (result.success ? 'KML downloaded.' : 'Could not export KML.'),
          result.success ? 'success' : 'warning'
        );
      }
      window.exportCinematicDisasterKml = exportCinematicDisasterKml;

      function openDisasterHeygenBriefing() {
        if (!selectedDisasterObj) {
          setDashboardStatus('Select a disaster in the grid first.', 'warning');
          return;
        }
        heygenStudio?.openBriefingMode?.();
      }
      window.openDisasterHeygenBriefing = openDisasterHeygenBriefing;

      function refreshAIOnSelection() {
        updateSelectionContextStrip();
        refreshAIContext();
        heygenStudio?.refreshScriptPreview?.();
        if (aiInsightsCard && selectedDisasterObj) {
          aiInsightsCard.generateInsights(getCurrentFilters(), 'disaster', selectedDisasterObj);
        } else {
          showInsightsIdlePlaceholder();
        }
      }

      async function initializeAIComponents() {
        const userId = (typeof window.getLoggedInUser === 'function' && window.getLoggedInUser())
          ? (window.getLoggedInUser().id || 'anonymous')
          : 'anonymous';

        const processorWelcome = `<i class="bi bi-robot"></i>
          <p><strong>Disaster processor expert</strong> — ask about verification, insurance, milestones, and triage for the selected event.</p>
          <small class="text-muted">Try: "What should I verify on loans within 25 miles?" · "Which milestones to hold until flood insurance is confirmed?" · "Summarize operational risk for this county."</small>`;

        if (window.AIChatWidget) {
          aiChatWidget = new window.AIChatWidget({
            apiEndpoint: '/api/loan-pipeline/ai/chat-disaster-expert',
            userId,
            sessionId: 'unified-disaster-processor',
            title: 'Disaster Processor Expert',
            buttonTitle: 'Disaster processor expert (voice: use chat mic)',
            welcomeHtml: processorWelcome,
            inputPlaceholder: 'Ask about processor actions for this disaster…',
            getContext: buildAIContext,
            showMusicMute: true,
            onOpen: async (ctx) => {
              if (window.DisasterMoodMusic?.isMuted?.()) return;
              await window.DisasterMoodMusic?.playForDisaster?.(
                ctx?.selectedDisaster || selectedDisasterObj
              );
            },
            onClose: () => window.DisasterMoodMusic?.stop?.(),
            onMessageSent: (message) => console.log('Disaster expert message:', message),
            onMessageReceived: (response) => console.log('Disaster expert response:', response)
          });
          window.aiChatWidget = aiChatWidget;
        }

        if (window.AIInsightsCard) {
          aiInsightsCard = new window.AIInsightsCard({
            apiEndpoint: '/api/loan-pipeline/ai/insights',
            userId,
            containerId: 'aiInsightsContainer',
            autoGenerate: false,
            onInsightsGenerated: (insights) => console.log('AI Insights:', insights)
          });
          window.aiInsightsCard = aiInsightsCard;
        }

        if (window.DisasterAiScanCard) {
          window.DisasterAiScanCard.mount(document.getElementById('disasterAiScanCardMount'), {
            title: 'Disaster processor expert',
            kicker: 'Scan · ask · triage',
            hint: 'Click to flip · scan QR on your phone',
            scanUrl: `${window.location.origin}/finance/disasters-unified.html`,
            openAi: true,
            imageUrl: '/family/assets/DavidELane.png',
            onOpenAi: openProcessorExpert,
          });
        }

        if (new URLSearchParams(window.location.search).get('openAi') === '1') {
          openDuDashboardSection('collapseLoans', 4);
          setTimeout(() => openProcessorExpert(), 600);
        }
      }

      // Get current filters
      function getCurrentFilters() {
        return {
          state: $('#stateInput').val(),
          county: $('#countyInput').val(),
          sources: $('#sourceInput').val() || [],
          events: $('#eventInput').val() || []
        };
      }

      // Initialize Voice Recognition
      function initializeVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          console.warn('Speech recognition not supported');
          $('#voiceControlBtn').hide();
          return;
        }

        voiceRecognition = new SpeechRecognition();
        voiceRecognition.continuous = false;
        voiceRecognition.interimResults = false;
        voiceRecognition.lang = 'en-US';

        const runToolbarVoiceCommand = async function(event) {
          const transcript = event.results[event.results.length - 1][0].transcript;
          console.log('Voice command:', transcript);
          setDashboardStatus(`Heard: "${transcript}"`, 'info');
          if (!window.parseVoiceCommand || !window.executeVoiceCommand) {
            setDashboardStatus('Voice commands not loaded yet.', 'warning');
            return;
          }
          const action = window.parseVoiceCommand(transcript);
          const context = {
            applyFilters: loadDisasters,
            setStateFilter: (state) => $('#stateInput').val(state),
            setCountyFilter: (county) => $('#countyInput').val(county),
            loadFEMADisastersDirect: () => $('#applyBtn').click(),
            expandAccordion: (targetId) => {
              const el = document.getElementById(targetId);
              if (el) new bootstrap.Collapse(el, { show: true });
            }
          };
          const result = await window.executeVoiceCommand(action, context);
          if (result.success) {
            setDashboardStatus(result.message || 'Done.', 'success');
            if (action.type === 'filter' && aiInsightsCard) {
              aiInsightsCard.generateInsights(getCurrentFilters(), 'filter', selectedDisasterObj);
            }
          } else {
            setDashboardStatus(result.message || 'Command not recognized.', 'warning');
          }
        };

        voiceRecognition.onstart = function() {
          isVoiceListening = true;
          updateVoiceButton(true);
          setDashboardStatus('Listening… speak a filter or navigation command.', 'info');
        };

        voiceRecognition.onresult = runToolbarVoiceCommand;

        voiceRecognition.onerror = function(event) {
          console.error('Voice recognition error:', event.error);
          isVoiceListening = false;
          updateVoiceButton(false);
          setDashboardStatus('Voice recognition error. Try again.', 'danger');
        };

        voiceRecognition.onend = function() {
          isVoiceListening = false;
          updateVoiceButton(false);
        };

        window.voiceRecognition = {
          start: (callback) => {
            voiceRecognition.onresult = callback
              ? function(event) {
                  callback(event.results[event.results.length - 1][0].transcript);
                }
              : runToolbarVoiceCommand;
            voiceRecognition.start();
          },
          stop: () => {
            voiceRecognition.onresult = runToolbarVoiceCommand;
            voiceRecognition.stop();
          },
          isListening: () => isVoiceListening
        };
      }

      // Toggle voice control
      function toggleVoiceControl() {
        if (!voiceRecognition) {
          alert('Voice recognition not available');
          return;
        }
        if (isVoiceListening) {
          voiceRecognition.stop();
        } else {
          voiceRecognition.start();
        }
      }

      // Update voice button
      function updateVoiceButton(listening) {
        const btn = $('#voiceControlBtn');
        const text = $('#voiceControlText');
        const icon = btn.find('i');
        
        if (listening) {
          btn.removeClass('btn-warning').addClass('btn-danger');
          icon.removeClass('bi-mic').addClass('bi-mic-fill');
          text.text(' Listening...');
        } else {
          btn.removeClass('btn-danger').addClass('btn-warning');
          icon.removeClass('bi-mic-fill').addClass('bi-mic');
          text.text(' Voice');
        }
      }

      // Disaster table camera buttons (legacy rows with event_type camera)
      $(document).on('click', '.camera-view-btn', function(e) {
        e.stopPropagation();
        e.preventDefault();
        const rowNode = $(this).closest('tr')[0];
        if (!rowNode) return;
        const rowData = $(rowNode).data('rowData') || $(rowNode).data('disasterObj');
        if (rowData && typeof window.showCameraViewer === 'function') {
          window.showCameraViewer(rowData);
        }
      });
      
