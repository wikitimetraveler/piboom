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

  enterBtn?.addEventListener('click', () => {
    if (window.WatchTogetherGate?.readUnlock()) {
      goTheater();
      return;
    }
    if (!gateHost) return;
    gateHost.replaceChildren();
    const loggedIn = typeof window.getLoggedInUser === 'function' ? window.getLoggedInUser() : null;
    if (loggedIn?.name) window.WatchTogetherGate.setName(loggedIn.name);
    const gate = window.WatchTogetherGate.buildGate({
      requireName: !loggedIn,
      onCancel: () => gateHost.replaceChildren(),
      onUnlock: goTheater,
    });
    gateHost.appendChild(gate);
    gate.querySelector('#wtGateCode')?.focus();
  });
})();
