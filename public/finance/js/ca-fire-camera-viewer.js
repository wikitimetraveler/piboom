/**
 * @deprecated Use /finance/js/hazard-webcam-viewer.js — kept for pages that still reference this path.
 * Hazard webcam viewer is loaded from hazard-webcam-viewer.js when both are included; this file is a no-op if hazard script ran first.
 */
(function () {
  'use strict';
  if (typeof window.showCameraViewer === 'function') return;
  const s = document.createElement('script');
  s.src = '/finance/js/hazard-webcam-viewer.js';
  s.async = false;
  document.head.appendChild(s);
})();
