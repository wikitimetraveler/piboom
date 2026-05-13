/**
 * Lane family tools — shared footer credit.
 *
 * Scope: digital presentation, visualization, and software for book-derived
 * genealogy material (not a claim of original archival research; see primary
 * sources and citations on each experience).
 *
 * Mount: add <div data-lane-site-credit></div> before this script on each page.
 */
(function () {
  'use strict';

  var DISPLAY_NAME = 'David E Lane';
  /** Public byline (muted footer); date appended like public/index.html footer. */
  var LINE =
    'Presentation, visualization, and software by ' +
    DISPLAY_NAME +
    ' · AI-assisted development';

  function mount() {
    var roots = document.querySelectorAll('[data-lane-site-credit]');
    var dateStr = new Date().toLocaleDateString();
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      if (root.getAttribute('data-lane-site-credit-mounted')) continue;
      root.setAttribute('data-lane-site-credit-mounted', '1');
      root.classList.add('lane-site-credit-mount');
      var p = document.createElement('p');
      p.className = 'lane-site-credit mb-0';
      p.setAttribute('role', 'note');
      p.textContent = LINE + ' — ' + dateStr;
      root.appendChild(p);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
