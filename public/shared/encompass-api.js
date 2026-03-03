/**
 * Shared Encompass API utilities. Use encompassFetch() for all Encompass Hub API calls
 * so the active env (Correspondent Dev | Retail Dev) is sent via X-Encompass-Env header.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'encompassEnv';

  function injectEnvSwitcher() {
    if (document.getElementById('encompassEnvSwitcher')) return;
    const div = document.createElement('div');
    div.id = 'encompassEnvSwitcher';
    div.style.cssText = 'position:fixed;top:70px;right:16px;z-index:999;background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:8px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);font-size:0.85rem;';
    div.innerHTML = '<label style="margin-right:6px;font-weight:600;">Env:</label><select id="encompassEnvSelectGlobal" style="padding:4px 8px;border-radius:4px;border:1px solid #ced4da;"><option value="correspondent">Correspondent</option><option value="retail">Retail</option></select>';
    document.body.appendChild(div);
    const sel = document.getElementById('encompassEnvSelectGlobal');
    sel.value = getEncompassEnv();
    sel.addEventListener('change', () => {
      setEncompassEnv(sel.value);
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('encompassEnvChanged', { detail: { env: sel.value } }));
      }
    });
  }

  function getEncompassEnv() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'retail' ? 'retail' : 'correspondent';
    } catch (_) {
      return 'correspondent';
    }
  }

  function setEncompassEnv(env) {
    try {
      const v = env === 'retail' ? 'retail' : 'correspondent';
      localStorage.setItem(STORAGE_KEY, v);
      const globalSel = document.getElementById('encompassEnvSelectGlobal');
      if (globalSel) globalSel.value = v;
      const hubSel = document.getElementById('encompassEnvSelect');
      if (hubSel) hubSel.value = v;
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('encompassEnvChanged', { detail: { env: v } }));
      }
      return v;
    } catch (_) {
      return 'correspondent';
    }
  }

  /**
   * Fetch wrapper that adds X-Encompass-Env header from localStorage.
   * Use for all /api/encompass-hub/* requests.
   */
  function encompassFetch(url, options = {}) {
    const env = getEncompassEnv();
    const headers = new Headers(options.headers || {});
    headers.set('X-Encompass-Env', env);
    return fetch(url, { ...options, headers });
  }

  global.encompassApi = {
    getEncompassEnv,
    setEncompassEnv,
    encompassFetch,
    injectEnvSwitcher,
  };

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectEnvSwitcher);
  } else if (typeof document !== 'undefined') {
    injectEnvSwitcher();
  }
})(typeof window !== 'undefined' ? window : globalThis);
