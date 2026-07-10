/**
 * Global User Login System
 * 
 * @file       user-login.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 * 
 * @description
 * Global user authentication system with icon-based login interface.
 * Provides a one-time login popup with 5 user icons for authentication
 * across all pages. Stores login state in sessionStorage and displays
 * user information throughout the application.
 * 
 * Features:
 * - Icon-based user selection interface
 * - Password-protected user accounts
 * - Session persistence across pages
 * - User avatar and name display
 * - Logout functionality
 * - Login modal popup system
 * 
 * Technical Implementation:
 * - Password validation via POST /api/auth/verify-user-password (PostgreSQL)
 * - SessionStorage for login state persistence
 * - Modal popup UI with animated transitions
 * - User avatar and name rendering
 * - Event-driven authentication flow
 * 
 * Security Notes:
 * - Passwords verified server-side (see /api/auth/verify-user-password)
 * - Login persistence uses localStorage + finance session cookie
 * 
 * ==============================================================================
 */

const LOGIN_MODAL_Z = 12000;

/** HttpOnly cannot be set from JS; this pairs with server middleware so /finance/*.html is not served without login. */
const FINANCE_SESSION_COOKIE_NAME = 'dc_finance_session';
const FINANCE_SESSION_COOKIE_VALUE = '1';
const FINANCE_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function setFinanceSessionCookie() {
  try {
    document.cookie = `${FINANCE_SESSION_COOKIE_NAME}=${FINANCE_SESSION_COOKIE_VALUE}; Path=/; Max-Age=${FINANCE_SESSION_MAX_AGE_SEC}; SameSite=Lax`;
  } catch (_) {}
}

function clearFinanceSessionCookie() {
  try {
    document.cookie = `${FINANCE_SESSION_COOKIE_NAME}=; Path=/; Max-Age=0`;
  } catch (_) {}
}

function hasFinanceSessionCookie() {
  try {
    return document.cookie
      .split(';')
      .some((part) => part.trim().startsWith(`${FINANCE_SESSION_COOKIE_NAME}=${FINANCE_SESSION_COOKIE_VALUE}`));
  } catch (_) {
    return false;
  }
}

(function syncFinanceSessionCookieFromStorage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('loggedInUserId')) {
      setFinanceSessionCookie();
    }
  } catch (_) {}
})();

// Requires /shared/demo-users.js (corp-friendly profiles)
window.USERS = window.DEMO_USERS || window.USERS || [];

// Check if logged in
function isLoggedIn() {
  return localStorage.getItem('loggedInUserId') !== null;
}

// Get logged in user
function getLoggedInUser() {
  const userId = localStorage.getItem('loggedInUserId');
  return window.USERS.find(u => u.id === userId) || null;
}

function setupLoginModalAccessibility(modal) {
  const panel = modal.querySelector('#loginDialogPanel');
  if (!panel) return;
  const previousActive = document.activeElement;
  const focusable = [
    'button:not([disabled])',
    'input:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  function getList() {
    return Array.from(panel.querySelectorAll(focusable)).filter(
      (el) => el.offsetParent !== null && !el.disabled
    );
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeLoginPopup();
      return;
    }
    if (e.key !== 'Tab') return;
    const list = getList();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !panel.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onFocusIn(e) {
    if (!modal.parentNode) return;
    if (panel.contains(e.target)) return;
    const list = getList();
    const pwd = panel.querySelector('#loginPasswordInput');
    if (pwd && panel.querySelector('#passwordSection')?.style.display !== 'none') {
      pwd.focus({ preventScroll: true });
      return;
    }
    if (list.length) list[0].focus({ preventScroll: true });
  }

  document.addEventListener('keydown', onKeydown, true);
  document.addEventListener('focusin', onFocusIn, true);
  modal.dataset._loginA11y = '1';
  modal._loginTeardown = () => {
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('focusin', onFocusIn, true);
    if (previousActive && typeof previousActive.focus === 'function') {
      try {
        previousActive.focus();
      } catch (_) {}
    }
  };

  requestAnimationFrame(() => {
    const closeBtn = modal.querySelector('#loginModalCloseBtn');
    if (closeBtn) closeBtn.focus();
  });
}

