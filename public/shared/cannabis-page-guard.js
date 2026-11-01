/**
 * Login wall for cannabis pages (Mountain High). Origins keeps its own password gate.
 * Development work by David Lane
 */
(function () {
  'use strict';

  function currentPath() {
    return String(window.location.pathname || '').toLowerCase();
  }

  function isCannabisPage() {
    const path = currentPath();
    return path === '/mountain-high' || path.indexOf('/mountain-high/') === 0;
  }

  function hasLogin() {
    try {
      return !!localStorage.getItem('loggedInUserId');
    } catch (e) {
      return false;
    }
  }

  if (!isCannabisPage() || hasLogin()) return;

  document.documentElement.classList.add('cannabis-auth-locked');

  const style = document.createElement('style');
  style.id = 'cannabisAuthLockStyle';
  style.textContent = [
    'html.cannabis-auth-locked body > *:not(#loginModal):not(#cannabisAuthOverlay){visibility:hidden !important;}',
    '#cannabisAuthOverlay{position:fixed;inset:0;z-index:13000;display:flex;align-items:center;justify-content:center;padding:1.5rem;',
    'background:rgba(12,22,14,0.94);visibility:visible !important;}',
    '#cannabisAuthOverlay .cannabis-auth-card{max-width:420px;width:100%;background:#1a2e1c;color:#e8f0e4;',
    'border:1px solid rgba(120,180,100,0.25);border-radius:1rem;padding:2rem;text-align:center;}',
    '#cannabisAuthOverlay h1{margin:0 0 .5rem;font-size:1.35rem;}',
    '#cannabisAuthOverlay p{margin:0 0 1.25rem;color:#a8c4a0;}',
    '#cannabisAuthOverlay button{width:100%;padding:.75rem 1rem;border:0;border-radius:.5rem;cursor:pointer;',
    'background:#3d7a4a;color:#fff;font-weight:700;}'
  ].join('');
  document.documentElement.appendChild(style);

  function unlock() {
    document.documentElement.classList.remove('cannabis-auth-locked');
    const overlay = document.getElementById('cannabisAuthOverlay');
    if (overlay) overlay.remove();
    if (style.parentNode) style.remove();
  }

  function showOverlay() {
    if (document.getElementById('cannabisAuthOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'cannabisAuthOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'cannabisAuthTitle');
    overlay.innerHTML =
      '<div class="cannabis-auth-card">' +
      '<h1 id="cannabisAuthTitle">Sign in</h1>' +
      '<p>This page stays hidden until you log in.</p>' +
      '<button type="button" id="cannabisAuthLogin">Log in</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#cannabisAuthLogin').addEventListener('click', function () {
      if (typeof window.showLoginPopup === 'function') window.showLoginPopup();
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(script);
    });
  }

  async function start() {
    showOverlay();
    try {
      if (!window.DEMO_USERS) await loadScript('/shared/demo-users.js');
      if (!window.isLoggedIn || !window.showLoginPopup) await loadScript('/shared/user-login.js');
    } catch (err) {
      console.error('Cannabis page guard failed to load login', err);
    }
    if (typeof window.isLoggedIn === 'function' && window.isLoggedIn()) {
      unlock();
      return;
    }
    if (typeof window.showLoginPopup === 'function') window.showLoginPopup();
  }

  window.addEventListener('user-logged-in', unlock);
  window.addEventListener('storage', function (event) {
    if ((!event.key || event.key === 'loggedInUserId') && hasLogin()) unlock();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
