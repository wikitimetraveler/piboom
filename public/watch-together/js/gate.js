/**
 * Password / code gate for Watch together (sessionStorage unlock, server verify).
 */
(function (global) {
  'use strict';

  const VERIFY_URL = '/api/watch-together/verify';
  const STORAGE_KEY = 'dc_watch_together_unlock_v1';
  const NAME_KEY = 'dc_watch_together_name_v1';
  const TTL_MS = 12 * 60 * 60 * 1000;

  function readUnlock() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const o = JSON.parse(raw);
      if (!o || typeof o.until !== 'number' || o.token !== 'unlocked') {
        sessionStorage.removeItem(STORAGE_KEY);
        return false;
      }
      if (Date.now() > o.until) {
        sessionStorage.removeItem(STORAGE_KEY);
        return false;
      }
      return true;
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
  }

  function markUnlocked() {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: 'unlocked', until: Date.now() + TTL_MS })
    );
  }

  function getName() {
    try {
      return String(sessionStorage.getItem(NAME_KEY) || '').trim();
    } catch {
      return '';
    }
  }

  function setName(name) {
    try {
      sessionStorage.setItem(NAME_KEY, String(name || '').trim());
    } catch {
      /* ignore */
    }
  }

  function getStoredCode() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return '';
      const o = JSON.parse(raw);
      return typeof o.code === 'string' ? o.code : '';
    } catch {
      return '';
    }
  }

  function markUnlockedWithCode(code) {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: 'unlocked', until: Date.now() + TTL_MS, code: String(code || '') })
    );
  }

  async function verifyCode(code) {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({ valid: false }));
    return Boolean(res.ok && data.valid);
  }

  function buildGate({ onCancel, onUnlock, requireName }) {
    const overlay = document.createElement('div');
    overlay.className = 'wt-gate';
    overlay.id = 'wtGate';
    overlay.innerHTML =
      '<form class="wt-gate-card" id="wtGateForm">' +
      '<h2>Private theater</h2>' +
      '<p>Ask Dave for the code. Volume stays yours. The clock is shared.</p>' +
      (requireName
        ? '<div class="wt-field"><label for="wtGateName">Your name</label><input id="wtGateName" name="name" autocomplete="nickname" maxlength="24" value=""></div>'
        : '') +
      '<div class="wt-field"><label for="wtGateCode">Access code</label><input id="wtGateCode" name="code" type="password" autocomplete="current-password" required></div>' +
      '<p class="wt-gate-error" id="wtGateError" role="alert"></p>' +
      '<div class="wt-gate-actions">' +
      '<button class="wt-enter" type="submit">Enter the theater</button>' +
      (onCancel ? '<button class="wt-ghost" type="button" id="wtGateCancel">Not now</button>' : '') +
      '</div></form>';

    const form = overlay.querySelector('#wtGateForm');
    const errorEl = overlay.querySelector('#wtGateError');
    const nameEl = overlay.querySelector('#wtGateName');
    if (nameEl) nameEl.value = getName();

    overlay.querySelector('#wtGateCancel')?.addEventListener('click', () => {
      overlay.remove();
      if (typeof onCancel === 'function') onCancel();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorEl.textContent = '';
      const code = String(form.code.value || '');
      const name = nameEl ? String(nameEl.value || '').trim() : getName();
      try {
        const ok = await verifyCode(code);
        if (!ok) {
          errorEl.textContent = 'That code is not the one.';
          return;
        }
        markUnlockedWithCode(code);
        if (name) setName(name);
        overlay.remove();
        if (typeof onUnlock === 'function') onUnlock({ code, name: name || 'Guest' });
      } catch {
        errorEl.textContent = 'Could not reach the theater. Try again.';
      }
    });

    return overlay;
  }

  global.WatchTogetherGate = {
    readUnlock,
    markUnlocked,
    markUnlockedWithCode,
    getStoredCode,
    getName,
    setName,
    verifyCode,
    buildGate,
  };
})(window);