function redirectAfterLoginIfNeeded() {
  const params = new URLSearchParams(window.location.search);
  let returnToRaw = params.get('returnTo');
  if (!returnToRaw) {
    try {
      returnToRaw = sessionStorage.getItem('featuredAuthReturnTo');
    } catch (_) {}
  }
  if (!returnToRaw) return false;
  try {
    const dest = new URL(returnToRaw, window.location.origin);
    if (dest.origin === window.location.origin && dest.pathname.startsWith('/finance')) {
      setFinanceSessionCookie();
      try {
        sessionStorage.removeItem('featuredAuthReturnTo');
      } catch (_) {}
      window.location.replace(dest.pathname + dest.search + dest.hash);
      return true;
    }
  } catch (_) {}
  return false;
}

// Show login popup
function showLoginPopup() {
  const existing = document.getElementById('loginModal');
  if (existing) closeLoginPopup();
  selectedLoginUserId = null;
  const modal = document.createElement('div');
  modal.id = 'loginModal';
  modal.setAttribute('role', 'presentation');
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: ${LOGIN_MODAL_Z};
    padding: 1rem;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    box-sizing: border-box;
  `;

  modal.innerHTML = `
    <div id="loginDialogPanel" role="dialog" aria-modal="true" aria-labelledby="loginModalTitle"
         style="background: var(--bs-body-bg, #fff); color: var(--bs-body-color, #212529); padding: 30px 20px; border-radius: 24px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5); position: relative;">
      <button type="button" id="loginModalCloseBtn"
              aria-label="Close"
              style="position: absolute; top: 10px; right: 12px; min-width:44px;min-height:44px;background: none; border: none; font-size: 1.75rem; color: #999; cursor: pointer; line-height: 1; padding: 0; z-index: 1;">×</button>

      <h2 id="loginModalTitle" tabindex="-1" style="text-align: center; margin-bottom: 10px; font-size: 1.5rem;">
        <i class="bi bi-person-circle" aria-hidden="true"></i> Select your user
      </h2>
      <p style="text-align: center; color: var(--bs-secondary-color, #6c757d); margin-bottom: 25px; font-size: 0.95rem;">Click your icon to log in</p>

      <div id="userIconGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; margin-bottom: 20px;">
        ${window.USERS.map(user => `
          <div class="login-user-card" data-user="${user.id}" role="button" tabindex="0"
               aria-label="Log in as ${user.name.replace(/"/g, '&quot;')}" style="cursor:pointer;">
            <img src="${user.avatar}" alt="" class="lane-lightbox-ignore" data-lane-lightbox-ignore="1"
                 style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin: 0 auto; display: block; border: 4px solid ${user.color}; touch-action: manipulation; pointer-events: none;">
            <div style="text-align: center; font-size: 0.85rem; margin-top: 8px; font-weight: 600; line-height: 1.2;">${user.name.split(' ').slice(-1)}</div>
          </div>
        `).join('')}
      </div>

      <div id="passwordSection" style="display: none; margin-top: 25px; padding-top: 25px; border-top: 2px solid #eee;" aria-live="polite">
        <form id="loginPasswordForm" autocomplete="on" novalidate>
          <h4 style="text-align: center; margin-bottom: 15px; font-size: 1.1rem;">
            Password for <span id="selectedUserName" style="color: #0d6efd;"></span>
          </h4>
          <div style="position: relative; margin-bottom: 15px;">
            <input type="password" id="loginPasswordInput" name="password"
                   placeholder="Password"
                   inputmode="text"
                   autocomplete="current-password"
                   autocorrect="off"
                   autocapitalize="off"
                   spellcheck="false"
                   aria-invalid="false"
                   required
                   style="width: 100%; padding: 14px 52px 14px 14px; border: 2px solid #dee2e6; border-radius: 10px; font-size: 1.1rem; box-sizing: border-box; min-height: 48px;">
            <button type="button" id="toggleLoginPasswordBtn"
                    aria-label="Show password" aria-pressed="false" title="Show password"
                    style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; background: none; border: none; cursor: pointer; border-radius: 8px; color: #6c757d; display: inline-flex; align-items: center; justify-content: center;">
              <i class="bi bi-eye" aria-hidden="true"></i>
            </button>
          </div>
          <div id="loginPasswordError" role="alert" style="color: #dc3545; font-size: 0.9rem; margin-bottom: 15px; text-align: center; display: none;"></div>
          <div style="display: flex; gap: 10px;">
            <button type="button" id="loginCancelBtn"
                    style="flex: 1; min-height: 44px; padding: 14px; border: 2px solid #dee2e6; background: #fff; color: #6c757d; border-radius: 12px; cursor: pointer; font-size: 1rem; font-weight: 600;">
              Cancel
            </button>
            <button type="submit" id="loginSubmitBtn"
                    style="flex: 1; min-height: 44px; padding: 14px; border: 2px solid #0d6efd; background: #0d6efd; color: #fff; border-radius: 12px; cursor: pointer; font-size: 1rem; font-weight: 600;">
              Log in
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#loginModalCloseBtn')?.addEventListener('click', closeLoginPopup);
  modal.querySelector('#loginCancelBtn')?.addEventListener('click', closeLoginPopup);
  modal.querySelector('#loginPasswordForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitLogin();
  });

  modal.addEventListener('click', (e) => {
    const card = e.target.closest('.login-user-card');
    if (!card || !modal.contains(card)) return;
    e.preventDefault();
    selectUserForLogin(card.dataset.user, modal);
  });

  modal.addEventListener('keydown', (e) => {
    const card = e.target.closest('.login-user-card');
    if (!card || !modal.contains(card)) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectUserForLogin(card.dataset.user, modal);
    }
  });

  const pwdInput = modal.querySelector('#loginPasswordInput');
  const togglePwd = modal.querySelector('#toggleLoginPasswordBtn');
  if (togglePwd && pwdInput) {
    togglePwd.addEventListener('click', () => {
      const visible = pwdInput.type === 'password';
      pwdInput.type = visible ? 'text' : 'password';
      togglePwd.setAttribute('aria-pressed', visible ? 'true' : 'false');
      togglePwd.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
      togglePwd.title = visible ? 'Hide password' : 'Show password';
      const icon = togglePwd.querySelector('i');
      if (icon) icon.className = visible ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
  }

  if (!document.getElementById('login-modal-hover-style')) {
    const style = document.createElement('style');
    style.id = 'login-modal-hover-style';
    style.textContent = `
      @media (prefers-reduced-motion: no-preference) {
        .login-user-card:hover { box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.35); border-radius: 12px; }
      }
    `;
    document.head.appendChild(style);
  }

  setupLoginModalAccessibility(modal);
}

// Select user for login
let selectedLoginUserId = null;

function getLoginModalRoot() {
  return document.getElementById('loginModal');
}

function selectUserForLogin(userId, modalRoot) {
  const modal = modalRoot || getLoginModalRoot();
  if (!modal || !userId) return;

  const u = window.USERS.find((x) => x.id === userId);
  if (!u) return;
  selectedLoginUserId = userId;

  const panel = modal.querySelector('#loginDialogPanel');
  const passwordSection = modal.querySelector('#passwordSection');
  const userGrid = modal.querySelector('#userIconGrid');
  const nameEl = modal.querySelector('#selectedUserName');
  const submitBtn = modal.querySelector('#loginSubmitBtn');
  const pwd = modal.querySelector('#loginPasswordInput');
  const errorDiv = modal.querySelector('#loginPasswordError');

  if (!passwordSection || !nameEl || !submitBtn || !pwd) return;

  if (userGrid) {
    userGrid.style.display = 'none';
  }
  passwordSection.style.display = 'block';
  nameEl.textContent = u.name;
  nameEl.style.color = u.color;

  submitBtn.style.background = '#0d6efd';
  submitBtn.style.borderColor = '#0d6efd';
  submitBtn.style.color = '#fff';

  pwd.value = '';
  pwd.setAttribute('aria-invalid', 'false');
  if (errorDiv) {
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
  }

  const titleEl = modal.querySelector('#loginModalTitle');
  if (titleEl) {
    titleEl.innerHTML = `<i class="bi bi-shield-lock" aria-hidden="true"></i> Enter password`;
  }

  requestAnimationFrame(() => {
    passwordSection.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    pwd.focus({ preventScroll: true });
  });

  modal.querySelectorAll('.login-user-card').forEach((card) => {
    card.style.opacity = card.dataset.user === userId ? '1' : '0.5';
  });
}

// Submit login
async function submitLogin() {
  if (!selectedLoginUserId) return;
  const modal = getLoginModalRoot();
  const pwdInput = modal?.querySelector('#loginPasswordInput') || document.getElementById('loginPasswordInput');
  const password = pwdInput.value.trim();
  const errorDiv = modal?.querySelector('#loginPasswordError') || document.getElementById('loginPasswordError');
  const submitBtn = modal?.querySelector('#loginSubmitBtn') || document.getElementById('loginSubmitBtn');
  const verify =
    typeof window.verifyPasswordWithServer === 'function'
      ? window.verifyPasswordWithServer
      : async (userId, pwd) => {
          const res = await fetch('/api/auth/verify-user-password', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ userId, password: pwd }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return { ok: false, serverError: res.status === 503 };
          return { ok: data.valid === true, serverError: false };
        };

  const panel = modal?.querySelector('#loginDialogPanel') || document.getElementById('loginDialogPanel');
  errorDiv.style.display = 'none';
  errorDiv.textContent = '';
  pwdInput.setAttribute('aria-invalid', 'false');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.dataset._loginLabel = submitBtn.textContent;
    submitBtn.textContent = 'Signing in…';
  }
  if (panel) panel.setAttribute('aria-busy', 'true');

  const { ok, serverError } = await verify(selectedLoginUserId, password);

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.removeAttribute('aria-busy');
    if (submitBtn.dataset._loginLabel) submitBtn.textContent = submitBtn.dataset._loginLabel;
  }
  if (panel) panel.removeAttribute('aria-busy');

  if (ok) {
    localStorage.setItem('loggedInUserId', selectedLoginUserId);
    localStorage.setItem('currentUserId', selectedLoginUserId);
    setFinanceSessionCookie();
    closeLoginPopup();
    window.dispatchEvent(new CustomEvent('user-logged-in', { detail: { userId: selectedLoginUserId } }));
    if (hasFinanceSessionCookie() && redirectAfterLoginIfNeeded()) return;
    window.location.reload();
    return;
  }

  if (serverError) {
    errorDiv.textContent = 'Could not reach server. Check connection and try again.';
  } else {
    errorDiv.textContent = 'Incorrect password. Try again.';
  }
  pwdInput.setAttribute('aria-invalid', 'true');
  errorDiv.style.display = 'block';
  pwdInput.value = '';
  pwdInput.style.borderColor = '#e74c3c';
  setTimeout(() => {
    pwdInput.style.borderColor = '#dee2e6';
  }, 1000);
  pwdInput.focus();
}

