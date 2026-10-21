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
/** Jordan / Syria / Holy Land — default night mode; own preference (does not follow sitewide). */
const ME_ATLAS_DARK_MODE_KEY = 'devConnectLabs_meAtlas_darkMode';

function isMiddleEastAtlasPage() {
  const body = document.body;
  if (!body) return false;
  return (
    body.classList.contains('jd-page')
    || body.classList.contains('sy-page')
    || body.classList.contains('hl-page')
    ||     body.classList.contains('om-page')
    || body.classList.contains('ir-page')
    || body.classList.contains('iq-page')
    || body.classList.contains('lb-page')
    || body.classList.contains('eg-page')
  );
}

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
  body.dark-mode.lane-scientific-page,
  body.dark-mode.lane-pdf-gallery-root,
  body.dark-mode.lane-relationships-page,
  body.dark-mode.genealogy-tree-page,
  body.dark-mode.music-research-page {
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

  /* Hub tool tiles (music mini-nav, Nature Hub, Entertainment) — home glass cards */
  body.dark-mode .domain-tile {
    background: rgba(24, 34, 50, 0.72);
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 10px 28px rgba(0, 0, 0, 0.3);
  }

  body.dark-mode .domain-tile:hover {
    background: rgba(30, 44, 64, 0.88);
    border-color: rgba(107, 179, 199, 0.55);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 18px 40px rgba(0, 0, 0, 0.45);
  }

  body.dark-mode .domain-tile.active {
    background: rgba(107, 179, 199, 0.16);
    border-color: rgba(107, 179, 199, 0.6);
  }

  body.dark-mode .domain-tile i {
    color: #8fd0e0;
  }

  body.dark-mode .domain-tile span {
    color: #eef4f7;
  }

  /* Music + Nature hubs — home-page night wash */
  body.dark-mode.music-menu-page,
  body.dark-mode.nature-hub-page {
    background:
      radial-gradient(ellipse 80% 50% at 15% -10%, rgba(107, 179, 199, 0.16), transparent 55%),
      radial-gradient(ellipse 70% 45% at 90% 0%, rgba(16, 185, 129, 0.1), transparent 50%),
      linear-gradient(180deg, #0b1218 0%, #101b26 55%, #0b1218 100%);
    background-attachment: fixed;
  }

  body.dark-mode.nature-hub-page .hub-header {
    background: linear-gradient(135deg, rgba(27, 94, 32, 0.85), rgba(11, 18, 24, 0.9));
    border-bottom: 1px solid rgba(139, 195, 74, 0.25);
  }

  body.dark-mode.nature-hub-page .hub-tabs .nav-link {
    color: #a5d6a7;
  }

  body.dark-mode.nature-hub-page .hub-tabs .nav-link.active {
    background: #2e7d32;
    color: #fff;
  }

  body.dark-mode.nature-hub-page .gallery-item,
  body.dark-mode.nature-hub-page .field-guide-card,
  body.dark-mode.nature-hub-page .card {
    background: rgba(24, 34, 50, 0.72);
    border-color: rgba(139, 195, 74, 0.35);
    color: var(--text-primary);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  }

  body.dark-mode.nature-hub-page .gallery-item .caption {
    background: rgba(11, 18, 24, 0.85);
    color: var(--text-primary);
  }

  body.dark-mode.nature-hub-page #map {
    border-color: rgba(139, 195, 74, 0.45);
  }

  body.dark-mode.nature-hub-page .text-muted {
    color: var(--text-secondary) !important;
  }

  /* Music research / discovery / collection panels (several set light backgrounds inline) */
  body.dark-mode.music-menu-page .kg-widget-container,
  body.dark-mode.music-menu-page .search-container,
  body.dark-mode.music-menu-page .map-container,
  body.dark-mode.music-menu-page .timeline-container,
  body.dark-mode.music-menu-page .youtube-container,
  body.dark-mode.music-menu-page .artist-info,
  body.dark-mode.music-menu-page .band-members,
  body.dark-mode.music-menu-page main > .card,
  body.dark-mode.music-menu-page .collection-setup,
  body.dark-mode.music-menu-page .search-filter-bar,
  body.dark-mode.music-menu-page .release-day-panel {
    background: rgba(24, 34, 50, 0.78) !important;
    border-color: rgba(255, 255, 255, 0.12) !important;
    color: var(--text-primary);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 14px 40px rgba(0, 0, 0, 0.35) !important;
  }

  body.dark-mode.music-menu-page .kg-result-card,
  body.dark-mode.music-menu-page .chat-response,
  body.dark-mode.music-menu-page #map {
    background: rgba(11, 18, 24, 0.6) !important;
    color: var(--text-secondary) !important;
  }

  body.dark-mode.music-menu-page .card-header,
  body.dark-mode.music-menu-page .card-body {
    background: transparent;
    color: var(--text-primary);
  }

  body.dark-mode.music-menu-page .source-select,
  body.dark-mode.music-menu-page .search-input,
  body.dark-mode.music-menu-page #kgBtn,
  body.dark-mode.music-menu-page .kge-search-picker,
  body.dark-mode.music-menu-page .kge-search-picker input {
    background: rgba(11, 18, 24, 0.85) !important;
    border-color: rgba(107, 179, 199, 0.35) !important;
    color: var(--text-primary) !important;
  }

  body.dark-mode.music-menu-page .artist-suggest-list {
    background: #182232;
    border-color: rgba(255, 255, 255, 0.12);
  }

  body.dark-mode.music-menu-page .artist-suggest-list li:hover,
  body.dark-mode.music-menu-page .artist-suggest-list li.is-active {
    background: rgba(107, 179, 199, 0.16);
  }

  body.dark-mode.music-menu-page .toast {
    background: rgba(24, 34, 50, 0.96);
    color: var(--text-primary);
  }

  /* Global tool search (navbar Search / Ctrl+K) */
  body.dark-mode #globalToolSearchOverlay .cp-box {
    color-scheme: dark;
    background: rgba(24, 34, 50, 0.97);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  body.dark-mode #globalToolSearchOverlay .cp-input,
  body.dark-mode #globalToolSearchOverlay .cp-result {
    color: #eef4f7;
  }

  body.dark-mode #globalToolSearchOverlay .cp-kbd {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.16);
    color: #a8b8c4;
  }

  body.dark-mode #globalToolSearchOverlay .cp-result-name mark {
    color: #8fd0e0;
  }

  body.dark-mode #globalToolSearchOverlay .cp-footer {
    background: rgba(11, 18, 24, 0.7);
    border-top-color: rgba(255, 255, 255, 0.08);
  }

  body.dark-mode #globalToolSearchOverlay .cp-input-row {
    border-bottom-color: rgba(255, 255, 255, 0.08);
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

  /* —— Glazed Light Mode (fluffy, airy, bright) —— */
  body.gz-page:not(.dark-mode) {
    --gz-cocoa: #fff9f4;
    --gz-espresso: #fff4eb;
    --gz-bark: #f5e8dc;
    --gz-frost: #ff7a9a;
    --gz-frost-deep: #e85a7a;
    --gz-glaze: #f5c76a;
    --gz-glaze-hot: #ffd98a;
    --gz-cream: #2c1810;
    --gz-milk: #f5e8dc;
    --gz-ink: #2c1810;
    --gz-muted: rgba(44, 24, 16, 0.65);
    
    background:
      radial-gradient(ellipse 85% 50% at 15% -5%, rgba(255, 210, 220, 0.35), transparent 50%),
      radial-gradient(ellipse 75% 45% at 88% 10%, rgba(255, 225, 160, 0.3), transparent 48%),
      radial-gradient(ellipse 90% 55% at 50% 100%, rgba(255, 200, 150, 0.2), transparent 55%),
      linear-gradient(180deg, #fffbf7 0%, #fff4eb 40%, #ffe8d6 100%) !important;
    background-attachment: fixed !important;
    color: var(--gz-ink) !important;
  }

  body.gz-page:not(.dark-mode) .gz-hero::before {
    background:
      radial-gradient(circle at 72% 42%, rgba(255, 200, 120, 0.15), transparent 38%),
      linear-gradient(180deg, transparent 25%, rgba(255, 245, 235, 0.65) 100%);
  }

  body.gz-page:not(.dark-mode) .gz-brand {
    background: linear-gradient(135deg, #2c1810 5%, #c47a2c 40%, #ff7a9a 85%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 4px 12px rgba(255, 122, 154, 0.25));
  }

  body.gz-page:not(.dark-mode) .gz-hero-line {
    color: rgba(44, 24, 16, 0.75);
  }

  body.gz-page:not(.dark-mode) .gz-btn-primary {
    background: linear-gradient(135deg, #ff7a9a, #e85a7a);
    color: white;
    border-color: transparent;
  }

  body.gz-page:not(.dark-mode) .gz-btn-primary:hover {
    background: linear-gradient(135deg, #e85a7a, #d04a6a);
    box-shadow: 0 6px 20px rgba(255, 122, 154, 0.35);
  }

  body.gz-page:not(.dark-mode) .gz-btn-ghost {
    background: rgba(255, 255, 255, 0.75);
    color: #2c1810;
    border-color: rgba(44, 24, 16, 0.15);
    backdrop-filter: blur(8px);
  }

  body.gz-page:not(.dark-mode) .gz-btn-ghost:hover {
    background: rgba(255, 255, 255, 0.95);
    border-color: #ff7a9a;
    color: #ff7a9a;
  }

  body.gz-page:not(.dark-mode) .gz-btn-frost {
    background: linear-gradient(135deg, #ffd98a, #f5c76a);
    color: #2c1810;
    border-color: transparent;
  }

  body.gz-page:not(.dark-mode) .gz-btn-frost:hover {
    background: linear-gradient(135deg, #f5c76a, #e8a54b);
    box-shadow: 0 6px 20px rgba(245, 199, 106, 0.35);
  }

  body.gz-page:not(.dark-mode) .gz-guide {
    background: rgba(255, 255, 255, 0.85);
    border-color: rgba(44, 24, 16, 0.12);
    color: #2c1810;
    backdrop-filter: blur(12px);
  }

  body.gz-page:not(.dark-mode) .gz-guide-card {
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 4px 16px rgba(44, 24, 16, 0.08);
  }

  body.gz-page:not(.dark-mode) .gz-section {
    color: #2c1810;
  }

  body.gz-page:not(.dark-mode) .gz-card {
    background: rgba(255, 255, 255, 0.85);
    border-color: rgba(44, 24, 16, 0.1);
    color: #2c1810;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 24px rgba(44, 24, 16, 0.08);
  }

  body.gz-page:not(.dark-mode) .gz-card:hover {
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 12px 32px rgba(255, 122, 154, 0.15);
  }

  body.gz-page:not(.dark-mode) .gz-card-kicker {
    color: #ff7a9a;
  }

  body.gz-page:not(.dark-mode) .gz-tagline {
    color: rgba(44, 24, 16, 0.65);
  }

  body.gz-page:not(.dark-mode) .gz-tag {
    background: rgba(255, 122, 154, 0.15);
    color: #c4423a;
  }

  body.gz-page:not(.dark-mode) .gz-face--back {
    background: rgba(255, 252, 248, 0.98);
  }

  body.gz-page:not(.dark-mode) .gz-back-kicker {
    color: #ff7a9a;
  }

  body.gz-page:not(.dark-mode) .gz-back-title {
    color: #2c1810;
  }

  body.gz-page:not(.dark-mode) .gz-fresh-drop-countdown {
    background: linear-gradient(135deg, rgba(255, 122, 154, 0.25), rgba(245, 199, 106, 0.2));
    border-color: rgba(245, 199, 106, 0.4);
    box-shadow: 
      0 8px 24px rgba(44, 24, 16, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }

  body.gz-page:not(.dark-mode) .gz-countdown-label {
    color: #c47a2c;
    text-shadow: 0 1px 3px rgba(255, 255, 255, 0.5);
  }

  body.gz-page:not(.dark-mode) .gz-countdown-value {
    color: #2c1810;
    text-shadow: 
      0 2px 4px rgba(255, 255, 255, 0.8),
      0 0 15px rgba(245, 199, 106, 0.3);
  }

  body.gz-page:not(.dark-mode) .gz-countdown-unit-label {
    color: rgba(44, 24, 16, 0.6);
  }

  body.gz-page:not(.dark-mode) .gz-countdown-separator {
    color: #ff7a9a;
    text-shadow: 0 0 10px rgba(255, 122, 154, 0.4);
  }

  body.gz-page:not(.dark-mode) .gz-countdown-message {
    color: rgba(44, 24, 16, 0.65);
  }

  body.gz-page:not(.dark-mode) .gz-footer-note {
    color: rgba(44, 24, 16, 0.7);
  }

  body.gz-page:not(.dark-mode) .gz-recipe-sheet-panel {
    background: rgba(255, 252, 248, 0.98);
    color: #2c1810;
  }

  body.gz-page:not(.dark-mode) .gz-shop-section {
    background: rgba(255, 255, 255, 0.5);
  }

  body.gz-page:not(.dark-mode) .gz-loading {
    color: rgba(44, 24, 16, 0.7);
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

  body.gz-page .dark-mode-toggle {
    background: linear-gradient(135deg, #ff7a9a, #e85a7a);
    box-shadow: 0 4px 15px rgba(255, 122, 154, 0.45);
  }

  body.gz-page.dark-mode .dark-mode-toggle {
    background: linear-gradient(135deg, #ffd98a, #f5c76a);
    box-shadow: 0 4px 15px rgba(245, 199, 106, 0.45);
    color: #2c1810;
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

  const isGlazedPage = document.body.classList.contains('gz-page');
  const isNightHub = document.body.classList.contains('music-menu-page')
    || document.body.classList.contains('nature-hub-page');
  const isMeAtlas = isMiddleEastAtlasPage();
  const storedPref = localStorage.getItem(DARK_MODE_KEY);
  const meAtlasPref = localStorage.getItem(ME_ATLAS_DARK_MODE_KEY);

  // Glazed, Music, Nature Hub, and Middle East atlas pages default to night mode.
  // ME atlas uses its own key so a light/dark choice sticks without following sitewide.
  // Other pages respect saved preference or stay light.
  let shouldBeDark = false;
  if (isMeAtlas) {
    shouldBeDark = meAtlasPref === null ? true : meAtlasPref === 'true';
  } else if (isGlazedPage || isNightHub) {
    shouldBeDark = storedPref === null ? true : storedPref === 'true';
  } else {
    shouldBeDark = storedPref === 'true';
  }

  if (shouldBeDark) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
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
  if (isMiddleEastAtlasPage()) {
    localStorage.setItem(ME_ATLAS_DARK_MODE_KEY, String(isDark));
  } else {
    localStorage.setItem(DARK_MODE_KEY, String(isDark));
  }
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
