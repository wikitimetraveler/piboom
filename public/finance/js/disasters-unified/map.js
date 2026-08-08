/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — Google Maps markers + YouTube
 * Loaded in global scope after prior scripts (see disasters-unified.html).
 */

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
    const pos = googleAdvancedMarkers.getMapMarkerPosition(entry.marker);
    if (pos) {
      map.setCenter(pos);
      map.setZoom(Math.max(map.getZoom() || 8, 10));
    }
    googleAdvancedMarkers.openMapInfoWindow(entry.info, map, entry.marker);
    activeDisasterInfoWindow = entry.info;
    return;
  }

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    map.setCenter({ lat, lng });
    map.setZoom(10);
  }
}

function initDisastersMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  const bootMap = () => {
    if (map || typeof google === 'undefined' || !google.maps?.Map) return;
    map = new google.maps.Map(mapEl, {
      zoom: 4,
      center: { lat: 39.8, lng: -98.6 },
      mapTypeId: 'satellite',
      mapId: googleAdvancedMarkers.DEFAULT_MAP_ID,
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=${googleAdvancedMarkers.MAP_LIBRARIES}&loading=async&callback=__duInitGoogleMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
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

function setMapMarkerStatus(message) {
  const el = document.getElementById('duMapMarkerStatus');
  if (!el) return;
  el.textContent = message || '';
  el.hidden = !message;
}

/**
 * Cap Advanced Markers for national loads; keep highest-risk / newest pins.
 * Selected disaster is always retained when it has coordinates.
 */
function selectRowsForMapMarkers(mapRows, allRows, relatedLookup) {
  const cap = typeof DU_MAP_MARKER_HARD_CAP === 'number' ? DU_MAP_MARKER_HARD_CAP : 500;
  const total = mapRows.length;
  if (total <= cap) {
    return { renderRows: mapRows, total, shown: total, capped: false };
  }

  const scored = mapRows.map((item) => {
    const startMs = item.row.start_time ? new Date(item.row.start_time).getTime() : 0;
    return {
      item,
      risk: calculateDisasterRiskScore(item.row, allRows, relatedLookup),
      startMs: Number.isFinite(startMs) ? startMs : 0,
    };
  });
  scored.sort((a, b) => b.risk - a.risk || b.startMs - a.startMs);

  let picked = scored.slice(0, cap).map((s) => s.item);
  if (selectedDisasterObj) {
    const key = disasterMatchKey(selectedDisasterObj);
    const already = picked.some((p) => disasterMatchKey(p.row) === key);
    if (!already) {
      const missing = mapRows.find((p) => disasterMatchKey(p.row) === key);
      if (missing) {
        picked = [missing, ...picked.slice(0, cap - 1)];
      }
    }
  }

  return { renderRows: picked, total, shown: picked.length, capped: true };
}

function renderMap(rows) {
  if (!map) return;
  const gen = ++duMapRenderGeneration;

  if (activeDisasterInfoWindow) {
    activeDisasterInfoWindow.close();
    activeDisasterInfoWindow = null;
  }
  markers.forEach((m) => googleAdvancedMarkers.removeMapMarker(m));
  markers = [];
  disasterMarkerEntries = [];
  const bounds = new google.maps.LatLngBounds();
  let any = false;
  cameraIndex = 0; // Reset camera index
  const allRows = rows || lastLoadedDisasterRows || [];
  const mapRows = [];
  allRows.forEach((r) => {
    // Support lat/lng, latitude/longitude, avg_latitude/avg_longitude
    const lat = r.lat ?? r.latitude ?? r.avg_latitude;
    const lng = r.lng ?? r.longitude ?? r.avg_longitude;
    if (lat != null && lng != null && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
      mapRows.push({ row: r, lat: parseFloat(lat), lng: parseFloat(lng) });
    }
  });

  const relatedLookup = typeof buildRelatedDisasterCountLookup === 'function'
    ? buildRelatedDisasterCountLookup(allRows)
    : null;
  const { renderRows, total, shown, capped } = selectRowsForMapMarkers(mapRows, allRows, relatedLookup);

  if (capped) {
    setMapMarkerStatus(`Showing ${shown.toLocaleString()} of ${total.toLocaleString()} map pins (highest intensity). Narrow by state/county for full coverage.`);
  } else if (total > 0) {
    setMapMarkerStatus(`${total.toLocaleString()} map pin${total === 1 ? '' : 's'}`);
  } else {
    setMapMarkerStatus('');
  }

  const chunkSize = typeof DU_MAP_MARKER_CHUNK_SIZE === 'number' ? DU_MAP_MARKER_CHUNK_SIZE : 40;

  function renderChunk(startIndex = 0) {
    if (gen !== duMapRenderGeneration) return;
    const endIndex = Math.min(startIndex + chunkSize, renderRows.length);
    for (let i = startIndex; i < endIndex; i += 1) {
      const item = renderRows[i];
      const r = item.row;
      const pos = { lat: item.lat, lng: item.lng };
      const isCameraMarker = r.event_type === 'camera' || r.source === 'alertcalifornia' ||
        (r.title && r.title.toLowerCase().includes('camera'));
      const riskScore = calculateDisasterRiskScore(r, allRows, relatedLookup);
      const disasterIcon = isCameraMarker && window.mapIcons?.getDisasterIconForMarker
        ? window.mapIcons.getDisasterIconForMarker('camera', r.source)
        : getDisasterMarkerIconForRisk(r, allRows, riskScore);
      let cameraDataKey = null;
      const marker = googleAdvancedMarkers.createMapMarker({
        position: pos,
        map,
        title: isCameraMarker
          ? (r.title || 'Camera')
          : `${r.title || r.event_type} (risk ${riskScore.toFixed(1)})`,
        icon: disasterIcon,
        zIndex: isCameraMarker ? 50 : Math.round(100 + riskScore * 10),
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
        googleAdvancedMarkers.openMapInfoWindow(info, map, marker);
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
    if (endIndex < renderRows.length) {
      // Yield to the browser between chunks so Leaflet / UI stay responsive.
      window.setTimeout(() => renderChunk(endIndex), 0);
      return;
    }
    if (gen !== duMapRenderGeneration) return;
    if (selectedDisasterObj) {
      focusMapOnDisaster(selectedDisasterObj);
      highlightSelectedDisasterInGrid(selectedDisasterObj);
    } else if (any) {
      map.fitBounds(bounds);
    }
  }
  renderChunk(0);
}

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

function updateMapWithLoans(loans) {
  if (!map) return;
  loanMarkers.forEach((m) => googleAdvancedMarkers.removeMapMarker(m.marker));
  loanMarkers = [];
  
  if (!loans) return;
  
  loans.forEach(loan => {
    if (loan.latitude && loan.longitude) {
      const loanIcon = window.mapIcons && window.mapIcons.getLoanIconForMarker
        ? window.mapIcons.getLoanIconForMarker(loan.disaster_risk_score)
        : { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png', scaledSize: new google.maps.Size(24, 24) };
      const marker = googleAdvancedMarkers.createMapMarker({
        position: { lat: parseFloat(loan.latitude), lng: parseFloat(loan.longitude) },
        map,
        title: `Loan ${loan.loan_number}`,
        icon: loanIcon,
        zIndex: 10,
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
      marker.addListener('click', () => googleAdvancedMarkers.openMapInfoWindow(infoWindow, map, marker));
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



window.cameraDataStore = window.cameraDataStore || {};
