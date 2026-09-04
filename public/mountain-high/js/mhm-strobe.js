/**
 * Mountain High strobe — opt-in flashing UV wash
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  let toggleBtn = null;
  let overlay = null;
  let on = false;
  let media = null;

  function prefersReducedMotion() {
    return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function syncUi() {
    if (toggleBtn) {
      const blocked = prefersReducedMotion();
      toggleBtn.disabled = blocked;
      toggleBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      toggleBtn.title = blocked
        ? 'Strobe stays off when reduced motion is on'
        : on
          ? 'Turn strobe off — flashing light'
          : 'Turn strobe on — flashing light';
      const label = toggleBtn.querySelector('[data-strobe-label]');
      if (label) {
        label.textContent = blocked ? 'Strobe off' : on ? 'Strobe on' : 'Strobe';
      }
      const icon = toggleBtn.querySelector('i');
      if (icon) icon.className = on ? 'bi bi-lightning-charge-fill' : 'bi bi-lightning-charge';
    }
    if (overlay) {
      overlay.hidden = !on;
      overlay.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('mhm-strobe-on', on);
    }
  }

  function setOn(next) {
    on = Boolean(next) && !prefersReducedMotion();
    syncUi();
    return on;
  }

  function toggle() {
    return setOn(!on);
  }

  function onVisibility() {
    if (typeof document !== 'undefined' && document.hidden && on) {
      setOn(false);
    }
  }

  function init(opts) {
    const options = opts || {};
    toggleBtn = options.toggle || (typeof document !== 'undefined'
      ? document.getElementById('mhmStrobeToggle')
      : null);
    overlay = options.overlay || (typeof document !== 'undefined'
      ? document.getElementById('mhmStrobe')
      : null);
    on = false;
    if (toggleBtn && !toggleBtn._mhmStrobeBound) {
      toggleBtn._mhmStrobeBound = true;
      toggleBtn.addEventListener('click', (event) => {
        event.preventDefault();
        toggle();
      });
    }
    if (root.matchMedia) {
      media = root.matchMedia('(prefers-reduced-motion: reduce)');
      const onMotion = () => {
        if (media.matches) setOn(false);
        else syncUi();
      };
      if (typeof media.addEventListener === 'function') media.addEventListener('change', onMotion);
      else if (typeof media.addListener === 'function') media.addListener(onMotion);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    syncUi();
    return { setOn, toggle, isOn: () => on };
  }

  root.MhmStrobe = {
    init,
    setOn,
    toggle,
    isOn: () => on,
    prefersReducedMotion,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
