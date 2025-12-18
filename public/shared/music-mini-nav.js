/**
 * Music mini-navigation (Research / Album Discovery / My Collection)
 * Lightweight, self-contained, with graceful fallback.
 */
(function () {
  const NAV_ITEMS = [
    { href: '/music/music-research.html', label: 'Music Research', icon: 'bi-search' },
    { href: '/music/album-discovery.html', label: 'Album Discovery', icon: 'bi-disc' },
    { href: '/music/collection.html', label: 'My Collection', icon: 'bi-collection-fill' },
  ];

  function ensureStyles() {
    if (document.getElementById('music-mini-nav-styles')) return;
    const style = document.createElement('style');
    style.id = 'music-mini-nav-styles';
    style.textContent = `
      .music-mini-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 12px 0 20px;
      }
      .music-mini-nav a {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid rgba(102,126,234,0.35);
        background: rgba(255,255,255,0.9);
        color: #333;
        text-decoration: none;
        box-shadow: 0 6px 12px rgba(0,0,0,0.05);
        transition: all 0.2s ease;
      }
      .music-mini-nav a:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 18px rgba(0,0,0,0.08);
        color: #4c6ef5;
      }
      .music-mini-nav a.active {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: #fff;
        border-color: transparent;
        box-shadow: 0 12px 24px rgba(102,126,234,0.3);
      }
      .music-mini-nav .bi {
        font-size: 1rem;
      }
      @media (max-width: 576px) {
        .music-mini-nav {
          gap: 8px;
        }
        .music-mini-nav a {
          width: 100%;
          justify-content: center;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function renderMiniNav(container) {
    if (!container) return;
    ensureStyles();

    const currentPath = window.location.pathname.toLowerCase();
    const nav = document.createElement('div');
    nav.className = 'music-mini-nav';

    NAV_ITEMS.forEach(item => {
      const link = document.createElement('a');
      link.href = item.href;
      link.textContent = item.label;
      link.prepend(createIcon(item.icon));
      if (currentPath.endsWith(item.href.toLowerCase())) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
      nav.appendChild(link);
    });

    container.innerHTML = '';
    container.appendChild(nav);
  }

  function createIcon(icon) {
    const i = document.createElement('i');
    i.className = `bi ${icon}`;
    return i;
  }

  function init() {
    const target = document.querySelector('[data-music-mini-nav]');
    if (!target) return;
    renderMiniNav(target);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

