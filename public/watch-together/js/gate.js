/**
 * Display-name gate for Watch together (sessionStorage only — not Worksheets login).
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

  function buildNamePrompt({ onCancel, onUnlock, suggested } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'wt-gate';
    overlay.id = 'wtGate';
    overlay.innerHTML =
      '<form class="wt-gate-card" id="wtGateForm">' +
      '<h2>What should we call you?</h2>' +
      '<p>Your couch goes live. They hear you. They see you. Mute anytime. This name shows in chat, on your camera, and on the map. <strong>No password</strong> — not Worksheets or Encompass login.</p>' +
      '<div class="wt-field"><label for="wtGateName">Your name</label><input id="wtGateName" name="name" autocomplete="nickname" maxlength="24" required></div>' +
      '<p class="wt-gate-error" id="wtGateError" role="alert"></p>' +
      '<div class="wt-gate-actions">' +
      '<button class="wt-enter" type="submit">Enter the theater</button>' +
      (onCancel ? '<button class="wt-ghost" type="button" id="wtGateCancel">Not now</button>' : '') +
      '</div></form>';

    const form = overlay.querySelector('#wtGateForm');
    const errorEl = overlay.querySelector('#wtGateError');
    const nameEl = overlay.querySelector('#wtGateName');
    nameEl.value = String(suggested || getName() || '').trim();

    overlay.querySelector('#wtGateCancel')?.addEventListener('click', () => {
      overlay.remove();
      if (typeof onCancel === 'function') onCancel();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      errorEl.textContent = '';
      const name = String(nameEl.value || '').trim();
      if (!name) {
        errorEl.textContent = 'Type the name people should see.';
        nameEl.focus();
        return;
      }
      setName(name);
      markUnlocked();
      overlay.remove();
      if (typeof onUnlock === 'function') onUnlock({ name });
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
    buildNamePrompt,
    buildGate: buildNamePrompt,
  };
})(window);
