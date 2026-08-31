/**
 * Lane stack — glanceable tags, hash jump, auth-gated mortgage.
 */
(function () {
  'use strict';

  function desk() {
    return document.getElementById('portfolioStackGroups');
  }

  function isLoggedIn() {
    const pf = window.SITE_PORTFOLIO;
    if (pf && typeof pf.isPortfolioSessionActive === 'function') {
      return !!pf.isPortfolioSessionActive();
    }
    if (typeof window.isLoggedIn === 'function') return !!window.isLoggedIn();
    try {
      return localStorage.getItem('loggedInUserId') !== null;
    } catch (_) {
      return false;
    }
  }

  function openGroup(id, scroll) {
    const root = desk();
    if (!root || !id) return;
    const el = root.querySelector('[data-stack-id="' + id + '"]');
    if (!el) return;
    if (scroll) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function render() {
    const pf = window.SITE_PORTFOLIO;
    if (!pf) return;
    const loggedIn = isLoggedIn();
    const chips = document.getElementById('portfolioStackChips');
    if (chips && typeof pf.renderPortfolioStackChips === 'function') {
      chips.innerHTML = pf.renderPortfolioStackChips({ loggedIn: loggedIn });
    }
    const tree = desk();
    if (tree && typeof pf.renderLaneStackDesk === 'function') {
      tree.innerHTML = pf.renderLaneStackDesk({ loggedIn: loggedIn });
      const hash = String(location.hash || '').replace(/^#stack-/, '');
      if (hash) openGroup(hash, false);
    }
  }

  function init() {
    render();
    window.addEventListener('user-logged-in', render);
    window.addEventListener('user-logged-out', render);
    window.addEventListener('pageshow', render);
    window.addEventListener('hashchange', function () {
      const hash = String(location.hash || '').replace(/^#stack-/, '');
      if (hash) openGroup(hash, true);
    });
    window.addEventListener('storage', function (event) {
      if (!event.key || event.key === 'loggedInUserId' || event.key === 'currentUserId') {
        render();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
