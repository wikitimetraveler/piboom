/**
 * Development work by David Lane
 */
/**
 * Shared disaster / loan → nearby fire camera helpers (Pipeline Risk + Disasters Unified).
 */
(function (global) {
  'use strict';

  const CAMERAS_API = '/api/disasters/cameras';
  const DEFAULT_CAMERA_LIMIT = 20;

  function resolveLoanCoords(loan) {
    if (!loan) return { lat: null, lng: null };
    const lat = parseFloat(loan.latitude);
    const lng = parseFloat(loan.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
    return { lat: null, lng: null };
  }

  function loanHasCoords(loan) {
    const { lat, lng } = resolveLoanCoords(loan);
    return lat != null && lng != null;
  }

  function getRadiusMiles(selectId, customId) {
    if (global.DisasterLoanFilters) {
      return global.DisasterLoanFilters.getSelectedRadiusMiles(selectId, customId);
    }
    return 50;
  }

  /**
   * @param {{ lat: number, lng: number }|null} center
   * @param {Object} options - radiusMiles, state, county, limit
   */
  function buildCameraQueryParams(center, options) {
    const params = new URLSearchParams();
    const limit = options?.limit ?? DEFAULT_CAMERA_LIMIT;
    params.set('limit', String(limit));

    if (options?.state) {
      params.set('state', String(options.state).trim().toUpperCase());
    }
    if (options?.county) {
      params.set('county', String(options.county).trim());
    }
    if (options?.source) {
      params.set('source', String(options.source).trim().toLowerCase());
    }
    if (options?.hazard) {
      params.set('hazard', String(options.hazard).trim().toLowerCase());
    }
    if (options?.mediaType) {
      params.set('mediaType', String(options.mediaType).trim().toLowerCase());
    }

    if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
      params.set('nearLat', String(center.lat));
      params.set('nearLng', String(center.lng));
      params.set('radiusMiles', String(options?.radiusMiles ?? 50));
    }

    return params;
  }

  function formatCameraDistanceMi(camera) {
    if (camera?.distance_miles != null) {
      return `${camera.distance_miles} mi`;
    }
    return '—';
  }

  function formatCameraFilterSubtitle(meta, count) {
    const { mode, label, radiusMiles, state, county } = meta;
    if (mode === 'distance' && radiusMiles) {
      return `${count} camera${count === 1 ? '' : 's'} within ${radiusMiles} mi of ${label}`;
    }
    if (mode === 'county' && county) {
      return `${count} camera${count === 1 ? '' : 's'} in ${county}${state ? `, ${state}` : ''}`;
    }
    if (state) {
      return `${count} camera${count === 1 ? '' : 's'} in ${state}`;
    }
    return `${count} camera${count === 1 ? '' : 's'}`;
  }

  /**
   * @returns {Promise<{ cameras: Array, meta: Object }>}
   */
  async function fetchNearbyCameras(center, options) {
    const params = buildCameraQueryParams(center, options);
    const hasGeo = center && Number.isFinite(center.lat) && Number.isFinite(center.lng);
    const mode = hasGeo ? 'distance' : (options?.county ? 'county' : 'state');

    const res = await fetch(`${CAMERAS_API}?${params.toString()}`);
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to load cameras');
    }

    const cameras = json.data?.cameras || [];
    const meta = {
      mode,
      label: options?.label || 'selection',
      radiusMiles: options?.radiusMiles,
      state: options?.state,
      county: options?.county,
      hasGeo
    };

    return { cameras, meta };
  }

  /**
   * Build center + options from disaster selection.
   */
  function buildDisasterCameraRequest(disasterObj, disasterData, radiusMiles) {
    const DLF = global.DisasterLoanFilters;
    if (!DLF) {
      return { center: null, options: {} };
    }
    const normalized = DLF.normalizeDisasterForFilters(disasterObj, disasterData);
    const hasCoords = DLF.disasterHasCoords(normalized, disasterData);
    const state = DLF.getDisasterState(disasterObj, disasterData) || 'CA';
    const county = DLF.getDisasterCounty(disasterObj, disasterData);
    const label = DLF.getDisasterTitle(disasterObj, disasterData);

    if (hasCoords) {
      const coords = DLF.resolveDisasterCoords(normalized, disasterData);
      return {
        center: { lat: coords.lat, lng: coords.lng },
        options: { radiusMiles, state, county, label }
      };
    }

    return {
      center: null,
      options: { state, county, label }
    };
  }

  /**
   * Build center + options from loan selection.
   */
  function buildLoanCameraRequest(loan, radiusMiles) {
    const coords = resolveLoanCoords(loan);
    const state = (loan?.state || 'CA').toString().trim();
    const county = loan?.county
      ? (global.DisasterLoanFilters?.normalizeCounty(loan.county) || loan.county)
      : '';
    const label = loan?.loan_number
      ? `loan ${loan.loan_number}`
      : (loan?.borrower_name || 'property');

    if (coords.lat != null) {
      return {
        center: coords,
        options: { radiusMiles, state, county, label }
      };
    }

    return {
      center: null,
      options: { state, county, label }
    };
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function storeCameraForViewer(camera, index) {
    global.cameraDataStore = global.cameraDataStore || {};
    const key = `cam-${camera.source_id || camera.id || index}`;
    global.cameraDataStore[key] = camera;
    return key;
  }

  function getCameraMapIcon(camera) {
    const src = (camera && camera.source) || 'alertcalifornia';
    if (global.mapIcons && typeof global.mapIcons.getDisasterIconForMarker === 'function') {
      return global.mapIcons.getDisasterIconForMarker('camera', src);
    }
    if (global.mapIcons && global.mapIcons.disaster && global.mapIcons.disaster.camera) {
      const c = global.mapIcons.disaster.camera;
      if (typeof google !== 'undefined' && google.maps) {
        return {
          url: c.url,
          scaledSize: new google.maps.Size(c.scaledSize.width, c.scaledSize.height),
          anchor: new google.maps.Point(c.anchor.x, c.anchor.y)
        };
      }
      return { url: c.url };
    }
    return { url: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png' };
  }

  /**
   * @param {google.maps.Map} gmap
   * @param {Array} cameras
   * @param {Array} markerBucket - mutable array to push { marker, key }
   */
  function addCameraMarkersToMap(gmap, cameras, markerBucket) {
    if (!gmap || !Array.isArray(cameras)) return;
    cameras.forEach((camera, index) => {
      const lat = parseFloat(camera.lat);
      const lng = parseFloat(camera.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const icon = getCameraMapIcon(camera);
      const key = storeCameraForViewer(camera, index);
      const title = camera.title || camera.name || 'Webcam';
      const dist = formatCameraDistanceMi(camera);
      const loc = [camera.county_name, camera.state_abbr].filter(Boolean).join(', ') || '—';
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: gmap,
        title,
        icon
      });
      const info = new google.maps.InfoWindow({
        content: `<div style="min-width:180px;"><strong>${escapeHtml(title)}</strong><br><span class="text-muted small">${escapeHtml(camera.source || '')}</span><br>${escapeHtml(loc)}<br>${dist !== '—' ? dist + ' away' : ''}<br><button type="button" class="btn btn-sm btn-warning mt-1" onclick="openCameraViewerFromMarker('${key}')">View feed</button></div>`
      });
      marker.addListener('click', () => info.open(gmap, marker));
      markerBucket.push({ marker, key });
    });
  }

  function buildNearbyCamerasListHtml(cameras, emptyMessage) {
    if (!cameras.length) {
      return `<p class="text-muted small mb-0">${escapeHtml(emptyMessage)}</p>`;
    }
    let html = '<div class="list-group list-group-flush">';
    cameras.forEach((camera, index) => {
      const key = storeCameraForViewer(camera, index);
      const name = escapeHtml(camera.title || camera.name || 'Camera');
      const loc = escapeHtml([camera.county_name, camera.state_abbr].filter(Boolean).join(', ') || '—');
      const src = escapeHtml(camera.source || '');
      const dist = escapeHtml(formatCameraDistanceMi(camera));
      html += `<div class="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
        <div class="me-2">
          <div class="fw-semibold small">${name}</div>
          <div class="text-muted small">${src ? src + ' · ' : ''}${loc} · ${dist}</div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-warning" onclick="openCameraViewerFromMarker('${key}')">
          <i class="bi bi-camera-video"></i> View
        </button>
      </div>`;
    });
    html += '</div>';
    return html;
  }

  global.DisasterCameraFilters = {
    CAMERAS_API,
    DEFAULT_CAMERA_LIMIT,
    resolveLoanCoords,
    loanHasCoords,
    getRadiusMiles,
    buildCameraQueryParams,
    formatCameraDistanceMi,
    formatCameraFilterSubtitle,
    fetchNearbyCameras,
    buildDisasterCameraRequest,
    buildLoanCameraRequest,
    escapeHtml,
    storeCameraForViewer,
    getCameraMapIcon,
    addCameraMarkersToMap,
    buildNearbyCamerasListHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
