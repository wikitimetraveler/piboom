 /**
 * Modern Navbar Web Component
 * 
 * @file       modern-navbar.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 * 
 * @description
 * Custom web component for modern navigation bar with responsive design,
 * mobile menu support, and integrated search functionality. Uses Shadow DOM
 * for style encapsulation and provides a reusable navigation component
 * across the application.
 * 
 * Features:
 * - Responsive navigation bar with mobile hamburger menu
 * - Shadow DOM encapsulation for isolated styling
 * - Search functionality integration
 * - Smooth animations and transitions
 * - Accessible ARIA labels and keyboard navigation
 * - Custom styling via CSS custom properties
 * 
 * Usage:
 * Simply include the custom element tag in HTML:
 * <modern-navbar></modern-navbar>
 * 
 * Technical Implementation:
 * - Extends HTMLElement for web component
 * - Shadow DOM mode: open (for style encapsulation)
 * - Event delegation for menu interactions
 * - Responsive breakpoint handling
 * - CSS Grid/Flexbox for layout
 * 
 * Browser Support:
 * - Requires native Web Components support
 * - Modern browsers (Chrome, Firefox, Safari, Edge)
 * - Polyfill available for older browsers
 * 
 * ==============================================================================
 */

const SITE_THEME_KEY = 'devConnectLabs_siteTheme';

function clearSitewideThemePreference() {
  if (typeof document === 'undefined') return;
  try {
    localStorage.removeItem(SITE_THEME_KEY);
  } catch (_) {}
  document.documentElement.removeAttribute('data-site-theme');
  if (document.body) {
    document.body.removeAttribute('data-site-theme');
  }
}

if (typeof window !== 'undefined') {
  clearSitewideThemePreference();
  document.addEventListener('DOMContentLoaded', clearSitewideThemePreference, { once: true });
}

