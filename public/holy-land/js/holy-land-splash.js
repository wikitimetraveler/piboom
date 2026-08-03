/**
 * Holy Land splash — classy first-visit entrance.
 * ?splash=1 forces replay. Honors prefers-reduced-motion.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'holyLandSplashShown_v1';
  const AUTO_MS = 4200;
  const REDUCED_MS = 900;
  const CLOSE_MS = 850;

  function init() {
    const root = document.getElementById('hlSplash');
    const skip = document.getElementById('hlSplashSkip');
    if (!root || !skip) return;

    const params = new URLSearchParams(window.location.search);
    const force = params.get('splash') === '1';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!force) {
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') {
          hideImmediate(root);
          return;
        }
      } catch (_) {
        /* ignore */
      }
    }

    document.body.classList.add('hl-splash-open');
    root.classList.add('is-ready');
    if (reduced) root.classList.add('is-reduced');

    let timer = null;
    let closing = false;

    function markSeen() {
      if (force) return;
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch (_) {
        /* ignore */
      }
    }

    function close() {
      if (closing) return;
      closing = true;
      markSeen();
      if (timer != null) clearTimeout(timer);
      root.classList.add('is-closing');
      document.body.classList.remove('hl-splash-open');
      window.setTimeout(() => {
        hideImmediate(root);
      }, CLOSE_MS);
    }

    function hideImmediate(el) {
      el.classList.add('is-hidden');
      el.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('hl-splash-open');
    }

    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });

    root.addEventListener('click', (e) => {
      if (e.target.closest('.hl-splash__skip')) return;
      close();
    });

    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          if (root.classList.contains('is-hidden')) return;
          e.preventDefault();
          close();
        }
      },
      { once: false }
    );

    timer = window.setTimeout(close, reduced ? REDUCED_MS : AUTO_MS);
    skip.focus({ preventScroll: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
