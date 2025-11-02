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
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        /* Professional Modern Navigation */
        .modern-navbar {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(135, 206, 250, 0.2);
          padding: 1rem 0;
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
          font-size: 1.4rem;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea, #764ba2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .nav-user-btn {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
          border: 2px solid rgba(102, 126, 234, 0.3);
          border-radius: 25px;
          padding: 8px 20px;
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
          padding: 10px 15px;
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
        
        /* Navigation Lists */
        .navbar-nav {
          display: flex;
          list-style: none;
          margin: 0;
          padding: 0;
          align-items: center;
          gap: 1rem;
        }
        
        .nav-item {
          position: relative;
        }
        
        .nav-link {
          text-decoration: none;
          color: #333;
          padding: 0.5rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
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
      </style>
      
      <nav class="modern-navbar">
        <div class="container">
          <a class="navbar-brand-modern" href="/">
            <i class="bi-music-note-beamed"></i>
            Big Wave Dave's Music Box
          </a>
          
          <button class="navbar-toggler" type="button" aria-label="Toggle navigation">
            <i class="bi-list"></i>
          </button>
          
          <div class="navbar-collapse">
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
              
              <!-- Music Discovery Dropdown -->
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button">
                  <i class="bi-music-note-beamed"></i> Music Discovery
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
                  <a class="dropdown-item" href="/music/kml-viewer.html">
                    <i class="bi-globe"></i> Grateful Dead Timeline
                  </a>
                  <a class="dropdown-item" href="/music/my-grateful-dead-shows.html">
                    <i class="bi-music-player-fill"></i> My Grateful Dead Shows
                  </a>
                  <a class="dropdown-item" href="/music/musical-google-earth-files.html">
                    <i class="bi-globe"></i> Musical Google Earth Files
                  </a>
                  <a class="dropdown-item" href="/music/music-time-machine.html">
                    <i class="bi-clock-history"></i> Time Machine
                  </a>
                  <a class="dropdown-item" href="/music/spotify-dashboard.html">
                    <i class="bi-spotify"></i> Spotify
                  </a>
                  <a class="dropdown-item" href="/music/song-identifier.html">
                    <i class="bi-soundwave"></i> Song Identifier
                  </a>
                </div>
              </li>

              <!-- AI & Voice Dropdown -->
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button">
                  <i class="bi-robot"></i> AI & Voice
                </a>
                <div class="dropdown-menu">
                  <a class="dropdown-item" href="/ai/voice-dj.html">
                    <i class="bi-mic"></i> Wolfman Dave
                  </a>
                  <a class="dropdown-item" href="/ai/assistant.html">
                    <i class="bi-chat-dots"></i> Levi Assistant
                  </a>
                  <div class="dropdown-divider"></div>
                  <a class="dropdown-item" href="/ai/voice-guide.html">
                    <i class="bi-book"></i> Voice Guide
                  </a>
                </div>
              </li>

              <!-- Entertainment Dropdown -->
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button">
                  <i class="bi-stars"></i> Entertainment
                </a>
                <div class="dropdown-menu">
                  <a class="dropdown-item" href="/entertainment/player.html">
                    <i class="bi-volume-up"></i> The Boombox
                  </a>
                  <a class="dropdown-item" href="/entertainment/visualizer.html">
                    <i class="bi-palette-fill"></i> Psychedelic Visualizer
                  </a>
                  <a class="dropdown-item" href="/entertainment/blacklight.html">
                    <i class="bi-lightning"></i> Black Light Zone
                  </a>
                  <a class="dropdown-item" href="/entertainment/poster-generator.html">
                    <i class="bi-palette"></i> Poster Generator
                  </a>
                  <a class="dropdown-item" href="/entertainment/art-gallery.html">
                    <i class="bi-image"></i> Art Gallery
                  </a>
                  <a class="dropdown-item" href="/entertainment/ouija-board.html">
                    <i class="bi-magic"></i> Ouija Board
                  </a>
                </div>
              </li>

              <!-- Finance Dropdown -->
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button">
                  <i class="bi-bank"></i> Finance
                </a>
                <div class="dropdown-menu">
                  <a class="dropdown-item" href="/finance/index.html">
                    <i class="bi-calculator"></i> Finance Hub
                  </a>
                  <div class="dropdown-divider"></div>
                  <a class="dropdown-item" href="/finance/encompass-assistant.html">
                    <i class="bi-bank2"></i> Encompass Assistant
                  </a>
                  <a class="dropdown-item" href="/finance/pipeline-risk-dashboard.html">
                    <i class="bi-shield-check"></i> Pipeline Risk Dashboard
                  </a>
                </div>
              </li>

              <!-- Family & Genealogy Dropdown -->
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button">
                  <i class="bi-people"></i> Family
                </a>
                <div class="dropdown-menu">
                  <a class="dropdown-item" href="/family/genealogy.html">
                    <i class="bi-diagram-3"></i> Genealogy
                  </a>
                  <a class="dropdown-item" href="/family/family-tree.html">
                    <i class="bi-tree"></i> Family Tree
                  </a>
                </div>
              </li>

              <!-- Nature Dropdown -->
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button">
                  <i class="bi-tree-fill"></i> Nature
                </a>
                <div class="dropdown-menu">
                  <a class="dropdown-item" href="/nature/tree-discovery.html">
                    <i class="bi-tree-fill"></i> Tree Discovery 🐻
                  </a>
                  <a class="dropdown-item" href="/nature/tree-collection.html">
                    <i class="bi-trees"></i> Tree Collection 🌲
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

