/**
 * Development work by David Lane
 */
(function () {
  'use strict';

  const enterBtn = document.getElementById('wtEnter');
  const gateHost = document.getElementById('wtGateHost');

  function goTheater() {
    window.location.href = '/watch-together/theater.html';
  }

  function suggestedName() {
    const stored = window.WatchTogetherGate?.getName?.() || '';
    if (stored) return stored;
    const loggedIn = typeof window.getLoggedInUser === 'function' ? window.getLoggedInUser() : null;
    return loggedIn?.name ? String(loggedIn.name).trim() : '';
  }

  enterBtn?.addEventListener('click', () => {
    if (window.WatchTogetherGate?.getName?.()) {
      goTheater();
      return;
    }
    if (!gateHost || !window.WatchTogetherGate?.buildNamePrompt) {
      goTheater();
      return;
    }
    gateHost.replaceChildren();
    const overlay = window.WatchTogetherGate.buildNamePrompt({
      suggested: suggestedName(),
      onCancel: () => gateHost.replaceChildren(),
      onUnlock: goTheater,
    });
    gateHost.appendChild(overlay);
    overlay.querySelector('#wtGateName')?.focus();
  });
})();
