/**
 * Development work by David Lane
 */
/**
 * Unified Disasters → Encompass map handoff (URL + sessionStorage).
 * Prefer URL query; fall back to sessionStorage when URL is incomplete.
 * No backend API — map page re-fetches loans via DisasterLoanFilters.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'duEncompassMapHandoffV1';
  const MAP_PAGE_PATH = '/finance/disasters-encompass-map.html';
  const UNIFIED_PAGE_PATH = '/finance/disasters-unified.html';

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseFinite(value) {
    if (value == null || value === '') return null;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeScopeMode(mode) {
    return mode === 'county' ? 'county' : 'distance';
  }

  function normalizePlaceScope(scope) {
    const s = String(scope || '').toLowerCase();
    if (s === 'county' || s === 'state' || s === 'usa') return s;
    return null;
  }

  function buildHandoffFromSelection(disasterObj, disasterData, options) {
    const DLF = global.DisasterLoanFilters;
    const opts = options || {};
    const coords = DLF
      ? DLF.resolveDisasterCoords(disasterObj, disasterData)
      : { lat: parseFinite(disasterObj?.lat ?? disasterObj?.latitude), lng: parseFinite(disasterObj?.lng ?? disasterObj?.longitude) };
    const state = DLF
      ? DLF.getDisasterState(disasterObj, disasterData)
      : String(disasterObj?.state_abbr || disasterObj?.state || '').trim();
    const county = DLF
      ? DLF.getDisasterCounty(disasterObj, disasterData)
      : String(disasterObj?.county_name || disasterObj?.county || '').trim();
    const title = DLF
      ? DLF.getDisasterTitle(disasterObj, disasterData)
      : String(disasterObj?.title || disasterObj?.declarationTitle || 'Selected disaster').trim();
    const radiusDefault = DLF?.DEFAULT_RADIUS_MILES || 100;
    const radiusMiles = parseFinite(opts.radiusMiles);
    return {
      source: String(disasterObj?.source || '').trim(),
      source_id: String(disasterObj?.source_id ?? disasterObj?.sourceId ?? '').trim(),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      state: String(state || '').trim(),
      county: String(county || '').trim(),
      title: String(title || 'Selected disaster').trim(),
      event_type: String(disasterObj?.event_type || disasterObj?.incidentType || '').trim(),
      scopeMode: normalizeScopeMode(opts.scopeMode),
      radiusMiles: radiusMiles != null && radiusMiles >= 1 && radiusMiles <= 500
        ? radiusMiles
        : radiusDefault,
      placeScope: normalizePlaceScope(opts.placeScope),
      from: 'unified',
      writtenAt: Date.now(),
    };
  }

  function writeHandoff(payload) {
    if (!payload || typeof payload !== 'object') return;
    try {
      global.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('duEncompassMapHandoff write failed:', err);
    }
  }

  function readHandoffFromStorage() {
    try {
      const raw = global.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function readHandoffFromUrl(search) {
    const params = search instanceof URLSearchParams
      ? search
      : new URLSearchParams(String(search || global.location?.search || ''));
    const lat = parseFinite(params.get('lat'));
    const lng = parseFinite(params.get('lng'));
    const radiusMiles = parseFinite(params.get('radius') || params.get('radiusMiles'));
    const hasAny = params.has('source')
      || params.has('source_id')
      || params.has('state')
      || params.has('title')
      || lat != null
      || lng != null;
    if (!hasAny) return null;
    return {
      source: String(params.get('source') || '').trim(),
      source_id: String(params.get('source_id') || '').trim(),
      lat,
      lng,
      state: String(params.get('state') || '').trim(),
      county: String(params.get('county') || '').trim(),
      title: String(params.get('title') || '').trim(),
      event_type: String(params.get('event_type') || params.get('eventType') || '').trim(),
      scopeMode: normalizeScopeMode(params.get('mode') || params.get('scopeMode')),
      radiusMiles: radiusMiles != null && radiusMiles >= 1 && radiusMiles <= 500
        ? radiusMiles
        : (global.DisasterLoanFilters?.DEFAULT_RADIUS_MILES || 100),
      placeScope: normalizePlaceScope(params.get('placeScope') || params.get('scope')),
      from: String(params.get('from') || '').trim() || 'url',
      writtenAt: null,
    };
  }

  function identityKey(payload) {
    if (!payload) return '';
    const sid = String(payload.source_id || '').trim();
    const src = String(payload.source || '').trim();
    if (src || sid) return `${src}|${sid}`;
    return '';
  }

  function mergeHandoff(urlPayload, storagePayload) {
    if (!urlPayload && !storagePayload) return null;
    if (!urlPayload) return storagePayload;
    if (!storagePayload) return urlPayload;

    const urlKey = identityKey(urlPayload);
    const storeKey = identityKey(storagePayload);
    if (urlKey && storeKey && urlKey !== storeKey) {
      // URL identity wins; do not mix another event's stored title/meta.
      return { ...urlPayload };
    }

    const merged = { ...storagePayload, ...urlPayload };
    // Prefer non-empty URL strings; fill blanks from storage.
    ['source', 'source_id', 'state', 'county', 'title', 'event_type', 'from'].forEach((key) => {
      if (!merged[key] && storagePayload[key]) merged[key] = storagePayload[key];
    });
    if (merged.lat == null && storagePayload.lat != null) merged.lat = storagePayload.lat;
    if (merged.lng == null && storagePayload.lng != null) merged.lng = storagePayload.lng;
    if (!merged.placeScope && storagePayload.placeScope) merged.placeScope = storagePayload.placeScope;
    if (merged.radiusMiles == null && storagePayload.radiusMiles != null) {
      merged.radiusMiles = storagePayload.radiusMiles;
    }
    return merged;
  }

  function readHandoff(search) {
    return mergeHandoff(readHandoffFromUrl(search), readHandoffFromStorage());
  }

  function isHandoffUsable(payload) {
    if (!payload || typeof payload !== 'object') return false;
    const hasPlace = !!(payload.state || payload.county || payload.title || payload.source || payload.source_id);
    const hasCoords = Number.isFinite(payload.lat) && Number.isFinite(payload.lng);
    return hasPlace || hasCoords;
  }

  function buildMapPageUrl(payload, basePath) {
    const path = basePath || MAP_PAGE_PATH;
    const params = new URLSearchParams();
    if (payload.source) params.set('source', payload.source);
    if (payload.source_id) params.set('source_id', payload.source_id);
    if (payload.state) params.set('state', payload.state);
    if (payload.county) params.set('county', payload.county);
    if (Number.isFinite(payload.lat)) params.set('lat', String(payload.lat));
    if (Number.isFinite(payload.lng)) params.set('lng', String(payload.lng));
    if (payload.scopeMode) params.set('mode', payload.scopeMode);
    if (Number.isFinite(payload.radiusMiles)) params.set('radius', String(payload.radiusMiles));
    if (payload.event_type) params.set('event_type', payload.event_type);
    if (payload.title) params.set('title', payload.title);
    if (payload.placeScope) params.set('placeScope', payload.placeScope);
    params.set('from', payload.from || 'unified');
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  }

  function buildUnifiedBackUrl(payload, basePath) {
    const path = basePath || UNIFIED_PAGE_PATH;
    const params = new URLSearchParams();
    if (payload?.state) params.set('state', payload.state);
    if (payload?.county) params.set('county', payload.county);
    params.set('load', '1');
    return `${path}?${params.toString()}`;
  }

  function collectUnifiedOpenOptions() {
    const DLF = global.DisasterLoanFilters;
    const scopeMode = global.document?.getElementById('duLoanScopeMode')?.value
      || 'distance';
    const radiusMiles = DLF
      ? DLF.getSelectedRadiusMiles('duLoanRadiusMiles', 'duLoanRadiusCustom')
      : (DLF?.DEFAULT_RADIUS_MILES || 100);
    const placeScope = typeof global.duGeoLoadScope === 'string' ? global.duGeoLoadScope : null;
    return { scopeMode, radiusMiles, placeScope };
  }

  /**
   * Write handoff + navigate same-tab to Encompass map page.
   */
  function openEncompassMap(disasterObj, disasterData, options) {
    const payload = buildHandoffFromSelection(
      disasterObj,
      disasterData,
      { ...collectUnifiedOpenOptions(), ...(options || {}) }
    );
    if (!isHandoffUsable(payload)) {
      console.warn('Encompass map handoff incomplete — select a disaster with place or coordinates.');
      return false;
    }
    writeHandoff(payload);
    global.location.href = buildMapPageUrl(payload);
    return true;
  }

  global.DuEncompassMapHandoff = {
    STORAGE_KEY,
    MAP_PAGE_PATH,
    UNIFIED_PAGE_PATH,
    escapeHtml,
    buildHandoffFromSelection,
    writeHandoff,
    readHandoffFromStorage,
    readHandoffFromUrl,
    mergeHandoff,
    readHandoff,
    isHandoffUsable,
    buildMapPageUrl,
    buildUnifiedBackUrl,
    collectUnifiedOpenOptions,
    openEncompassMap,
  };
})(typeof window !== 'undefined' ? window : globalThis);
