const filtersForm = document.getElementById('analyticsFilters');
const stateInput = document.getElementById('analyticsState');
const limitInput = document.getElementById('analyticsLimit');
const calcSummaryShell = document.getElementById('calcSummary');
const ratioShell = document.getElementById('ratioBuckets');
const ratioMeta = document.getElementById('ratioMeta');
const ratioPlaceholder = document.getElementById('ratioChartPlaceholder');
const mapMeta = document.getElementById('mapMeta');
const cubeMeta = document.getElementById('cubeMeta');
const statusToast = document.getElementById('statusToast');
const statusToastMessage = document.getElementById('statusToastMessage');

let mapInstance;
let currentDeckLayer;
let cubeScene;
let cubeCamera;
let cubeRenderer;
let cubeObjects = [];
let animationFrame;

if (window.maplibregl && !window.mapboxgl) {
  window.mapboxgl = window.maplibregl;
}

filtersForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  loadAnalytics();
});

window.addEventListener('resize', () => {
  resizeCubeRenderer();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(animationFrame);
  } else {
    animateCubeScene();
  }
});

initMap();
initCubeScene();
loadAnalytics();

async function loadAnalytics() {
  const query = buildQuery();
  const summaryPromise = fetchJSON(`/api/encompass-hub/analytics/calc-summary${query}`);
  const ratioPromise = fetchJSON(`/api/encompass-hub/analytics/ratios${query}`);
  const mapPromise = fetchJSON(`/api/encompass-hub/visualizations/map3d${query}`);
  const cubesPromise = fetchJSON(`/api/encompass-hub/visualizations/stacked-cubes${query}`);

  try {
    const [summary, ratios, mapData, cubeData] = await Promise.all([
      summaryPromise,
      ratioPromise,
      mapPromise,
      cubesPromise,
    ]);
    renderCalcSummary(summary?.summary);
    renderRatios(ratios?.ratios, ratios?.count);
    updateMapLayer(mapData?.features || [], mapData?.meta);
    renderCubeData(cubeData?.groups || []);
    hideToast();
  } catch (error) {
    console.error('Analytics dashboard failed to load:', error);
    showToast(error.message || 'Unable to load analytics data.');
  }
}

