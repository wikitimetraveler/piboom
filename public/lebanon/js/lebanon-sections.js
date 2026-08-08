/**
 * Lebanon section accordion — multi-open collapsible panels.
 * Exposes expand helpers for map / timeline / story reel.
 * Development work by David Lane
 */
(function () {
  'use strict';

  function panelFor(section) {
    return section?.querySelector('.lb-section-panel') || null;
  }

  function toggleFor(section) {
    return section?.querySelector('.lb-section-toggle') || null;
  }

  function setOpen(section, open) {
    if (!section) return;
    const panel = panelFor(section);
    const btn = toggleFor(section);
    section.classList.toggle('is-open', open);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (panel) {
      if (open) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    }
    if (open) {
      document.dispatchEvent(
        new CustomEvent('hl:section-expanded', { detail: { id: section.id, section } })
      );
    }
  }

  function expand(idOrEl) {
    const section =
      typeof idOrEl === 'string'
        ? document.getElementById(idOrEl.replace(/^#/, ''))
        : idOrEl?.closest?.('[data-lb-collapse]') || idOrEl;
    if (!section || !section.hasAttribute('data-lb-collapse')) return null;
    setOpen(section, true);
    return section;
  }

  function expandFor(el) {
    if (!el) return null;
    const section = el.closest('[data-lb-collapse]');
    if (section) setOpen(section, true);
    return section;
  }

  function toggle(section) {
    if (!section) return;
    setOpen(section, !section.classList.contains('is-open'));
  }

  function init() {
    document.querySelectorAll('[data-lb-collapse]').forEach((section) => {
      const btn = toggleFor(section);
      if (!btn) return;
      const defaultOpen =
        section.hasAttribute('data-lb-default-open') || section.classList.contains('is-open');
      setOpen(section, defaultOpen);

      btn.addEventListener('click', () => {
        toggle(section);
      });
    });
  }

  window.LebanonSections = {
    expand,
    expandFor,
    setOpen,
    toggle
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
