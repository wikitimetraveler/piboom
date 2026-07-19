/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — selection, AI, shell, bootstrap
 * Loaded in global scope after prior scripts (see disasters-unified.html).
 */

function clearCameraMarkers() {
  cameraMarkers.forEach((entry) => googleAdvancedMarkers.removeMapMarker(entry.marker));
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
  const onCamerasTab = document.getElementById('duLoanPanelCamerasTab')?.classList.contains('active');
  if (camerasCard) {
    camerasCard.style.display = '';
    camerasCard.hidden = !onCamerasTab;
  }
  if (camerasIdle) camerasIdle.hidden = onCamerasTab || camerasCard?.style.display === 'none';
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

function syncDuWorkflowPill(stepNum) {
  const hint = document.getElementById('workflowHint');
  if (hint && stepNum) {
    hint.querySelectorAll('li').forEach((li, idx) => {
      li.classList.toggle('du-workflow-pill-active', idx + 1 === stepNum);
    });
  }
  const strip = document.getElementById('workflowStripDesktop');
  if (strip && stepNum) {
    strip.querySelectorAll('[data-du-section-step]').forEach((btn) => {
      const active = Number(btn.getAttribute('data-du-section-step')) === stepNum;
      btn.classList.toggle('du-workflow-strip-active', active);
      btn.setAttribute('aria-current', active ? 'step' : 'false');
    });
  }
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

  ['collapseCommandDeck', 'collapseRiskIntel', 'collapseLoans'].forEach((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const step = sectionId === 'collapseLoans' ? 3 : 2;
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

  syncDuWorkflowPill(2);
}

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
  if (duMultiPanelMode) {
    showDuDashboardSectionCard(id);
    return;
  }
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

function revealDuIntelShell({ scope, state, county, statusMsg, keepGeoExpanded = true }) {
  duCountyIntelLoaded = true;
  duMultiPanelMode = true;
  duGeoLoadScope = scope;
  duSelectedGeoState = state || null;
  duSelectedGeoCounty = county || null;

  $('#stateInput').val(state || '');
  $('#countyInput').val(county || '');

  const geoStage = document.getElementById('duGeoStage');
  const intelStage = document.getElementById('duIntelStage');
  const crumb = document.getElementById('duGeoActiveCrumb');
  if (geoStage) {
    geoStage.classList.remove('du-geo-stage--collapsed');
    geoStage.classList.toggle('du-geo-stage--has-data', true);
  }
  if (intelStage) intelStage.classList.remove('du-intel-stage--pending');
  if (crumb) {
    if (scope === 'usa') crumb.textContent = 'United States';
    else if (scope === 'state') {
      const stateLabel = typeof duGeoData !== 'undefined' && duGeoData.stateName
        ? duGeoData.stateName(state)
        : state;
      crumb.textContent = `${stateLabel} (all counties)`;
    } else crumb.textContent = `${county}, ${state}`;
    crumb.hidden = false;
  }
  document.getElementById('duGeoChangeCountyBtn')?.removeAttribute('hidden');

  const statsRow = document.getElementById('statsRow');
  statsRow?.classList.remove('du-stats-row--placeholder');
  statsRow?.classList.remove('du-stats-row--hidden');
  if (statusMsg) setDashboardStatus(statusMsg, 'info');

  showDuDashboardSectionCard('collapseCommandDeck');
  showDuDashboardSectionCard('collapseFilters');
  showDuDashboardSectionCard('collapseDisasters');
  showDuDashboardSectionCard('collapseMapYouTube');

  initDisastersMap();
  syncSourceChipsFromSelect();
  setTimeout(() => {
    if (typeof window.duGeoPickerInvalidate === 'function') window.duGeoPickerInvalidate();
  }, 350);
}

function revealDuStateIntelPanels(state) {
  const st = String(state || '').toUpperCase();
  const stateLabel = typeof duGeoData !== 'undefined' && duGeoData.stateName
    ? duGeoData.stateName(st)
    : st;

  duGeoLoadScope = 'state';
  duSelectedGeoCounty = null;
  $('#countyInput').val('');
  revealDuIntelShell({
    scope: 'state',
    state: st,
    county: null,
    statusMsg: `Loading statewide hazard intelligence for ${stateLabel}…`,
  });

  loadDisasters().then(() => {
    setDashboardStatus(
      `Loaded statewide data for ${stateLabel}. Click a county to narrow, or keep browsing the map.`,
      'success'
    );
    $('#duLoanScopeMode').val('county');
    syncDuLoanRadiusControls();
    loadLoansForDisaster(
      { state_abbr: st, county_name: '', title: `${stateLabel} (statewide)` },
      null
    );
    const url = new URL(window.location.href);
    url.searchParams.set('state', st);
    url.searchParams.delete('county');
    url.searchParams.set('load', '1');
    window.history.replaceState({}, '', url);
    openDuDashboardSection('collapseDisasters', 2);
  });
}

function revealDuUsaIntelPanels() {
  duStateDisasterRows = [];
  revealDuIntelShell({
    scope: 'usa',
    state: '',
    county: '',
    statusMsg: 'Loading nationwide hazard intelligence (90-day window)…',
  });
  $('#stateInput').val('');
  $('#countyInput').val('');
  loadDisasters().then(() => {
    setEncompassLoansGridRows([]);
    $('#encompassLoansSubtitle').text('Nationwide view — select a disaster for loan context.');
    const url = new URL(window.location.href);
    url.searchParams.delete('state');
    url.searchParams.delete('county');
    url.searchParams.set('scope', 'usa');
    url.searchParams.set('load', '1');
    window.history.replaceState({}, '', url);
    openDuDashboardSection('collapseDisasters', 2);
  });
}

window.onDuCountyFiltered = function onDuCountyFiltered(state, county) {
  const st = String(state || '').toUpperCase();
  const co = String(county || '').trim();
  if (!st || !co) return;

  if (duStateDisasterRows.length && duSelectedGeoState === st) {
    revealDuIntelShell({
      scope: 'county',
      state: st,
      county: co,
      statusMsg: `Filtering to ${co}, ${st}…`,
    });
    applyCountyDisasterFilter(co);
    openDuDashboardSection('collapseDisasters', 2);
    return;
  }

  duGeoLoadScope = 'county';
  duSelectedGeoState = st;
  duSelectedGeoCounty = co;
  revealDuIntelShell({
    scope: 'county',
    state: st,
    county: co,
    statusMsg: `Loading hazard intelligence for ${co}, ${st}…`,
  });

  loadDisasters().then(() => {
    $('#duLoanScopeMode').val('county');
    syncDuLoanRadiusControls();
    loadLoansForDisaster(
      { state_abbr: st, county_name: co, title: `${co}, ${st}` },
      null
    );
    const url = new URL(window.location.href);
    url.searchParams.set('state', st);
    url.searchParams.set('county', co);
    url.searchParams.set('load', '1');
    window.history.replaceState({}, '', url);
    openDuDashboardSection('collapseDisasters', 2);
  });
};

window.onDuStateConfirmed = function onDuStateConfirmed(state) {
  revealDuStateIntelPanels(String(state || '').toUpperCase());
};

window.onDuUsaConfirmed = function onDuUsaConfirmed() {
  revealDuUsaIntelPanels();
};

window.onDuCountyConfirmed = function onDuCountyConfirmed(state, county) {
  window.onDuCountyFiltered(state, county);
};

function revealDuCountyIntelPanels(state, county) {
  window.onDuCountyFiltered(state, county);
}

function revealDisasterSelectionPanels() {
  showDuDashboardSectionCard('collapseDisasters');
  showDuDashboardSectionCard('collapseMapYouTube');
  expandDuLoansSection();
  setDuSectionPillActive('collapseMapYouTube');
  syncDuWorkflowPill(2);
  setTimeout(() => {
    refreshDisastersGridLayout();
    refreshEncompassLoansGridLayout();
    document.querySelector('.du-youtube-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 200);
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
    if (duMultiPanelMode) {
      showDuDashboardSectionCard(targetId);
    } else {
      DU_SIDEBAR_SECTION_IDS.forEach((sid) => {
        if (sid !== targetId) hideDuDashboardSectionCard(sid);
      });
      showDuDashboardSectionCard(targetId);
    }
    document.getElementById(sectionHeadingIds[targetId])?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (targetId === 'duBottomDock') {
    document.getElementById('duBottomDock')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (targetId === 'duGeoStage') {
    document.getElementById('duGeoStage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  setDuSectionPillActive(targetId);
  if (stepNum) syncDuWorkflowPill(Number(stepNum));
}

function initDuWorkflowPills() {
  document.querySelectorAll('#workflowHint [data-du-section-target], #workflowStripDesktop [data-du-section-target]').forEach((btn) => {
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
    const sectionTarget = link.getAttribute('data-du-section-target');
    if (sectionTarget === 'duBottomDock' || sectionTarget === 'duGeoStage') {
      openDuDashboardSection(sectionTarget, link.getAttribute('data-du-section-step'));
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
  syncDuWorkflowPill(duCountyIntelLoaded ? 2 : 1);
}

function setDuLoanPanel(panel) {
  const loansPanel = document.getElementById('duLoanPanelLoans');
  const camerasPanel = document.getElementById('duLoanPanelCameras');
  const camerasCard = document.getElementById('duNearbyCamerasCard');
  const camerasIdle = document.getElementById('duNearbyCamerasIdle');
  const isLoans = panel !== 'cameras';
  if (loansPanel) loansPanel.hidden = !isLoans;
  if (camerasPanel) camerasPanel.hidden = isLoans;
  if (camerasCard) {
    const showCard = !isLoans && camerasCard.style.display !== 'none';
    camerasCard.hidden = !showCard;
  }
  if (camerasIdle) {
    camerasIdle.hidden = isLoans || (camerasCard && camerasCard.style.display !== 'none');
  }
  document.querySelectorAll('#duLoanPanelPills [data-du-loan-panel]').forEach((btn) => {
    const active = btn.getAttribute('data-du-loan-panel') === (isLoans ? 'loans' : 'cameras');
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (!isLoans && camerasPanel) {
    camerasPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  $('#duNearbyWeatherAlertsCard').show();
  $('#duNearbyWeatherAlertsIdle').hide();
  const camerasCard = document.getElementById('duNearbyCamerasCard');
  const onCamerasTab = document.getElementById('duLoanPanelCamerasTab')?.classList.contains('active');
  if (camerasCard) {
    camerasCard.style.display = '';
    camerasCard.hidden = !onCamerasTab;
  }
  $('#duNearbyCamerasIdle').toggle(!onCamerasTab);
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

async function loadLoansForDisaster(disasterObj, disasterData) {
  expandDuLoansSection();
  $('#encompassLoansSubtitle').text('Loading loans via live /near…');

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
        loanSub += ' — No demo loans in this live /near radius/county; widen radius or verify county.';
      } else {
        loanSub += ' · ops triage rank (not a probability)';
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

function getRiskLevel(score) {
  if (!score) return 'Not Analyzed';
  if (score >= 10) return 'Critical';
  if (score >= 7) return 'High';
  if (score >= 4) return 'Moderate';
  return 'Low';
}

function getRiskClass(score) {
  if (!score) return 'bg-secondary';
  if (score >= 7) return 'bg-danger';
  if (score >= 4) return 'bg-warning';
  return 'bg-success';
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

function setAiInsightsPanelStatus(text) {
  const status = document.getElementById('duAiInsightsStatus');
  if (status) status.textContent = text || '';
}

function expandAiInsightsPanel() {
  const el = document.getElementById('collapseAiInsights');
  if (!el || typeof bootstrap === 'undefined' || !bootstrap.Collapse) return;
  bootstrap.Collapse.getOrCreateInstance(el, { toggle: false }).show();
}

function showInsightsIdlePlaceholder() {
  const container = document.getElementById('aiInsightsContainer');
  if (!container) return;
  setAiInsightsPanelStatus('Select a disaster for tailored insights');
  container.innerHTML = `
    <div id="aiInsightsIdle" class="small text-muted mb-0">
      <i class="bi bi-lightbulb" aria-hidden="true"></i> Select a disaster in the grid for tailored AI insights.
    </div>`;
}

function updateSelectionContextStrip() {
  const el = document.getElementById('selectionContextStrip');
  if (!el || !selectedDisasterObj) {
    if (el) el.hidden = true;
    updateKmlExportButtons();
    return;
  }
  const title = selectedDisasterObj.title || selectedDisasterObj.declarationTitle || 'Selected disaster';
  const state = selectedDisasterObj.state_abbr || '';
  const county = selectedDisasterObj.county_name || '';
  const location = [county, state].filter(Boolean).join(', ');
  const loanLine = lastLoanFilterMeta
    ? DisasterLoanFilters.formatLoanFilterSubtitle(lastLoanFilterMeta, lastAffectedLoans.length)
    : `${lastAffectedLoans.length} mocked loan(s)`;
  const camLine = lastNearbyCameras.length
    ? `${lastNearbyCameras.length} fire camera(s)`
    : 'No cameras in range';
  const nwsLine = lastNearbyWeatherAlerts.length
    ? `${lastNearbyWeatherAlerts.length} weather alert(s)`
    : 'No NWS alerts in range';

  el.hidden = false;
  el.className = 'du-selection-strip alert alert-primary py-2 small mb-3';
  el.innerHTML = '';

  const summary = document.createElement('div');
  summary.className = 'du-selection-strip-summary';
  summary.innerHTML = `<strong class="du-selection-strip-title">${duEscapeHtml(title)}</strong>
    <span class="badge text-bg-light border du-live-near-chip me-1" title="Live GET /api/disasters/near — not graph NEAR">Live /near</span>
    <span class="du-selection-strip-meta text-muted">${duEscapeHtml(location)} · ${duEscapeHtml(loanLine)} · ${duEscapeHtml(camLine)} · ${duEscapeHtml(nwsLine)}</span>`;

  const actions = document.createElement('div');
  actions.className = 'du-selection-strip-actions';
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', 'Selection actions');

  const primaryActions = [
    { label: 'AI video briefing', icon: 'bi-camera-reels', className: 'btn-info text-white', onclick: 'openDisasterHeygenBriefing()' },
    { label: 'Google Earth KML', icon: 'bi-globe-americas', className: 'btn-warning', onclick: 'exportCinematicDisasterKml()' },
    { label: 'Processor expert', icon: 'bi-robot', className: 'btn-light', onclick: 'openProcessorExpert()' },
  ];
  primaryActions.forEach((act) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-sm ${act.className} du-selection-strip-btn`;
    btn.title = act.label;
    btn.setAttribute('aria-label', act.label);
    btn.innerHTML = `<i class="bi ${act.icon}" aria-hidden="true"></i><span class="du-selection-strip-btn-label">${act.label}</span>`;
    btn.addEventListener('click', () => {
      if (act.onclick === 'openDisasterHeygenBriefing()') openDisasterHeygenBriefing();
      else if (act.onclick === 'exportCinematicDisasterKml()') exportCinematicDisasterKml();
      else openProcessorExpert();
    });
    actions.appendChild(btn);
  });

  const overflow = document.createElement('div');
  overflow.className = 'dropdown du-selection-strip-overflow';
  overflow.innerHTML = `<button type="button" class="btn btn-sm btn-outline-primary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" aria-label="More actions">
    <i class="bi bi-three-dots" aria-hidden="true"></i><span class="du-selection-strip-btn-label">More</span>
  </button>
  <ul class="dropdown-menu dropdown-menu-end">
    <li><a class="dropdown-item" href="disasters-webcams.html"><i class="bi bi-camera-video me-1"></i>Hazard webcams</a></li>
    <li><a class="dropdown-item" href="pipeline-risk-dashboard.html"><i class="bi bi-graph-up me-1"></i>FEMA pipeline ops triage</a></li>
    <li><a class="dropdown-item" href="/disaster-impact-graph.html" title="Persisted graph NEAR — as-of reseed (seeded_at), not live distance"><i class="bi bi-diagram-3 me-1"></i>Impact Graph <span class="text-muted small">(as-of reseed)</span></a></li>
  </ul>`;
  actions.appendChild(overflow);

  el.appendChild(summary);
  el.appendChild(actions);
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

function openDisasterHeygenBriefing() {
  if (!selectedDisasterObj) {
    setDashboardStatus('Select a disaster in the grid first.', 'warning');
    return;
  }
  heygenStudio?.openBriefingMode?.();
}

function refreshAIOnSelection() {
  updateSelectionContextStrip();
  refreshAIContext();
  heygenStudio?.refreshScriptPreview?.();
  if (aiInsightsCard && selectedDisasterObj) {
    const title = selectedDisasterObj.title || selectedDisasterObj.declarationTitle || 'Selected disaster';
    setAiInsightsPanelStatus(title);
    expandAiInsightsPanel();
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
    openDuDashboardSection('collapseLoans', 3);
    setTimeout(() => openProcessorExpert(), 600);
  }
}

function getCurrentFilters() {
  return {
    state: $('#stateInput').val(),
    county: $('#countyInput').val(),
    sources: $('#sourceInput').val() || [],
    events: $('#eventInput').val() || []
  };
}

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
        setAiInsightsPanelStatus('Insights for current filters');
        expandAiInsightsPanel();
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


window.selectNearbyWeatherAlert = function selectNearbyWeatherAlert(index) {
  const alert = lastNearbyWeatherAlerts[index];
  if (!alert) return;
  selectDisaster(null, alert);
};

window.exportCinematicDisasterKml = exportCinematicDisasterKml;
window.openDisasterHeygenBriefing = openDisasterHeygenBriefing;


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
  syncSourceChipsFromSelect();
  $('#sourceInput').on('change', () => {
    syncSourceChipsFromSelect();
    scheduleFilterApply();
  });
  $('#eventInput').on('change', scheduleFilterApply);
  $('#stateInput, #countyInput').on('change', scheduleFilterApply);
  function onApplyFiltersClick() {
    applyFiltersNow();
  }
  $('#applyBtn, .du-apply-filters-btn').on('click', function() {
    onApplyFiltersClick();
  });
  document.getElementById('refreshBtnHero')?.addEventListener('click', refreshDisasters);
  document.getElementById('duIngestPostgresBtn')?.addEventListener('click', refreshDisasters);
  const focusPull = () => {
    const heroPull = document.getElementById('refreshBtnHero');
    if (!heroPull) return;
    heroPull.scrollIntoView({ behavior: 'smooth', block: 'center' });
    heroPull.focus({ preventScroll: true });
  };
  document.getElementById('duFocusPullBtn')?.addEventListener('click', focusPull);
  document.getElementById('duJumpToPullLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    focusPull();
  });
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
  if (typeof initDuGeoPicker === 'function') {
    initDuGeoPicker();
  } else {
    hideLoading();
  }
});

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
