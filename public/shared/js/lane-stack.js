/**
 * Lane stack tree — render, hash open, expand/collapse, auth-gated mortgage.
 */
(function () {
  'use strict';

  let bound = false;

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

  function branches() {
    const root = desk();
    return root ? root.querySelectorAll('details.lane-tree-branch') : [];
  }

  function openBranch(id, scroll) {
    const root = desk();
    if (!root || !id) return;
    const el = root.querySelector('details[data-stack-id="' + id + '"]');
    if (!el) return;
    el.open = true;
    if (scroll) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function setAll(open) {
    branches().forEach(function (el) {
      el.open = open;
    });
    syncToc();
  }

  function syncToc() {
    const root = desk();
    if (!root) return;
    root.querySelectorAll('[data-stack-jump]').forEach(function (link) {
      const id = link.getAttribute('data-stack-jump');
      const branch = root.querySelector('details[data-stack-id="' + id + '"]');
      const limb = link.closest('.lane-stack-toc__limb');
      const on = !!(branch && branch.open);
      link.setAttribute('aria-current', on ? 'true' : 'false');
      if (limb) limb.classList.toggle('is-open', on);
    });
  }

  function bind() {
    const root = desk();
    if (!root || bound) return;
    bound = true;

    root.addEventListener('click', function (event) {
      const jump = event.target.closest('[data-stack-jump]');
      if (jump) {
        event.preventDefault();
        const id = jump.getAttribute('data-stack-jump');
        openBranch(id, true);
        if (id && history.replaceState) {
          history.replaceState(null, '', '#stack-' + id);
        }
        syncToc();
        return;
      }
      const expand = event.target.closest('[data-stack-expand]');
      if (expand) {
        setAll(expand.getAttribute('data-stack-expand') === '1');
      }
    });

    root.addEventListener('toggle', syncToc, true);
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
      bind();
      const hash = String(location.hash || '').replace(/^#stack-/, '');
      if (hash) openBranch(hash, false);
      syncToc();
    }
  }

  function init() {
    render();
    window.addEventListener('user-logged-in', render);
    window.addEventListener('user-logged-out', render);
    window.addEventListener('pageshow', render);
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
