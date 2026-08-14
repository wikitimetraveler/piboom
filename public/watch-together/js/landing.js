/**
 * Development work by David Lane
 */
(function () {
  'use strict';

  const enterBtn = document.getElementById('wtEnter');

  function goTheater() {
    window.location.href = '/watch-together/theater.html';
  }

  enterBtn?.addEventListener('click', () => {
    const loggedIn = typeof window.getLoggedInUser === 'function' ? window.getLoggedInUser() : null;
    if (loggedIn?.name) window.WatchTogetherGate?.setName(loggedIn.name);
    goTheater();
  });
})();
