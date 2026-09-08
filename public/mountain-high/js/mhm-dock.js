/**
 * Sticky Bud Master dock — compact / expand (Glazed Pip pattern)
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  function init() {
    const guide = document.getElementById('mhmGuide');
    if (!guide) return;

    document.getElementById('mhmGuideExpand')?.addEventListener('click', () => {
      if (guide.classList.contains('is-compact')) {
        guide.classList.remove('is-compact');
        return;
      }
      root.MhmAskJill?.();
    });

    document.getElementById('mhmGuideCollapse')?.addEventListener('click', () => {
      guide.classList.add('is-compact');
    });

    root.addEventListener('mhm-age-confirmed', () => {
      guide.classList.remove('is-compact');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
