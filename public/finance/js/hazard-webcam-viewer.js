/**
 * Multi-source hazard webcam viewer (ALERTCalifornia, USGS, WebCOOS, UCSD).
 */
(function () {
  'use strict';

  window.cameraDataStore = window.cameraDataStore || {};
  let activeCameraId = null;

  window.openCameraViewerFromMarker = function (cameraDataKey) {
    const cameraData = window.cameraDataStore[cameraDataKey];
    if (cameraData && typeof window.showCameraViewer === 'function') {
      window.showCameraViewer(cameraData);
    }
  };

  function parseRaw(cameraData) {
    let raw = cameraData.raw || {};
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (_) {
        raw = {};
      }
    }
    return raw;
  }

  function sourceLabel(source) {
    const map = {
      alertcalifornia: 'ALERTCalifornia',
      usgs_nims: 'USGS',
      usgs_volcano: 'USGS Volcano',
      webcoos: 'NOAA WebCOOS',
      ucsd_hpwren: 'HPWREN / UCSD',
      ucsd_pier: 'Scripps COOL Lab',
    };
    return map[source] || source || 'Webcam';
  }

  async function resolveImageUrl(cameraData) {
    if (cameraData.image_url) return cameraData.image_url;
    const raw = parseRaw(cameraData);
    const fromRaw = raw.image_url || raw.imageURL || raw.imageUrl;
    if (fromRaw) return fromRaw;

    if (cameraData.id && (cameraData.media_type === 'still_image' || cameraData.source === 'usgs_nims')) {
      try {
        const res = await fetch(`/api/disasters/cameras/${cameraData.id}/snapshot`);
        const json = await res.json();
        if (json.success && json.data?.image_url) return json.data.image_url;
      } catch (_) {}
    }
    return null;
  }

  window.showCameraViewer = async function showCameraViewer(cameraData) {
    if (!cameraData) {
      alert('Error: No camera data available');
      return;
    }

    activeCameraId = cameraData.id || null;
    const raw = parseRaw(cameraData);
    const cameraUrl =
      cameraData.camera_url ||
      raw.camera_url ||
      raw.cameraURL ||
      raw.cameraUrl ||
      null;
    const networkUrl =
      cameraData.network_url ||
      raw.network_url ||
      raw.networkURL ||
      raw.networkUrl ||
      null;
    const cameraName = cameraData.title || cameraData.name || raw.name || 'Hazard Webcam';
    const siteId = raw.site_id || raw.siteId || raw.SITE_ID || cameraData.source_id || null;
    const mediaType = cameraData.media_type || raw.media_type || null;
    const attribution = raw.attribution || sourceLabel(cameraData.source);

    const titleEl = document.getElementById('cameraViewerTitle');
    const locEl = document.getElementById('cameraViewerLocation');
    const siteEl = document.getElementById('cameraViewerSiteId');
    const attrEl = document.getElementById('cameraViewerAttribution');
    const linkEl = document.getElementById('cameraViewerLink');
    const cameraFrame = document.getElementById('cameraFeedFrame');
    const cameraImg = document.getElementById('cameraFeedImg');
    const cameraError = document.getElementById('cameraFeedError');

    if (titleEl) titleEl.textContent = cameraName;
    if (locEl) {
      const st = cameraData.state_abbr || raw.state_abbr || '';
      const county = cameraData.county_name || raw.county_name || '';
      locEl.textContent = [county, st].filter(Boolean).join(', ') || '—';
    }
    if (siteEl) {
      siteEl.textContent = `${sourceLabel(cameraData.source)} · ${siteId || 'N/A'}`;
    }
    if (attrEl) attrEl.textContent = attribution;

    const imageUrl = await resolveImageUrl(cameraData);
    let feedUrl = cameraUrl || networkUrl;
    if (!feedUrl && siteId && cameraData.source === 'alertcalifornia') {
      feedUrl = `https://cameras.alertcalifornia.org/?id=${siteId}`;
    }

    if (linkEl) {
      const openUrl = feedUrl || imageUrl || cameraUrl;
      if (openUrl) {
        linkEl.href = openUrl;
        linkEl.style.display = 'inline-block';
      } else {
        linkEl.style.display = 'none';
      }
    }

    if (cameraError) cameraError.style.display = 'none';
    if (window.cameraRefreshInterval) {
      clearInterval(window.cameraRefreshInterval);
      window.cameraRefreshInterval = null;
    }

    const useStill =
      mediaType === 'still_image' ||
      (!feedUrl && imageUrl) ||
      cameraData.source === 'usgs_nims' ||
      cameraData.source === 'usgs_volcano';

    if (useStill && imageUrl && cameraImg) {
      if (cameraFrame) cameraFrame.style.display = 'none';
      const bust = () => imageUrl + (imageUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
      cameraImg.src = bust();
      cameraImg.style.display = 'block';
      const intervalMs = (cameraData.refresh_minutes || 10) * 60 * 1000;
      window.cameraRefreshInterval = setInterval(async () => {
        const fresh = await resolveImageUrl(cameraData);
        cameraImg.src = (fresh || imageUrl) + ((fresh || imageUrl).includes('?') ? '&' : '?') + 't=' + Date.now();
      }, Math.min(intervalMs, 60000));
    } else if (feedUrl && cameraFrame) {
      cameraFrame.src = feedUrl;
      cameraFrame.style.display = 'block';
      if (cameraImg) cameraImg.style.display = 'none';
    } else if (cameraError) {
      cameraError.textContent = 'No camera feed URL found for this mount';
      cameraError.style.display = 'block';
      if (cameraFrame) cameraFrame.style.display = 'none';
      if (cameraImg) cameraImg.style.display = 'none';
    }

    const modalEl = document.getElementById('cameraViewerModal');
    if (modalEl && window.bootstrap) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    const modalEl = document.getElementById('cameraViewerModal');
    if (!modalEl) return;
    modalEl.addEventListener('hidden.bs.modal', function () {
      activeCameraId = null;
      if (window.cameraRefreshInterval) {
        clearInterval(window.cameraRefreshInterval);
        window.cameraRefreshInterval = null;
      }
      const frame = document.getElementById('cameraFeedFrame');
      if (frame) frame.src = '';
    });

    const refreshBtn = document.getElementById('refreshFeedImgBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async function () {
        const img = document.getElementById('cameraFeedImg');
        const key = Object.keys(window.cameraDataStore || {}).find(
          (k) => window.cameraDataStore[k]?.id === activeCameraId
        );
        const cam = key ? window.cameraDataStore[key] : null;
        if (cam && typeof window.showCameraViewer === 'function') {
          await window.showCameraViewer(cam);
        } else if (img && img.src) {
          img.src = img.src.replace(/([?&])t=\d+/, '') + (img.src.includes('?') ? '&' : '?') + 't=' + Date.now();
        }
      });
    }
  });
})();
