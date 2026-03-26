/**
 * User Password Protection System
 *
 * Verifies action passwords via POST /api/auth/verify-user-password.
 * Verification is remembered in localStorage (cross-tab) for several hours.
 *
 * Modal: dialog semantics, focus trap, Escape, masked password by default,
 * aria wiring, safe primary button contrast, reduced-motion respect.
 */

const VERIFY_USER_PASSWORD_URL = '/api/auth/verify-user-password';
const VERIFY_STORAGE_KEY = 'dc_action_verify_v1';
const VERIFY_TTL_MS = 12 * 60 * 60 * 1000;
/** Above finance auth overlay (11000) */
const VERIFY_MODAL_Z = 12000;

function readStoredVerifiedUserId() {
  try {
    const raw = localStorage.getItem(VERIFY_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o.userId !== 'string' || typeof o.until !== 'number') {
      localStorage.removeItem(VERIFY_STORAGE_KEY);
      return null;
    }
    if (Date.now() > o.until) {
      localStorage.removeItem(VERIFY_STORAGE_KEY);
      return null;
    }
    return o.userId;
  } catch {
    localStorage.removeItem(VERIFY_STORAGE_KEY);
    return null;
  }
}

async function verifyPasswordWithServer(userId, password) {
  try {
    const res = await fetch(VERIFY_USER_PASSWORD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ userId, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 503) {
      return { ok: false, serverError: true };
    }
    if (!res.ok) {
      return { ok: false, serverError: false };
    }
    return { ok: data.valid === true, serverError: false };
  } catch {
    return { ok: false, serverError: true };
  }
}

if (typeof window.sessionKey === 'undefined') {
  window.sessionKey = 'verified_user_session';
}

function isUserVerifiedInSession(userId) {
  if (sessionStorage.getItem(window.sessionKey) === userId) {
    return true;
  }
  return readStoredVerifiedUserId() === userId;
}

function markUserVerified(userId) {
  sessionStorage.setItem(window.sessionKey, userId);
  try {
    localStorage.setItem(
      VERIFY_STORAGE_KEY,
      JSON.stringify({ userId, until: Date.now() + VERIFY_TTL_MS })
    );
  } catch (_) {}
}

function clearVerification() {
  sessionStorage.removeItem(window.sessionKey);
  try {
    localStorage.removeItem(VERIFY_STORAGE_KEY);
  } catch (_) {}
}

