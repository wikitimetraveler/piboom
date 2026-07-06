/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — shared state + loading UI
 * Loaded in global scope after prior scripts (see disasters-unified.html).
 */

var disastersGridApi = null;
var map, markers = [], disasterMarkerEntries = [], loanMarkers = [];
var activeDisasterInfoWindow = null;
var lastGridSelectKey = '';
var lastGridSelectAt = 0;
var encompassLoansGridApi = null;
var selectedDisaster = null;
var youtubeBrowserApiKey = null;
var youtubeBrowserApiKeyPromise = null;
var selectedDisasterObj = null;
var selectedDisasterRow = null;
var selectedLoan = null;
var cameraMarkers = [];
var cameraLoadContext = 'disaster';
var lastAffectedLoans = [];
var lastLoanFilterMeta = null;
var lastNearbyCameras = [];
var lastNearbyWeatherAlerts = [];
var nwsGridFilterActive = false;
var nwsGridFilterContext = null;
var aiChatWidget = null;
var aiInsightsCard = null;
var voiceRecognition = null;
var isVoiceListening = false;
var lastGridRows = [];
var lastLoadedDisasterRows = [];
var activeHotspotKey = null;
var activeHotspot = null;
var heygenStudio = null;
var duCountyIntelLoaded = false;
var duSelectedGeoState = null;
var duSelectedGeoCounty = null;
var duMultiPanelMode = false;
var duLoadDisastersGeneration = 0;
var duFilterApplyTimer = null;
var DU_FILTER_APPLY_DEBOUNCE_MS = 400;

function duEscapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showLoadingOverlay(message, progress) {
  const el = document.getElementById('roadRunnerLoading');
  if (!el) return;
  el.classList.remove('hidden');
  el.setAttribute('aria-busy', 'true');
  if (message != null) updateLoadingStatusDisaster(message, progress ?? 0);
}

function hideLoadingOverlay() {
  const el = document.getElementById('roadRunnerLoading');
  if (!el) return;
  setTimeout(() => {
    el.classList.add('hidden');
    el.setAttribute('aria-busy', 'false');
  }, 300);
}

function setDuInlineLoading(active, targets) {
  const ids = targets || ['disastersGrid', 'statsRow', 'sourceHealthLine'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('du-inline-loading', !!active);
    if (id === 'disastersGrid') {
      el.closest('.du-grid-shell')?.classList.toggle('du-inline-loading', !!active);
    }
    if (active) el.setAttribute('aria-busy', 'true');
    else el.removeAttribute('aria-busy');
  });
}

/** Sidebar section collapse ids (section-sidebar-shell) */
var DU_SIDEBAR_SECTION_IDS = [
  'collapseCommandDeck',
  'collapseRiskIntel',
  'collapseFilters',
  'collapseDisasters',
  'collapseMapYouTube',
  'collapseLoans',
];

var cameraIndex = 0;



function showLoading() {
  showLoadingOverlay('Initializing disaster monitoring...', 0);
}

function hideLoading() {
  hideLoadingOverlay();
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
