/** Browser id for Postgres-backed hide list (not secret; bucket for this device) */
const LS_CLIENT_ID = 'lanePdfGallery.clientId';
/** One-shot migrate old localStorage hides to API */
const LS_DB_MIGRATED = 'lanePdfGallery.dbHidesMigrated20260428';
const LEGACY_PLATE_HIDE = 'lanePdfGallery.userHiddenIds';
const LS_PLATE_HIDE_LEGACY = 'lanePdfGallery.plateHideIds';
const LS_SHOW_HIDDEN = 'lanePdfGallery.showHidden';
/** Runs once ever per browser if the full grid suppressed every plate with no filters (broken state) */
const LS_AUTO_GRID_FIX_ONCE = 'lanePdfGallery.blankGridRecoverOnce.v1';
/** One-shot: older builds defaulted checkbox off → empty grid after denylist+hides */
const SHOW_HIDDEN_LEGACY_ONCE = 'lanePdfGallery.defaultShowLegacy20260428';
/** Legacy localStorage presets — migrated once to Postgres via /lane-pdf/presets/import */
const LS_FILTER_PRESETS = 'lanePdfGallery.filterPresets.v1';
const LS_PRESETS_MIGRATED = 'lanePdfGallery.presetsMigratedToDb.v1';

/** Lane PDF extractor plate keys, e.g. p12-i0 (ignore junk from bad imports) */
const PLATE_IMAGE_ID_RE = /^p\d+-i\d+$/;

function isLikelyPlateImageId(raw) {
  return typeof raw === 'string' && PLATE_IMAGE_ID_RE.test(raw.trim());
}

/** Allowlisted slugs for committee portrait crops on plate p4-i0 (see data/lane-historians.json). */
const LANE_HISTORIANS_PORTRAIT_DEEPLINK = Object.freeze({
  'john-wm-lane': 'Rev. John Wm. Lane',
  'jas-h-fitts': 'Rev. James H. Fitts',
  'geo-w-lane': 'Geo. W. Lane, Esq.',
  'dr-edwd-b-lane': 'Dr. Edward B. Lane'
});

/**
 * @param {string} raw query value
 * @returns {{ slug: string, label: string } | null}
 */
function parsePortraitDeepLinkParam(raw) {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '');
  if (!k || !Object.prototype.hasOwnProperty.call(LANE_HISTORIANS_PORTRAIT_DEEPLINK, k)) return null;
  return { slug: k, label: LANE_HISTORIANS_PORTRAIT_DEEPLINK[k] };
}

function renderPortraitDeeplinkBanner(portraitInfo) {
  const banner = document.getElementById('lanePdfPortraitDeeplinkBanner');
  if (!banner) return;
  if (!portraitInfo) {
    banner.classList.add('d-none');
    banner.innerHTML = '';
    return;
  }
  const { slug, label } = portraitInfo;
  const histUrl = `/family/lane-historians.html#lh-portrait-${encodeURIComponent(slug)}`;
  banner.classList.remove('d-none');
  banner.innerHTML = `<p class="mb-1"><strong>Historians portrait</strong> — this opening plate includes a dedicated crop for <strong>${esc(label)}</strong> on the Lane Historians page.</p><p class="mb-0 small"><a href="${esc(histUrl)}">Open Lane Historians · ${esc(label)}</a> · <code>p4-i0</code></p>`;
}

