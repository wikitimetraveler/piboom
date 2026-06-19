/**
 * Development work by David Lane
 */
(() => {
  const FINANCE_PATH_PREFIX = '/finance/';
  const LOGIN_MODAL_ID = 'loginModal';
  const OVERLAY_ID = 'financeAuthOverlay';
  const CHECK_INTERVAL_MS = 600;
  const PUBLIC_FINANCE_PAGES = new Set([
    '/finance/disasters-unified.html',
    '/finance/disasters-webcams.html',
  ]);

  const financePath = window.location.pathname.toLowerCase();
  if (!financePath.startsWith(FINANCE_PATH_PREFIX)) {
    return;
  }

  if (PUBLIC_FINANCE_PAGES.has(financePath)) {
    return;
  }

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });

  const ensureAuthScripts = async () => {
    if (!window.DEMO_USERS) {
      await loadScript('/shared/demo-users.js');
    }
    if (!window.isLoggedIn || !window.showLoginPopup) {
      await loadScript('/shared/user-login.js');
    }
    if (!window.verifyUserPassword) {
      await loadScript('/shared/user-passwords.js');
    }
  };

  const createOverlay = () => {
    if (document.getElementById(OVERLAY_ID)) return;
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(8, 12, 24, 0.88);
      backdrop-filter: blur(6px);
      z-index: 11000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    `;
    overlay.innerHTML = `
      <div style="max-width: 520px; width: 100%; background: #ffffff; border-radius: 20px; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 12px;">🔒</div>
        <h2 style="margin: 0 0 8px; color: #1f2a44; font-size: 1.4rem;">Login Required</h2>
        <p style="margin: 0 0 20px; color: #556070;">Worksheets and Encompass tools are locked until you log in.</p>
        <button id="financeAuthLoginBtn" style="background: #4a90a4; color: #fff; border: none; border-radius: 12px; padding: 12px 18px; font-weight: 600; cursor: pointer; width: 100%;">
          Log In to Continue
        </button>
        <button id="financeAuthHomeBtn" style="margin-top: 10px; background: transparent; color: #4a90a4; border: 1px solid #4a90a4; border-radius: 12px; padding: 10px 18px; font-weight: 600; cursor: pointer; width: 100%;">
          Back to Home
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    overlay.querySelector('#financeAuthLoginBtn')?.addEventListener('click', () => {
      if (typeof window.showLoginPopup === 'function') {
        window.showLoginPopup();
      }
    });
    overlay.querySelector('#financeAuthHomeBtn')?.addEventListener('click', () => {
      window.location.href = '/index.html';
    });
  };

  const removeOverlay = () => {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.remove();
      document.body.style.overflow = '';
    }
  };

  const isUserLoggedIn = () => typeof window.isLoggedIn === 'function' && window.isLoggedIn();

  const ensureLogin = () => {
    if (isUserLoggedIn()) {
      removeOverlay();
      return;
    }
    const loginModal = document.getElementById(LOGIN_MODAL_ID);
    if (loginModal) {
      const overlay = document.getElementById(OVERLAY_ID);
      if (overlay) overlay.style.display = 'none';
      return;
    }
    createOverlay();
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.style.display = 'flex';
    if (!loginModal && typeof window.showLoginPopup === 'function') {
      window.showLoginPopup();
    }
  };

  const startGuard = async () => {
    try {
      await ensureAuthScripts();
    } catch (error) {
      console.error('Finance auth guard failed to load auth scripts', error);
    }
    ensureLogin();
    window.addEventListener('storage', ensureLogin);
    setInterval(ensureLogin, CHECK_INTERVAL_MS);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGuard);
  } else {
    startGuard();
  }
})();
