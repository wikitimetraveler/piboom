/**
 * 21+ age gate for Mountain High Medicinals
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const KEY = 'mhm_age_ok_v1';

  function apply(state) {
    document.body.dataset.age = state;
    const app = document.getElementById('mhmApp');
    const gate = document.getElementById('mhmGate');
    if (app) {
      app.hidden = state !== 'ok';
      app.setAttribute('aria-hidden', state === 'ok' ? 'false' : 'true');
    }
    if (gate) {
      gate.hidden = state === 'ok';
    }
    if (state === 'ok') {
      root.dispatchEvent(new CustomEvent('mhm-age-ok'));
    }
  }

  function read() {
    try {
      return sessionStorage.getItem(KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function confirm() {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch (_) {
      /* ignore */
    }
    apply('ok');
    root.dispatchEvent(new CustomEvent('mhm-age-confirmed'));
  }

  function deny() {
    apply('blocked');
    const msg = document.getElementById('mhmGateDenied');
    if (msg) msg.hidden = false;
  }

  function init() {
    if (read()) {
      apply('ok');
      return;
    }
    apply('pending');
    document.getElementById('mhmAgeYes')?.addEventListener('click', confirm);
    document.getElementById('mhmAgeNo')?.addEventListener('click', deny);
  }

  root.MhmAgeGate = { init, confirm, read };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
