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

var cameraIndex = 0;



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
