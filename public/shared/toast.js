/**
 * Development work by David Lane
 */
/**
 * Shared toast notification module.
 * Use showToast(message, options) or showToast(title, message, type) for backward compat.
 * @see docs/FRONTEND_PATTERNS.md
 */
(function (window) {
  'use strict';

  const CONTAINER_ID = 'sharedToastContainer';
  const DEFAULT_DURATION = 4000;

  function getContainer() {
    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      container.className = 'shared-toast-container collection-toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;max-width:400px;';
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Show a toast notification.
   * @param {string} message - Main message (or title when using 3-arg form)
   * @param {Object|string} optionsOrType - Options { type, title, duration } or type string (2nd arg)
   * @param {string|number} [typeOrMessage] - Type when 3-arg, or message when 2-arg with options
   * @param {number} [durationMs] - Duration when using 4-arg form (title, message, type, duration)
   */
  function showToast(message, optionsOrType, typeOrMessage, durationMs) {
    let title = '';
    let type = 'info';
    let duration = DEFAULT_DURATION;

    const knownTypes = ['success', 'error', 'warning', 'info'];
    if (typeof optionsOrType === 'object' && optionsOrType !== null) {
      title = optionsOrType.title || '';
      type = optionsOrType.type || 'info';
      duration = optionsOrType.duration ?? DEFAULT_DURATION;
    } else if (knownTypes.includes(message) && typeof optionsOrType === 'string' && typeof typeOrMessage === 'string') {
      type = message;
      title = optionsOrType;
      message = typeOrMessage;
      if (typeof durationMs === 'number') duration = durationMs;
    } else if (typeof optionsOrType === 'string' && typeof typeOrMessage === 'string') {
      title = message;
      message = optionsOrType;
      type = typeOrMessage || 'info';
      if (typeof durationMs === 'number') duration = durationMs;
    } else if (typeof optionsOrType === 'string' && typeof typeOrMessage === 'number') {
      type = optionsOrType;
      duration = typeOrMessage;
    } else if (typeof optionsOrType === 'string') {
      type = optionsOrType;
    }

    const typeMap = { ok: 'success', err: 'error', danger: 'error' };
    type = typeMap[type] || type;

    const container = getContainer();
    const toast = document.createElement('div');
    toast.className = `shared-toast collection-toast toast ${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    if (title) {
      toast.innerHTML = `<strong>${escapeHtml(title)}</strong><br>${escapeHtml(message)}`;
    } else {
      toast.textContent = message;
    }
    container.appendChild(toast);

    const removeToast = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(400px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    };

    const timer = setTimeout(removeToast, duration);
    toast._toastTimer = timer;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.showToast = showToast;
})(window);
