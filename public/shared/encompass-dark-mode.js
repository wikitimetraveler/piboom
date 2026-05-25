/**
 * Development work by David Lane
 */
/**
 * Shared Encompass Dark Mode toggle.
 * Include encompass-dark-mode.css and this script on Encompass tool pages.
 * Preference stored in localStorage (encompassDarkMode: 'true' | 'false').
 */
(function () {
  'use strict';
  const STORAGE_KEY = 'encompassDarkMode';
  const BODY_CLASS = 'encompass-dark-mode';

  function isDarkMode() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }

  function injectGridDarkStyles() {
    var id = 'encompass-dark-mode-grid-overrides';
    var el = document.getElementById(id);
    if (el) return el;
    el = document.createElement('style');
    el.id = id;
    el.textContent = [
      'body.encompass-dark-mode{background:#374151!important;color:#f3f4f6!important}',
      'body.encompass-dark-mode .main-content,body.encompass-dark-mode .container,body.encompass-dark-mode main{color:#f3f4f6!important}',
      'body.encompass-dark-mode .ag-theme-alpine,body.encompass-dark-mode #unitTestsGrid,body.encompass-dark-mode #fieldsGrid{--ag-background-color:#374151!important;--ag-foreground-color:#f3f4f6!important;--ag-header-background-color:#4b5563!important;--ag-header-foreground-color:#f9fafb!important;--ag-odd-row-background-color:#374151!important;--ag-row-hover-color:#4b5563!important;--ag-border-color:#6b7280!important;background:#374151!important}',
      'body.encompass-dark-mode .ag-theme-alpine .ag-root,body.encompass-dark-mode .ag-theme-alpine .ag-root-wrapper,body.encompass-dark-mode .ag-theme-alpine .ag-body-viewport,body.encompass-dark-mode .ag-theme-alpine .ag-center-cols-viewport,body.encompass-dark-mode .ag-theme-alpine .ag-center-cols-container,body.encompass-dark-mode .ag-theme-alpine .ag-body-horizontal-scroll,body.encompass-dark-mode #unitTestsGrid .ag-root,body.encompass-dark-mode #unitTestsGrid .ag-body-viewport,body.encompass-dark-mode #fieldsGrid .ag-root,body.encompass-dark-mode #fieldsGrid .ag-body-viewport{background:#374151!important}',
      'body.encompass-dark-mode .ag-theme-alpine .ag-header,body.encompass-dark-mode .ag-theme-alpine .ag-header-row,body.encompass-dark-mode .ag-theme-alpine .ag-pinned-left-header,body.encompass-dark-mode .ag-theme-alpine .ag-pinned-right-header,body.encompass-dark-mode #unitTestsGrid .ag-header,body.encompass-dark-mode #fieldsGrid .ag-header{background:#4b5563!important;color:#f9fafb!important;border-color:#6b7280!important}',
      'body.encompass-dark-mode .ag-theme-alpine .ag-header-cell,body.encompass-dark-mode #unitTestsGrid .ag-header-cell,body.encompass-dark-mode #fieldsGrid .ag-header-cell{background:#4b5563!important;color:#f9fafb!important;border-color:#6b7280!important}',
      'body.encompass-dark-mode .ag-theme-alpine .ag-cell,body.encompass-dark-mode .ag-theme-alpine .ag-row,body.encompass-dark-mode #unitTestsGrid .ag-cell,body.encompass-dark-mode #unitTestsGrid .ag-row,body.encompass-dark-mode #fieldsGrid .ag-cell,body.encompass-dark-mode #fieldsGrid .ag-row{background:#374151!important;color:#f3f4f6!important;border-color:#6b7280!important}',
      'body.encompass-dark-mode .ag-theme-alpine .ag-row-hover .ag-cell,body.encompass-dark-mode #unitTestsGrid .ag-row-hover .ag-cell,body.encompass-dark-mode #fieldsGrid .ag-row-hover .ag-cell{background:#4b5563!important}',
      'body.encompass-dark-mode .ag-theme-alpine .ag-cell.test-scenario-cell,body.encompass-dark-mode #unitTestsGrid .ag-cell.test-scenario-cell{background:#4b5563!important}',
      'body.encompass-dark-mode .ag-theme-alpine .ag-cell.test-scenario-cell.cell-pass,body.encompass-dark-mode #unitTestsGrid .ag-cell.test-scenario-cell.cell-pass{background:rgba(46,204,113,0.2)!important}',
      'body.encompass-dark-mode .ag-theme-alpine .ag-cell.test-scenario-cell.cell-fail,body.encompass-dark-mode #unitTestsGrid .ag-cell.test-scenario-cell.cell-fail{background:rgba(248,81,73,0.2)!important}',
      'body.encompass-dark-mode .ag-theme-alpine .ag-header-cell-label,body.encompass-dark-mode .ag-theme-alpine .ag-header-cell-text,body.encompass-dark-mode #unitTestsGrid .ag-header-cell-label,body.encompass-dark-mode #fieldsGrid .ag-header-cell-label{color:#f9fafb!important}',
      'body.encompass-dark-mode .ag-theme-alpine input,body.encompass-dark-mode .ag-theme-alpine select,body.encompass-dark-mode .ag-theme-alpine .ag-input-field-input,body.encompass-dark-mode #unitTestsGrid input,body.encompass-dark-mode #fieldsGrid input{background:#4b5563!important;border-color:#6b7280!important;color:#f3f4f6!important}',
      'body.encompass-dark-mode .ag-theme-alpine .ag-overlay-no-rows-center{color:#9ca3af!important}',
      'body.encompass-dark-mode #unitTestsGrid .ag-header-cell.step-header,body.encompass-dark-mode #unitTestsGrid .ag-header-cell.action-header,body.encompass-dark-mode #unitTestsGrid .ag-header-cell.target-header,body.encompass-dark-mode #unitTestsGrid .ag-header-cell.description-header{background:#4b5563!important;color:#f9fafb!important}',
      'body.encompass-dark-mode #unitTestsGrid .ag-cell.step-cell,body.encompass-dark-mode #unitTestsGrid .ag-cell.action-cell,body.encompass-dark-mode #unitTestsGrid .ag-cell.target-cell,body.encompass-dark-mode #unitTestsGrid .ag-cell.description-cell{background:#374151!important;color:#f3f4f6!important}',
      'body.encompass-dark-mode .card{background:#4b5563!important;border-color:#6b7280!important;color:#f3f4f6!important}',
      'body.encompass-dark-mode .card-header{background:#6b7280!important;border-color:#6b7280!important;color:#f9fafb!important}',
      'body.encompass-dark-mode .card-header .btn-link{color:#f9fafb!important}',
      'body.encompass-dark-mode .card-header .btn-link:hover{color:#58a6ff!important;background:#4b5563!important}',
      'body.encompass-dark-mode .card-body{background:#4b5563!important;color:#f3f4f6!important;border-color:#6b7280!important}',
      'body.encompass-dark-mode .accordion .card{background:#4b5563!important;border-color:#6b7280!important}',
      'body.encompass-dark-mode .accordion .card-header{background:#6b7280!important;border-color:#6b7280!important}',
      'body.encompass-dark-mode .accordion .card-header .btn-link{color:#f9fafb!important}',
      'body.encompass-dark-mode .accordion .card-body{background:#4b5563!important;color:#f3f4f6!important}',
      'body.encompass-dark-mode .accordion .collapse.show{border-color:#6b7280!important}',
      'body.encompass-dark-mode .collapse{background:#4b5563!important;border-color:#6b7280!important}',
      'body.encompass-dark-mode .badge-soft{background:#6b7280!important;color:#f9fafb!important;border-color:#6b7280!important}',
      'body.encompass-dark-mode .table-responsive{background:#374151!important}',
      'body.encompass-dark-mode .card-header.p-0{background:transparent!important}',
      'body.encompass-dark-mode .text-muted{color:#9ca3af!important}',
      'body.encompass-dark-mode .badge{background:#6b7280!important;color:#f9fafb!important;border-color:#6b7280!important}',
      'body.encompass-dark-mode h5,body.encompass-dark-mode .h5{color:#f9fafb!important}',
      'body.encompass-dark-mode small{color:#9ca3af!important}'
    ].join('');
    document.head.appendChild(el);
    return el;
  }

  function removeGridDarkStyles() {
    var el = document.getElementById('encompass-dark-mode-grid-overrides');
    if (el) el.remove();
  }

  function setDarkMode(on) {
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false');
    } catch (_) {}
    document.body.classList.toggle(BODY_CLASS, on);
    if (on) injectGridDarkStyles(); else removeGridDarkStyles();
    const btn = document.getElementById('encompassDarkModeToggle');
    if (btn) {
      btn.title = on ? 'Switch to light mode' : 'Switch to dark mode';
      btn.innerHTML = on ? '☀️' : '🌙';
      updateToggleStyle(btn);
    }
  }

  function updateToggleStyle(btn) {
    if (!btn) return;
    const dark = document.body.classList.contains(BODY_CLASS);
    btn.style.background = dark ? '#4b5563' : '#fff';
    btn.style.borderColor = dark ? '#6b7280' : '#dee2e6';
    btn.style.color = dark ? '#f9fafb' : '#374151';
  }

  function injectToggle() {
    if (document.getElementById('encompassDarkModeToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'encompassDarkModeToggle';
    btn.type = 'button';
    btn.title = isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode';
    btn.innerHTML = isDarkMode() ? '☀️' : '🌙';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.style.cssText = 'position:fixed;top:70px;right:16px;z-index:999;width:40px;height:40px;border-radius:8px;border:1px solid #dee2e6;background:#fff;color:#1f2937;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.1);transition:all 0.2s;';
    updateToggleStyle(btn);
    btn.addEventListener('mouseenter', function () {
      btn.style.transform = 'scale(1.05)';
      btn.style.background = document.body.classList.contains(BODY_CLASS) ? '#6b7280' : '#f3f4f6';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.transform = 'scale(1)';
      updateToggleStyle(btn);
    });
    btn.addEventListener('click', function () {
      setDarkMode(!document.body.classList.contains(BODY_CLASS));
      updateToggleStyle(btn);
    });
    document.body.appendChild(btn);
  }

  function init() {
    setDarkMode(isDarkMode());
    injectToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
