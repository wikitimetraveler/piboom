/**
 * Password gate for Coffee Dreams gallery (sessionStorage unlock, server verify).
 */
(function (global) {
  'use strict';

  const VERIFY_URL = '/api/auth/verify-coffee-dreams';
  const STORAGE_KEY = 'dc_coffee_dreams_unlock_v1';
  const TTL_MS = 12 * 60 * 60 * 1000;
  const OVERLAY_ID = 'coffeeDreamsAuthOverlay';

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

  function clearUnlock() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getContentEl() {
    return document.getElementById('coffeeDreamsContent');
  }

  function setGalleryVisible(visible) {
    const content = getContentEl();
    if (content) {
      content.hidden = !visible;
      content.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }
  }

  function removeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    setGalleryVisible(true);
  }

  function showError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'coffeeDreamsAuthTitle');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 12000;
      display: flex; align-items: center; justify-content: center;
      padding: 1.5rem;
      background: rgba(18, 10, 8, 0.92);
      backdrop-filter: blur(8px);
    `;

    overlay.innerHTML = `
      <div style="max-width: 420px; width: 100%; background: #2a1810; color: #f5e6d3; border-radius: 1rem; padding: 2rem; box-shadow: 0 24px 60px rgba(0,0,0,0.45); border: 1px solid rgba(255,200,150,0.15);">
        <div style="font-size: 2rem; text-align: center; margin-bottom: 0.5rem;">☕</div>
        <h2 id="coffeeDreamsAuthTitle" style="margin: 0 0 0.5rem; font-size: 1.35rem; text-align: center; font-weight: 600; letter-spacing: 0.04em;">Coffee Dreams</h2>
        <p style="margin: 0 0 1.25rem; text-align: center; color: #c9b8a8; font-size: 0.95rem;">This gallery is private. Enter the page password to continue.</p>
        <form id="coffeeDreamsAuthForm">
          <label for="coffeeDreamsPassword" style="display: block; font-size: 0.8rem; margin-bottom: 0.35rem; color: #d4c4b0;">Password</label>
          <input type="password" id="coffeeDreamsPassword" autocomplete="current-password"
            style="width: 100%; padding: 0.75rem 1rem; border-radius: 0.5rem; border: 1px solid rgba(255,200,150,0.25); background: rgba(0,0,0,0.25); color: #fff; margin-bottom: 0.75rem;"
            required />
          <p id="coffeeDreamsAuthError" hidden style="color: #ffb4a2; font-size: 0.85rem; margin: 0 0 0.75rem;"></p>
          <button type="submit" id="coffeeDreamsAuthSubmit"
            style="width: 100%; padding: 0.75rem; border: none; border-radius: 0.5rem; background: linear-gradient(135deg, #c87941, #8b4513); color: #fff; font-weight: 600; cursor: pointer;">
            Unlock gallery
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    setGalleryVisible(false);

    const form = overlay.querySelector('#coffeeDreamsAuthForm');
    const input = overlay.querySelector('#coffeeDreamsPassword');
    const errorEl = overlay.querySelector('#coffeeDreamsAuthError');
    const submitBtn = overlay.querySelector('#coffeeDreamsAuthSubmit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Checking…';

      try {
        const res = await fetch(VERIFY_URL, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ password: input.value }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 503) {
          showError(errorEl, data.error || 'Page not configured on server.');
          return;
        }
        if (!res.ok || !data.valid) {
          showError(errorEl, 'Incorrect password. Try again.');
          input.select();
          return;
        }

        markUnlocked();
        removeOverlay();
        global.dispatchEvent(new CustomEvent('coffee-dreams-unlocked'));
      } catch {
        showError(errorEl, 'Could not reach server. Try again.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Unlock gallery';
      }
    });

    input.focus();
  }

  function initCoffeeDreamsGuard() {
    if (readUnlock()) {
      setGalleryVisible(true);
      return;
    }
    createOverlay();
  }

  global.CoffeeDreamsGuard = {
    initCoffeeDreamsGuard,
    readUnlock,
    markUnlocked,
    clearUnlock,
    STORAGE_KEY,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCoffeeDreamsGuard);
  } else {
    initCoffeeDreamsGuard();
  }
})(typeof window !== 'undefined' ? window : globalThis);