class ModernNavbar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    clearSitewideThemePreference();
    this.ensureMenuConfig().then(() => {
      this.render();
      this.attachEventListeners();
      this.injectToolSearchScripts();
      this.injectImageLightbox();
    });
  }

  injectImageLightbox() {
    if (window.LaneImageLightbox?.bound) return;
    if (!document.querySelector('link[href="/shared/lane-image-lightbox.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/shared/lane-image-lightbox.css';
      document.head.appendChild(link);
    }
    const runInit = () => {
      if (window.LaneImageLightbox) window.LaneImageLightbox.init();
    };
    if (window.LaneImageLightbox) {
      runInit();
      return;
    }
    const script = document.createElement('script');
    script.src = '/shared/lane-image-lightbox.js';
    script.onload = runInit;
    script.onerror = () => {};
    document.head.appendChild(script);
  }

  ensureMenuConfig() {
    if (window.MENU_CONFIG) return Promise.resolve();
    return new Promise(function (resolve) {
      const s = document.createElement('script');
      s.src = '/shared/menu-config.js';
      s.onload = resolve;
      s.onerror = resolve;
      document.head.appendChild(s);
    });
  }

  injectToolSearchScripts() {
    if (window.openGlobalToolSearch) return;
    const idx = document.createElement('script');
    idx.src = '/shared/tool-search-index.js';
    document.head.appendChild(idx);
    idx.onload = () => {
      const search = document.createElement('script');
      search.src = '/shared/global-tool-search.js';
      search.onload = () => {
        if (window.__pendingToolSearchOpen) {
          window.__pendingToolSearchOpen = false;
          window.openGlobalToolSearch?.();
        }
      };
      document.head.appendChild(search);
    };
  }

  openToolSearch() {
    if (typeof window.openGlobalToolSearch === 'function') {
      window.openGlobalToolSearch();
      return;
    }
    window.__pendingToolSearchOpen = true;
  }

  isDemoMode() {
    const q = new URLSearchParams(location.search).get('demo');
    if (q === '1') {
      try { localStorage.setItem('demoMode', '1'); } catch (_) {}
      return true;
    }
    if (q === '0') {
      try { localStorage.removeItem('demoMode'); } catch (_) {}
      return false;
    }
    try { return localStorage.getItem('demoMode') === '1'; } catch (_) { return false; }
  }

  renderDropdownItems(items) {
    if (!items || !items.length) return '';
    const cfg = window.MENU_CONFIG;
    if (!cfg) return '';
    const currentPath = location.pathname;
    return items.map(function (it) {
      if (it.divider) return '<div class="dropdown-divider"></div>';
      const isActive = it.href && (currentPath === it.href || (it.href !== '/' && currentPath.endsWith(it.href)));
      return '<a class="dropdown-item' + (isActive ? ' active' : '') + '" href="' + it.href + '"><i class="bi ' + it.icon + '"></i> ' + it.label + '</a>';
    }).join('\n                  ');
  }

  render() {
    const brand = this.getAttribute('brand') || 'DevConnect Labs';
    const compact = this.hasAttribute('compact');
    const demoMode = this.isDemoMode();
    const cfg = window.MENU_CONFIG || {};
    const navFinance = cfg.NAV_FINANCE || [];
    const navMusic = cfg.NAV_MUSIC || [];
    const navEnt = cfg.NAV_ENTERTAINMENT || [];
    const navMore = cfg.NAV_MORE || [];
    this.shadowRoot.innerHTML = `
      <style>
        /* Professional Modern Navigation */
        .modern-navbar {
          background: color-mix(in srgb, white 82%, var(--site-card-bg, rgba(255, 255, 255, 0.97)) 18%);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--site-border, rgba(135, 206, 250, 0.2));
          padding: 0.4rem 0;
          position: sticky;
          top: 0;
          z-index: 1000;
          transition: all 0.3s ease;
          box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
        }
        
        .modern-navbar.scrolled {
          background: linear-gradient(
            135deg,
            color-mix(in srgb, white 88%, var(--site-surface, #f8fafc) 12%) 0%,
            color-mix(in srgb, white 82%, var(--site-surface-muted, #e2e8f0) 18%) 100%
          );
          box-shadow: 0 4px 30px rgba(var(--site-primary-rgb, 74, 144, 164), 0.12);
          border-bottom-color: rgba(var(--site-primary-rgb, 74, 144, 164), 0.25);
        }

        .modern-navbar.scrolled .navbar-brand-modern {
          filter: drop-shadow(0 0 8px rgba(var(--site-primary-rgb, 74, 144, 164), 0.35));
        }
        
        .navbar-brand-modern {
          font-size: 1.2rem;
          font-weight: 700;
          background: linear-gradient(135deg, var(--site-primary, #4a90a4), var(--site-primary-hover, #3d7a8a));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        
        .nav-user-btn {
          background: linear-gradient(135deg, rgba(var(--site-primary-rgb, 74, 144, 164), 0.1), rgba(var(--site-primary-rgb, 74, 144, 164), 0.16));
          border: 2px solid rgba(var(--site-primary-rgb, 74, 144, 164), 0.3);
          border-radius: 20px;
          padding: 5px 14px;
          transition: all 0.3s ease;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: inherit;
        }
        
        .nav-user-btn:hover {
          background: linear-gradient(135deg, rgba(var(--site-primary-rgb, 74, 144, 164), 0.2), rgba(var(--site-primary-rgb, 74, 144, 164), 0.26));
          border-color: var(--site-primary, #4a90a4);
          transform: translateY(-2px);
        }
        
        /* Modern Dropdown Menus */
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .dropdown-menu {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          border: none;
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
          padding: 10px;
          margin-top: 10px;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px);
          min-width: 200px;
          z-index: 1001;
        }
        
        .dropdown-menu.show {
          display: block;
          animation: dropIn 0.18s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .dropdown-item {
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 0.9rem;
          transition: all 0.2s ease;
          margin-bottom: 2px;
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: inherit;
        }
        
        .dropdown-item:hover {
          background: linear-gradient(135deg, rgba(var(--site-primary-rgb, 74, 144, 164), 0.1), rgba(var(--site-primary-rgb, 74, 144, 164), 0.16));
          color: var(--site-primary, #4a90a4);
          transform: translateX(5px);
        }

        .dropdown-item.active {
          background: linear-gradient(135deg, rgba(var(--site-primary-rgb, 74, 144, 164), 0.15), rgba(var(--site-primary-rgb, 74, 144, 164), 0.22));
          color: var(--site-primary, #4a90a4);
          font-weight: 600;
        }
        
        .dropdown-divider {
          border-top: 1px solid rgba(var(--site-primary-rgb, 74, 144, 164), 0.2);
          margin: 5px 0;
        }
        
        /* Container */
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 15px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .navbar-collapse {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        /* Navigation Lists */
        .navbar-nav {
          display: flex;
          list-style: none;
          margin: 0;
          padding: 0;
          align-items: center;
          gap: 0.5rem;
        }
        
        .nav-item {
          position: relative;
        }
        
        .nav-link {
          text-decoration: none;
          color: #333;
          padding: 0.35rem 0.75rem;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          transition: all 0.3s ease;
          border-radius: 8px;
          position: relative;
        }
        
        .nav-link:hover {
          color: var(--site-primary, #4a90a4);
          background: rgba(var(--site-primary-rgb, 74, 144, 164), 0.06);
        }

        .nav-link.active-page {
          color: var(--site-primary, #4a90a4);
          font-weight: 600;
        }

        .nav-link.active-page::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 50%;
          transform: translateX(-50%);
          width: 60%;
          height: 2px;
          border-radius: 2px;
          background: linear-gradient(90deg, var(--site-primary, #4a90a4), var(--site-primary-hover, #3d7a8a));
        }
        
        .nav-item.dropdown.open .nav-link {
          color: var(--site-primary, #4a90a4);
          background: rgba(var(--site-primary-rgb, 74, 144, 164), 0.08);
          border-radius: 8px;
        }
        
        .dropdown-toggle::after {
          content: ' ▾';
          font-size: 0.8em;
        }
        
        /* Mobile Styles */
        .navbar-toggler {
          display: none;
          background: none;
          border: 2px solid rgba(var(--site-primary-rgb, 74, 144, 164), 0.3);
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 1.2rem;
          color: var(--site-primary, #4a90a4);
        }
        
        @media (max-width: 991px) {
          .navbar-toggler {
            display: block;
          }
          
          .navbar-collapse {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: color-mix(in srgb, white 80%, var(--site-card-bg, rgba(255, 255, 255, 0.97)) 20%);
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
            padding: 1rem;
          }
          
          .navbar-collapse.show {
            display: block;
          }
          
          .navbar-nav {
            flex-direction: column;
            align-items: stretch;
          }
          
          .dropdown-menu {
            position: static;
            box-shadow: none;
            margin-left: 1rem;
          }
        }
        
        /* Bootstrap Icons CDN compatibility */
        @import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css');
        
        /* Encompass dark mode - when body has encompass-dark-mode */
        :host-context(body.encompass-dark-mode) .modern-navbar {
          background: #161b22 !important;
          border-bottom-color: #30363d !important;
          box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
        }
        :host-context(body.encompass-dark-mode) .navbar-brand-modern {
          -webkit-text-fill-color: #e6edf3;
          color: #e6edf3;
        }
        :host-context(body.encompass-dark-mode) .nav-link {
          color: #e6edf3 !important;
        }
        :host-context(body.encompass-dark-mode) .nav-link:hover {
          color: #58a6ff !important;
        }
        :host-context(body.encompass-dark-mode) .dropdown-menu {
          background: #161b22 !important;
          border: 1px solid #30363d;
        }
        :host-context(body.encompass-dark-mode) .dropdown-item {
          color: #e6edf3 !important;
        }
        :host-context(body.encompass-dark-mode) .dropdown-item:hover {
          background: #21262d !important;
          color: #58a6ff !important;
        }
        :host-context(body.encompass-dark-mode) .navbar-collapse {
          background: #161b22 !important;
        }
        :host-context(body.encompass-dark-mode) .nav-user-btn {
          background: #21262d !important;
          border-color: #30363d !important;
          color: #e6edf3 !important;
        }
        :host-context(body.encompass-dark-mode) .navbar-toggler {
          border-color: #30363d !important;
          color: #e6edf3 !important;
        }
      </style>
      
      <nav class="modern-navbar">
        <div class="container">
          <a class="navbar-brand-modern" href="/">
            <i class="bi-music-note-beamed"></i>
            ${brand}
          </a>
          
          <button class="navbar-toggler" type="button" aria-label="Toggle navigation">
            <i class="bi-list"></i>
          </button>
          
          <div class="navbar-collapse">
            <!-- Search (Ctrl+K) -->
            <ul class="navbar-nav">
              <li class="nav-item">
                <button class="nav-link" id="navSearchBtn" type="button" aria-label="Search tools (Ctrl+K)" title="Search tools (Ctrl+K)" style="background:none;border:none;cursor:pointer;padding:0.35rem 0.75rem;">
                  <i class="bi-search"></i> Search
                </button>
              </li>
            </ul>
            <!-- User Login (LEFT SIDE) -->
            <ul class="navbar-nav">
              <li class="nav-item">
                <a class="nav-link nav-user-btn" href="#" id="navUserBtn">
                  <i class="bi-person-circle"></i>
                  <span id="navUserName">Login</span>
                </a>
              </li>
            </ul>
            
            <ul class="navbar-nav">
              <li class="nav-item">
                <a class="nav-link" href="/">
                  <i class="bi-house"></i> Home
                </a>
              </li>

              <!-- Worksheets dropdown (Hub + essentials; /finance/ URLs) -->
              <li class="nav-item dropdown" id="navFinanceDropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button" aria-haspopup="true" aria-expanded="false" aria-label="Worksheets menu">
                  <i class="bi-bank"></i> Worksheets
                </a>
                <div class="dropdown-menu">
                  ${this.renderDropdownItems(navFinance)}
                </div>
              </li>

              <li class="nav-item">
                <a class="nav-link" href="/gse-analyzer.html" title="Fannie / Freddie / FHFA scenario research (not pricing or approval)">
                  <i class="bi-graph-up-arrow"></i> GSE analyzer
                </a>
              </li>

              ${demoMode ? `
              <li class="nav-item">
                <a class="nav-link" href="/?demo=0" style="font-size:0.8rem;color:var(--muted,#888);" title="Show all domains">
                  <i class="bi-grid-3x3-gap"></i> Show all
                </a>
              </li>
              ` : ''}

              ${!demoMode ? `<!-- Music Discovery Dropdown (Trimmed + Hub Link) -->
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button" aria-haspopup="true" aria-expanded="false" aria-label="Music menu">
                  <i class="bi-music-note-beamed"></i> Music
                </a>
                <div class="dropdown-menu">
                  ${this.renderDropdownItems(navMusic)}
                </div>
              </li>

              ${compact ? '' : `<!-- Entertainment Dropdown -->
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button" aria-haspopup="true" aria-expanded="false" aria-label="Entertainment menu">
                  <i class="bi-stars"></i> Entertainment
                </a>
                <div class="dropdown-menu">
                  ${this.renderDropdownItems(navEnt)}
                </div>
              </li>
              `}

              <!-- More Dropdown (Bike, AI, Family, Nature) -->
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button" aria-haspopup="true" aria-expanded="false" aria-label="More menu">
                  <i class="bi-three-dots"></i> More
                </a>
                <div class="dropdown-menu">
                  ${this.renderDropdownItems(navMore)}
                </div>
              </li>
              ` : ''}
            </ul>
          </div>
        </div>
      </nav>
    `;
  }

  attachEventListeners() {
    // Scroll effect
    window.addEventListener('scroll', () => {
      const navbar = this.shadowRoot.querySelector('.modern-navbar');
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });

    // Mobile toggle
    const toggler = this.shadowRoot.querySelector('.navbar-toggler');
    const collapse = this.shadowRoot.querySelector('.navbar-collapse');
    toggler?.addEventListener('click', () => {
      collapse?.classList.toggle('show');
    });

    // Dropdown toggles
    const dropdowns = this.shadowRoot.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
      const toggle = dropdown.querySelector('.dropdown-toggle');
      const menu = dropdown.querySelector('.dropdown-menu');
      
      toggle?.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = menu?.classList.contains('show');
        
        // Close other dropdowns
        dropdowns.forEach(other => {
          if (other !== dropdown) {
            other.querySelector('.dropdown-menu')?.classList.remove('show');
            other.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded', 'false');
            other.classList.remove('open');
          }
        });
        
        menu?.classList.toggle('show');
        toggle?.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        dropdown.classList.toggle('open', !isOpen);
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.contains(e.target)) {
        this.shadowRoot.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
        this.shadowRoot.querySelectorAll('.dropdown-toggle').forEach(t => t.setAttribute('aria-expanded', 'false'));
        this.shadowRoot.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
      }
    });

    // Search button (triggers global tool search)
    const searchBtn = this.shadowRoot.querySelector('#navSearchBtn');
    searchBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openToolSearch();
    });

    // User login button
    const userBtn = this.shadowRoot.querySelector('#navUserBtn');
    userBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      // Dispatch custom event that can be caught by parent document
      this.dispatchEvent(new CustomEvent('login-clicked', { 
        bubbles: true, 
        composed: true 
      }));
      
      // Try to call global function if it exists
      if (typeof window.showLoginPopup === 'function') {
        window.showLoginPopup();
      }
    });

    // Mark active nav items
    this.markActiveNavItems();

    // Initialize user display
    this.updateUserDisplay();
  }

  markActiveNavItems() {
    const currentPath = location.pathname;
    // Highlight plain nav-link (Home, etc.)
    this.shadowRoot.querySelectorAll('.nav-link:not(.dropdown-toggle):not(.nav-user-btn)').forEach(link => {
      const href = link.getAttribute('href');
      if (href && href !== '#' && (currentPath === href || currentPath.endsWith(href))) {
        link.classList.add('active-page');
      }
    });
    // Highlight dropdown parent if any child matches
    this.shadowRoot.querySelectorAll('.nav-item.dropdown').forEach(dropdown => {
      const hasActive = dropdown.querySelector('.dropdown-item.active');
      if (hasActive) {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        if (toggle) toggle.classList.add('active-page');
      }
    });
  }

  updateUserDisplay() {
    // Try to get logged in user from global function
    if (typeof window.getLoggedInUser === 'function') {
      const loggedInUser = window.getLoggedInUser();
      const navUserBtn = this.shadowRoot.querySelector('#navUserBtn');
      
      if (loggedInUser && navUserBtn) {
        navUserBtn.style.background = `${loggedInUser.color}22`;
        navUserBtn.style.borderLeft = `3px solid ${loggedInUser.color}`;
        navUserBtn.innerHTML = `
          <img src="${loggedInUser.avatar}" style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${loggedInUser.color}; margin-right: 8px; vertical-align: middle;">
          <span>${loggedInUser.name.split(' ').slice(-1)[0]}</span>
        `;
      }
    }
  }

  // Public method to update user display (can be called from outside)
  refresh() {
    this.updateUserDisplay();
  }
}

// Define the custom element
customElements.define('modern-navbar', ModernNavbar);

// Listen for user login events to refresh navbar
window.addEventListener('user-logged-in', () => {
  const navbar = document.querySelector('modern-navbar');
  if (navbar && navbar.refresh) {
    navbar.refresh();
  }
});

