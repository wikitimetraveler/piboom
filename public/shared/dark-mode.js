/**
 * Dark Mode Toggle System
 *
 * @file       dark-mode.js
 * @author     David Lane
 * @version    1.1.0
 * @since      2024
 *
 * Sitewide zen dark theme + Lane heritage (--lf-*) overrides.
 * Preference key: devConnectLabs_darkMode
 */

const DARK_MODE_KEY = 'devConnectLabs_darkMode';

const darkModeStyles = `
  body.dark-mode {
    --zen-primary: #6bb3c7;
    --zen-primary-hover: #5a9db0;
    --zen-primary-rgb: 107, 179, 199;
    --zen-muted: #94a3b8;
    --zen-border: rgba(107, 179, 199, 0.28);
    --zen-card-bg: rgba(45, 55, 72, 0.96);
    --zen-dark: #0f172a;
    --zen-surface: #1e293b;
    --zen-surface-muted: #334155;

    --primary-blue: var(--zen-primary);
    --primary-blue-hover: var(--zen-primary-hover);
    --text-dark: #f1f5f9;
    --text-muted: #cbd5e1;
    --border-light: rgba(255, 255, 255, 0.12);
    --background-light: #1e293b;
    --white: #2d3748;

    --ice-primary: var(--zen-primary);
    --ice-secondary: #5ba88a;
    --ice-dark: #e2e8f0;
    --ice-light: rgba(107, 179, 199, 0.12);
    --ice-glow: rgba(107, 179, 199, 0.35);
    --ice-border: rgba(107, 179, 199, 0.25);

    --text: var(--text-dark);
    --muted: var(--text-muted);
    --border: var(--border-light);

    --bg-primary: var(--zen-surface);
    --bg-secondary: var(--zen-surface-muted);
    --text-primary: var(--text-dark);
    --text-secondary: var(--text-muted);

    --site-primary: var(--zen-primary);
    --site-primary-hover: var(--zen-primary-hover);
    --site-primary-rgb: var(--zen-primary-rgb);
    --site-muted: var(--zen-muted);
    --site-border: var(--zen-border);
    --site-card-bg: var(--zen-card-bg);
    --site-dark: #0f172a;
    --site-surface: var(--zen-surface);
    --site-surface-muted: var(--zen-surface-muted);
    --site-highlight: var(--ice-secondary);

    background: linear-gradient(135deg, var(--site-surface) 0%, var(--site-surface-muted) 50%, #475569 100%);
    color: var(--text-primary);
  }

  body.dark-mode[data-site-theme="heritage"] {
    --site-primary: #c4a48a;
    --site-primary-hover: #d6b59b;
    --site-primary-rgb: 196, 164, 138;
    --site-muted: #afa495;
    --site-border: rgba(196, 164, 138, 0.24);
    --site-card-bg: rgba(40, 34, 30, 0.96);
    --site-dark: #14100d;
    --site-surface: #201a16;
    --site-surface-muted: #312720;
    --site-highlight: #d7bf84;

    --primary-blue: var(--site-primary);
    --primary-blue-hover: var(--site-primary-hover);
    --text-dark: #f5efe7;
    --text-muted: #d4cbc0;
    --border-light: var(--site-border);
    --background-light: var(--site-surface);
    --ice-primary: var(--site-primary);
    --ice-secondary: var(--site-highlight);
    --ice-dark: var(--text-dark);
    --ice-light: rgba(196, 164, 138, 0.12);
    --ice-glow: rgba(196, 164, 138, 0.26);
    --ice-border: var(--site-border);
    --text: var(--text-dark);
    --muted: var(--text-muted);
    --border: var(--border-light);
    --bg-primary: var(--site-surface);
    --bg-secondary: var(--site-surface-muted);
    --text-primary: var(--text-dark);
    --text-secondary: var(--text-muted);

    background: linear-gradient(135deg, var(--site-surface) 0%, var(--site-surface-muted) 50%, #43362d 100%);
  }

  /* Lane heritage (magazine, hub, shell tools) */
  body.dark-mode.lane-magazine-page,
  body.dark-mode.lane-major-achievers-page,
  body.dark-mode.lane-family-hub,
  body.dark-mode.lane-historians-page,
  body.dark-mode.lane-museum-page,
  body.dark-mode.lane-war-page,
  body.dark-mode.lane-memorial-page,
  body.dark-mode.lane-occ-page,
  body.dark-mode.lane-direct-page,
  body.dark-mode.lane-pdf-gallery-root {
    --lf-bg: #1a1917;
    --lf-bg-elevated: #242220;
    --lf-ink: #f3f1ec;
    --lf-ink-soft: #d4cfc6;
    --lf-muted: #9a948a;
    --lf-line: rgba(243, 241, 236, 0.1);
    --lf-line-strong: rgba(243, 241, 236, 0.18);
    --lf-accent: #a88b72;
    --lf-accent-hover: #c4a48a;
    --lane-heritage-ink: var(--lf-ink);
    --lane-heritage-ink-soft: var(--lf-ink-soft);
    --lane-heritage-accent: var(--lf-accent);
    --lane-heritage-muted: var(--lf-muted);
  }

  body.dark-mode.lane-trading-cards-page {
    --lf-surface-dark: #0a0c10;
    --lf-ink-on-dark: #f1f2f6;
    --lf-muted-on-dark: #b8bfd0;
    --lf-gold: #d9c47a;
    --lf-gold-muted: rgba(217, 196, 122, 0.4);
  }

  body.dark-mode .navbar,
  body.dark-mode .modern-navbar {
    background: color-mix(in srgb, var(--site-surface) 92%, black 8%) !important;
    border-bottom-color: var(--site-border) !important;
  }

  body.dark-mode .header {
    background: color-mix(in srgb, var(--site-surface) 90%, black 10%);
    border-bottom-color: var(--site-border);
  }

  body.dark-mode .page-hero__title {
    color: var(--text-primary);
  }

  body.dark-mode .page-hero__lead {
    color: var(--text-secondary);
  }

  body.dark-mode .tool-card {
    background: var(--site-card-bg);
    border-color: var(--site-border);
    color: var(--text-primary);
  }

  body.dark-mode .tool-card:hover {
    background: color-mix(in srgb, var(--site-card-bg) 90%, var(--site-primary) 10%);
    border-color: var(--site-primary);
  }

  body.dark-mode .tool-card h3,
  body.dark-mode .tool-card p,
  body.dark-mode .tool-card h4 {
    color: var(--text-primary);
  }

  body.dark-mode .tool-card .text-muted {
    color: var(--text-secondary) !important;
  }

  body.dark-mode .premium-accordion .card {
    background: var(--site-card-bg);
    border-color: var(--site-border);
  }

  body.dark-mode .premium-accordion .card-header {
    background: var(--site-surface-muted);
  }

  body.dark-mode .card-body {
    background: color-mix(in srgb, var(--site-card-bg) 85%, transparent);
  }

  body.dark-mode .form-control,
  body.dark-mode .form-select {
    background: var(--background-light);
    border-color: var(--site-border);
    color: var(--text-primary);
  }

  body.dark-mode .form-control:focus,
  body.dark-mode .form-select:focus {
    border-color: var(--site-primary);
    box-shadow: 0 0 0 0.2rem rgba(var(--site-primary-rgb), 0.35);
  }

  body.dark-mode .table {
    color: var(--text-primary);
    --bs-table-bg: transparent;
  }

  body.dark-mode .table th {
    background: var(--site-surface-muted);
    color: var(--text-primary);
    border-color: var(--site-border);
  }

  body.dark-mode .table td {
    border-color: var(--site-border);
  }

  body.dark-mode .dataTables_wrapper {
    color: var(--text-secondary);
  }

  body.dark-mode .disaster-detail-strip {
    background: var(--background-light);
    border-color: var(--site-border);
  }

  body.dark-mode #youtubeResults .youtube-card {
    background: var(--site-card-bg);
    border-color: var(--site-border);
  }

  body.dark-mode .dropdown-menu {
    background: color-mix(in srgb, var(--site-surface) 92%, black 8%);
    border-color: var(--site-border);
  }

  body.dark-mode .dropdown-item {
    color: var(--text-secondary);
  }

  body.dark-mode .dropdown-item:hover {
    background: var(--site-surface-muted);
    color: var(--text-primary);
  }

  body.dark-mode .footer {
    background: linear-gradient(135deg, var(--site-surface), var(--site-surface-muted));
    border-top-color: var(--site-border);
  }

  body.dark-mode .user-selector,
  body.dark-mode .user-info .user-display {
    background: var(--site-card-bg) !important;
    border-color: var(--site-border) !important;
    color: var(--text-primary);
  }

  body.dark-mode .btn-primary {
    background: var(--site-primary);
    border-color: var(--site-primary);
  }

  body.dark-mode .btn-primary:hover {
    background: var(--site-primary-hover);
    border-color: var(--site-primary-hover);
  }

  .dark-mode-toggle {
    position: fixed;
    bottom: 100px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--site-primary, #4a90a4), var(--site-primary-hover, #3d7a8a));
    border: none;
    color: white;
    cursor: pointer;
    z-index: 999;
    box-shadow: 0 4px 15px rgba(var(--site-primary-rgb, 74, 144, 164), 0.45);
    transition: box-shadow 0.3s ease, transform 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
  }

  .dark-mode-toggle:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 22px rgba(var(--site-primary-rgb, 74, 144, 164), 0.55);
  }

  .dark-mode-toggle:active {
    transform: scale(0.95);
  }
`;

