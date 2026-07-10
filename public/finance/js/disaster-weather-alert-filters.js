/**
 * Development work by David Lane
 */
/**
 * Shared disaster → nearby NOAA/NWS weather alert helpers (Disasters Unified).
 */
(function (global) {
  'use strict';

  const NEAR_API = '/api/disasters/near';
  const DEFAULT_ALERT_LIMIT = 50;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeSource(source) {
    const s = String(source || '').trim().toLowerCase();
    if (s === 'noaa') return 'nws';
    return s;
  }

  function isNwsAlert(row) {
    return normalizeSource(row?.source) === 'nws';
  }

  function alertMatchKey(alert) {
    if (!alert) return '';
    return `${alert.source || ''}|${alert.source_id || ''}|${alert.start_time || ''}|${alert.lat ?? ''}|${alert.lng ?? ''}`;
  }

  function normalizeCounty(name) {
    if (global.DisasterLoanFilters?.normalizeCounty) {
      return global.DisasterLoanFilters.normalizeCounty(name);
    }
    return String(name || '').replace(/\s*\(County\)$/i, '').trim();
  }

  function countiesMatch(rowCounty, filterCounty) {
    const a = normalizeCounty(rowCounty).toLowerCase();
    const b = normalizeCounty(filterCounty).toLowerCase();
    if (!a || !b) return true;
    return a.includes(b) || b.includes(a);
  }

  function filterAlertsByAdmin(alerts, state, county) {
    const st = String(state || '').trim().toUpperCase();
    const hasCounty = !!normalizeCounty(county);
    return (alerts || []).filter((row) => {
      if (!isNwsAlert(row)) return false;
      if (st && String(row.state_abbr || '').trim().toUpperCase() !== st) return false;
      if (hasCounty && !countiesMatch(row.county_name, county)) return false;
      return true;
    });
  }

  function excludeAlertByKey(alerts, excludeKey) {
    if (!excludeKey) return alerts || [];
    return (alerts || []).filter((row) => alertMatchKey(row) !== excludeKey);
  }

  function formatAlertDistanceMi(alert) {
    if (alert?.distance_miles != null) {
      return `${alert.distance_miles} mi`;
    }
    return '—';
  }

  function formatAlertSeverity(alert) {
    const severity = String(alert?.severity || alert?.raw?.severity || '').trim();
    if (!severity) return '';
    return severity;
  }

  function formatAlertEventType(alert) {
    const event = String(alert?.event_type || alert?.raw?.event || '').trim();
    if (!event) return 'Alert';
    return event.charAt(0).toUpperCase() + event.slice(1);
  }

  function formatWeatherAlertFilterSubtitle(meta, count) {
    const { mode, label, radiusMiles, state, county } = meta;
    const noun = `${count} weather alert${count === 1 ? '' : 's'}`;
    if (mode === 'distance' && radiusMiles) {
      return `${noun} within ${radiusMiles} mi of ${label}`;
    }
    if (mode === 'county' && county) {
      return `${noun} in ${county}${state ? `, ${state}` : ''}`;
    }
    if (state) {
      return `${noun} in ${state}`;
    }
    return noun;
  }

  /**
   * @param {Array} localRows - full disaster rows already loaded in the grid
   * @param {Object} options - state, county, excludeKey
   */
  function fetchWeatherAlertsFromLocalRows(localRows, options) {
    const state = options?.state || '';
    const county = options?.county || '';
    let alerts = filterAlertsByAdmin(localRows, state, county);
    alerts = excludeAlertByKey(alerts, options?.excludeKey);
    alerts = alerts
      .slice()
      .sort((a, b) => {
        const ta = a.start_time ? new Date(a.start_time).getTime() : 0;
        const tb = b.start_time ? new Date(b.start_time).getTime() : 0;
        return tb - ta;
      })
      .slice(0, options?.limit ?? DEFAULT_ALERT_LIMIT);

    const mode = county ? 'county' : (state ? 'state' : 'local');
    return {
      alerts,
      meta: {
        mode,
        label: options?.label || 'selection',
        radiusMiles: null,
        state,
        county,
        hasGeo: false
      }
    };
  }

  /**
   * @param {{ lat: number, lng: number }|null} center
   * @param {Object} options
   * @returns {Promise<{ alerts: Array, meta: Object }>}
   */
  async function fetchNearbyWeatherAlerts(center, options) {
    const scopeMode = options?.scopeMode || 'distance';
    const useLocal = scopeMode === 'county'
      || !center
      || !Number.isFinite(center.lat)
      || !Number.isFinite(center.lng);

    if (useLocal) {
      return fetchWeatherAlertsFromLocalRows(options?.localRows || [], options);
    }

    const params = new URLSearchParams();
    params.set('lat', String(center.lat));
    params.set('lng', String(center.lng));
    params.set('radiusMiles', String(options?.radiusMiles ?? 50));
    params.set('types', 'disasters');
    params.set('limit', String(options?.limit ?? DEFAULT_ALERT_LIMIT));

    const res = await fetch(`${NEAR_API}?${params.toString()}`);
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to load nearby weather alerts');
    }

    let alerts = (json.data?.disasters || []).filter(isNwsAlert);
    alerts = excludeAlertByKey(alerts, options?.excludeKey);

    const meta = {
      mode: 'distance',
      label: options?.label || 'selection',
      radiusMiles: options?.radiusMiles,
      state: options?.state,
      county: options?.county,
      hasGeo: true
    };

    return { alerts, meta };
  }

  /**
   * Build request payload from disaster selection (mirrors camera helpers).
   */
  function buildDisasterWeatherAlertRequest(disasterObj, disasterData, radiusMiles, localRows, scopeMode) {
    const DLF = global.DisasterLoanFilters;
    const DCF = global.DisasterCameraFilters;
    if (DCF?.buildDisasterCameraRequest) {
      const req = DCF.buildDisasterCameraRequest(disasterObj, disasterData, radiusMiles);
      return {
        center: req.center,
        options: {
          ...req.options,
          radiusMiles,
          scopeMode: scopeMode || 'distance',
          localRows: localRows || [],
          excludeKey: alertMatchKey(disasterObj),
          limit: DEFAULT_ALERT_LIMIT
        }
      };
    }
    if (!DLF) {
      return { center: null, options: { localRows: localRows || [], excludeKey: alertMatchKey(disasterObj) } };
    }
    const normalized = DLF.normalizeDisasterForFilters(disasterObj, disasterData);
    const hasCoords = DLF.disasterHasCoords(normalized, disasterData);
    const state = DLF.getDisasterState(disasterObj, disasterData) || '';
    const county = DLF.getDisasterCounty(disasterObj, disasterData);
    const label = DLF.getDisasterTitle(disasterObj, disasterData);
    const options = {
      radiusMiles,
      state,
      county,
      label,
      scopeMode: scopeMode || 'distance',
      localRows: localRows || [],
      excludeKey: alertMatchKey(disasterObj),
      limit: DEFAULT_ALERT_LIMIT
    };
    if (hasCoords) {
      const coords = DLF.resolveDisasterCoords(normalized, disasterData);
      return { center: { lat: coords.lat, lng: coords.lng }, options };
    }
    return { center: null, options };
  }

  /**
   * Grid external-filter predicate for NWS rows in selected admin area.
   */
  function rowPassesNwsGridFilter(rowData, context) {
    if (!rowData || !context) return true;
    if (!isNwsAlert(rowData.disasterObj || rowData)) return false;
    return rowPassesAdminGridFilter(rowData, context);
  }

  /** All sources in selected state/county (FEMA, USGS, NWS, etc.). */
  function rowPassesAdminGridFilter(rowData, context) {
    if (!rowData || !context) return true;
    const state = String(context.state || '').trim().toUpperCase();
    if (state && String(rowData.state || rowData.state_abbr || '').trim().toUpperCase() !== state) {
      return false;
    }
    if (context.county && !countiesMatch(rowData.county || rowData.county_name, context.county)) {
      return false;
    }
    return true;
  }

  function rowPassesSelectionGridFilter(rowData, context) {
    if (!rowData || !context) return true;
    if (context.filterMode === 'nws-only') {
      return rowPassesNwsGridFilter(rowData, context);
    }
    return rowPassesAdminGridFilter(rowData, context);
  }

  function buildGridFilterContextFromDisaster(disasterObj, disasterData) {
    const DLF = global.DisasterLoanFilters;
    if (!DLF) return null;
    const state = DLF.getDisasterState(disasterObj, disasterData);
    if (!state) return null;
    const normalized = DLF.normalizeDisasterForFilters(disasterObj, disasterData);
    const subject = disasterObj || normalized;
    return {
      state,
      county: DLF.getDisasterCounty(disasterObj, disasterData) || '',
      filterMode: isNwsAlert(subject) ? 'nws-only' : 'admin-area'
    };
  }

  function buildNearbyWeatherAlertsListHtml(alerts, emptyMessage) {
    if (!alerts.length) {
      return `<p class="text-muted small mb-0">${escapeHtml(emptyMessage)}</p>`;
    }
    let html = '<div class="list-group list-group-flush du-nws-alert-list">';
    alerts.forEach((alert, index) => {
      const title = escapeHtml(alert.title || alert.raw?.headline || formatAlertEventType(alert));
      const eventType = escapeHtml(formatAlertEventType(alert));
      const severity = formatAlertSeverity(alert);
      const severityBadge = severity
        ? `<span class="badge du-nws-severity-badge ms-1">${escapeHtml(severity)}</span>`
        : '';
      const loc = escapeHtml([alert.county_name, alert.state_abbr].filter(Boolean).join(', ') || '—');
      const dist = escapeHtml(formatAlertDistanceMi(alert));
      const when = alert.start_time
        ? escapeHtml(new Date(alert.start_time).toLocaleString())
        : '';
      html += `<div class="list-group-item d-flex justify-content-between align-items-start px-0 py-2">
        <div class="me-2">
          <div class="fw-semibold small">${title}${severityBadge}</div>
          <div class="text-muted small">${eventType} · ${loc}${dist !== '—' ? ` · ${dist}` : ''}${when ? ` · ${when}` : ''}</div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-info flex-shrink-0" data-du-nws-alert-index="${index}" onclick="selectNearbyWeatherAlert(${index})" title="Show this alert in the grid">
          <i class="bi bi-cloud-lightning"></i> View
        </button>
      </div>`;
    });
    html += '</div>';
    return html;
  }

  global.DisasterWeatherAlertFilters = {
    NEAR_API,
    DEFAULT_ALERT_LIMIT,
    isNwsAlert,
    alertMatchKey,
    filterAlertsByAdmin,
    fetchWeatherAlertsFromLocalRows,
    fetchNearbyWeatherAlerts,
    buildDisasterWeatherAlertRequest,
    formatWeatherAlertFilterSubtitle,
    formatAlertDistanceMi,
    formatAlertSeverity,
    formatAlertEventType,
    buildNearbyWeatherAlertsListHtml,
    rowPassesNwsGridFilter,
    rowPassesAdminGridFilter,
    rowPassesSelectionGridFilter,
    buildGridFilterContextFromDisaster,
    escapeHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
