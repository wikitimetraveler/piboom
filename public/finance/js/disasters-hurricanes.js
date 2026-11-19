/**
 * Hurricane Tracker UI — track/cone map, county impact, Governor SoE by state.
 * Development work by David Lane
 */
(() => {
  const state = {
    active: null,
    prediction: null,
    map: null,
    layers: {
      cone: null,
      track: null,
      radii: [],
      counties: null,
      loans: null,
      cameras: null,
    },
  };

  const $ = (id) => document.getElementById(id);

  function fmtMoney(n) {
    const v = Number(n) || 0;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v}`;
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(iso).slice(0, 16);
    }
  }

  function fmtWindow(start, end) {
    if (!start && !end) return '—';
    if (start && end) return `${fmtDate(start)} → ${fmtDate(end)}`;
    return fmtDate(start || end);
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.details || `HTTP ${res.status}`);
    return data;
  }

  function initMap() {
    if (state.map) return;
    state.map = L.map('htMap', { scrollWheelZoom: true }).setView([27.5, -85], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 18,
    }).addTo(state.map);
    state.layers.counties = L.layerGroup().addTo(state.map);
    state.layers.loans = L.layerGroup().addTo(state.map);
    state.layers.cameras = L.layerGroup().addTo(state.map);
  }

  function clearMapOverlays() {
    if (state.layers.cone) {
      state.map.removeLayer(state.layers.cone);
      state.layers.cone = null;
    }
    if (state.layers.track) {
      state.map.removeLayer(state.layers.track);
      state.layers.track = null;
    }
    state.layers.radii.forEach((l) => state.map.removeLayer(l));
    state.layers.radii = [];
    state.layers.counties.clearLayers();
    state.layers.loans.clearLayers();
    state.layers.cameras.clearLayers();
  }

  function nmToMiles(nm) {
    return (Number(nm) || 0) * 1.15078;
  }

  function tierColor(tier) {
    return (
      {
        core_64kt: '#ef4444',
        swath_50kt: '#f97316',
        ts_34kt: '#eab308',
        fringe: '#94a3b8',
      }[tier] || '#64748b'
    );
  }

  function renderMap(prediction) {
    initMap();
    clearMapOverlays();
    const adv = prediction.advisory;
    if (!adv) return;

    if (Array.isArray(adv.conePolygon) && adv.conePolygon.length >= 3) {
      const latlngs = adv.conePolygon.map(([lng, lat]) => [lat, lng]);
      state.layers.cone = L.polygon(latlngs, {
        color: '#38bdf8',
        weight: 2,
        fillColor: '#0ea5e9',
        fillOpacity: 0.15,
      }).addTo(state.map);
    }

    if (Array.isArray(adv.track) && adv.track.length) {
      const line = adv.track.map((p) => [p.lat, p.lng]);
      state.layers.track = L.polyline(line, { color: '#f8fafc', weight: 3 }).addTo(state.map);
      adv.track.forEach((p) => {
        L.circleMarker([p.lat, p.lng], {
          radius: 5,
          color: p.category >= 3 ? '#ef4444' : p.category >= 1 ? '#f97316' : '#38bdf8',
          fillOpacity: 0.9,
        })
          .bindPopup(`TAU ${p.tauH}h · ${p.windKt} kt · Cat ${p.category}`)
          .addTo(state.layers.track);
      });
    }

    const center = adv.center || adv.track?.[0];
    if (center) {
      const radii = adv.windRadiiNm || {};
      const toggles = [
        { id: 'htToggle34', kt: 34, nm: radii.kt34, color: '#eab308' },
        { id: 'htToggle50', kt: 50, nm: radii.kt50, color: '#f97316' },
        { id: 'htToggle64', kt: 64, nm: radii.kt64, color: '#ef4444' },
      ];
      toggles.forEach((t) => {
        const el = $(t.id);
        if (el && !el.checked) return;
        if (!t.nm) return;
        const ring = L.circle([center.lat, center.lng], {
          radius: nmToMiles(t.nm) * 1609.34,
          color: t.color,
          weight: 1,
          fillOpacity: 0.05,
          dashArray: '4 4',
        }).bindTooltip(`${t.kt} kt wind radius`);
        ring.addTo(state.map);
        state.layers.radii.push(ring);
      });
    }

    (prediction.impactedCounties || []).forEach((c) => {
      L.circleMarker([c.lat, c.lng], {
        radius: 6,
        color: tierColor(c.impactTier),
        fillColor: tierColor(c.impactTier),
        fillOpacity: 0.75,
      })
        .bindPopup(
          `<strong>${c.county_name}, ${c.state_abbr}</strong><br>${c.impactTierLabel}<br>CPA ${c.cpaMiles} mi<br>Gov SoE: ${fmtDate(c.governorSoe?.windowTypical)}`
        )
        .addTo(state.layers.counties);
    });

    (prediction.loansInPath?.loans || []).slice(0, 80).forEach((loan) => {
      const lat = parseFloat(loan.latitude);
      const lng = parseFloat(loan.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      L.circleMarker([lat, lng], {
        radius: 4,
        color: '#a78bfa',
        fillOpacity: 0.8,
      })
        .bindPopup(
          `${loan.loan_number}<br>${loan.city}, ${loan.state}<br>${loan.milestone || ''}<br>${fmtMoney(loan.loan_amount)}`
        )
        .addTo(state.layers.loans);
    });

    (prediction.coastalCameras || []).slice(0, 40).forEach((cam) => {
      const lat = parseFloat(cam.lat);
      const lng = parseFloat(cam.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      L.marker([lat, lng], {
        title: cam.name || cam.source_id,
      })
        .bindPopup(`<strong>${cam.name || 'Camera'}</strong><br>${cam.source}`)
        .addTo(state.layers.cameras);
    });

    const bounds = [];
    if (state.layers.cone) bounds.push(state.layers.cone.getBounds());
    if (state.layers.track) bounds.push(state.layers.track.getBounds());
    if (bounds.length) {
      const b = bounds.reduce((acc, x) => acc.extend(x), L.latLngBounds(bounds[0]));
      state.map.fitBounds(b.pad(0.15));
    }
    $('htMapStatus').textContent = `${prediction.storm?.name || 'Storm'} · ${adv.label || ''}`;
  }

  function populateStormSelect(active) {
    const sel = $('htStormSelect');
    sel.innerHTML = '';
    const groups = [
      { label: 'Live NHC', items: active.liveStorms || [] },
      { label: 'Replay / Demo', items: active.replayStorms || [] },
    ];
    groups.forEach((g) => {
      if (!g.items.length) return;
      const og = document.createElement('optgroup');
      og.label = g.label;
      g.items.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} · Cat ${s.category}${s.synthetic ? ' (synthetic)' : ''}`;
        og.appendChild(opt);
      });
      sel.appendChild(og);
    });
    if (active.defaultStormId) sel.value = active.defaultStormId;
  }

  function updateModeBadge(mode) {
    const badge = $('htModeBadge');
    if (mode === 'live') {
      badge.className = 'ht-badge-live';
      badge.textContent = 'Live Atlantic/Pacific Feed';
    } else {
      badge.className = 'ht-badge-replay';
      badge.textContent = 'Replay Simulation Mode';
    }
  }

  function renderKpis(prediction) {
    const k = prediction.kpis || {};
    $('htKpiCat').textContent = `Cat ${k.category ?? '—'} · ${k.maxWindKt ?? '—'} kt`;
    $('htKpiCounties').textContent = String(k.impactedCountyCount ?? 0);
    $('htKpiLoans').textContent = `${k.loansInCone ?? 0} · ${fmtMoney(k.loansUpb)}`;
    const next = k.nextAnnouncement;
    $('htKpiNext').textContent = next
      ? `${next.type}: ${next.state || ''} ${fmtDate(next.at)}`
      : '—';
  }

  function renderGovernorPanel(prediction) {
    const panel = $('htGovernorPanel');
    const rows = prediction.governorAnnouncementsByState || [];
    if (!rows.length) {
      panel.innerHTML = '<p class="text-muted small mb-0">No governor SoE windows for this advisory.</p>';
      return;
    }
    panel.innerHTML = rows
      .map(
        (g) => `
      <div class="ht-gov-card mb-2">
        <div class="d-flex justify-content-between align-items-start">
          <div class="ht-state">${g.state_abbr}</div>
          <span class="badge ${g.coastalPrimary ? 'bg-info' : 'bg-secondary'}">${g.coastalPrimary ? 'Coastal' : 'Inland / cascade'}</span>
        </div>
        <div class="small mt-1"><strong>Governor SoE window</strong></div>
        <div class="small">${fmtWindow(g.earliestSoeStart, g.latestSoeEnd)}</div>
        <div class="small text-muted">Typical: ${fmtDate(g.typicalSoe)}</div>
        <div class="ht-soe-note mt-1">${g.note || 'SoE timing varies by state.'}</div>
        <div class="small mt-1 text-muted">${g.counties.length} counties in path</div>
      </div>`
      )
      .join('');
  }

  function renderCountyTable(prediction) {
    const filter = ($('htCountyFilter').value || '').trim().toLowerCase();
    const body = $('htCountyBody');
    const rows = (prediction.impactedCounties || []).filter((c) => {
      if (!filter) return true;
      return `${c.county_name} ${c.state_abbr} ${c.impactTierLabel}`.toLowerCase().includes(filter);
    });
    body.innerHTML = rows
      .map((c) => {
        const tl = c.declarationTimeline || {};
        return `<tr>
          <td>${c.county_name}, ${c.state_abbr}<div class="small text-muted">${c.county_fips || ''}</div></td>
          <td class="ht-tier-${c.impactTier}">${c.impactTierLabel}</td>
          <td>${c.cpaMiles ?? '—'}</td>
          <td>${fmtDate(c.windArrival34At)}</td>
          <td>${fmtWindow(c.governorSoe?.windowStart, c.governorSoe?.windowEnd)}</td>
          <td>${fmtWindow(tl.femaEm?.windowStart, tl.femaEm?.windowEnd)}</td>
          <td>${fmtWindow(tl.femaDr?.windowStart, tl.femaDr?.windowEnd)}</td>
          <td>${tl.femaDr?.likelyPrograms || '—'}</td>
          <td class="small">${(c.processorAction || []).join(' · ') || '—'}</td>
        </tr>`;
      })
      .join('');
  }

  function renderLoans(prediction) {
    const loans = prediction.loansInPath?.loans || [];
    $('htLoanSummary').textContent = `${prediction.loansInPath?.count || 0} loans · ${fmtMoney(prediction.loansInPath?.totalUpb)} UPB`;
    $('htLoanBody').innerHTML = loans
      .slice(0, 200)
      .map(
        (l) => `<tr>
        <td>${l.loan_number}</td>
        <td>${l.city}, ${l.state}<div class="small text-muted">${l.county || ''}</div></td>
        <td>${l.milestone || '—'}</td>
        <td>${l.flood_zone || '—'}</td>
        <td class="ht-tier-${l.impactTier || ''}">${l.impactTierLabel || '—'}</td>
        <td>${fmtMoney(l.loan_amount)}</td>
        <td>${fmtDate(l.governorSoeWindow)}</td>
      </tr>`
      )
      .join('');
  }

  function renderCameras(prediction) {
    const cams = prediction.coastalCameras || [];
    const grid = $('htCamGrid');
    if (!cams.length) {
      grid.innerHTML = '<p class="text-muted small">No coastal/storm webcams matched for this path.</p>';
      return;
    }
    grid.innerHTML = cams
      .slice(0, 24)
      .map((c) => {
        const img = c.image_url
          ? `<img class="ht-webcam-thumb" src="${c.image_url}" alt="" loading="lazy" referrerpolicy="no-referrer">`
          : `<div class="ht-webcam-thumb d-flex align-items-center justify-content-center text-muted"><i class="bi-camera-video"></i></div>`;
        return `<div class="col-md-3 col-6">
          <div class="card h-100">
            ${img}
            <div class="card-body p-2">
              <div class="small fw-semibold text-truncate">${c.name || c.source_id}</div>
              <div class="small text-muted">${c.state_abbr || ''} · ${c.source}</div>
            </div>
          </div>
        </div>`;
      })
      .join('');
  }

  function updateAdvisoryLabel(prediction) {
    const adv = prediction?.advisory;
    const list = prediction?.advisories || [];
    $('htAdvisoryRange').max = Math.max(0, list.length - 1);
    $('htAdvisoryLabel').textContent = adv
      ? `${adv.label} · issued ${fmtDate(adv.issuedAt)}`
      : 'Advisory —';
  }

  async function loadPrediction() {
    const stormId = $('htStormSelect').value;
    const advisoryIndex = Number($('htAdvisoryRange').value) || 0;
    $('htMapStatus').textContent = 'Loading prediction…';
    const res = await fetchJson(
      `/api/disasters/hurricanes/predict?stormId=${encodeURIComponent(stormId)}&advisoryIndex=${advisoryIndex}&mode=auto`
    );
    state.prediction = res.data;
    if (res.data.disclaimer) $('htDisclaimer').textContent = res.data.disclaimer;
    updateModeBadge(res.data.mode);
    updateAdvisoryLabel(res.data);
    renderKpis(res.data);
    renderGovernorPanel(res.data);
    renderCountyTable(res.data);
    renderLoans(res.data);
    renderCameras(res.data);
    renderMap(res.data);
    wireAiContext(res.data);
  }

  function wireAiContext(prediction) {
    if (!window.AiChatWidget) return;
    const slot = $('htAiSlot');
    if (!slot.dataset.wired) {
      try {
        window.AiChatWidget.mount?.({
          container: slot,
          endpoint: '/api/loan-pipeline/ai/chat-disaster-expert',
          sessionId: 'hurricane-tracker-processor',
          title: 'Hurricane Processor',
          expertProfile: 'processor',
        });
        slot.dataset.wired = '1';
      } catch {
        /* optional */
      }
    }
    window.AiChatWidget?.setContext?.({
      page: 'disasters-hurricanes',
      storm: prediction.storm,
      advisory: prediction.advisory,
      governorAnnouncementsByState: prediction.governorAnnouncementsByState,
      impactedCountyCount: prediction.impactedCounties?.length,
      nextPublicAnnouncement: prediction.nextPublicAnnouncement,
      loansInPath: {
        count: prediction.loansInPath?.count,
        totalUpb: prediction.loansInPath?.totalUpb,
      },
      disclaimer: prediction.disclaimer,
    });
  }

  async function runSampleTape() {
    const stormId = $('htStormSelect').value;
    const advisoryIndex = Number($('htAdvisoryRange').value) || 0;
    $('htSheetResult').textContent = 'Analyzing sample tape…';
    const res = await fetchJson('/api/disasters/hurricanes/analyze-spreadsheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useSample: true, stormId, advisoryIndex, mode: 'auto' }),
    });
    const d = res.data;
    const rows = (d.properties || [])
      .map(
        (p) =>
          `<tr><td>${p.loan_number}</td><td>${p.city}, ${p.state}</td><td>${p.impactTier || (p.inCone ? 'cone' : '—')}</td><td>${fmtDate(p.governorSoe?.windowTypical)}</td><td>${p.requirements?.statusBadge || '—'}</td></tr>`
      )
      .join('');
    $('htSheetResult').innerHTML = `
      <div class="mb-2">In path: <strong>${d.rollup?.inPath ?? 0}</strong> / ${d.rollup?.total ?? 0}
        · Hold/inspect: <strong>${d.rollup?.holdClosing ?? 0}</strong></div>
      <div class="table-responsive"><table class="table table-sm"><thead><tr><th>Loan</th><th>Loc</th><th>Tier</th><th>Gov SoE</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function exportKml() {
    const p = state.prediction;
    if (!p || !window.DisasterKmlExport) {
      alert('KML export unavailable or no prediction loaded.');
      return;
    }
    const storm = p.storm;
    const track = p.advisory?.track || [];
    const disaster = {
      title: storm?.name,
      source: 'nhc',
      event_type: 'hurricane',
      lat: storm?.landfall?.lat || track[0]?.lat,
      lng: storm?.landfall?.lng || track[0]?.lng,
      start_time: p.advisory?.issuedAt,
    };
    try {
      window.DisasterKmlExport.downloadKml({
        disaster,
        loans: p.loansInPath?.loans || [],
        cameras: p.coastalCameras || [],
        radiusMiles: nmToMiles(p.advisory?.windRadiiNm?.kt34 || 100),
        filename: `hurricane-${storm?.id || 'track'}.kml`,
      });
    } catch (e) {
      console.warn(e);
      alert(e.message || 'KML export failed');
    }
  }

  async function boot() {
    initMap();
    const activeRes = await fetchJson('/api/disasters/hurricanes/active?mode=auto');
    state.active = activeRes.data;
    if (activeRes.data.disclaimer) $('htDisclaimer').textContent = activeRes.data.disclaimer;
    populateStormSelect(activeRes.data);
    updateModeBadge(activeRes.data.mode);
    await loadPrediction();

    $('htStormSelect').addEventListener('change', () => {
      $('htAdvisoryRange').value = '0';
      loadPrediction().catch((e) => alert(e.message));
    });
    $('htAdvisoryRange').addEventListener('input', () => {
      loadPrediction().catch((e) => alert(e.message));
    });
    $('htRefreshBtn').addEventListener('click', () => loadPrediction().catch((e) => alert(e.message)));
    $('htCountyFilter').addEventListener('input', () => {
      if (state.prediction) renderCountyTable(state.prediction);
    });
    ['htToggle34', 'htToggle50', 'htToggle64'].forEach((id) => {
      $(id).addEventListener('change', () => {
        if (state.prediction) renderMap(state.prediction);
      });
    });
    $('htSampleTapeBtn').addEventListener('click', () => runSampleTape().catch((e) => alert(e.message)));
    $('htExportKmlBtn').addEventListener('click', exportKml);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot().catch((e) => console.error(e)));
  } else {
    boot().catch((e) => console.error(e));
  }
})();
