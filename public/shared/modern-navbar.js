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
class ModernNavbar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
    this.injectToolSearchScripts();
  }

  injectToolSearchScripts() {
    if (window.openGlobalToolSearch) return;
    const idx = document.createElement('script');
    idx.src = '/shared/tool-search-index.js';
    document.head.appendChild(idx);
    idx.onload = () => {
      const search = document.createElement('script');
      search.src = '/shared/global-tool-search.js';
      document.head.appendChild(search);
    };
  }

  render() {
    const brand = this.getAttribute('brand') || 'DevConnect Labs';
    const compact = this.hasAttribute('compact');
    this.shadowRoot.innerHTML = `
      <style>
        /* Professional Modern Navigation */
        .modern-navbar {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(135, 206, 250, 0.2);
          padding: 0.4rem 0;
          position: sticky;
          top: 0;
          z-index: 1000;
          transition: all 0.3s ease;
          box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
        }
        
        .modern-navbar.scrolled {
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.12);
        }
        
        .navbar-brand-modern {
          font-size: 1.2rem;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea, #764ba2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        
        .nav-user-btn {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
          border: 2px solid rgba(102, 126, 234, 0.3);
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
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
          border-color: #667eea;
          transform: translateY(-2px);
        }
        
        /* Modern Dropdown Menus */
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
          background: linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1));
          color: #667eea;
          transform: translateX(5px);
        }
        
        .dropdown-divider {
          border-top: 1px solid rgba(135, 206, 250, 0.2);
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
        }
        
        .nav-link:hover {
          color: #667eea;
        }
        
        .dropdown-toggle::after {
          content: ' ▾';
          font-size: 0.8em;
        }
        
        /* Mobile Styles */
        .navbar-toggler {
          display: none;
          background: none;
          border: 2px solid rgba(102, 126, 234, 0.3);
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 1.2rem;
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
            background: rgba(255, 255, 255, 0.98);
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

              <!-- Finance Dropdown (Hub + Essentials) -->
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button">
                  <i class="bi-bank"></i> Finance
                </a>
                <div class="dropdown-menu">
                  <a class="dropdown-item" href="/finance/index.html">
                    <i class="bi-calculator"></i> Finance Hub
                  </a>
                  <a class="dropdown-item" href="/finance/encompass-assistant.html">
                    <i class="bi-robot"></i> Encompass Assistant
                  </a>
                  <a class="dropdown-item" href="/finance/encompass-hub.html">
                    <i class="bi-columns-gap"></i> Encompass Hub
                  </a>
                  <a class="dropdown-item" href="/finance/pipeline-risk-dashboard.html">
                    <i class="bi-shield-check"></i> Pipeline Risk Dashboard
                  </a>
                  <a class="dropdown-item" href="/finance/unit-tests.html">
                    <i class="bi-clipboard-check"></i> Unit Tests
                  </a>
                  <a class="dropdown-item" href="/finance/tool9.html">
                    <i class="bi-camera-reels"></i> The Screen Test
                  </a>
                </div>
              </li>

              <!-- Music Discovery Dropdown (Trimmed + Hub Link) -->
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button">
                  <i class="bi-music-note-beamed"></i> Music
                </a>
                <div class="dropdown-menu">
                  <a class="dropdown-item" href="/music/music-research.html">
                    <i class="bi-search"></i> Music Research
                  </a>
                  <a class="dropdown-item" href="/music/album-discovery.html">
                    <i class="bi-disc"></i> Album Discovery
                  </a>
                  <a class="dropdown-item" href="/music/collection.html">
                    <i class="bi-collection-fill"></i> My Collection
                  </a>
                  <a class="dropdown-item" href="/music/song-identifier.html">
                    <i class="bi-soundwave"></i> Song Identifier
                  </a>
                  <a class="dropdown-item" href="/music/spotify-dashboard.html">
                    <i class="bi-spotify"></i> Spotify
                  </a>
                  <a class="dropdown-item" href="/music/music-time-machine.html">
                    <i class="bi-clock-history"></i> Time Machine
                  </a>
                  <div class="dropdown-divider"></div>
                  <a class="dropdown-item" href="/#headingMusic">
                    <i class="bi-grid-3x3-gap"></i> All Music Tools
                  </a>
                </div>
              </li>

              ${compact ? '' : `<!-- Entertainment Dropdown -->\n              <li class="nav-item dropdown">\n                <a class="nav-link dropdown-toggle" href="#" role="button">\n                  <i class="bi-stars"></i> Entertainment\n                </a>\n                <div class="dropdown-menu">\n                  <a class="dropdown-item" href="/entertainment/player.html">\n                    <i class="bi-volume-up"></i> The Boombox\n                  </a>\n                  <a class="dropdown-item" href="/entertainment/visualizer.html">\n                    <i class="bi-palette-fill"></i> Psychedelic Visualizer\n                  </a>\n                  <a class="dropdown-item" href="/entertainment/blacklight.html">\n                    <i class="bi-lightning"></i> Black Light Zone\n                  </a>\n                  <a class="dropdown-item" href="/entertainment/poster-generator.html">\n                    <i class="bi-palette"></i> Poster Generator\n                  </a>\n                  <a class="dropdown-item" href="/entertainment/art-gallery.html">\n                    <i class="bi-image"></i> Art Gallery\n                  </a>\n                  <a class="dropdown-item" href="/entertainment/ouija-board.html">\n                    <i class="bi-magic"></i> Ouija Board\n                  </a>\n                  <div class="dropdown-divider"></div>\n                  <a class="dropdown-item" href="/#headingEntertainment">\n                    <i class="bi-grid-3x3-gap"></i> All Entertainment\n                  </a>\n                </div>\n              </li>\n              `}

              <!-- More Dropdown (Bike, AI, Family, Nature) -->
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button">
                  <i class="bi-three-dots"></i> More
                </a>
                <div class="dropdown-menu">
                  <a class="dropdown-item" href="/bike-store-home.html">
                    <i class="bi-bicycle"></i> Bike Store
                  </a>
                  <a class="dropdown-item" href="/ai/voice-dj.html">
                    <i class="bi-mic"></i> Wolfman Dave
                  </a>
                  <a class="dropdown-item" href="/ai/assistant.html">
                    <i class="bi-chat-dots"></i> Levi Assistant
                  </a>
                  <a class="dropdown-item" href="/ai/voice-guide.html">
                    <i class="bi-book"></i> Voice Guide
                  </a>
                  <a class="dropdown-item" href="/family/genealogy.html">
                    <i class="bi-diagram-3"></i> Family
                  </a>
                  <a class="dropdown-item" href="/nature/tree-discovery.html">
                    <i class="bi-tree-fill"></i> Tree Discovery
                  </a>
                  <a class="dropdown-item" href="/nature/tree-collection.html">
                    <i class="bi-trees"></i> Tree Collection
                  </a>
                  <a class="dropdown-item" href="/nature/critter-discovery.html">
                    <i class="bi-bug-fill"></i> Critter Discovery
                  </a>
                  <a class="dropdown-item" href="/nature/critter-collection.html">
                    <i class="bi-bug"></i> Critter Collection
                  </a>
                  <a class="dropdown-item" href="/local/local-spots.html">
                    <i class="bi-geo-alt-fill"></i> Local Spots
                  </a>
                  <div class="dropdown-divider"></div>
                  <a class="dropdown-item" href="/">
                    <i class="bi-house"></i> Hub (All Tools)
                  </a>
                </div>
              </li>
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
        
        // Close other dropdowns
        dropdowns.forEach(other => {
          if (other !== dropdown) {
            other.querySelector('.dropdown-menu')?.classList.remove('show');
          }
        });
        
        menu?.classList.toggle('show');
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.contains(e.target)) {
        this.shadowRoot.querySelectorAll('.dropdown-menu').forEach(menu => {
          menu.classList.remove('show');
        });
      }
    });

    // Search button (triggers global tool search)
    const searchBtn = this.shadowRoot.querySelector('#navSearchBtn');
    searchBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('open-tool-search', { bubbles: true }));
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

    // Initialize user display
    this.updateUserDisplay();
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

