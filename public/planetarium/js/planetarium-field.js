/**
 * Planetarium Field — dock, sheets, night levels, first-run calibrate
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  if (!root.__PLANETARIUM_FIELD && !document.body?.classList.contains('plan-field')) {
    return;
  }

  const NIGHT_KEY = 'planFieldNight';
  const BRIGHT_KEY = 'planFieldBrightness';
  const CALIBRATE_KEY = 'planFieldCalibrateSeen';
  const TITLES = {
    guide: 'Carl',
    tonight: 'Tonight',
    discover: 'Find',
    more: 'More',
  };

  function isField() {
    return !!(root.__PLANETARIUM_FIELD || document.body?.classList.contains('plan-field'));
  }

  function setSheetOpen(open, size) {
    const sidebar = document.getElementById('planSidebar');
    const backdrop = document.getElementById('planSidebarBackdrop');
    const moreBtn = document.getElementById('planDockMore');
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', !!open);
    document.body.classList.toggle('plan-desk-open', !!open);
    if (size) sidebar.setAttribute('data-sheet-size', size);
    else if (!open) sidebar.removeAttribute('data-sheet-size');
    if (backdrop) backdrop.hidden = !open;
    if (moreBtn) moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function setDeskTab(id) {
    const next =
      id === 'tonight' || id === 'discover' || id === 'more' ? id : 'guide';
    document.querySelectorAll('[data-plan-tab]').forEach((tab) => {
      const on = tab.getAttribute('data-plan-tab') === next;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-plan-pane]').forEach((pane) => {
      const on = pane.getAttribute('data-plan-pane') === next;
      pane.classList.toggle('is-active', on);
      pane.hidden = !on;
    });
    const title = document.getElementById('planSheetTitle');
    if (title) title.textContent = TITLES[next] || 'Field';
  }

  function openSheet(tab, size) {
    setDeskTab(tab);
    setSheetOpen(true, size || (tab === 'discover' ? 'lg' : 'sm'));
    if (tab === 'discover') {
      root.setTimeout(() => document.getElementById('planCatalogSearch')?.focus(), 180);
    }
  }

  function applyNightLevel(level) {
    const next = level === 'dim' || level === 'deep' ? level : 'red';
    document.body.setAttribute('data-night', next);
    document.body.classList.add('plan-night-vision');
    const nv = document.getElementById('planNightVision');
    if (nv) nv.setAttribute('aria-pressed', 'true');
    document.querySelectorAll('[data-night-level]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-night-level') === next);
    });
    try {
      localStorage.setItem(NIGHT_KEY, next);
    } catch (_) {
      /* private mode */
    }
  }

  function applyBrightness(pct) {
    const n = Math.max(10, Math.min(100, Number(pct) || 70));
    document.body.style.setProperty('--plan-field-ui-opacity', String(n / 100));
    const slider = document.getElementById('planFieldBrightness');
    if (slider && String(slider.value) !== String(n)) slider.value = String(n);
    try {
      localStorage.setItem(BRIGHT_KEY, String(n));
    } catch (_) {
      /* private mode */
    }
  }

  function syncFaceDock() {
    const compass = document.getElementById('planCompassToggle');
    const face = document.getElementById('planDockFace');
    const heading = document.getElementById('planFieldHeading');
    if (!face) return;
    const on = compass?.getAttribute('aria-pressed') === 'true';
    face.setAttribute('aria-pressed', on ? 'true' : 'false');
    face.classList.toggle('is-active', !!on);
    if (heading) {
      const status = document.getElementById('planCompassStatus')?.textContent || '';
      const match = status.match(/Facing\s+(\d+)/i);
      if (on && match) {
        heading.hidden = false;
        const deg = Number(match[1]);
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const label = dirs[Math.round(deg / 45) % 8];
        heading.textContent = deg + '° ' + label;
      } else {
        heading.hidden = true;
        heading.textContent = '';
      }
    }
  }

  function cycleFov() {
    const GL = root.PlanetariumGL;
    if (!GL || !GL.ok || typeof GL.setFov !== 'function') return;
    const view = GL.getView?.() || {};
    const steps = [40, 70, 100, 140];
    const cur = Number(view.fov) || 70;
    let idx = steps.findIndex((v) => cur <= v + 5);
    if (idx < 0) idx = 0;
    const next = steps[(idx + 1) % steps.length];
    GL.setFov(next);
    const fovEl = document.getElementById('planFov');
    if (fovEl) fovEl.textContent = Math.round(next) + '° FOV';
  }

  function bindDock() {
    document.getElementById('planDockFace')?.addEventListener('click', () => {
      document.getElementById('planCompassToggle')?.click();
      root.setTimeout(syncFaceDock, 80);
    });
    document.getElementById('planDockFace')?.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      openSheet('more', 'sm');
      document.getElementById('planFacing')?.focus();
    });
    document.getElementById('planDockFind')?.addEventListener('click', () => openSheet('discover', 'lg'));
    document.getElementById('planDockTonight')?.addEventListener('click', () => openSheet('tonight', 'sm'));
    document.getElementById('planDockMore')?.addEventListener('click', () => {
      const sidebar = document.getElementById('planSidebar');
      const open = sidebar?.classList.contains('is-open');
      const moreActive =
        document.querySelector('[data-plan-pane="more"]')?.classList.contains('is-active');
      if (open && moreActive) setSheetOpen(false);
      else openSheet('more', 'sm');
    });
    document.getElementById('planDockCarl')?.addEventListener('click', () => {
      openSheet('guide', 'sm');
      root.setTimeout(() => document.getElementById('planAskCarl')?.click(), 120);
    });

    document.getElementById('planHudWhen')?.addEventListener('click', () => openSheet('more', 'sm'));
    document.getElementById('planFov')?.addEventListener('click', cycleFov);

    document.getElementById('planSidebarClose')?.addEventListener('click', () => setSheetOpen(false));
    document.getElementById('planSidebarBackdrop')?.addEventListener('click', () => setSheetOpen(false));

    document.getElementById('planCompassToggle')?.addEventListener('click', () => {
      root.setTimeout(syncFaceDock, 120);
    });

    // After catalog pick / ISS jump, collapse sheet so sky is visible
    document.getElementById('planCatalogHits')?.addEventListener('click', (ev) => {
      if (ev.target.closest('button, a, .plan-catalog-hit')) {
        root.setTimeout(() => setSheetOpen(false), 200);
      }
    });
    document.getElementById('planIssList')?.addEventListener('click', (ev) => {
      if (ev.target.closest('button, a, .plan-iss-hit')) {
        root.setTimeout(() => setSheetOpen(false), 200);
      }
    });
    document.getElementById('planPlanetBody')?.addEventListener('click', (ev) => {
      if (ev.target.closest('button, tr, a')) {
        root.setTimeout(() => setSheetOpen(false), 200);
      }
    });
    document.getElementById('planAsterisms')?.addEventListener('click', (ev) => {
      if (ev.target.closest('button, a')) {
        root.setTimeout(() => setSheetOpen(false), 200);
      }
    });
    document.getElementById('planDeepSky')?.addEventListener('click', (ev) => {
      if (ev.target.closest('button, a, .plan-deepsky-hit')) {
        root.setTimeout(() => setSheetOpen(false), 200);
      }
    });
  }

  function bindNightKit() {
    let saved = 'red';
    let bright = 70;
    try {
      saved = localStorage.getItem(NIGHT_KEY) || 'red';
      bright = Number(localStorage.getItem(BRIGHT_KEY)) || 70;
    } catch (_) {
      /* private mode */
    }
    applyNightLevel(saved);
    applyBrightness(bright);

    document.querySelectorAll('[data-night-level]').forEach((btn) => {
      btn.addEventListener('click', () => applyNightLevel(btn.getAttribute('data-night-level')));
    });
    document.getElementById('planFieldBrightness')?.addEventListener('input', (ev) => {
      applyBrightness(ev.target.value);
    });
  }

  function bindCalibrate() {
    const wrap = document.getElementById('planFieldCalibrate');
    if (!wrap) return;
    let seen = false;
    try {
      seen = localStorage.getItem(CALIBRATE_KEY) === '1';
    } catch (_) {
      /* private mode */
    }
    if (seen) return;
    wrap.hidden = false;

    function dismiss() {
      wrap.hidden = true;
      try {
        localStorage.setItem(CALIBRATE_KEY, '1');
      } catch (_) {
        /* private mode */
      }
    }

    document.getElementById('planCalibrateLocate')?.addEventListener('click', () => {
      document.getElementById('planGeolocate')?.click();
      dismiss();
    });
    document.getElementById('planCalibrateFace')?.addEventListener('click', () => {
      document.getElementById('planCompassToggle')?.click();
      root.setTimeout(syncFaceDock, 150);
      dismiss();
    });
    document.getElementById('planCalibrateSkip')?.addEventListener('click', dismiss);
  }

  function watchCompassStatus() {
    const status = document.getElementById('planCompassStatus');
    if (!status || typeof MutationObserver !== 'function') return;
    const mo = new MutationObserver(() => syncFaceDock());
    mo.observe(status, { childList: true, characterData: true, subtree: true });
  }

  function initField() {
    if (!isField()) return;
    bindNightKit();
    bindDock();
    bindCalibrate();
    watchCompassStatus();
    syncFaceDock();

    // Expose helpers for extras / tests
    root.PlanetariumField = {
      openSheet,
      setSheetOpen,
      applyNightLevel,
      applyBrightness,
      syncFaceDock,
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => root.setTimeout(initField, 60));
  } else {
    root.setTimeout(initField, 60);
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
