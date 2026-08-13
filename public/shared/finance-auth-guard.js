/**
 * Finance auth guard — Wall of Fire gate for login-required /finance pages.
 * Development work by David Lane
 */
(() => {
  const FINANCE_PATH_PREFIX = '/finance/';
  const CHECK_INTERVAL_MS = 600;
  const PUBLIC_FINANCE_PAGES = new Set([
    '/finance/index.html',
    '/finance/fha-streamline-calculator.html',
    '/finance/fha-streamline-loan-amount-calculator.html',
    '/finance/fha-streamline-ntb-calculator.html',
    '/finance/asset-qualifier-calculator.html',
    '/finance/dti-calculator.html',
    '/finance/cashout-refinance-calculator.html',
    '/finance/amortization-schedule-calculator.html',
    '/finance/closing-cost-calculator.html',
    '/finance/ltv-calculator.html',
    '/finance/va-irrrl-calculator.html',
    '/finance/disasters-unified.html',
    '/finance/disasters-webcams.html',
    '/finance/disasters-encompass-map.html',
  ]);

  const financePath = window.location.pathname.toLowerCase();
  if (!financePath.startsWith(FINANCE_PATH_PREFIX) && financePath !== '/finance') {
    return;
  }

  const isPublicHub =
    financePath === '/finance' ||
    financePath === '/finance/' ||
    financePath === '/finance/index.html';
  if (isPublicHub || PUBLIC_FINANCE_PAGES.has(financePath)) {
    return;
  }

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1' || existing.getAttribute('data-loaded') === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = '1';
        resolve();
      };
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
    if (!window.FinanceFireGate) {
      await loadScript('/shared/js/finance-fire-gate.js');
    }
  };

  const createOverlay = async () => {
    if (!window.FinanceFireGate) return;
    if (window.FinanceFireGate.isMounted()) {
      window.FinanceFireGate.setVisible(true);
      return;
    }
    await window.FinanceFireGate.mount();
  };

  const removeOverlay = () => {
    if (window.FinanceFireGate && window.FinanceFireGate.isMounted()) {
      window.FinanceFireGate.unmount();
    }
  };

  const isUserLoggedIn = () => typeof window.isLoggedIn === 'function' && window.isLoggedIn();

  const ensureLogin = async () => {
    if (isUserLoggedIn()) {
      removeOverlay();
      return;
    }
    await createOverlay();
    if (window.FinanceFireGate) {
      window.FinanceFireGate.setVisible(true);
    }
    if (typeof window.showLoginPopup === 'function') {
      const loginModal = document.getElementById('loginModal');
      if (!loginModal) {
        window.showLoginPopup();
      }
    }
  };

  const startGuard = async () => {
    try {
      await ensureAuthScripts();
    } catch (error) {
      console.error('Finance auth guard failed to load auth scripts', error);
    }
    await ensureLogin();
    window.addEventListener('storage', () => {
      ensureLogin();
    });
    window.addEventListener('user-logged-in', () => {
      removeOverlay();
    });
    setInterval(() => {
      ensureLogin();
    }, CHECK_INTERVAL_MS);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGuard);
  } else {
    startGuard();
  }
})();
