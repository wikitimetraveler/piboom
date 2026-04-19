(function () {
  'use strict';

  const API_BASE = '/api/genealogy';
  let memorialMap = null;
  let memorialMarker = null;
  let modalRenderToken = 0;
  const geocodeCache = new Map();

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizePlaceKey(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function parseBirthYear(person) {
    const y = parseInt(person.birthYear, 10);
    return Number.isFinite(y) ? y : null;
  }

  function parseDeathYear(person) {
    const y = parseInt(person.deathYear, 10);
    return Number.isFinite(y) ? y : null;
  }

  function isBookOrOcrSource(person) {
    const im = person.importMeta;
    if (im && (im.source || im.parser)) return true;
    const refs = person.sourceRefs;
    return Array.isArray(refs) && refs.length > 0;
  }

  function sortByBirthYear(a, b) {
    const ay = parseBirthYear(a);
    const by = parseBirthYear(b);
    const aUnknown = ay === null;
    const bUnknown = by === null;
    if (aUnknown && bUnknown) return (a.name || '').localeCompare(b.name || '');
    if (aUnknown) return 1;
    if (bUnknown) return -1;
    if (ay !== by) return ay - by;
    return (a.name || '').localeCompare(b.name || '');
  }

  function centuryLabel(year) {
    const c = Math.floor(year / 100) * 100;
    return `${c}s`;
  }

  function decadeRange(year) {
    const start = Math.floor(year / 10) * 10;
    return { start, label: `${start}–${start + 9}` };
  }

  function groupByCenturyAndDecade(people) {
    const dated = [];
    const undated = [];
    for (const p of people) {
      const y = parseBirthYear(p);
      if (y === null) undated.push(p);
      else dated.push(p);
    }
    dated.sort(sortByBirthYear);

    /** @type {Map<string, Map<string, typeof people>>} */
    const byCentury = new Map();
    for (const p of dated) {
      const y = parseBirthYear(p);
      const cLabel = centuryLabel(y);
      const { label: dLabel } = decadeRange(y);
      if (!byCentury.has(cLabel)) byCentury.set(cLabel, new Map());
      const byDecade = byCentury.get(cLabel);
      if (!byDecade.has(dLabel)) byDecade.set(dLabel, []);
      byDecade.get(dLabel).push(p);
    }

    const centuries = Array.from(byCentury.keys()).sort((a, b) => {
      const ca = parseInt(a, 10);
      const cb = parseInt(b, 10);
      return ca - cb;
    });

    return { centuries, byCentury, undated };
  }

  function lineHtml(person) {
    const birthYear = parseBirthYear(person);
    const deathYear = parseDeathYear(person);
    const birth = birthYear === null ? 'b. ?' : `b. ${birthYear}`;
    const death = deathYear === null ? '' : ` · d. ${deathYear}`;
    return `
      <div class="memorial-line" role="button" tabindex="0" data-person-id="${esc(person.id)}">
        <span class="memorial-name">${esc(person.name || 'Unknown')}</span>
        <span class="memorial-birth"> — ${esc(birth + death)}</span>
      </div>`;
  }

  function centuryId(cLabel) {
    return `century-${String(cLabel).replace(/[^a-zA-Z0-9]+/g, '-')}`;
  }

  function shouldSkipFalseLocation(place) {
    const x = String(place || '').trim();
    if (!x) return true;
    const low = x.toLowerCase();
    if (/\b(company|regiment)\b/i.test(x)) return true;
    if (/^james$/i.test(x) || /^abner$/i.test(x)) return true;
    return false;
  }

  function buildPlaceEntries(person) {
    const entries = [];
    const push = (label, rawPlace) => {
      const place = String(rawPlace || '').trim();
      if (!place) return;
      if (label === 'Other recorded place' && shouldSkipFalseLocation(place)) return;
      const key = normalizePlaceKey(place);
      if (!key) return;
      if (entries.some((entry) => entry.key === key)) return;
      entries.push({ label, place, key, status: 'idle' });
    };

    push('Born', person.birthPlace || person.born);
    push('Died', person.deathPlace || person.died);
    push('Buried', person.burial);
    const locations = Array.isArray(person.locations) ? person.locations : [];
    for (const place of locations) {
      push('Other recorded place', place);
    }
    return entries;
  }

  /** When tree edges are missing, pull parent/spouse clues from book-style prose + OCR snippets. */
  function extractLineageHintsFromText(raw) {
    const t = String(raw || '');
    const parents = [];
    const seen = new Set();
    const add = (s) => {
      const v = String(s || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (v.length < 2) return;
      const k = v.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      parents.push(v);
    };
    const reDau = /\(\s*dau\.?\s+of\s+([^)]+)\)/gi;
    const reSon = /\(\s*s\.?\s+of\s+([^)]+)\)/gi;
    let m;
    while ((m = reDau.exec(t))) add(m[1]);
    while ((m = reSon.exec(t))) add(m[1]);
    return { parentHints: parents };
  }

  function spouseHintsFromOcr(ocrFacts) {
    if (!ocrFacts || !Array.isArray(ocrFacts.marriageSnippets)) return [];
    return [...new Set(ocrFacts.marriageSnippets.map((s) => String(s || '').trim()).filter((s) => s.length >= 2))];
  }

  function infoLine(label, value) {
    const text = String(value || '').trim();
    if (!text) return '';
    return `<p class="mb-2"><strong>${esc(label)}:</strong> ${esc(text)}</p>`;
  }


  function formatParentNames(rows) {
    if (!rows || !rows.length) return '—';
    const parts = rows
      .map((row) => {
        const n = row && row.person && row.person.name;
        if (!n) return null;
        const rel = row.relation ? `${row.relation}: ` : '';
        return `${rel}${n}`;
      })
      .filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }

  function formatPersonNames(rows) {
    if (!rows || !rows.length) return '—';
    const parts = rows.map((row) => (row && row.name ? String(row.name) : null)).filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }

  function occupationLabels(person) {
    const occ = Array.isArray(person.occupation) ? person.occupation : [];
    const labels = [];
    for (const o of occ) {
      if (o && typeof o === 'object' && typeof o.job === 'string' && o.job.trim()) labels.push(o.job.trim());
    }
    return [...new Set(labels)];
  }

  function militaryBrief(person) {
    const parts = [];
    const ocr = person.importMeta && person.importMeta.ocrFacts;
    if (ocr && Array.isArray(ocr.military)) {
      for (const m of ocr.military) {
        const s = String(m || '').trim();
        if (s) parts.push(s);
      }
    }
    const occ = Array.isArray(person.occupation) ? person.occupation : [];
    for (const o of occ) {
      if (!o || typeof o !== 'object') continue;
      const svc = Array.isArray(o.service) ? o.service : [];
      for (const s of svc) {
        if (s && typeof s.text === 'string' && s.text.trim()) parts.push(s.text.trim());
      }
    }
    const joined = parts.join(' · ');
    return joined.length > 450 ? `${joined.slice(0, 447)}…` : joined;
  }

  function createMapCardMarkup(placeEntries) {
    const hasPlaces = placeEntries.length > 0;
    const placeList = hasPlaces
      ? `
        <div class="memorial-place-list" id="memorialPlaceList">
          ${placeEntries
            .map(
              (entry, index) => `
                <button type="button" class="memorial-place-item" data-place-index="${index}">
                  <span class="memorial-place-label">${esc(entry.label)}</span>
                  <span class="memorial-place-text">${esc(entry.place)}</span>
                  <span class="memorial-place-status">Checking map availability...</span>
                </button>
              `
            )
            .join('')}
        </div>
      `
      : '';

    return `
      <section class="memorial-profile-card memorial-map-card">
        <div>
          <h6 class="mb-1">Place Context</h6>
          <p class="small text-muted mb-0">Mapped from recorded place text when available.</p>
        </div>
        <div class="memorial-map-shell" id="memorialMapShell">
          ${
            hasPlaces
              ? `
                <div class="memorial-map-loading" id="memorialMapStatus">
                  <div>
                    <i class="bi bi-geo-alt"></i>
                    <div>Preparing map context...</div>
                  </div>
                </div>
                <div id="memorialMapCanvas" class="memorial-map-canvas d-none" aria-label="Person place map"></div>
              `
              : `
                <div class="memorial-map-empty">
                  <div class="memorial-map-empty-inner">
                    <i class="bi bi-pin-map"></i>
                    <h6 class="mb-2">No place recorded</h6>
                    <p class="mb-0 small text-muted">This profile has no mappable location in the current record.</p>
                  </div>
                </div>
              `
          }
        </div>
        <p class="memorial-map-caption" id="memorialMapCaption">
          ${hasPlaces ? 'Approximate location based on recorded place name.' : 'No place recorded in this profile.'}
        </p>
        ${placeList}
      </section>
    `;
  }

  function renderMapEmptyState(title, copy) {
    const shell = document.getElementById('memorialMapShell');
    const caption = document.getElementById('memorialMapCaption');
    if (!shell || !caption) return;
    shell.innerHTML = `
      <div class="memorial-map-empty">
        <div class="memorial-map-empty-inner">
          <i class="bi bi-geo-alt"></i>
          <h6 class="mb-2">${esc(title)}</h6>
          <p class="mb-0 small text-muted">${esc(copy)}</p>
        </div>
      </div>
    `;
    caption.textContent = copy;
  }

  async function ensureGoogleMaps() {
    if (window.google && window.google.maps) return true;
    if (typeof window.laneFamilyLoadGoogleMaps !== 'function') {
      window.__laneGoogleMapsUnavailableReason =
        'Google Maps loader missing. Include /family/js/lane-family-google-maps.js before this script.';
      return false;
    }
    return window.laneFamilyLoadGoogleMaps();
  }

  async function geocodePlace(entry) {
    if (!entry || !entry.key) return null;
    if (geocodeCache.has(entry.key)) return geocodeCache.get(entry.key);
    try {
      const res = await fetch(`${API_BASE}/geocode-address?q=${encodeURIComponent(entry.place)}`);
      const data = await res.json();
      if (data.success && data.longitude != null && data.latitude != null) {
        const result = {
          ok: true,
          place: data.label || entry.place,
          lngLat: [data.longitude, data.latitude]
        };
        geocodeCache.set(entry.key, result);
        return result;
      }
      const fail = { ok: false, place: entry.place, lngLat: null };
      geocodeCache.set(entry.key, fail);
      return fail;
    } catch (e) {
      const fail = { ok: false, place: entry.place, lngLat: null };
      geocodeCache.set(entry.key, fail);
      return fail;
    }
  }

  function updatePlaceList(placeEntries, activeIndex) {
    const host = document.getElementById('memorialPlaceList');
    if (!host) return;
    host.querySelectorAll('.memorial-place-item').forEach((button) => {
      const index = Number(button.dataset.placeIndex);
      const entry = placeEntries[index];
      if (!entry) return;
      button.classList.toggle('active', index === activeIndex);
      const statusEl = button.querySelector('.memorial-place-status');
      if (!statusEl) return;
      if (entry.status === 'mapped') statusEl.textContent = 'Approximate map location';
      else if (entry.status === 'unresolved') statusEl.textContent = 'Place recorded, map unresolved';
      else statusEl.textContent = 'Checking map availability...';
    });
  }

  function disposeMemorialMap() {
    if (memorialMarker) {
      memorialMarker.setMap(null);
      memorialMarker = null;
    }
    if (memorialMap) {
      if (window.google && google.maps && google.maps.event) {
        google.maps.event.clearInstanceListeners(memorialMap);
      }
      memorialMap = null;
    }
    const mapEl = document.getElementById('memorialMapCanvas');
    if (mapEl) mapEl.innerHTML = '';
  }

  async function focusPlaceOnMap(placeEntries, index, renderToken) {
    const entry = placeEntries[index];
    if (!entry) return;
    const caption = document.getElementById('memorialMapCaption');
    if (caption) caption.textContent = 'Locating recorded place...';

    const result = await geocodePlace(entry).catch(() => null);
    if (renderToken !== modalRenderToken) return;

    if (result && result.ok && result.lngLat) {
      if (!(await ensureGoogleMaps())) {
        if (renderToken !== modalRenderToken) return;
        entry.status = 'unresolved';
        updatePlaceList(placeEntries, index);
        renderMapEmptyState(
          'Map unavailable',
          window.__laneGoogleMapsUnavailableReason ||
            'Place details are shown below even though the map could not load.'
        );
        return;
      }
      if (renderToken !== modalRenderToken) return;

      entry.status = 'mapped';
      entry.lngLat = result.lngLat;
      updatePlaceList(placeEntries, index);
      const canvas = document.getElementById('memorialMapCanvas');
      const loading = document.getElementById('memorialMapStatus');
      if (!canvas || !caption) return;
      if (loading) loading.classList.add('d-none');
      canvas.classList.remove('d-none');
      disposeMemorialMap();
      const center = { lat: result.lngLat[1], lng: result.lngLat[0] };
      memorialMap = new google.maps.Map(canvas, {
        center,
        zoom: 10,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        streetViewControl: false,
        fullscreenControl: true
      });
      memorialMarker = new google.maps.Marker({
        position: center,
        map: memorialMap
      });
      caption.textContent = `Approximate location based on recorded place name: ${result.place}`;
      setTimeout(() => {
        if (memorialMap && window.google && google.maps.event) {
          google.maps.event.trigger(memorialMap, 'resize');
        }
      }, 250);
      updatePlaceList(placeEntries, index);
      return;
    }

    entry.status = 'unresolved';
    updatePlaceList(placeEntries, index);
    const mappedCount = placeEntries.filter((item) => item.status === 'mapped').length;
    if (!mappedCount) {
      renderMapEmptyState('Map not available for this place yet', 'Place recorded, map unresolved.');
    } else if (caption) {
      caption.textContent = 'Place recorded, map unresolved.';
    }
  }

  async function renderPlaceContext(placeEntries, renderToken) {
    if (!placeEntries.length) return;

    if (!(await ensureGoogleMaps())) {
      if (renderToken !== modalRenderToken) return;
      renderMapEmptyState(
        'Map unavailable',
        window.__laneGoogleMapsUnavailableReason ||
          'Place details are shown below even though the map could not load.'
      );
      return;
    }

    let firstMappedIndex = -1;
    for (let i = 0; i < placeEntries.length; i++) {
      const result = await geocodePlace(placeEntries[i]).catch(() => null);
      if (renderToken !== modalRenderToken) return;
      if (result && result.ok && result.lngLat) {
        placeEntries[i].status = 'mapped';
        placeEntries[i].lngLat = result.lngLat;
        if (firstMappedIndex === -1) firstMappedIndex = i;
      } else {
        placeEntries[i].status = 'unresolved';
      }
    }

    updatePlaceList(placeEntries, firstMappedIndex);

    if (firstMappedIndex === -1) {
      renderMapEmptyState('Map not available for this place yet', 'Place recorded, map unresolved.');
    } else {
      await focusPlaceOnMap(placeEntries, firstMappedIndex, renderToken);
    }

    const list = document.getElementById('memorialPlaceList');
    if (!list) return;
    list.querySelectorAll('.memorial-place-item').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.placeIndex);
        focusPlaceOnMap(placeEntries, index, renderToken);
      });
    });
  }

  function renderWall(people) {
    const host = document.getElementById('memorialWall');
    const { centuries, byCentury, undated } = groupByCenturyAndDecade(people);

    const parts = [];
    for (const cLabel of centuries) {
      const byDecade = byCentury.get(cLabel);
      const decadeKeys = Array.from(byDecade.keys()).sort((a, b) => {
        const sa = parseInt(a.split('–')[0], 10);
        const sb = parseInt(b.split('–')[0], 10);
        return sa - sb;
      });

      const cid = centuryId(cLabel);
      parts.push(`<section class="memorial-century" aria-labelledby="${esc(cid)}">`);
      parts.push(`<h2 class="memorial-century-label" id="${esc(cid)}">${esc(cLabel)}</h2>`);

      for (const dLabel of decadeKeys) {
        const rows = byDecade.get(dLabel) || [];
        parts.push('<div class="memorial-decade">');
        parts.push(`
          <div class="memorial-decade-header">
            <span class="memorial-decade-year">${esc(dLabel)}</span>
            <span class="memorial-decade-line" aria-hidden="true"></span>
            <span class="memorial-decade-count">${rows.length} names</span>
          </div>
          <div class="memorial-columns">${rows.map(lineHtml).join('')}</div>
        </div>`);
      }
      parts.push('</section>');
    }

    if (undated.length) {
      undated.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const n = undated.length;
      const undatedTitle = `Undated: ${n} — birth year unknown or not parsed. Click to show list.`;
      parts.push(`
        <section class="memorial-undated" aria-label="Undated entries">
          <details class="memorial-undated-details">
            <summary class="memorial-undated-summary" title="${esc(undatedTitle)}">
              <span aria-hidden="true">*</span>
              <span class="sr-only">Undated entries (${n} names). Birth year unknown or not parsed. Activate to expand the list.</span>
            </summary>
            <p class="small text-muted mb-2 memorial-undated-lede">Birth year unknown or not parsed.</p>
            <div class="memorial-columns">${undated.map(lineHtml).join('')}</div>
          </details>
        </section>
      `);
    }

    host.innerHTML = parts.join('');
  }

  async function openModal(personId) {
    const titleEl = document.getElementById('memorialModalTitle');
    const bodyEl = document.getElementById('memorialModalBody');
    titleEl.textContent = 'Loading…';
    bodyEl.innerHTML = '<p class="text-muted mb-0">Fetching profile…</p>';
    $('#memorialModal').modal('show');
    const renderToken = ++modalRenderToken;

    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(personId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.person) {
        titleEl.textContent = 'Not found';
        bodyEl.innerHTML = `<p class="text-warning mb-0">${esc(data.error || 'Person not found.')}</p>`;
        return;
      }

      disposeMemorialMap();
      const p = data.person;
      const fam = data.family || {};
      titleEl.textContent = p.name || 'Profile';
      const placeEntries = buildPlaceEntries(p);
      const text = p.text ? `<p class="small text-light" style="white-space: pre-wrap;">${esc(p.text)}</p>` : '';
      const im = p.importMeta;
      const ocrFacts = im && typeof im === 'object' && im.ocrFacts && typeof im.ocrFacts === 'object' ? im.ocrFacts : null;
      const marriedList = ocrFacts && Array.isArray(ocrFacts.marriageSnippets)
        ? [...new Set(ocrFacts.marriageSnippets.map((s) => String(s || '').trim()).filter(Boolean))]
        : [];
      const marriedRow =
        marriedList.length > 0
          ? `<dt class="col-sm-3">Married</dt><dd class="col-sm-9">${esc(marriedList.join(' · '))}</dd>`
          : '';
      const childrenNote = ocrFacts && ocrFacts.childrenNote ? String(ocrFacts.childrenNote) : '';
      const childrenRow = childrenNote
        ? `<dt class="col-sm-3">Children (text)</dt><dd class="col-sm-9">${esc(childrenNote)}</dd>`
        : '';
      const birthParts = [p.birthYear, p.birthDate].filter((x) => x !== undefined && x !== null && String(x).trim() !== '');
      const birthDisplay = birthParts.length ? birthParts.join(' · ') : '—';
      const deathParts = [p.deathYear, p.deathDate].filter((x) => x !== undefined && x !== null && String(x).trim() !== '');
      const deathDisplay = deathParts.length ? deathParts.join(' · ') : '—';
      const occList = occupationLabels(p);
      const occRow =
        occList.length > 0
          ? `<dt class="col-sm-3">Occupation</dt><dd class="col-sm-9">${esc(occList.join(' · '))}</dd>`
          : '';
      const milText = militaryBrief(p);
      const milRow =
        milText
          ? `<dt class="col-sm-3">Military</dt><dd class="col-sm-9">${esc(milText)}</dd>`
          : '';
      const metaJson = im && typeof im === 'object' ? JSON.stringify(im) : '';
      const metaDetails =
        metaJson
          ? `<details class="small text-muted mt-2"><summary>Raw import metadata</summary><pre class="small mb-0 mt-1" style="white-space:pre-wrap;max-height:12rem;overflow:auto;">${esc(metaJson)}</pre></details>`
          : '';
      const lineage = extractLineageHintsFromText(p.text || '');
      const parentHints = lineage.parentHints || [];
      const spouseTextHints = spouseHintsFromOcr(ocrFacts);
      const hasNarrativeFamily =
        (parentHints && parentHints.length > 0) || (spouseTextHints && spouseTextHints.length > 0);
      const narrativeFamilyBlock =
        hasNarrativeFamily
          ? `
        <div class="memorial-family-narrative border-top border-secondary pt-2 mt-2">
          <div class="memorial-family-narrative-label small text-muted text-uppercase mb-2">From book text (not linked in tree)</div>
          <p class="mb-1 small"><strong>Parents (text):</strong> ${esc(parentHints.length ? parentHints.join(', ') : '—')}</p>
          <p class="mb-0 small"><strong>Partners / spouse (text):</strong> ${esc(spouseTextHints.length ? spouseTextHints.join(' · ') : '—')}</p>
        </div>
      `
          : '';
      const familySummary = `
        <section class="memorial-profile-card">
          <h6 class="mb-3">Family Context</h6>
          <p class="mb-1 small text-muted">Linked in family tree</p>
          <p class="mb-2"><strong>Parents:</strong> ${esc(formatParentNames(fam.parents))}</p>
          <p class="mb-2"><strong>Spouses:</strong> ${esc(formatPersonNames(fam.spouses))}</p>
          <p class="mb-2"><strong>Children:</strong> ${esc(formatPersonNames(fam.children))}</p>
          <p class="mb-0"><strong>Siblings:</strong> ${esc(formatPersonNames(fam.siblings))}</p>
          ${narrativeFamilyBlock}
        </section>
      `;

      bodyEl.innerHTML = `
        <div class="memorial-profile-grid">
          <div>
            <section class="memorial-profile-card mb-3">
              <h6 class="mb-3">Record Summary</h6>
              <dl class="row mb-0">
                <dt class="col-sm-3">Birth</dt><dd class="col-sm-9">${esc(birthDisplay)}</dd>
                <dt class="col-sm-3">Death</dt><dd class="col-sm-9">${esc(deathDisplay)}</dd>
                ${marriedRow}
                ${childrenRow}
                ${occRow}
                ${milRow}
              </dl>
              ${infoLine('Birth place', p.birthPlace)}
              ${infoLine('Recorded born', p.born)}
              ${infoLine('Death place', p.deathPlace)}
              ${infoLine('Recorded died', p.died)}
              ${infoLine('Burial', p.burial)}
            </section>
            ${familySummary}
            ${
              text || metaDetails
                ? `
                  <section class="memorial-profile-card mt-3">
                    <h6 class="mb-3">Memorial Notes</h6>
                    ${text ? `<div class="memorial-profile-text">${text}</div>` : ''}
                    ${metaDetails}
                  </section>
                `
                : ''
            }
            <p class="mb-0 mt-3 memorial-profile-links"><a href="/family/genealogy.html" class="text-info">Open family tree</a></p>
          </div>
          <div>
            ${createMapCardMarkup(placeEntries)}
          </div>
        </div>
      `;

      renderPlaceContext(placeEntries, renderToken);
    } catch (e) {
      titleEl.textContent = 'Error';
      bodyEl.innerHTML = `<p class="text-danger mb-0">${esc(e.message || String(e))}</p>`;
    }
  }

  function wireClicks() {
    const wall = document.getElementById('memorialWall');
    wall.addEventListener('click', (ev) => {
      const line = ev.target.closest('.memorial-line[data-person-id]');
      if (!line) return;
      openModal(line.dataset.personId);
    });
    wall.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const line = ev.target.closest('.memorial-line[data-person-id]');
      if (!line) return;
      ev.preventDefault();
      openModal(line.dataset.personId);
    });
  }

  async function load() {
    const errBox = document.getElementById('memorialError');
    const stat = document.getElementById('memorialStat');
    errBox.classList.add('d-none');

    try {
      const res = await fetch(`${API_BASE}/people`);
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.people)) {
        throw new Error(data.error || 'Failed to load people');
      }

      let people = data.people;
      const bookOnly = document.getElementById('bookOnly').checked;
      if (bookOnly) {
        people = people.filter(isBookOrOcrSource);
      }

      stat.textContent = `${people.length} shown${bookOnly ? ' (filtered)' : ''} · ${data.count} total in tree`;

      renderWall(people);
    } catch (e) {
      errBox.textContent = e.message || String(e);
      errBox.classList.remove('d-none');
      document.getElementById('memorialWall').innerHTML = '';
      stat.textContent = '';
    }
  }

  document.getElementById('bookOnly').addEventListener('change', load);
  wireClicks();
  load();
})();
