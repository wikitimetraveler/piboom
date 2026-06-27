/**
 * Collapsible workflow sidebar toggle (desktop collapse + mobile drawer).
 */
(function () {
  const MOBILE_MQ = window.matchMedia('(max-width: 991px)');

  function isMobile() {
    return MOBILE_MQ.matches;
  }

  function readStored(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v === '0' || v === '1') return v === '1';
    } catch (_) {}
    return fallback;
  }

  function writeStored(key, open) {
    try {
      localStorage.setItem(key, open ? '1' : '0');
    } catch (_) {}
  }

  function syncBodyClasses(open) {
    document.body.classList.toggle('section-sidebar-collapsed', !open);
    document.body.classList.toggle('section-sidebar-open', open && isMobile());
  }

  /**
   * @param {object} [opts]
   * @param {string} [opts.layoutSelector='.unit-tests-layout']
   * @param {string} [opts.sidebarSelector='.section-sidebar']
   * @param {string} [opts.storageKey='sectionSidebarOpen']
   * @param {boolean} [opts.defaultOpen=true]
   */
  function initSectionSidebarShell(opts) {
    const options = opts || {};
    const layoutSelector = options.layoutSelector || '.unit-tests-layout';
    const sidebarSelector = options.sidebarSelector || '.section-sidebar';
    const storageKey = options.storageKey || 'sectionSidebarOpen';
    const defaultOpen =
      typeof options.defaultOpen === 'boolean'
        ? options.defaultOpen
        : !isMobile();

    const layout = document.querySelector(layoutSelector);
    const sidebar = layout?.querySelector(sidebarSelector);
    if (!layout || !sidebar) return;

    let open = readStored(storageKey, defaultOpen);

    const drawer = document.createElement('div');
    drawer.className = 'section-sidebar-drawer';
    sidebar.parentNode.insertBefore(drawer, sidebar);
    drawer.appendChild(sidebar);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'section-sidebar-shell__toggle';
    toggle.setAttribute('aria-controls', sidebar.id || 'sectionSidebar');
    toggle.title = 'Show or hide workflow menu';

    const backdrop = document.createElement('div');
    backdrop.className = 'section-sidebar-shell__backdrop';
    backdrop.hidden = true;

    function paintToggle() {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.innerHTML = open
        ? '<i class="bi bi-chevron-left" aria-hidden="true"></i><span class="visually-hidden">Hide workflow menu</span>'
        : '<i class="bi bi-list" aria-hidden="true"></i><span class="visually-hidden">Show workflow menu</span>';
      backdrop.hidden = !(open && isMobile());
    }

    function applyState(persist) {
      syncBodyClasses(open);
      paintToggle();
      if (persist) writeStored(storageKey, open);
      if (!open && typeof options.onCollapse === 'function') options.onCollapse();
      if (open && typeof options.onExpand === 'function') options.onExpand();
      window.dispatchEvent(new CustomEvent('section-sidebar-toggle', { detail: { open } }));
    }

    toggle.addEventListener('click', () => {
      open = !open;
      applyState(true);
    });

    backdrop.addEventListener('click', () => {
      open = false;
      applyState(true);
    });

    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('a') && isMobile() && open) {
        open = false;
        applyState(true);
      }
    });

    MOBILE_MQ.addEventListener('change', () => {
      if (isMobile() && open) {
        applyState(false);
        return;
      }
      applyState(false);
    });

    layout.insertBefore(toggle, drawer);
    layout.appendChild(backdrop);

    if (!sidebar.id) sidebar.id = 'sectionSidebar';

    applyState(false);
  }

  window.initSectionSidebarShell = initSectionSidebarShell;
})();
