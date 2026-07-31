/**
 * Password gate for Cannabis Origins map — uses logged-in app user password
 * (POST /api/auth/verify-user-password), same as other Nature tools.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'dc_cannabis_origins_unlock_v1';
  const TTL_MS = 12 * 60 * 60 * 1000;
  const OVERLAY_ID = 'cannabisOriginsAuthOverlay';
  const ACTION = 'view the cannabis origins map';

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
      const userId = localStorage.getItem('loggedInUserId');
      if (!userId || (o.userId && o.userId !== userId)) {
        return false;
      }
      return true;
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
  }

  function markUnlocked(userId) {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: 'unlocked',
        userId: userId || localStorage.getItem('loggedInUserId') || '',
        until: Date.now() + TTL_MS,
      })
    );
  }

  function clearUnlock() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function getContentEl() {
    return document.getElementById('cannabisOriginsContent');
  }

  function setContentVisible(visible) {
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
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => {
        script.dataset.loaded = '1';
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function ensureAuthScripts() {
    if (!global.DEMO_USERS) {
      await loadScript('/shared/demo-users.js');
    }
    if (!global.getUserById) {
      await loadScript('/shared/user-selector.js');
    }
    if (!global.isLoggedIn || !global.showLoginPopup) {
      await loadScript('/shared/user-login.js');
    }
    if (!global.verifyUserPassword) {
      await loadScript('/shared/user-passwords.js');
    }
  }

  function showBlockingOverlay(message, options) {
    removeOverlay();
    const opts = options || {};
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'cannabisOriginsAuthTitle');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 12000;
      display: flex; align-items: center; justify-content: center;
      padding: 1.5rem;
      background: rgba(12, 22, 14, 0.94);
      backdrop-filter: blur(8px);
    `;

    overlay.innerHTML = `
      <div style="max-width: 420px; width: 100%; background: #1a2e1c; color: #e8f0e4; border-radius: 1rem; padding: 2rem; box-shadow: 0 24px 60px rgba(0,0,0,0.45); border: 1px solid rgba(120,180,100,0.2); text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;" aria-hidden="true">🌿</div>
        <h2 id="cannabisOriginsAuthTitle" style="margin: 0 0 0.5rem; font-size: 1.35rem; font-weight: 600;">Cannabis Origins</h2>
        <p style="margin: 0 0 1.25rem; color: #a8c4a0; font-size: 0.95rem;">${message}</p>
        ${
          opts.retry
            ? `<button type="button" id="cannabisOriginsAuthRetry"
                style="width: 100%; padding: 0.75rem; border: none; border-radius: 0.5rem; background: linear-gradient(135deg, #3d7a4a, #1e4a28); color: #fff; font-weight: 600; cursor: pointer;">
                Try again
              </button>`
            : ''
        }
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    setContentVisible(false);

    if (opts.retry) {
      overlay.querySelector('#cannabisOriginsAuthRetry')?.addEventListener('click', () => {
        removeOverlay();
        runGate();
      });
    }
  }

  function waitForLogin() {
    return new Promise((resolve) => {
      if (typeof global.isLoggedIn === 'function' && global.isLoggedIn()) {
        resolve(true);
        return;
      }

      const onLogin = () => {
        cleanup();
        resolve(true);
      };
      const onStorage = (e) => {
        if (e.key === 'loggedInUserId' && e.newValue) {
          cleanup();
          resolve(true);
        }
      };
      function cleanup() {
        global.removeEventListener('user-logged-in', onLogin);
        global.removeEventListener('storage', onStorage);
      }

      global.addEventListener('user-logged-in', onLogin);
      global.addEventListener('storage', onStorage);

      if (typeof global.showLoginPopup === 'function') {
        global.showLoginPopup();
      }
    });
  }

  function unlockSuccess(userId) {
    markUnlocked(userId);
    removeOverlay();
    setContentVisible(true);
    global.dispatchEvent(new CustomEvent('cannabis-origins-unlocked'));
  }

  async function runGate() {
    setContentVisible(false);

    try {
      await ensureAuthScripts();
    } catch (err) {
      console.error('cannabis-origins-guard scripts:', err);
      showBlockingOverlay('Could not load login scripts. Refresh and try again.', {
        retry: true,
      });
      return;
    }

    if (!global.isLoggedIn || !global.isLoggedIn()) {
      showBlockingOverlay('Sign in with your user account, then enter your user password.');
      await waitForLogin();
      removeOverlay();
    }

    const userId = localStorage.getItem('loggedInUserId');
    if (!userId) {
      showBlockingOverlay('Sign in required to view this map.', { retry: true });
      return;
    }

    if (readUnlock()) {
      unlockSuccess(userId);
      return;
    }

    const ok = await global.verifyUserPassword(userId, ACTION);
    if (ok) {
      unlockSuccess(userId);
      return;
    }

    showBlockingOverlay('User password required to unlock this map.', { retry: true });
  }

  function initCannabisOriginsGuard() {
    runGate();
  }

  global.CannabisOriginsGuard = {
    initCannabisOriginsGuard,
    readUnlock,
    markUnlocked,
    clearUnlock,
    STORAGE_KEY,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCannabisOriginsGuard);
  } else {
    initCannabisOriginsGuard();
  }
})(typeof window !== 'undefined' ? window : globalThis);
