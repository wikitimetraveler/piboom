/**
 * Music mini-navigation (Research / Album Discovery / My Collection)
 * Uses MENU_CONFIG.MUSIC_TOOLS when available; fallback to local data.
 */
(function () {
  const FALLBACK_ITEMS = [
    { href: '/music/music-research.html', label: 'Music Research', icon: 'bi-search', title: 'Search albums, artists, Spotify' },
    { href: '/music/album-discovery.html', label: 'Album Discovery', icon: 'bi-disc', title: 'Discover albums' },
    { href: '/music/collection.html', label: 'My Collection', icon: 'bi-collection-fill', title: 'Your music collection' },
    { href: '/music/song-identifier.html', label: 'Song ID', icon: 'bi-music-note-beamed', title: 'Identify songs' },
    { href: '/music/spotify-dashboard.html', label: 'Spotify', icon: 'bi-spotify', title: 'Spotify dashboard' },
    { href: '/music/music-time-machine.html', label: 'Time Machine', icon: 'bi-clock-history', title: 'Music time machine' },
  ];

  function getNavItems() {
    return (window.MENU_CONFIG && window.MENU_CONFIG.MUSIC_TOOLS) || FALLBACK_ITEMS;
  }

  function renderMiniNav(container) {
    if (!container) return;

    const currentPath = window.location.pathname.toLowerCase();
    const nav = document.createElement('div');
    nav.className = 'domain-grid domain-grid-sm music-mini-nav';

    getNavItems().forEach(item => {
      const link = document.createElement('a');
      link.href = item.href;
      link.className = 'domain-tile';
      link.title = item.title || item.label;
      if (currentPath.endsWith(item.href.split('/').pop().toLowerCase())) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
      link.appendChild(createIcon(item.icon));
      const span = document.createElement('span');
      span.textContent = item.label;
      link.appendChild(span);
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