function injectVerifyModalStylesOnce() {
  if (document.getElementById('dc-verify-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'dc-verify-modal-styles';
  style.textContent = `
    .dc-verify-backdrop {
      position: fixed;
      inset: 0;
      z-index: ${VERIFY_MODAL_Z};
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(5px);
      box-sizing: border-box;
    }
    .dc-verify-dialog {
      background: var(--bs-body-bg, #fff);
      color: var(--bs-body-color, #212529);
      border-radius: 1rem;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.35);
      outline: none;
    }
    .dc-verify-dialog:focus-visible {
      outline: 2px solid var(--bs-primary, #0d6efd);
      outline-offset: 2px;
    }
    .dc-verify-header-accent {
      height: 5px;
      border-radius: 1rem 1rem 0 0;
    }
    .dc-verify-body {
      padding: 1.5rem;
    }
    .dc-verify-title {
      margin: 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 600;
      text-align: center;
    }
    .dc-verify-desc {
      text-align: center;
      font-size: 0.9rem;
      color: var(--bs-secondary-color, #6c757d);
      margin: 0.35rem 0;
    }
    .dc-verify-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .dc-verify-btn {
      flex: 1;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      border: 2px solid transparent;
      min-height: 44px;
      box-sizing: border-box;
    }
    .dc-verify-btn:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
    .dc-verify-btn-cancel {
      border-color: var(--bs-border-color, #dee2e6);
      background: var(--bs-body-bg, #fff);
      color: var(--bs-secondary, #6c757d);
    }
    .dc-verify-btn-submit {
      background: #0d6efd;
      color: #fff;
      border-color: #0d6efd;
    }
    .dc-verify-btn-submit:focus-visible {
      outline: 2px solid #0d6efd;
      outline-offset: 2px;
    }
    .dc-verify-input-wrap {
      position: relative;
      margin-top: 1rem;
    }
    .dc-verify-input {
      width: 100%;
      padding: 0.875rem 3.25rem 0.875rem 0.875rem;
      border: 2px solid var(--bs-border-color, #dee2e6);
      border-radius: 0.5rem;
      font-size: 1.05rem;
      box-sizing: border-box;
      min-height: 48px;
    }
    .dc-verify-input[aria-invalid="true"] {
      border-color: #dc3545;
    }
    .dc-verify-toggle {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      width: 44px;
      height: 44px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 0.375rem;
      color: var(--bs-secondary, #6c757d);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .dc-verify-toggle:focus-visible {
      outline: 2px solid #0d6efd;
      outline-offset: 2px;
    }
    .dc-verify-msg {
      font-size: 0.85rem;
      margin-top: 0.75rem;
      text-align: center;
      display: none;
    }
    .dc-verify-msg--err { color: #dc3545; }
    .dc-verify-msg--warn { color: #c77800; }
    .dc-verify-spinner {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: dc-verify-spin 0.7s linear infinite;
      vertical-align: -2px;
      margin-right: 0.35rem;
    }
    @keyframes dc-verify-spin { to { transform: rotate(360deg); } }
    @keyframes dc-verify-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-8px); }
      75% { transform: translateX(8px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .dc-verify-spinner { animation: none; border-top-color: #fff; opacity: 0.7; }
      .dc-verify-dialog.dc-verify-shake-anim { animation: none !important; }
    }
    .dc-verify-dialog.dc-verify-shake-anim {
      animation: dc-verify-shake 0.4s ease;
    }
  `;
  document.head.appendChild(style);
}

function focusableSelector() {
  return [
    'button:not([disabled]):not([aria-hidden="true"])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
}

async function verifyUserPassword(userId, actionDescription = 'perform this action') {
  if (isUserVerifiedInSession(userId)) {
    return true;
  }

  injectVerifyModalStylesOnce();

  const user = getUserById ? getUserById(userId) : null;
  const userName = user ? user.name : 'User';
  const userColor = user ? user.color : '#667eea';
  const sid = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const titleId = `dc-verify-title-${sid}`;
  const descId = `dc-verify-desc-${sid}`;
  const inputId = `dc-verify-input-${sid}`;
  const errId = `dc-verify-err-${sid}`;
  const srvId = `dc-verify-srv-${sid}`;

  return new Promise((resolve) => {
    const previousActive = document.activeElement;
    const backdrop = document.createElement('div');
    backdrop.className = 'dc-verify-backdrop';
    backdrop.setAttribute('role', 'presentation');

    const panel = document.createElement('div');
    panel.className = 'dc-verify-dialog';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', titleId);
    panel.setAttribute('aria-describedby', descId);
    panel.tabIndex = -1;

    const avatarHtml = user
      ? `<img src="${user.avatar}" alt="" class="rounded-circle mx-auto d-block" style="width:80px;height:80px;object-fit:cover;border:3px solid ${userColor};" width="80" height="80">`
      : '';

    panel.innerHTML = `
      <div class="dc-verify-header-accent" style="background:${userColor};"></div>
      <div class="dc-verify-body">
        <div style="text-align:center;margin-bottom:0.5rem">${avatarHtml}</div>
        <h2 id="${titleId}" class="dc-verify-title">Password required</h2>
        <p id="${descId}" class="dc-verify-desc">
          Enter password for <strong style="color:${userColor}">${escapeHtml(userName)}</strong>
          to ${escapeHtml(actionDescription)}.
        </p>
        <div class="dc-verify-input-wrap">
          <input type="password"
            id="${inputId}"
            class="dc-verify-input"
            placeholder="Password"
            inputmode="text"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            aria-invalid="false">
          <button type="button"
            class="dc-verify-toggle"
            id="dc-verify-toggle-${sid}"
            aria-label="Show password"
            aria-pressed="false"
            title="Show password">
            <i class="bi bi-eye" aria-hidden="true"></i>
          </button>
        </div>
        <div class="dc-verify-actions">
          <button type="button" class="dc-verify-btn dc-verify-btn-cancel" id="dc-verify-cancel-${sid}">Cancel</button>
          <button type="button" class="dc-verify-btn dc-verify-btn-submit" id="dc-verify-submit-${sid}">
            Verify
          </button>
        </div>
        <div id="${errId}" class="dc-verify-msg dc-verify-msg--err" role="alert"></div>
        <div id="${srvId}" class="dc-verify-msg dc-verify-msg--warn" role="alert"></div>
      </div>
    `;

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    const input = document.getElementById(inputId);
    const errorDiv = document.getElementById(errId);
    const serverErrDiv = document.getElementById(srvId);
    const submitBtn = document.getElementById(`dc-verify-submit-${sid}`);
    const cancelBtn = document.getElementById(`dc-verify-cancel-${sid}`);
    const toggleBtn = document.getElementById(`dc-verify-toggle-${sid}`);
    const submitDefaultHtml = submitBtn.innerHTML;

    let resolved = false;

    function showError(kind, text) {
      errorDiv.textContent = '';
      serverErrDiv.textContent = '';
      errorDiv.style.display = 'none';
      serverErrDiv.style.display = 'none';
      input.setAttribute('aria-invalid', 'false');
      input.removeAttribute('aria-errormessage');
      if (!text) return;
      if (kind === 'server') {
        serverErrDiv.textContent = text;
        serverErrDiv.style.display = 'block';
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-errormessage', srvId);
      } else {
        errorDiv.textContent = text;
        errorDiv.style.display = 'block';
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-errormessage', errId);
      }
    }

    function cleanup() {
      document.removeEventListener('keydown', onDocKeydown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      if (previousActive && typeof previousActive.focus === 'function') {
        try {
          previousActive.focus();
        } catch (_) {}
      }
    }

    function finish(value) {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(value);
    }

    function onDocKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = panel.querySelectorAll(focusableSelector());
      const list = Array.from(nodes).filter(
        (el) => el.offsetParent !== null && !el.disabled
      );
      if (list.length === 0) return;
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
      if (resolved) return;
      if (!panel.contains(e.target)) {
        e.preventDefault();
        input.focus();
      }
    }

    document.addEventListener('keydown', onDocKeydown, true);
    document.addEventListener('focusin', onFocusIn, true);

    let passwordVisible = false;
    toggleBtn.addEventListener('click', () => {
      passwordVisible = !passwordVisible;
      input.type = passwordVisible ? 'text' : 'password';
      toggleBtn.setAttribute('aria-pressed', passwordVisible ? 'true' : 'false');
      toggleBtn.setAttribute('aria-label', passwordVisible ? 'Hide password' : 'Show password');
      toggleBtn.title = passwordVisible ? 'Hide password' : 'Show password';
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        icon.className = passwordVisible ? 'bi bi-eye-slash' : 'bi bi-eye';
      }
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(false);
    });

    cancelBtn.addEventListener('click', () => finish(false));

    const checkPassword = async () => {
      if (submitBtn.disabled || resolved) return;
      const enteredPassword = input.value;
      showError(null, '');
      panel.setAttribute('aria-busy', 'true');
      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="dc-verify-spinner" aria-hidden="true"></span> Verifying…';

      const { ok, serverError } = await verifyPasswordWithServer(userId, enteredPassword.trim());

      panel.removeAttribute('aria-busy');
      submitBtn.innerHTML = submitDefaultHtml;
      submitBtn.disabled = false;
      cancelBtn.disabled = false;

      if (ok) {
        markUserVerified(userId);
        finish(true);
        return;
      }

      if (serverError) {
        showError(
          'server',
          'Could not verify (network or server). Try again later.'
        );
        input.focus();
        return;
      }

      showError('field', 'Incorrect password. Try again.');
      input.value = '';
      input.focus();
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (!reduceMotion) {
        panel.classList.remove('dc-verify-shake-anim');
        void panel.offsetWidth;
        panel.classList.add('dc-verify-shake-anim');
      }
    };

    submitBtn.addEventListener('click', () => {
      checkPassword();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkPassword();
      }
    });

    requestAnimationFrame(() => {
      input.focus();
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.addEventListener('userChanged', () => {
  clearVerification();
});

window.verifyUserPassword = verifyUserPassword;
window.clearUserVerification = clearVerification;
window.verifyPasswordWithServer = verifyPasswordWithServer;