function buildQuery() {
  const params = new URLSearchParams();
  if (stateInput?.value) {
    params.append('state', stateInput.value.trim());
  }
  if (limitInput?.value) {
    params.append('limit', limitInput.value);
  }
  return params.toString() ? `?${params.toString()}` : '';
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

function renderCalcSummary(summary) {
  if (!summary) {
    calcSummaryShell.innerHTML = '<p class="text-muted mb-0">No calculator data available.</p>';
    return;
  }
  const cards = [
    {
      label: 'Total Loans',
      value: summary.totals.count ?? 0,
      suffix: '',
    },
    {
      label: 'Total Volume',
      value: formatCurrency(summary.totals.totalVolume),
    },
    {
      label: 'Avg Loan',
      value: formatCurrency(summary.totals.averageLoanAmount),
    },
    {
      label: 'Avg Housing Ratio',
      value: formatPercent(summary.totals.averageHousingRatio),
    },
    {
      label: 'Avg Total DTI',
      value: formatPercent(summary.totals.averageDTI),
    },
  ];
  calcSummaryShell.innerHTML = cards
    .map(
      (card) => `
      <div class="kpi-card border-bottom pb-3 mb-3">
        <small class="text-uppercase text-muted">${card.label}</small>
        <div class="h4 mb-0">${card.value ?? '—'}${card.suffix ?? ''}</div>
      </div>
    `,
    )
    .join('');
}

function renderRatios(ratios, count = 0) {
  if (!ratios) {
    ratioMeta.textContent = 'No ratio data';
    ratioShell.innerHTML = '';
    ratioPlaceholder.style.display = 'block';
    return;
  }
  ratioMeta.textContent = `${count || 0} loans`;
  ratioPlaceholder.style.display = 'none';
  const chips = [];
  const housingBuckets = ratios.bucketCounts?.housing || [];
  const totalBuckets = ratios.bucketCounts?.total || [];

  chips.push('<p class="text-muted mb-2">Housing Ratio Buckets</p>');
  housingBuckets.forEach((bucket) => {
    chips.push(`<span class="ratio-chip"><i class="bi bi-house"></i> ${bucket.id}: ${bucket.value}</span>`);
  });

  chips.push('<p class="text-muted mt-3 mb-2">Total DTI Buckets</p>');
  totalBuckets.forEach((bucket) => {
    chips.push(`<span class="ratio-chip"><i class="bi bi-percent"></i> ${bucket.id}: ${bucket.value}</span>`);
  });

  ratioShell.innerHTML = chips.join('');
}

function initMap() {
  if (!window.maplibregl) {
    mapMeta.textContent = 'Map library unavailable.';
    return;
  }

  mapInstance = new maplibregl.Map({
    container: 'mapCanvas',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    center: [-98.5795, 39.8283],
    zoom: 3.5,
    pitch: 45,
    bearing: -20,
  });
  mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');
}

function updateMapLayer(features, meta = {}) {
  if (!mapInstance || !window.deck) {
    mapMeta.textContent = 'Map unavailable.';
    return;
  }
  if (!mapInstance.isStyleLoaded()) {
    mapInstance.once('load', () => updateMapLayer(features, meta));
    return;
  }
  const palette = {
    '760_plus': [26, 188, 156],
    '720_759': [52, 152, 219],
    '680_719': [155, 89, 182],
    '640_679': [241, 196, 15],
    sub_640: [231, 76, 60],
    unknown: [189, 195, 199],
  };
  const data = features.map((feature) => {
    const { longitude, latitude } = feature.coordinates || {};
    return {
      position: [longitude || 0, latitude || 0],
      elevation: feature.altitude || 0,
      properties: feature.properties || {},
      color: palette[feature.colorKey] || palette.unknown,
    };
  });

  if (currentDeckLayer && mapInstance.getLayer('loan-columns')) {
    mapInstance.removeLayer('loan-columns');
    currentDeckLayer = null;
  }

  if (!data.length) {
    mapMeta.textContent = 'No map data for current filter.';
    return;
  }

  currentDeckLayer = new deck.MapboxLayer({
    id: 'loan-columns',
    type: deck.ColumnLayer,
    data,
    diskResolution: 12,
    radius: 2000,
    extruded: true,
    elevationScale: 0.0015,
    getPosition: (d) => d.position,
    getFillColor: (d) => d.color,
    getElevation: (d) => d.elevation || 0,
    pickable: true,
    autoHighlight: true,
  });

  mapInstance.addLayer(currentDeckLayer);
  mapMeta.textContent = `${meta?.loans ?? data.length} loans · Geocodes used: ${meta?.geocodeRequestsUsed ?? 0}`;
}

function initCubeScene() {
  const canvas = document.getElementById('cubeCanvas');
  if (!canvas || !window.THREE) {
    cubeMeta.textContent = '3D renderer unavailable.';
    return;
  }

  cubeScene = new THREE.Scene();
  cubeScene.background = new THREE.Color(0x0b132b);

  cubeCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  cubeCamera.position.set(0, 25, 30);
  cubeCamera.lookAt(0, 0, 0);

  cubeRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  cubeRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
  cubeRenderer.setPixelRatio(window.devicePixelRatio || 1);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(10, 25, 15);
  cubeScene.add(ambientLight);
  cubeScene.add(directional);

  animateCubeScene();
}

function renderCubeData(groups) {
  if (!cubeScene) {
    cubeMeta.textContent = 'Renderer unavailable.';
    return;
  }
  cubeObjects.forEach((mesh) => {
    cubeScene.remove(mesh);
    mesh.geometry?.dispose();
    mesh.material?.dispose();
  });
  cubeObjects = [];

  if (!groups.length) {
    cubeMeta.textContent = 'No stacked cube data.';
    return;
  }

  const palette = {
    principalInterest: 0x3498db,
    hazardInsurance: 0xe67e22,
    taxes: 0x2ecc71,
    mortgageInsurance: 0x9b59b6,
    hoa: 0xe74c3c,
    other: 0xf1c40f,
  };

  const visible = groups.slice(0, 8);
  const spacing = 6;
  const scale = computeScale(visible);

  visible.forEach((group, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const baseX = col * spacing - spacing * 1.5;
    const baseZ = row * spacing - spacing * 0.5;
    let currentHeight = 0;

    (group.paymentStack || []).forEach((segment) => {
      const value = segment.value || 0;
      const height = Math.max(value / scale, 0.3);
      const geometry = new THREE.BoxGeometry(2, height, 2);
      const material = new THREE.MeshStandardMaterial({
        color: palette[segment.id] || 0x95a5a6,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(baseX, currentHeight + height / 2, baseZ);
      cubeScene.add(mesh);
      cubeObjects.push(mesh);
      currentHeight += height;
    });

    const labelGeometry = new THREE.BoxGeometry(2.4, 0.08, 2.4);
    const labelMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
    const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
    labelMesh.position.set(baseX, 0.04, baseZ);
    cubeScene.add(labelMesh);
    cubeObjects.push(labelMesh);
  });

  cubeMeta.textContent = `${groups.length} regions · scale 1:${Math.round(scale)}`;
}

function computeScale(groups) {
  const maxValue = Math.max(
    ...groups.map((group) =>
      (group.paymentStack || []).reduce((sum, part) => sum + (part.value || 0), 0),
    ),
    1,
  );
  return maxValue / 10;
}

function animateCubeScene() {
  if (!cubeRenderer || !cubeScene || !cubeCamera) {
    return;
  }
  cubeObjects.forEach((mesh) => {
    mesh.rotation.y += 0.002;
  });
  cubeRenderer.render(cubeScene, cubeCamera);
  animationFrame = requestAnimationFrame(animateCubeScene);
}

function resizeCubeRenderer() {
  if (!cubeRenderer || !cubeCamera) {
    return;
  }
  const canvas = cubeRenderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  cubeCamera.aspect = width / height;
  cubeCamera.updateProjectionMatrix();
  cubeRenderer.setSize(width, height, false);
}

function showToast(message) {
  if (!statusToast || !statusToastMessage) return;
  statusToastMessage.textContent = message;
  statusToast.classList.add('show');
}

function hideToast() {
  statusToast?.classList.remove('show');
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Number(value).toFixed(1)}%`;
}