function sanitizePlateIdList(ids) {
  const seen = new Set();
  const out = [];
  for (const x of ids || []) {
    const s = String(x ?? '').trim();
    if (!isLikelyPlateImageId(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseIdList(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const parts = raw.split(/[\s,]+/).map((x) => parseInt(x.trim(), 10)).filter((n) => !Number.isNaN(n));
  return parts.length ? parts : null;
}

/** PDF page filter: empty or integer ≥ 1 */
function sanitizeFilterPage(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (!s) return '';
  const p = parseInt(s, 10);
  if (Number.isNaN(p) || p < 1) return '';
  return String(p);
}

/** JPEG exists (pypdf decoded); skip JBIG2 / other failed streams */
function isExtractedPlate(img) {
  if (!img || img.status === 'skipped') return false;
  if (img.status === 'ok') return true;
  return Boolean(img.publicUrl && (img.fileName || /\.jpg$/i.test(String(img.publicUrl))));
}

/**
 * Migrate from legacy lanePdfGallery.userHiddenIds once:
 * oversized lists (>200 valid ids after sanitize) were almost always accidental imports → drop them.
 */
function migratePlateHideFromLegacyOnce() {
  try {
    const legacy = localStorage.getItem(LEGACY_PLATE_HIDE);
    const current = localStorage.getItem(LS_PLATE_HIDE_LEGACY);
    if (!legacy) return;
    if (!current) {
      const parsed = JSON.parse(legacy);
      if (!Array.isArray(parsed)) {
        localStorage.removeItem(LEGACY_PLATE_HIDE);
        return;
      }
      const cleaned = sanitizePlateIdList(parsed.map((x) => String(x ?? '')));
      /** Keep deliberate small queues; purge obvious bulk-hide accidents */
      if (cleaned.length > 200) {
        localStorage.removeItem(LEGACY_PLATE_HIDE);
        return;
      }
      localStorage.setItem(LS_PLATE_HIDE_LEGACY, JSON.stringify(cleaned));
    }
    localStorage.removeItem(LEGACY_PLATE_HIDE);
  } catch (_) {
    try {
      localStorage.removeItem(LEGACY_PLATE_HIDE);
    } catch (_) {
      /* ignore */
    }
  }
}

function getOrCreateClientId() {
  try {
    let id = localStorage.getItem(LS_CLIENT_ID);
    if (id && typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      /** basic UUID shape */
      const u = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (u.test(id.trim())) return id.trim();
    }
    const nu = crypto.randomUUID();
    localStorage.setItem(LS_CLIENT_ID, nu);
    return nu;
  } catch (e) {
    console.warn('lane-pdf-gallery: client id', e);
    return '';
  }
}

/** Read legacy local hides once for Postgres import only */
function peekLegacyPlateHideIds() {
  try {
    const raw = localStorage.getItem(LS_PLATE_HIDE_LEGACY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sanitizePlateIdList(parsed.map((x) => String(x ?? ''))) : [];
  } catch {
    return [];
  }
}

/** Page + candidate id filters only */
function filterByPageAndIds(images, pageFilter, idFilter) {
  let list = images.slice();
  if (pageFilter != null && pageFilter !== '') {
    const p = parseInt(pageFilter, 10);
    /* PDF pages are 1-based; p=0 or negative matches nothing → empty grid confusion */
    if (!Number.isNaN(p) && p >= 1) list = list.filter((img) => img.pdfPage === p);
  }
  if (idFilter && idFilter.length) {
    list = list.filter((img) => {
      const ids = img.candidatePersonIds || [];
      return idFilter.some((fid) => ids.includes(fid));
    });
  }
  return list;
}

/** Plates suppressed by repo denylist (checkbox controls whether those still show). */
function serverHiddenSet(ids) {
  return new Set(sanitizePlateIdList(ids || []));
}

/** Always removed from grid when hidden — personal list in Postgres */
function userHiddenSet(ids) {
  return new Set(sanitizePlateIdList(ids || []));
}

/**
 * Decide which thumbnails to render.
 * Personal hides never appear; "Show hidden plates" reveals only denylist-flagged IDs.
 */
function computeGalleryVisible(narrowed, galleryHiddenIds, userHiddenIds, showServerDenied) {
  const serverH = serverHiddenSet(galleryHiddenIds);
  const userH = userHiddenSet(userHiddenIds);
  const displayed = narrowed.filter((img) => {
    const id = img.imageId ? String(img.imageId) : '';
    if (!id) return true;
    if (userH.has(id)) return false;
    if (serverH.has(id)) return showServerDenied;
    return true;
  });

  /** In current filtered slice: suppressed by denylist toggle or by your hide list */
  const suppressedHere = narrowed.reduce((acc, img) => {
    const id = img.imageId ? String(img.imageId) : '';
    if (!id) return acc;
    if (userH.has(id)) return acc + 1;
    if (serverH.has(id) && !showServerDenied) return acc + 1;
    return acc;
  }, 0);

  const serverSuppressedFiltered = narrowed.filter(
    (img) => img.imageId && serverH.has(String(img.imageId))
  ).length;
  const uhCount = narrowed.filter(
    (img) => img.imageId && userH.has(String(img.imageId))
  ).length;

  return {
    displayed,
    suppressedHere,
    serverSuppressedFiltered,
    uhCount
  };
}

function renderGallery(images, portraits, container) {
  const portraitByImageId = new Map();
  for (const p of portraits || []) {
    if (p.imageId) portraitByImageId.set(p.imageId, p);
  }

  container.innerHTML = (images || [])
    .map((img) => {
      const isSkipped = img.status === 'skipped';
      const ids = img.candidatePersonIds || [];
      const ambiguous = img.ambiguous;
      const confirmed = img.imageId && portraitByImageId.has(img.imageId);
      const portrait = confirmed ? portraitByImageId.get(img.imageId) : null;
      const url = img.publicUrl || '#';
      const cardClass = isSkipped ? 'lane-pdf-card lane-pdf-card--skipped' : 'lane-pdf-card';
      const plateMeta =
        !isSkipped &&
        `Page ${img.pdfPage} · ${img.imageId}${
          img.width && img.height ? ` · ${img.width}×${img.height}` : ''
        }`;
      const imgTag = isSkipped
        ? `<div class="d-flex align-items-center justify-content-center bg-secondary text-white" style="height:120px">Not extracted</div>`
        : `<img src="${esc(url)}" alt="" loading="lazy" class="lane-pdf-thumb" tabindex="0" role="button" data-plate-meta="${esc(
            plateMeta
          )}" aria-label="${esc(`Expand plate, page ${img.pdfPage}`)}" title="Decoded JPEG from the PDF scan; pale boxes often match blank or low-detail pages in the book, not a missing file." onerror="this.style.opacity=0.35" />`;

      let badge = '';
      if (isSkipped) {
        badge = '<span class="badge lane-pdf-badge-skipped mb-1">Skipped decode</span>';
      } else if (confirmed) {
        badge = '<span class="badge bg-success mb-1">Curated portrait</span>';
      } else if (ambiguous) {
        badge = '<span class="badge lane-pdf-badge-ambiguous mb-1">Ambiguous page</span>';
      } else if (ids.length === 1) {
        badge = '<span class="badge lane-pdf-badge-candidate mb-1">Single candidate</span>';
      } else if (ids.length > 1) {
        badge = '<span class="badge lane-pdf-badge-ambiguous mb-1">Multiple candidates</span>';
      } else {
        badge = '<span class="badge bg-secondary mb-1">No tree match</span>';
      }

      const hideBtn =
        !isSkipped && img.imageId
          ? `<button type="button" class="btn btn-sm btn-outline-secondary lane-pdf-hide-btn mt-2" data-hide-plate-id="${esc(img.imageId)}">Hide from gallery</button>`
          : '';

      const idLinks = ids
        .slice(0, 12)
        .map(
          (pid) =>
            `<a href="/family/genealogy.html?id=${encodeURIComponent(pid)}" class="mr-2">#${esc(pid)}</a>`
        )
        .join(' ');
      const more = ids.length > 12 ? ` <span class="text-muted">+${ids.length - 12}</span>` : '';
      const yearRange = portrait
        ? `${portrait.personBirthYear || '?'} - ${portrait.personDeathYear || '?'}`
        : '';
      const occupationText =
        portrait && Array.isArray(portrait.personOccupations) && portrait.personOccupations.length
          ? portrait.personOccupations.join(' | ')
          : '';
      const portraitMeta = portrait
        ? `
          <div class="lane-pdf-meta mt-1 small">
            <div><strong>Years:</strong> ${esc(yearRange)}</div>
            ${portrait.personBorn ? `<div><strong>Born:</strong> ${esc(portrait.personBorn)}</div>` : ''}
            ${portrait.personDeathPlace ? `<div><strong>Died:</strong> ${esc(portrait.personDeathPlace)}</div>` : ''}
            ${portrait.personTitle ? `<div><strong>Title:</strong> ${esc(portrait.personTitle)}</div>` : ''}
            ${occupationText ? `<div><strong>Occupation:</strong> ${esc(occupationText)}</div>` : ''}
            ${
              portrait.personGeneration != null && portrait.personGeneration !== ''
                ? `<div><strong>Generation:</strong> ${esc(portrait.personGeneration)}</div>`
                : ''
            }
            ${portrait.notes ? `<div><strong>Match note:</strong> ${esc(portrait.notes)}</div>` : ''}
            ${portrait.credit ? `<div class="text-muted"><strong>Credit:</strong> ${esc(portrait.credit)}</div>` : ''}
          </div>`
        : '';

      return `
        <div class="col-md-4 col-sm-6 mb-4">
          <div class="${cardClass}"${img.imageId ? ` data-lane-pdf-plate-id="${esc(img.imageId)}"` : ''}>
            ${imgTag}
            <div class="lane-pdf-card-body">
              ${badge}
              <div><strong>Page</strong> ${esc(img.pdfPage)} · <code>${esc(img.imageId)}</code></div>
              ${
                portrait && portrait.personName
                  ? `<div class="mt-1"><strong>Display name:</strong> ${esc(portrait.personName)}</div>`
                  : ''
              }
              ${portraitMeta}
              ${!isSkipped && img.width ? `<div class="text-muted">${esc(img.width)}×${esc(img.height)}</div>` : ''}
              ${
                isSkipped && img.reason
                  ? `<div class="small text-danger mt-1">${esc(img.reason)}</div>`
                  : ''
              }
              <div class="mt-1 small"><strong>Candidates:</strong> ${idLinks || '—'}${more}</div>
              ${hideBtn}
            </div>
          </div>
        </div>`;
    })
    .join('');
}

function bindPlateLightbox(grid) {
  if (!grid) return;
  const root = document.getElementById('lanePdfLightbox');
  const imgEl = document.getElementById('lanePdfLightboxImg');
  const capEl = document.getElementById('lanePdfLightboxCaption');
  const backdrop = root && root.querySelector('.lane-pdf-lightbox-backdrop');
  const closeBtn = root && root.querySelector('.lane-pdf-lightbox-close');
  let lastFocus = null;

  if (!root || !imgEl || !capEl || !backdrop || !closeBtn) return;

  function openFromThumb(thumb) {
    const src = thumb.getAttribute('src');
    if (!src || src === '#') return;
    lastFocus = thumb;
    imgEl.src = src;
    imgEl.alt = thumb.getAttribute('aria-label') || 'Plate';
    capEl.textContent = thumb.getAttribute('data-plate-meta') || '';
    capEl.id = 'lanePdfLightboxCaption';
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    root.hidden = true;
    imgEl.src = '';
    document.body.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  grid.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-hide-plate-id]')) return;
    if (t.tagName !== 'IMG' || !t.classList.contains('lane-pdf-thumb')) return;
    e.preventDefault();
    openFromThumb(t);
  });

  grid.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t.tagName !== 'IMG' || !t.classList.contains('lane-pdf-thumb')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFromThumb(t);
    }
  });

  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !root.hidden) close();
  });
}

