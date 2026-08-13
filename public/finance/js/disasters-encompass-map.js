/**
 * Development work by David Lane
 */
/**
 * Encompass loan / hazard map page — Google Maps + live proximity loan markers.
 * Handoff from Unified Disasters via URL + sessionStorage (duEncompassMapHandoffV1).
 */
(function () {
  'use strict';

  const MARKER_HARD_CAP = typeof DU_MAP_MARKER_HARD_CAP === 'number' ? DU_MAP_MARKER_HARD_CAP : 500;
  const MARKER_CHUNK_SIZE = typeof DU_MAP_MARKER_CHUNK_SIZE === 'number' ? DU_MAP_MARKER_CHUNK_SIZE : 40;

  let map = null;
  let loanMarkers = [];
  let disasterMarker = null;
  let activeInfoWindow = null;
  let renderGeneration = 0;
  let googleApiKeyPromise = null;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return window.DuEncompassMapHandoff?.escapeHtml
      ? window.DuEncompassMapHandoff.escapeHtml(str)
      : String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
  }

  function getRiskLevel(score) {
    if (!score) return 'Not Analyzed';
    if (score >= 10) return 'Critical';
    if (score >= 7) return 'High';
    if (score >= 4) return 'Moderate';
    return 'Low';
  }

  function setStatus(message, variant) {
    const el = $('demStatus');
    if (!el) return;
    el.textContent = message || '';
    el.className = `dem-status-line small mb-2 ${
      variant === 'danger' ? 'text-danger'
        : variant === 'warning' ? 'text-warning'
          : 'text-muted'
    }`;
  }

  function setMarkerStatus(message) {
    const el = $('demMarkerStatus');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  function showEmptyState() {
    document.body.classList.add('is-empty');
    const back = $('demBackLink');
    if (back) back.href = '/finance/disasters-unified.html';
  }

  function renderContextBanner(handoff) {
    const el = $('demContextBanner');
    if (!el) return;
    const title = handoff.title || 'Selected disaster';
    const place = [handoff.county, handoff.state].filter(Boolean).join(', ');
    const modeLine = handoff.scopeMode === 'county' && handoff.county
      ? `County scope · ${place || handoff.state || '—'}`
      : `Within ${handoff.radiusMiles || 100} mi · ${place || handoff.state || 'live /near'}`;
    el.innerHTML = `
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span class="badge text-bg-light border dem-live-chip ms-1" title="Live loan proximity — not graph NEAR">Live proximity · ops triage — not graph NEAR</span>
          <div class="small text-muted mt-1">${escapeHtml(modeLine)}${handoff.event_type ? ` · ${escapeHtml(handoff.event_type)}` : ''}</div>
        </div>
        <div class="small text-muted text-end">
          ${handoff.source ? `<span class="me-2">${escapeHtml(handoff.source)}${handoff.source_id ? ` · ${escapeHtml(handoff.source_id)}` : ''}</span>` : ''}
        </div>
      </div>`;
  }

  function wireBackLink(handoff) {
    const back = $('demBackLink');
    if (!back || !window.DuEncompassMapHandoff) return;
    back.href = window.DuEncompassMapHandoff.buildUnifiedBackUrl(handoff);
  }

  function loadGoogleApiKey() {
    if (googleApiKeyPromise) return googleApiKeyPromise;
    googleApiKeyPromise = fetch('/api/music-research/google-api-key')
      .then((resp) => resp.json())
      .then((data) => data.apiKey || null)
      .catch((err) => {
        console.error('Google API key fetch failed:', err);
        return null;
      });
    return googleApiKeyPromise;
  }

  function clearLoanMarkers() {
    loanMarkers.forEach((entry) => {
      window.googleAdvancedMarkers.removeMapMarker(entry.marker);
    });
    loanMarkers = [];
  }

  function placeDisasterMarker(handoff) {
    if (!map || !Number.isFinite(handoff.lat) || !Number.isFinite(handoff.lng)) return;
    if (disasterMarker) {
      window.googleAdvancedMarkers.removeMapMarker(disasterMarker);
      disasterMarker = null;
    }
    const icon = window.mapIcons?.getDisasterIconForMarker
      ? window.mapIcons.getDisasterIconForMarker(handoff.event_type, handoff.source)
      : { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png', scaledSize: new google.maps.Size(28, 28) };
    const pos = { lat: handoff.lat, lng: handoff.lng };
    disasterMarker = window.googleAdvancedMarkers.createMapMarker({
      position: pos,
      map,
      title: handoff.title || 'Selected disaster',
      icon,
      zIndex: 200,
    });
    const info = new google.maps.InfoWindow({
      content: `<div>
        <strong>${escapeHtml(handoff.title || 'Selected disaster')}</strong><br>
        ${escapeHtml([handoff.county, handoff.state].filter(Boolean).join(', '))}<br>
        <span class="text-muted small">Live proximity focus · not graph NEAR</span>
      </div>`,
    });
    disasterMarker.addListener('click', () => {
      if (activeInfoWindow) activeInfoWindow.close();
      window.googleAdvancedMarkers.openMapInfoWindow(info, map, disasterMarker);
      activeInfoWindow = info;
    });
    map.setCenter(pos);
    map.setZoom(10);
  }

  function selectLoansForMarkers(loans) {
    const withCoords = (loans || []).filter((loan) => {
      const lat = parseFloat(loan.latitude);
      const lng = parseFloat(loan.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng);
    });
    const total = withCoords.length;
    if (total <= MARKER_HARD_CAP) {
      return { renderLoans: withCoords, total, shown: total, capped: false };
    }
    const scored = withCoords.map((loan) => ({
      loan,
      risk: Number(loan.disaster_risk_score) || 0,
    }));
    scored.sort((a, b) => b.risk - a.risk);
    const picked = scored.slice(0, MARKER_HARD_CAP).map((s) => s.loan);
    return { renderLoans: picked, total, shown: picked.length, capped: true };
  }

  function updateMapWithLoans(loans) {
    if (!map) return;
    const gen = ++renderGeneration;
    clearLoanMarkers();
    const { renderLoans, total, shown, capped } = selectLoansForMarkers(loans);
    if (capped) {
      setMarkerStatus(`Showing ${shown.toLocaleString()} of ${total.toLocaleString()} loan pins (highest ops triage). Narrow radius for full coverage.`);
    } else if (total > 0) {
      setMarkerStatus(`${total.toLocaleString()} loan pin${total === 1 ? '' : 's'} · live proximity`);
    } else {
      setMarkerStatus('No loan pins in this live /near filter');
    }

    const bounds = new google.maps.LatLngBounds();
    let anyLoan = false;
    if (disasterMarker) {
      const pos = window.googleAdvancedMarkers.getMapMarkerPosition(disasterMarker);
      if (pos) bounds.extend(pos);
    }

    function renderChunk(startIndex) {
      if (gen !== renderGeneration) return;
      const endIndex = Math.min(startIndex + MARKER_CHUNK_SIZE, renderLoans.length);
      for (let i = startIndex; i < endIndex; i += 1) {
        const loan = renderLoans[i];
        const lat = parseFloat(loan.latitude);
        const lng = parseFloat(loan.longitude);
        const pos = { lat, lng };
        const loanIcon = window.mapIcons?.getLoanIconForMarker
          ? window.mapIcons.getLoanIconForMarker(loan.disaster_risk_score)
          : { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png', scaledSize: new google.maps.Size(24, 24) };
        const marker = window.googleAdvancedMarkers.createMapMarker({
          position: pos,
          map,
          title: `Loan ${loan.loan_number}`,
          icon: loanIcon,
          zIndex: 10,
        });
        const infoWindow = new google.maps.InfoWindow({
          content: `<div>
            <h6>Loan ${escapeHtml(loan.loan_number)}</h6>
            <div>${escapeHtml(loan.property_address || '')}</div>
            <div>${escapeHtml(loan.city || '')}, ${escapeHtml(loan.state || '')} ${escapeHtml(loan.zip_code || '')}</div>
            <div>County: ${escapeHtml(loan.county || '')}</div>
            <div>Ops triage: ${escapeHtml(getRiskLevel(loan.disaster_risk_score))}</div>
            <div class="small text-muted mt-1">Live proximity · not graph NEAR</div>
          </div>`,
        });
        marker.addListener('click', () => {
          if (activeInfoWindow) activeInfoWindow.close();
          window.googleAdvancedMarkers.openMapInfoWindow(infoWindow, map, marker);
          activeInfoWindow = infoWindow;
        });
        loanMarkers.push({ loanId: loan.id, marker });
        bounds.extend(pos);
        anyLoan = true;
      }
      if (endIndex < renderLoans.length) {
        window.setTimeout(() => renderChunk(endIndex), 0);
        return;
      }
      if (gen !== renderGeneration) return;
      if (anyLoan || disasterMarker) {
        map.fitBounds(bounds, 48);
        const z = map.getZoom();
        if (Number.isFinite(z) && z > 12) map.setZoom(12);
      }
    }
    renderChunk(0);
  }

  async function loadLoansForHandoff(handoff) {
    const DLF = window.DisasterLoanFilters;
    if (!DLF) {
      setStatus('Loan filter helpers missing.', 'danger');
      return;
    }
    const disasterObj = {
      source: handoff.source,
      source_id: handoff.source_id,
      title: handoff.title,
      event_type: handoff.event_type,
      state_abbr: handoff.state,
      county_name: handoff.county,
      lat: handoff.lat,
      lng: handoff.lng,
      latitude: handoff.lat,
      longitude: handoff.lng,
    };
    let mode = handoff.scopeMode || DLF.defaultScopeMode(disasterObj);
    const radiusMiles = handoff.radiusMiles || DLF.DEFAULT_RADIUS_MILES;
    if (mode === 'distance' && !DLF.disasterHasCoords(disasterObj)) {
      mode = 'county';
      setStatus('No disaster coordinates — loading county/state loan matches.', 'warning');
    } else {
      setStatus('Loading mocked loans via live proximity…');
    }

    if (!handoff.state && mode !== 'distance') {
      setStatus('Handoff has no state — cannot match mocked loans.', 'warning');
      updateMapWithLoans([]);
      return;
    }

    const built = DLF.buildLoanQueryParams(disasterObj, null, { mode, radiusMiles });
    if (!built.state && mode !== 'distance') {
      setStatus('Selected disaster has no state — cannot match mocked loans.', 'warning');
      updateMapWithLoans([]);
      return;
    }

    try {
      const response = await fetch(`/api/loan-pipeline/loans?${built.params.toString()}`);
      const data = await response.json();
      if (!data.success) {
        setStatus('Failed to load mocked loans.', 'danger');
        updateMapWithLoans([]);
        return;
      }
      const loans = data.data?.loans || [];
      const meta = {
        mode: built.mode,
        state: built.state,
        county: built.county,
        title: built.title,
        radiusMiles: mode === 'distance' ? radiusMiles : null,
      };
      let line = DLF.formatLoanFilterSubtitle(meta, loans.length);
      line += ' · Live proximity · ops triage — not graph NEAR';
      setStatus(line);
      updateMapWithLoans(loans);
    } catch (err) {
      console.error('Encompass map loan load failed:', err);
      setStatus('Error loading mocked loans.', 'danger');
      updateMapWithLoans([]);
    }
  }

  function bootMap(handoff) {
    const mapEl = $('demMap');
    if (!mapEl || typeof google === 'undefined' || !google.maps?.Map) return;
    const center = Number.isFinite(handoff.lat) && Number.isFinite(handoff.lng)
      ? { lat: handoff.lat, lng: handoff.lng }
      : { lat: 39.8, lng: -98.6 };
    map = new google.maps.Map(mapEl, {
      zoom: Number.isFinite(handoff.lat) ? 10 : 4,
      center,
      mapTypeId: 'satellite',
      mapId: window.googleAdvancedMarkers.DEFAULT_MAP_ID,
      streetViewControl: false,
    });
    placeDisasterMarker(handoff);
    loadLoansForHandoff(handoff);
  }

  async function initGoogleMaps(handoff) {
    if (typeof google !== 'undefined' && google.maps?.Map) {
      bootMap(handoff);
      return;
    }
    const apiKey = await loadGoogleApiKey();
    if (!apiKey) {
      setStatus('Google Maps API key not available.', 'danger');
      return;
    }
    if (document.querySelector('script[data-dem-google-maps]')) {
      const wait = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps?.Map) {
          clearInterval(wait);
          bootMap(handoff);
        }
      }, 100);
      return;
    }
    window.__demInitGoogleMap = () => bootMap(handoff);
    const script = document.createElement('script');
    script.dataset.demGoogleMaps = '1';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=${window.googleAdvancedMarkers.MAP_LIBRARIES}&loading=async&callback=__demInitGoogleMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  function init() {
    const handoff = window.DuEncompassMapHandoff?.readHandoff?.();
    if (!handoff || !window.DuEncompassMapHandoff.isHandoffUsable(handoff)) {
      showEmptyState();
      setStatus('No disaster handoff — open Encompass map from Unified Disasters after selecting an event.', 'warning');
      return;
    }
    document.body.classList.remove('is-empty');
    renderContextBanner(handoff);
    wireBackLink(handoff);
    if (handoff.radiusMiles && window.DisasterLoanFilters?.setStoredRadiusMiles) {
      window.DisasterLoanFilters.setStoredRadiusMiles(handoff.radiusMiles);
    }
    initGoogleMaps(handoff);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
