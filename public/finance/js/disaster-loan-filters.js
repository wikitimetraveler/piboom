/**
 * Shared disaster → loan filter helpers (Pipeline Risk + Disasters Unified).
 */
(function (global) {
  const RADIUS_STORAGE_KEY = 'disasterLoanRadiusMiles';
  const DEFAULT_RADIUS_MILES = 50;

  function calculateDistance(lat1, lng1, lat2, lng2) {
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
      return null;
    }
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
      * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function normalizeCounty(name) {
    return String(name || '').replace(/\s*\(County\)$/i, '').trim();
  }

  /**
   * Resolve lat/lng from disaster object and/or unified table row array.
   * @returns {{ lat: number|null, lng: number|null }}
   */
  function resolveDisasterCoords(disasterObj, disasterData) {
    const tryPair = (latVal, lngVal) => {
      const lat = parseFloat(latVal);
      const lng = parseFloat(lngVal);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
      return { lat: null, lng: null };
    };

    if (disasterObj) {
      const fromObj = tryPair(
        disasterObj.latitude ?? disasterObj.lat,
        disasterObj.longitude ?? disasterObj.lng
      );
      if (fromObj.lat != null) return fromObj;

      const raw = disasterObj.raw;
      if (raw && typeof raw === 'object') {
        const fromRaw = tryPair(
          raw.latitude ?? raw.lat ?? raw.LATITUDE,
          raw.longitude ?? raw.lng ?? raw.LONGITUDE
        );
        if (fromRaw.lat != null) return fromRaw;
      }
    }

    if (disasterObj && disasterObj.avg_latitude != null && disasterObj.avg_longitude != null) {
      const fromAvg = tryPair(disasterObj.avg_latitude, disasterObj.avg_longitude);
      if (fromAvg.lat != null) return fromAvg;
    }

    return { lat: null, lng: null };
  }

  function disasterHasCoords(disasterObj, disasterData) {
    const { lat, lng } = resolveDisasterCoords(disasterObj, disasterData);
    return lat != null && lng != null;
  }

  /** Object with lat/lng filled for downstream helpers */
  function normalizeDisasterForFilters(disasterObj, disasterData) {
    const coords = resolveDisasterCoords(disasterObj, disasterData);
    if (!disasterObj) {
      return coords.lat != null ? { lat: coords.lat, lng: coords.lng } : null;
    }
    if (coords.lat == null) return disasterObj;
    return {
      ...disasterObj,
      lat: disasterObj.lat ?? coords.lat,
      lng: disasterObj.lng ?? coords.lng,
      latitude: disasterObj.latitude ?? coords.lat,
      longitude: disasterObj.longitude ?? coords.lng
    };
  }

  function getDisasterState(disasterObj, disasterData) {
    return (
      disasterObj?.state
      || disasterObj?.state_abbr
      || (Array.isArray(disasterData) ? disasterData[3] : '')
      || ''
    ).toString().trim();
  }

  function getDisasterCounty(disasterObj, disasterData) {
    const fromObj = disasterObj?.county || disasterObj?.county_name;
    if (fromObj) return normalizeCounty(fromObj);
    if (!Array.isArray(disasterData)) return '';
    // FEMA pipeline table rows are wider; unified disasters rows are shorter
    if (disasterData.length >= 12) return normalizeCounty(disasterData[4]);
    return normalizeCounty(disasterData[2]);
  }

  function getDisasterTitle(disasterObj, disasterData) {
    const fromObj = disasterObj?.declarationTitle || disasterObj?.title;
    if (fromObj) return String(fromObj).trim();
    if (!Array.isArray(disasterData)) return 'Selected disaster';
    if (disasterData.length >= 12) return String(disasterData[2] || '').trim();
    return String(disasterData[6] || disasterData[2] || '').trim();
  }

  function getStoredRadiusMiles() {
    const stored = parseFloat(sessionStorage.getItem(RADIUS_STORAGE_KEY));
    return Number.isFinite(stored) && stored >= 1 && stored <= 500
      ? stored
      : DEFAULT_RADIUS_MILES;
  }

  function setStoredRadiusMiles(miles) {
    sessionStorage.setItem(RADIUS_STORAGE_KEY, String(miles));
  }

  /**
   * Read radius from preset select + optional custom input.
   * @param {string} selectId
   * @param {string} customId
   */
  function getSelectedRadiusMiles(selectId, customId) {
    const select = document.getElementById(selectId);
    if (!select) return getStoredRadiusMiles();
    if (select.value === 'custom') {
      const custom = document.getElementById(customId);
      const n = parseFloat(custom?.value);
      if (Number.isFinite(n) && n >= 1 && n <= 500) {
        setStoredRadiusMiles(n);
        return n;
      }
      return getStoredRadiusMiles();
    }
    const preset = parseFloat(select.value);
    if (Number.isFinite(preset)) {
      setStoredRadiusMiles(preset);
      return preset;
    }
    return DEFAULT_RADIUS_MILES;
  }

  function syncRadiusCustomVisibility(selectId, customWrapId) {
    const select = document.getElementById(selectId);
    const wrap = document.getElementById(customWrapId);
    if (!select || !wrap) return;
    wrap.style.display = select.value === 'custom' ? '' : 'none';
  }

  /**
   * Default scope when disaster is selected.
   */
  function defaultScopeMode(disasterObj, disasterData) {
    return disasterHasCoords(disasterObj, disasterData) ? 'distance' : 'county';
  }

  /**
   * Build query string params for GET /api/loan-pipeline/loans
   */
  function buildLoanQueryParams(disasterObj, disasterData, options) {
    const normalized = normalizeDisasterForFilters(disasterObj, disasterData);
    const mode = options?.mode || defaultScopeMode(normalized, disasterData);
    const state = getDisasterState(disasterObj, disasterData);
    const county = getDisasterCounty(disasterObj, disasterData);
    const params = new URLSearchParams();

    if (state) {
      params.set('state', state);
    }

    if (mode === 'county' && county) {
      params.set('county', county);
    }

    if (mode === 'distance' && disasterHasCoords(normalized, disasterData)) {
      const { lat, lng } = resolveDisasterCoords(normalized, disasterData);
      params.set('nearLat', String(lat));
      params.set('nearLng', String(lng));
      params.set('radiusMiles', String(options?.radiusMiles ?? DEFAULT_RADIUS_MILES));
    }

    return {
      params,
      mode,
      state,
      county,
      title: getDisasterTitle(disasterObj, disasterData)
    };
  }

  function formatLoanFilterSubtitle(meta, count) {
    const { mode, state, county, title, radiusMiles } = meta;
    if (mode === 'distance' && radiusMiles) {
      return `${count} loan${count === 1 ? '' : 's'} within ${radiusMiles} mi of ${title}${state ? ` (${state})` : ''}`;
    }
    if (mode === 'county' && county) {
      return `${count} loan${count === 1 ? '' : 's'} in ${county}${state ? `, ${state}` : ''} — ${title}`;
    }
    if (state) {
      return `${count} loan${count === 1 ? '' : 's'} in ${state} — ${title}`;
    }
    return `${count} loan${count === 1 ? '' : 's'} — ${title}`;
  }

  function getDistanceValue(loan, disasterObj, disasterData) {
    const normalized = normalizeDisasterForFilters(disasterObj, disasterData);
    if (!disasterHasCoords(normalized, disasterData)) return 999999;
    const lat = parseFloat(loan.latitude);
    const lng = parseFloat(loan.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 999998;
    const coords = resolveDisasterCoords(normalized, disasterData);
    const dLat = coords.lat;
    const dLng = coords.lng;
    const km = calculateDistance(lat, lng, dLat, dLng);
    return km !== null ? km : 999999;
  }

  function formatDistance(loan, disasterObj, disasterData) {
    const normalized = normalizeDisasterForFilters(disasterObj, disasterData);
    if (!disasterHasCoords(normalized, disasterData)) {
      return '<span class="text-muted">N/A</span>';
    }
    const lat = parseFloat(loan.latitude);
    const lng = parseFloat(loan.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return '<span class="text-muted">No coordinates</span>';
    }
    const coords = resolveDisasterCoords(normalized, disasterData);
    const dLat = coords.lat;
    const dLng = coords.lng;
    const distanceKm = calculateDistance(lat, lng, dLat, dLng);
    if (distanceKm === null) {
      return '<span class="text-muted">N/A</span>';
    }
    const milesRounded = Math.round(distanceKm * 0.621371 * 10) / 10;
    let distanceClass = 'text-success';
    if (distanceKm < 10) distanceClass = 'text-danger fw-bold';
    else if (distanceKm < 25) distanceClass = 'text-warning fw-bold';
    else if (distanceKm < 50) distanceClass = 'text-info';
    return `<span class="${distanceClass}" data-sort="${distanceKm}" title="${Math.round(distanceKm * 10) / 10} km / ${milesRounded} mi">
      <i class="bi bi-geo-alt"></i> ${milesRounded} mi
    </span>`;
  }

  global.DisasterLoanFilters = {
    DEFAULT_RADIUS_MILES,
    RADIUS_STORAGE_KEY,
    calculateDistance,
    normalizeCounty,
    resolveDisasterCoords,
    normalizeDisasterForFilters,
    disasterHasCoords,
    getDisasterState,
    getDisasterCounty,
    getDisasterTitle,
    getStoredRadiusMiles,
    setStoredRadiusMiles,
    getSelectedRadiusMiles,
    syncRadiusCustomVisibility,
    defaultScopeMode,
    buildLoanQueryParams,
    formatLoanFilterSubtitle,
    getDistanceValue,
    formatDistance
  };
})(typeof window !== 'undefined' ? window : globalThis);