// Close login popup
function closeLoginPopup() {
  const modal = document.getElementById('loginModal');
  if (modal && typeof modal._loginTeardown === 'function') {
    modal._loginTeardown();
    modal._loginTeardown = null;
  }
  if (modal && modal.parentNode) {
    modal.parentNode.removeChild(modal);
  }
}

// Logout
async function logout() {
  if (!confirm('Logout? You will need to login again.')) return;
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch (_) {}
  localStorage.removeItem('loggedInUserId');
  localStorage.removeItem('currentUserId');
  sessionStorage.clear();
  clearFinanceSessionCookie();
  window.location.reload();
}

// Update navbar to show current user
function updateNavbarUserDisplay() {
  const user = getLoggedInUser();
  const navUserBtn = document.getElementById('navUserBtn');
  
  if (navUserBtn && user) {
    navUserBtn.innerHTML = `
      <img src="${user.avatar}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid ${user.color}; margin-right: 8px; vertical-align: middle;">
      ${user.name}
    `;
  }

  const portfolioAuthBtn = document.getElementById('portfolioAuthBtn');
  if (portfolioAuthBtn) {
    if (user) {
      const name = user.name ? user.name.split(' ').slice(-1)[0] : 'Account';
      portfolioAuthBtn.classList.add('portfolio-auth-btn--out');
      portfolioAuthBtn.setAttribute('aria-label', 'Log out as ' + name);
      portfolioAuthBtn.innerHTML =
        (user.avatar
          ? '<img class="portfolio-auth-btn__avatar" src="' + user.avatar + '" alt="" />'
          : '<i class="bi bi-person-check" aria-hidden="true"></i>') +
        '<span>' + name + ' · Log out</span>';
    } else {
      portfolioAuthBtn.classList.remove('portfolio-auth-btn--out');
      portfolioAuthBtn.setAttribute('aria-label', 'Log in');
      portfolioAuthBtn.innerHTML = '<i class="bi bi-box-arrow-in-right" aria-hidden="true"></i><span>Log in</span>';
    }
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const returnToRaw = params.get('returnTo');
  const financeLogin = params.get('financeLogin') === '1';

  if (returnToRaw && isLoggedIn()) {
    setFinanceSessionCookie();
    if (hasFinanceSessionCookie() && redirectAfterLoginIfNeeded()) return;
    if (!hasFinanceSessionCookie()) {
      try {
        const dest = new URL(returnToRaw, window.location.origin);
        if (dest.origin === window.location.origin && dest.pathname.startsWith('/finance')) {
          showLoginPopup();
          return;
        }
      } catch (_) {}
    }
  }

  if (financeLogin && returnToRaw && !isLoggedIn()) {
    try {
      const dest = new URL(returnToRaw, window.location.origin);
      if (dest.origin === window.location.origin && dest.pathname.startsWith('/finance')) {
        try {
          sessionStorage.removeItem('financeFireGateDismissed');
        } catch (_) {}
        const onHome =
          window.location.pathname === '/' ||
          window.location.pathname === '/index.html';
        const mountFireGate = () => {
          if (typeof window.FinanceFireGate?.mount === 'function') {
            window.FinanceFireGate.mount({ homeMode: onHome }).then(() => {
              showLoginPopup();
            }).catch(() => showLoginPopup());
            return;
          }
          showLoginPopup();
        };
        if (window.FinanceFireGate) {
          mountFireGate();
        } else {
          const script = document.createElement('script');
          script.src = '/shared/js/finance-fire-gate.js';
          script.async = true;
          script.onload = mountFireGate;
          script.onerror = () => showLoginPopup();
          document.head.appendChild(script);
        }
      }
    } catch (_) {}
  }

  updateNavbarUserDisplay();
});

window.addEventListener('user-logged-in', () => {
  if (window.FinanceFireGate && window.FinanceFireGate.isMounted()) {
    window.FinanceFireGate.unmount();
  }
});

// Export functions
window.showLoginPopup = showLoginPopup;
window.selectUserForLogin = selectUserForLogin;
window.submitLogin = submitLogin;
window.closeLoginPopup = closeLoginPopup;
window.logout = logout;
window.isLoggedIn = isLoggedIn;
window.getLoggedInUser = getLoggedInUser;
window.updateNavbarUserDisplay = updateNavbarUserDisplay;
window.hasFinanceSessionCookie = hasFinanceSessionCookie;
window.setFinanceSessionCookie = setFinanceSessionCookie;