function initDarkMode() {
  const styleEl = document.createElement('style');
  styleEl.id = 'darkModeStyles';
  styleEl.textContent = darkModeStyles;
  if (!document.getElementById('darkModeStyles')) {
    document.head.appendChild(styleEl);
  }

  const isDark = localStorage.getItem(DARK_MODE_KEY) === 'true';
  if (isDark) {
    document.body.classList.add('dark-mode');
  }

  if (!document.querySelector('.dark-mode-toggle')) {
    createDarkModeToggle();
  }
}

function createDarkModeToggle() {
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'dark-mode-toggle';
  toggleBtn.type = 'button';
  toggleBtn.setAttribute('aria-label', 'Toggle dark mode');
  toggleBtn.title = 'Toggle Dark Mode';
  toggleBtn.onclick = toggleDarkMode;
  updateToggleIcon(toggleBtn);
  document.body.appendChild(toggleBtn);
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem(DARK_MODE_KEY, isDark);
  const toggleBtn = document.querySelector('.dark-mode-toggle');
  updateToggleIcon(toggleBtn);
  document.body.style.transition = 'background 0.3s ease, color 0.3s ease';
  setTimeout(() => {
    document.body.style.transition = '';
  }, 300);
}

function updateToggleIcon(toggleBtn) {
  if (!toggleBtn) return;
  const isDark = document.body.classList.contains('dark-mode');
  toggleBtn.innerHTML = isDark
    ? '<i class="bi-sun-fill"></i>'
    : '<i class="bi-moon-stars-fill"></i>';
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDarkMode);
  } else {
    initDarkMode();
  }
}

window.initDarkMode = initDarkMode;
window.toggleDarkMode = toggleDarkMode;
