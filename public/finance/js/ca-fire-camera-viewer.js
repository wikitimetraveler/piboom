/**
 * ALERTCalifornia fire camera viewer modal (shared by disasters-ca-cameras page).
 */
(function () {
  'use strict';

  window.cameraDataStore = window.cameraDataStore || {};

  window.openCameraViewerFromMarker = function (cameraDataKey) {
    const cameraData = window.cameraDataStore[cameraDataKey];
    if (cameraData && typeof window.showCameraViewer === 'function') {
      window.showCameraViewer(cameraData);
    }
  };

  window.showCameraViewer = function showCameraViewer(cameraData) {
    if (!cameraData) {
      alert('Error: No camera data available');
      return;
    }

    let raw = cameraData.raw || {};
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (e) {
        raw = {};
      }
    }

    const cameraUrl = raw.camera_url || raw.cameraURL || raw.CAMERA_URL || raw.cameraUrl || null;
    const networkUrl = raw.network_url || raw.networkURL || raw.NETWORK_URL || raw.networkUrl || null;
    const imageUrl = raw.image_url || raw.imageURL || raw.IMAGE_URL || raw.imageUrl || null;
    const cameraName = cameraData.title || raw.name || raw.cameraName || raw.camera_name || 'Fire Camera';
    const siteId = raw.site_id || raw.siteId || raw.SITE_ID || null;

    let feedUrl = cameraUrl || networkUrl || imageUrl;
    if (!feedUrl && siteId) {
      feedUrl = `https://cameras.alertcalifornia.org/?id=${siteId}`;
    }

    const titleEl = document.getElementById('cameraViewerTitle');
    const locEl = document.getElementById('cameraViewerLocation');
    const siteEl = document.getElementById('cameraViewerSiteId');
    const linkEl = document.getElementById('cameraViewerLink');
    const cameraFrame = document.getElementById('cameraFeedFrame');
    const cameraImg = document.getElementById('cameraFeedImg');
    const cameraError = document.getElementById('cameraFeedError');

    if (titleEl) titleEl.textContent = cameraName;
    if (locEl) {
      locEl.textContent = `${cameraData.county_name || ''}, ${cameraData.state_abbr || 'CA'}`.replace(/^,\s*/, '');
    }
    if (siteEl) siteEl.textContent = siteId || 'N/A';

    if (linkEl) {
      if (feedUrl) {
        linkEl.href = feedUrl;
        linkEl.style.display = 'inline-block';
      } else {
        linkEl.style.display = 'none';
      }
    }

    if (cameraError) cameraError.style.display = 'none';

    if (feedUrl && cameraFrame && cameraImg) {
      if (cameraUrl || networkUrl) {
        cameraFrame.src = feedUrl;
        cameraFrame.style.display = 'block';
        cameraImg.style.display = 'none';
      } else if (imageUrl) {
        cameraFrame.style.display = 'none';
        cameraImg.src = imageUrl + (imageUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        cameraImg.style.display = 'block';
        if (window.cameraRefreshInterval) clearInterval(window.cameraRefreshInterval);
        window.cameraRefreshInterval = setInterval(() => {
          cameraImg.src = imageUrl + (imageUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        }, 30000);
      } else {
        cameraError.textContent = 'Camera feed URL not available';
        cameraError.style.display = 'block';
        cameraFrame.style.display = 'none';
        cameraImg.style.display = 'none';
      }
    } else if (cameraError) {
      cameraError.textContent = 'No camera feed URL found for this camera';
      cameraError.style.display = 'block';
    }

    const modalEl = document.getElementById('cameraViewerModal');
    if (modalEl && window.bootstrap) {
      const cameraModal = bootstrap.Modal.getOrCreateInstance(modalEl);
      cameraModal.show();
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    const modalEl = document.getElementById('cameraViewerModal');
    if (!modalEl) return;
    modalEl.addEventListener('hidden.bs.modal', function () {
      if (window.cameraRefreshInterval) {
        clearInterval(window.cameraRefreshInterval);
        window.cameraRefreshInterval = null;
      }
      const frame = document.getElementById('cameraFeedFrame');
      if (frame) frame.src = '';
    });
  });
})();