function bindHideDelegation(grid, onHidePlate) {
  if (!grid || typeof onHidePlate !== 'function') return;
  grid.addEventListener('click', (e) => {
    let n = /** @type {Node | null} */ (e.target);
    while (n && n.nodeType !== Node.ELEMENT_NODE) n = n.parentNode;
    const hideBtn = n instanceof Element ? n.closest('[data-hide-plate-id]') : null;
    if (!hideBtn) return;
    e.preventDefault();
    const id = hideBtn.getAttribute('data-hide-plate-id');
    if (!id) return;
    onHidePlate(id);
  });
}

async function initLanePdfGallery() {
  const grid = document.getElementById('lanePdfGrid');
  const errEl = document.getElementById('lanePdfError');
  const statsLine = document.getElementById('lanePdfStatsLine');
  const pageInput = document.getElementById('lanePdfFilterPage');
  const idInput = document.getElementById('lanePdfFilterIds');
  const showHiddenInput = document.getElementById('lanePdfShowHidden');
  const clearUserBtn = document.getElementById('lanePdfClearUserHidden');
  const exportBtn = document.getElementById('lanePdfExportUserHidden');
  const importTrigger = document.getElementById('lanePdfTriggerImportHides');
  const importInput = document.getElementById('lanePdfImportHidesInput');
  const emptyHint = document.getElementById('lanePdfEmptyHint');
  const emptyTitle = document.getElementById('lanePdfEmptyHintTitle');
  const emptyDetail = document.getElementById('lanePdfEmptyHintDetail');
  const recoverShowHiddenBtn = document.getElementById('lanePdfRecoverShowHidden');
  const recoverClearHidesBtn = document.getElementById('lanePdfRecoverClearHides');
  const recoverClearFiltersBtn = document.getElementById('lanePdfRecoverClearFilters');
  const emergencyRestoreBtn = document.getElementById('lanePdfEmergencyRestore');
  const undoBtn = document.getElementById('lanePdfUndoHide');
  const presetSelect = document.getElementById('lanePdfPresetSelect');
  const presetLoadBtn = document.getElementById('lanePdfPresetLoad');
  const presetSaveBtn = document.getElementById('lanePdfPresetSave');
  const presetDeleteBtn = document.getElementById('lanePdfPresetDelete');
  const presetExportBtn = document.getElementById('lanePdfPresetExport');
  const presetImportTrigger = document.getElementById('lanePdfPresetImportTrigger');
  const presetImportInput = document.getElementById('lanePdfPresetImportInput');

  bindPlateLightbox(grid);

  try {
    const res = await fetch('/api/genealogy/lane-pdf/gallery');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Request failed');

    const galleryHiddenIds = sanitizePlateIdList(
      Array.isArray(data.galleryHiddenIds) ? data.galleryHiddenIds.map(String) : []
    );
    const images = (data.images || []).filter(isExtractedPlate);
    const portraits = data.portraits || [];
    const summary = data.summary || {};
    const extractedIdSet = new Set(images.map((i) => (i.imageId ? String(i.imageId) : '')));

    /** Postgres-backed personal hides — always omitted from grid; denylist separately toggled below */
    let dbUserHiddenIds = [];
    let dbCanUndo = false;
    const clientId = getOrCreateClientId();

    async function refreshHidesFromServer() {
      if (!clientId) return;
      const r = await fetch(`/api/genealogy/lane-pdf/hides?clientId=${encodeURIComponent(clientId)}`);
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Could not load your hide preferences');
      dbUserHiddenIds = sanitizePlateIdList(Array.isArray(j.hiddenImageIds) ? j.hiddenImageIds : []);
      dbCanUndo = Boolean(j.canUndo);
      if (undoBtn) undoBtn.disabled = !dbCanUndo;
    }

    async function migrateLegacyHidesToDb() {
      if (!clientId || localStorage.getItem(LS_DB_MIGRATED) === '1') return;
      migratePlateHideFromLegacyOnce();
      const merged = sanitizePlateIdList(peekLegacyPlateHideIds());
      const capped = merged.length > 250 ? merged.slice(0, 250) : merged;
      try {
        const r = await fetch('/api/genealogy/lane-pdf/hides/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, imageIds: capped })
        });
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j.error || 'Import failed');
        localStorage.setItem(LS_DB_MIGRATED, '1');
        try {
          localStorage.removeItem(LS_PLATE_HIDE_LEGACY);
          localStorage.removeItem(LEGACY_PLATE_HIDE);
        } catch (_) {
          /* ignore */
        }
      } catch (e) {
        console.warn('lane-pdf-gallery: DB migrate deferred', e);
      }
    }

    try {
      await migrateLegacyHidesToDb();
      await refreshHidesFromServer();
    } catch (hidesErr) {
      console.warn('lane-pdf-gallery hides API', hidesErr);
      errEl.textContent =
        hidesErr.message ||
        String(hidesErr || 'Gallery data loaded but hide preferences unavailable (check DATABASE_URL server-side).');
      errEl.classList.remove('d-none');
    }

    try {
      if (!localStorage.getItem(SHOW_HIDDEN_LEGACY_ONCE)) {
        localStorage.setItem(SHOW_HIDDEN_LEGACY_ONCE, '1');
        if (localStorage.getItem(LS_SHOW_HIDDEN) === '0') {
          localStorage.removeItem(LS_SHOW_HIDDEN);
        }
      }
    } catch (_) {
      /* ignore */
    }

    if (showHiddenInput) {
      const sv = localStorage.getItem(LS_SHOW_HIDDEN);
      if (sv === '0') {
        showHiddenInput.checked = false;
      } else {
        /** Default checked: show full grid (omit denylist hides only when unchecked) */
        showHiddenInput.checked = true;
      }
    }

    bindHideDelegation(grid, async (plateId) => {
      if (!clientId) {
        errEl.textContent =
          'Cannot save hides — no browser client id (check local storage / private window).';
        errEl.classList.remove('d-none');
        return;
      }
      try {
        errEl.textContent = '';
        errEl.classList.add('d-none');
        const r = await fetch('/api/genealogy/lane-pdf/hides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, imageId: plateId })
        });
        const j = await r.json();
        if (!r.ok || !j.success) {
          errEl.textContent = j.error || 'Could not save hide';
          errEl.classList.remove('d-none');
          return;
        }
        dbUserHiddenIds = sanitizePlateIdList(j.hiddenImageIds || []);
        dbCanUndo = Boolean(j.canUndo);
        if (undoBtn) undoBtn.disabled = !dbCanUndo;
        /** Do not uncheck "show denylist" — that was hiding hundreds of plates; user hides are filtered in applyFilters() */
        applyFilters();
      } catch (he) {
        console.warn('lane-pdf-gallery: hide POST', he);
        errEl.textContent = he.message || String(he);
        errEl.classList.remove('d-none');
      }
    });

    function persistShowHiddenCheckbox() {
      if (!showHiddenInput) return;
      try {
        localStorage.setItem(LS_SHOW_HIDDEN, showHiddenInput.checked ? '1' : '0');
      } catch (e) {
        console.warn('lane-pdf-gallery: could not persist show-hidden toggle', e);
      }
    }

    if (showHiddenInput && localStorage.getItem(LS_SHOW_HIDDEN) === null) {
      persistShowHiddenCheckbox();
    }

    let lastFilterSerialized = '';
    let galleryDisplayedFull = [];
    /** Snapshot for stats line + empty-state hints (matches latest applyFilters pass). */
    let lastGalleryStatsCtx = null;
    /** Last fetch from GET /lane-pdf/presets (server-backed saved views). */
    let presetsCache = [];

    function filterSnapshot() {
      const pageVal = pageInput.value.trim();
      const idVal = idInput.value.trim();
      const sh = showHiddenInput ? (showHiddenInput.checked ? '1' : '0') : '1';
      return `${pageVal}|${idVal}|${sh}`;
    }

    function plateVisibilityLabelHtml(N) {
      return `Plates shown: <strong>${esc(N)}</strong>`;
    }

    function refreshGalleryVisuals(ctx) {
      const {
        displayedFull,
        narrowed,
        showHidden,
        suppressedHere,
        serverSuppressedInFilter,
        userHidesInFilter,
        summary: sum,
        galleryHiddenIds: gHid,
        extractedIdSet: exSet,
        userHiddenIdsLive: uHid,
        portraits: portraitsArg
      } = ctx;
      renderGallery(displayedFull, portraitsArg, grid);

      const N = displayedFull.length;

      const skippedChip =
        typeof sum.skippedCount === 'number' && sum.skippedCount > 0
          ? `<span class="lane-pdf-stat-chip lane-pdf-stat-chip--note"><span class="lane-pdf-stat-k">Skipped decode</span> <span class="text-muted">${esc(sum.skippedCount)} omitted</span></span>`
          : '';

      const totalHiddenListed = gHid.reduce(
        (acc, id) => acc + (exSet.has(String(id)) ? 1 : 0),
        0
      );
      const uhCount = (uHid || []).filter((id) => exSet.has(String(id))).length;

      let viewingNote = '';
      if (showHidden && serverSuppressedInFilter > 0) {
        const uh = typeof userHidesInFilter === 'number' ? userHidesInFilter : 0;
        viewingNote = ` <span class="text-info">Showing ${esc(
          serverSuppressedInFilter
        )} server-denylisted plate(s) in this filtered set.${uh > 0 ? ` Omitting ${esc(uh)} you hid.` : ''}</span>`;
      } else if (!showHidden && suppressedHere > 0) {
        viewingNote = ` <span class="text-muted">${esc(
          suppressedHere
        )} plate(s) not shown (${esc(serverSuppressedInFilter)} denylist toggle; personal hides always off grid).</span>`;
      }

      const platesFrag = plateVisibilityLabelHtml(N);

      const withCandidates = images.filter((i) => (i.candidatePersonIds || []).length > 0).length;

      if (statsLine) {
        statsLine.innerHTML = `
        <div class="lane-pdf-stats-chips">
          <span class="lane-pdf-stat-chip"><span class="lane-pdf-stat-k">PDF pages</span> <strong class="lane-pdf-stat-v">${esc(sum.pdfPageCount)}</strong></span>
          <span class="lane-pdf-stat-chip"><span class="lane-pdf-stat-k">Extracted JPEGs</span> <strong class="lane-pdf-stat-v">${esc(images.length)}</strong></span>
          ${skippedChip}
          <span class="lane-pdf-stat-chip lane-pdf-stat-chip--emphasis">${platesFrag}${viewingNote}</span>
          <span class="lane-pdf-stat-chip"><span class="lane-pdf-stat-k">Server-hidden</span> <strong class="lane-pdf-stat-v">${esc(totalHiddenListed)}</strong></span>
          <span class="lane-pdf-stat-chip"><span class="lane-pdf-stat-k">Your hides</span> <strong class="lane-pdf-stat-v">${esc(uhCount)}</strong></span>
          <span class="lane-pdf-stat-chip"><span class="lane-pdf-stat-k">With ≥1 candidate</span> <strong class="lane-pdf-stat-v">${esc(withCandidates)}</strong></span>
          <span class="lane-pdf-stat-chip"><span class="lane-pdf-stat-k">Curated portraits</span> <strong class="lane-pdf-stat-v">${esc(portraitsArg.length)}</strong></span>
        </div>`;
      }
    }

    /** User hides from Postgres; checkbox only reveals repo denylist (your hides stay off-grid). */
    function applyFilters() {
      const snap = filterSnapshot();
      if (snap !== lastFilterSerialized) {
        lastFilterSerialized = snap;
      }

      const userHiddenIdsLive = dbUserHiddenIds;
      const pageVal = pageInput.value.trim();
      const idFilter = parseIdList(idInput.value.trim());
      const narrowed = filterByPageAndIds(images, pageVal, idFilter);

      let showHidden = Boolean(showHiddenInput && showHiddenInput.checked);
      const noTextFilters =
        pageInput.value.trim().length === 0 && idInput.value.trim().length === 0;

      const visibilityIfOff = computeGalleryVisible(
        narrowed,
        galleryHiddenIds,
        userHiddenIdsLive,
        false
      );
      const visibilityIfOn = computeGalleryVisible(narrowed, galleryHiddenIds, userHiddenIdsLive, true);

      const wouldHideAll =
        narrowed.length >= 40 &&
        images.length >= 40 &&
        noTextFilters &&
        narrowed.length === images.length &&
        !showHidden &&
        visibilityIfOff.displayed.length === 0 &&
        visibilityIfOn.displayed.length > 0;

      if (wouldHideAll && !localStorage.getItem(LS_AUTO_GRID_FIX_ONCE)) {
        try {
          localStorage.setItem(LS_AUTO_GRID_FIX_ONCE, '1');
        } catch (_) {
          /* ignore */
        }
        if (showHiddenInput) showHiddenInput.checked = true;
        persistShowHiddenCheckbox();
        showHidden = true;
      }

      const vis = computeGalleryVisible(narrowed, galleryHiddenIds, userHiddenIdsLive, showHidden);
      const { displayed, suppressedHere, uhCount: userHidesInFilter, serverSuppressedFiltered } = vis;

      galleryDisplayedFull = displayed;

      lastGalleryStatsCtx = {
        displayedFull: galleryDisplayedFull,
        narrowed,
        showHidden,
        suppressedHere,
        serverSuppressedInFilter: serverSuppressedFiltered,
        userHidesInFilter,
        summary,
        galleryHiddenIds,
        extractedIdSet,
        userHiddenIdsLive,
        portraits
      };

      refreshGalleryVisuals(lastGalleryStatsCtx);

      /* Empty-grid recovery hints (wrong import, stray filters, or show-hidden off while everything suppressed) */
      if (emptyHint && emptyTitle && emptyDetail && images.length > 0) {
        recoverShowHiddenBtn && recoverShowHiddenBtn.classList.add('d-none');
        recoverClearHidesBtn && recoverClearHidesBtn.classList.add('d-none');
        recoverClearFiltersBtn && recoverClearFiltersBtn.classList.add('d-none');

        const hasPageOrIdFilter =
          pageInput.value.trim().length > 0 || idInput.value.trim().length > 0;

        if (displayed.length === 0) {
          emptyHint.classList.remove('d-none');
          if (narrowed.length === 0 && hasPageOrIdFilter) {
            emptyTitle.textContent = 'No plates match your filters.';
            emptyDetail.textContent =
              'Adjust or clear the PDF page number and candidate id filters.';
            recoverClearFiltersBtn && recoverClearFiltersBtn.classList.remove('d-none');
          } else if (narrowed.length > 0) {
            if (visibilityIfOn.displayed.length === 0) {
              emptyTitle.textContent =
                'No plates visible — you hid every plate in this filtered view.';
              emptyDetail.textContent =
                'Use Undo last hide or Clear my hides to restore them. Turning on Show hidden plates only affects server denylist items, not your personal hides.';
              recoverClearHidesBtn && recoverClearHidesBtn.classList.remove('d-none');
            } else if (!showHidden) {
              emptyTitle.textContent =
                'No plates visible — matched plates are hidden by the server denylist.';
              emptyDetail.textContent =
                'Turn on Show hidden plates to show those flagged plates again (your personally hidden plates stay off the grid until you clear them).';
              recoverShowHiddenBtn && recoverShowHiddenBtn.classList.remove('d-none');
              recoverClearHidesBtn && recoverClearHidesBtn.classList.remove('d-none');
            } else {
              emptyHint.classList.add('d-none');
            }
          } else {
            emptyHint.classList.add('d-none');
          }
        } else {
          emptyHint.classList.add('d-none');
        }
      }
    }

    async function migrateLocalPresetsOnce() {
      if (!clientId || localStorage.getItem(LS_PRESETS_MIGRATED) === '1') return;
      try {
        const raw = localStorage.getItem(LS_FILTER_PRESETS);
        if (!raw) {
          localStorage.setItem(LS_PRESETS_MIGRATED, '1');
          return;
        }
        const doc = JSON.parse(raw);
        const arr = doc && Array.isArray(doc.presets) ? doc.presets : [];
        if (arr.length === 0) {
          localStorage.setItem(LS_PRESETS_MIGRATED, '1');
          localStorage.removeItem(LS_FILTER_PRESETS);
          return;
        }
        const r = await fetch('/api/genealogy/lane-pdf/presets/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, presets: arr })
        });
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j.error || 'Preset migration failed');
        localStorage.setItem(LS_PRESETS_MIGRATED, '1');
        localStorage.removeItem(LS_FILTER_PRESETS);
      } catch (e) {
        console.warn('lane-pdf-gallery: preset migration deferred', e);
      }
    }

    async function refreshPresetDropdown(selectIdAfter) {
      if (!presetSelect) return;
      if (!clientId) {
        presetSelect.innerHTML = '';
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = '— Client id unavailable —';
        presetSelect.appendChild(opt0);
        if (presetDeleteBtn) presetDeleteBtn.disabled = true;
        if (presetLoadBtn) presetLoadBtn.disabled = true;
        return;
      }
      try {
        const r = await fetch(`/api/genealogy/lane-pdf/presets?clientId=${encodeURIComponent(clientId)}`);
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j.error || 'Could not load presets');
        presetsCache = Array.isArray(j.presets) ? j.presets : [];
      } catch (e) {
        console.warn('lane-pdf-gallery: presets GET', e);
        presetsCache = [];
      }
      const sorted = presetsCache
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
      presetSelect.innerHTML = '';
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Choose a saved view —';
      presetSelect.appendChild(opt0);
      for (const pr of sorted) {
        const op = document.createElement('option');
        op.value = pr.id;
        op.textContent = pr.label;
        presetSelect.appendChild(op);
      }
      if (selectIdAfter && sorted.some((p) => p.id === selectIdAfter)) {
        presetSelect.value = selectIdAfter;
      }
      if (presetDeleteBtn) presetDeleteBtn.disabled = !presetSelect.value;
      if (presetLoadBtn) presetLoadBtn.disabled = !presetSelect.value;
    }

    function loadSelectedPreset() {
      if (!presetSelect) return;
      const sel = presetSelect.value;
      if (!sel) return;
      const pr = presetsCache.find((p) => p.id === sel);
      if (!pr || !pr.config) return;
      pageInput.value = pr.config.filterPage != null ? String(pr.config.filterPage) : '';
      idInput.value =
        pr.config.filterCandidateIds != null ? String(pr.config.filterCandidateIds) : '';
      if (showHiddenInput && typeof pr.config.showServerDenied === 'boolean') {
        showHiddenInput.checked = pr.config.showServerDenied;
        persistShowHiddenCheckbox();
      }
      applyFilters();
    }

    async function saveCurrentPreset() {
      if (!clientId) {
        window.alert('Cannot save — no browser client id.');
        return;
      }
      const label = window.prompt(
        'Name this saved view (stores PDF page, candidate id filter, and Show denylist checkbox):',
        ''
      );
      if (label == null) return;
      const trimmed = label.trim().slice(0, 80);
      if (!trimmed) {
        window.alert('Please enter a name.');
        return;
      }
      const cfg = {
        filterPage: sanitizeFilterPage(pageInput.value),
        filterCandidateIds: idInput.value.trim().slice(0, 500),
        showServerDenied: showHiddenInput ? showHiddenInput.checked : true
      };
      try {
        const r = await fetch('/api/genealogy/lane-pdf/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, label: trimmed, config: cfg })
        });
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j.error || 'Could not save preset');
        presetsCache = Array.isArray(j.presets) ? j.presets : presetsCache;
        const sid = j.saved && j.saved.id ? String(j.saved.id) : '';
        await refreshPresetDropdown(sid);
      } catch (e) {
        window.alert(e.message || String(e) || 'Could not save presets.');
      }
    }

    async function deleteSelectedPreset() {
      if (!presetSelect || !presetSelect.value || !clientId) return;
      const sel = presetSelect.value;
      try {
        const r = await fetch(
          `/api/genealogy/lane-pdf/presets?clientId=${encodeURIComponent(clientId)}&presetId=${encodeURIComponent(sel)}`,
          { method: 'DELETE' }
        );
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j.error || 'Delete failed');
        presetsCache = Array.isArray(j.presets) ? j.presets : [];
        await refreshPresetDropdown('');
      } catch (e) {
        window.alert(e.message || String(e) || 'Could not delete preset.');
      }
    }

    function exportPresetsToFile() {
      const out = {
        version: 1,
        exportedAt: new Date().toISOString(),
        notes:
          'Lane book plates gallery — filter presets. Import merges by label into Postgres for this browser client id.',
        presets: presetsCache.slice()
      };
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lane-pdf-gallery-filter-presets.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    if (presetLoadBtn) {
      presetLoadBtn.addEventListener('click', () => loadSelectedPreset());
    }
    if (presetSelect) {
      presetSelect.addEventListener('change', () => {
        if (presetDeleteBtn) presetDeleteBtn.disabled = !presetSelect.value;
        if (presetLoadBtn) presetLoadBtn.disabled = !presetSelect.value;
      });
      presetSelect.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          loadSelectedPreset();
        }
      });
    }
    if (presetSaveBtn) presetSaveBtn.addEventListener('click', () => saveCurrentPreset());
    if (presetDeleteBtn) presetDeleteBtn.addEventListener('click', () => deleteSelectedPreset());
    if (presetExportBtn) presetExportBtn.addEventListener('click', () => exportPresetsToFile());
    if (presetImportTrigger && presetImportInput) {
      presetImportTrigger.addEventListener('click', () => presetImportInput.click());
      presetImportInput.addEventListener('change', () => {
        const file = presetImportInput.files && presetImportInput.files[0];
        presetImportInput.value = '';
        if (!file || !clientId) return;
        file
          .text()
          .then(async (text) => {
            const parsed = JSON.parse(text);
            const arr = Array.isArray(parsed.presets)
              ? parsed.presets
              : Array.isArray(parsed)
                ? parsed
                : null;
            if (!arr || !arr.length) throw new Error('No presets array found in JSON.');
            const r = await fetch('/api/genealogy/lane-pdf/presets/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, presets: arr })
            });
            const j = await r.json();
            if (!r.ok || !j.success) throw new Error(j.error || 'Import failed');
            presetsCache = Array.isArray(j.presets) ? j.presets : [];
            await refreshPresetDropdown('');
            errEl.textContent = '';
            errEl.classList.add('d-none');
          })
          .catch((e) => {
            console.warn('lane-pdf-gallery: preset import', e);
            errEl.textContent = e.message || 'Could not import presets (invalid JSON?).';
            errEl.classList.remove('d-none');
          });
      });
    }

    migrateLocalPresetsOnce()
      .then(() => refreshPresetDropdown(''))
      .catch(() => refreshPresetDropdown(''));

    function onStorageAcrossTabs(ev) {
      if (ev.key === LS_SHOW_HIDDEN || ev.key === LS_CLIENT_ID) {
        refreshHidesFromServer()
          .then(() => applyFilters())
          .catch(() => {});
      }
    }
    window.addEventListener('storage', onStorageAcrossTabs);
    window.addEventListener('focus', () => {
      if (!clientId || !presetSelect) return;
      refreshPresetDropdown(presetSelect.value || '').catch(() => {});
    });

    async function clearHidesViaApiOnly() {
      if (!clientId) return;
      const r = await fetch(`/api/genealogy/lane-pdf/hides?clientId=${encodeURIComponent(clientId)}`, {
        method: 'DELETE'
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || 'Clear hides failed');
      dbUserHiddenIds = sanitizePlateIdList(j.hiddenImageIds || []);
      dbCanUndo = Boolean(j.canUndo);
      if (undoBtn) undoBtn.disabled = !dbCanUndo;
    }

    async function restoreFullGalleryView() {
      try {
        await clearHidesViaApiOnly();
      } catch (e) {
        console.warn('lane-pdf-gallery: restore', e);
      }
      pageInput.value = '';
      idInput.value = '';
      if (showHiddenInput) {
        showHiddenInput.checked = true;
        persistShowHiddenCheckbox();
      }
      try {
        localStorage.removeItem(LS_AUTO_GRID_FIX_ONCE);
      } catch (_) {
        /* ignore */
      }
      applyFilters();
    }

    if (clearUserBtn) {
      clearUserBtn.addEventListener('click', async () => {
        try {
          await clearHidesViaApiOnly();
          errEl.classList.add('d-none');
        } catch (e) {
          errEl.textContent = e.message || String(e);
          errEl.classList.remove('d-none');
          return;
        }
        applyFilters();
      });
    }

    if (undoBtn) {
      undoBtn.addEventListener('click', async () => {
        if (!clientId || undoBtn.disabled) return;
        try {
          errEl.classList.add('d-none');
          const r = await fetch('/api/genealogy/lane-pdf/hides/undo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId })
          });
          const j = await r.json();
          if (!r.ok || !j.success) throw new Error(j.error || 'Undo failed');
          dbUserHiddenIds = sanitizePlateIdList(j.hiddenImageIds || []);
          dbCanUndo = Boolean(j.canUndo);
          undoBtn.disabled = !dbCanUndo;
          applyFilters();
        } catch (ue) {
          errEl.textContent = ue.message || String(ue);
          errEl.classList.remove('d-none');
        }
      });
    }

    if (emergencyRestoreBtn) {
      emergencyRestoreBtn.addEventListener('click', () => restoreFullGalleryView());
    }

    if (recoverShowHiddenBtn) {
      recoverShowHiddenBtn.addEventListener('click', () => {
        if (!showHiddenInput) return;
        showHiddenInput.checked = true;
        persistShowHiddenCheckbox();
        applyFilters();
      });
    }

    if (recoverClearHidesBtn) {
      recoverClearHidesBtn.addEventListener('click', async () => {
        try {
          await clearHidesViaApiOnly();
          errEl.classList.add('d-none');
        } catch (_) {
          /* ignore */
        }
        applyFilters();
      });
    }

    if (recoverClearFiltersBtn) {
      recoverClearFiltersBtn.addEventListener('click', () => {
        pageInput.value = '';
        idInput.value = '';
        applyFilters();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const ids = dbUserHiddenIds.slice();
        const doc = {
          version: 1,
          exportedAt: new Date().toISOString(),
          notes: 'Merge via Import hides on Lane book plates gallery; merges with existing browser hides.',
          hiddenImageIds: ids
        };
        const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lane-pdf-gallery-user-hides.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    }

    if (importTrigger && importInput) {
      importTrigger.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', async () => {
        const file = importInput.files && importInput.files[0];
        importInput.value = '';
        if (!file || !clientId) return;
        try {
          const text = await file.text();
          const doc = JSON.parse(text);
          const incoming = Array.isArray(doc.hiddenImageIds) ? doc.hiddenImageIds : [];
          const merged = sanitizePlateIdList(
            [...new Set([...dbUserHiddenIds, ...incoming.map((id) => String(id))])]
          ).slice(0, 250);
          const r = await fetch('/api/genealogy/lane-pdf/hides/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, imageIds: merged })
          });
          const j = await r.json();
          if (!r.ok || !j.success) throw new Error(j.error || 'Import failed');
          dbUserHiddenIds = sanitizePlateIdList(j.hiddenImageIds || []);
          dbCanUndo = Boolean(j.canUndo);
          if (undoBtn) undoBtn.disabled = !dbCanUndo;
          errEl.textContent = '';
          errEl.classList.add('d-none');
          applyFilters();
        } catch (e) {
          console.warn('lane-pdf-gallery: import failed', e);
          errEl.textContent = 'Could not merge import (invalid JSON?).';
          errEl.classList.remove('d-none');
        }
      });
    }

    if (showHiddenInput) {
      showHiddenInput.addEventListener('change', () => {
        persistShowHiddenCheckbox();
        applyFilters();
      });
    }

    pageInput.addEventListener('input', applyFilters);
    idInput.addEventListener('input', applyFilters);

    /** Deep link: ?pdfPage=4 and/or ?plate=p4-i0 (alias ?imageId=p4-i0); optional ?portrait=<slug> for Lane Historians committee crops */
    (function applyUrlDeepLinkParams() {
      try {
        const params = new URLSearchParams(window.location.search);
        const plate = (params.get('plate') || params.get('imageId') || '').trim();
        const pageFromQuery = sanitizeFilterPage(params.get('pdfPage') || '');
        const portraitInfo = parsePortraitDeepLinkParam(params.get('portrait') || params.get('historian') || '');
        if (plate && isLikelyPlateImageId(plate)) {
          const hit = images.find((img) => String(img.imageId || '') === plate);
          if (hit && hit.pdfPage) {
            pageInput.value = String(hit.pdfPage);
          }
          idInput.value = '';
        } else if (pageFromQuery) {
          pageInput.value = pageFromQuery;
        }
        applyFilters();
        renderPortraitDeeplinkBanner(portraitInfo);
        if (plate && isLikelyPlateImageId(plate)) {
          requestAnimationFrame(() => {
            const cel = grid.querySelector(`[data-lane-pdf-plate-id="${CSS.escape(plate)}"]`);
            if (cel && typeof cel.scrollIntoView === 'function') {
              cel.scrollIntoView({ behavior: 'smooth', block: 'center' });
              cel.classList.add('lane-pdf-card--deeplink');
              window.setTimeout(() => cel.classList.remove('lane-pdf-card--deeplink'), 2600);
            }
          });
        }
      } catch (_) {
        renderPortraitDeeplinkBanner(null);
        applyFilters();
      }
    })();
  } catch (e) {
    errEl.textContent = e.message || String(e);
    errEl.classList.remove('d-none');
  }
}

document.addEventListener('DOMContentLoaded', initLanePdfGallery);
