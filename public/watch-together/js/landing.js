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
    return window.WatchTogetherGate?.getName?.() || '';
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
      onUnlock: goTheater,
    });
    gateHost.appendChild(overlay);
    overlay.querySelector('#wtGateName')?.focus();
  });
})();
