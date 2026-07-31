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

  function ensureGateFonts() {
    if (document.getElementById('coffeeDreamsGateFonts')) return;
    const link = document.createElement('link');
    link.id = 'coffeeDreamsGateFonts';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500&family=Sora:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
  }

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    ensureGateFonts();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'coffeeDreamsAuthTitle');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 12000;
      display: flex; align-items: center; justify-content: center;
      padding: 1.5rem;
      background:
        radial-gradient(ellipse 70% 50% at 50% 20%, rgba(196, 132, 74, 0.18), transparent 55%),
        rgba(14, 8, 5, 0.94);
      backdrop-filter: blur(10px);
      font-family: "Sora", "Segoe UI", sans-serif;
    `;

    overlay.innerHTML = `
      <div style="
        max-width: 400px; width: 100%;
        background: linear-gradient(165deg, #2e1a12 0%, #1c110c 100%);
        color: #f3e6d4;
        border-radius: 0.25rem;
        padding: 2.25rem 1.85rem 2rem;
        box-shadow: 0 22px 48px rgba(0,0,0,0.5);
        border: 1px solid rgba(243, 230, 212, 0.12);
      ">
        <p style="
          margin: 0 0 0.65rem; text-align: center;
          font-size: 0.68rem; font-weight: 500;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: #c4844a;
        ">Private gallery</p>
        <h2 id="coffeeDreamsAuthTitle" style="
          margin: 0 0 0.65rem; text-align: center;
          font-family: Fraunces, Palatino, serif;
          font-weight: 300; font-size: clamp(1.85rem, 6vw, 2.35rem);
          letter-spacing: -0.02em; line-height: 1; color: #fff6ea;
        ">Coffee <em style="font-style: italic; font-weight: 500; color: #c4844a;">Dreams</em></h2>
        <p style="
          margin: 0 0 1.5rem; text-align: center;
          color: #b9a693; font-size: 0.92rem; font-weight: 300; line-height: 1.5;
        ">Late-night café prints. Enter the page password to step inside.</p>
        <form id="coffeeDreamsAuthForm">
          <label for="coffeeDreamsPassword" style="
            display: block; font-size: 0.72rem; font-weight: 500;
            margin-bottom: 0.4rem; color: #b9a693;
            letter-spacing: 0.08em; text-transform: uppercase;
          ">Password</label>
          <input type="password" id="coffeeDreamsPassword" autocomplete="current-password"
            style="
              width: 100%; padding: 0.8rem 1rem; border-radius: 0.2rem;
              border: 1px solid rgba(243, 230, 212, 0.18);
              background: rgba(0, 0, 0, 0.35); color: #fff6ea;
              font-family: inherit; font-size: 1rem; margin-bottom: 0.85rem;
            "
            required />
          <p id="coffeeDreamsAuthError" hidden style="color: #e8a090; font-size: 0.85rem; margin: 0 0 0.85rem;"></p>
          <button type="submit" id="coffeeDreamsAuthSubmit"
            style="
              width: 100%; padding: 0.85rem; border: none; border-radius: 0.2rem;
              background: #c4844a; color: #1a100b;
              font-family: inherit; font-weight: 600; font-size: 0.88rem;
              letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer;
            ">
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
