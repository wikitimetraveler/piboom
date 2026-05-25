/**
 * Multi-source hazard webcam viewer (ALERTCalifornia, USGS, WebCOOS, UCSD).
 * Still-image only in the modal — live feeds open via "Open source page".
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
      usgs_volcano: 'USGS / AVO Volcano',
      faa_weathercam: 'FAA WeatherCams',
      webcoos: 'NOAA WebCOOS',
      ucsd_hpwren: 'HPWREN / UCSD',
      ucsd_pier: 'Scripps COOL Lab',
    };
    return map[source] || source || 'Webcam';
  }

  function isDeadFaaLegacyUrl(url) {
    return /avcams(?:plus)?\.faa\.gov/i.test(String(url || ''));
  }

  function sanitizeExternalUrl(url) {
    if (!url || isDeadFaaLegacyUrl(url)) return null;
    return url;
  }

  function sanitizeImageUrl(url) {
    if (!url || isDeadFaaLegacyUrl(url)) return null;
    return url;
  }

  function bustCache(url) {
    return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  }

  function showStillImage(cameraImg, cameraError, imageUrl, cameraData, feedUrl) {
    if (!imageUrl || !cameraImg) {
      if (cameraError) {
        cameraError.innerHTML = feedUrl
          ? '<i class="bi-exclamation-triangle" style="font-size: 2rem;"></i>'
            + '<p class="mt-2 mb-0">No snapshot available — use <strong>Open source page</strong> for the live feed.</p>'
          : '<i class="bi-exclamation-triangle" style="font-size: 2rem;"></i>'
            + '<p class="mt-2 mb-0">No snapshot available — try Refresh image or Open source page.</p>';
        cameraError.style.display = 'block';
      }
      if (cameraImg) cameraImg.style.display = 'none';
      return;
    }

    if (cameraError) cameraError.style.display = 'none';
    cameraImg.onerror = async () => {
      const fresh = await resolveImageUrl(cameraData);
      if (fresh && fresh !== cameraImg.src) {
        cameraImg.src = bustCache(fresh);
      } else if (cameraError) {
        cameraError.innerHTML = '<i class="bi-exclamation-triangle" style="font-size: 2rem;"></i>'
          + '<p class="mt-2 mb-0">Unable to load snapshot — use Open source page.</p>';
        cameraError.style.display = 'block';
      }
    };
    cameraImg.src = bustCache(imageUrl);
    cameraImg.style.display = 'block';

    const intervalMs = (cameraData.refresh_minutes || 10) * 60 * 1000;
    window.cameraRefreshInterval = setInterval(async () => {
      const fresh = await resolveImageUrl(cameraData);
      const next = fresh || imageUrl;
      cameraImg.src = bustCache(next);
    }, Math.min(intervalMs, 60000));
  }

  async function resolveImageUrl(cameraData) {
    const raw = parseRaw(cameraData);
    const fromStored = sanitizeImageUrl(
      cameraData.image_url
      || raw.newestImage?.imageUrl
      || raw.image_url
      || raw.imageURL
      || raw.imageUrl
    );
    if (fromStored) return fromStored;

    if (cameraData.id) {
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
    const cameraUrl = sanitizeExternalUrl(
      cameraData.camera_url ||
      raw.camera_url ||
      raw.cameraURL ||
      raw.cameraUrl ||
      null
    );
    const networkUrl = sanitizeExternalUrl(
      cameraData.network_url ||
      raw.network_url ||
      raw.networkURL ||
      raw.networkUrl ||
      null
    );
    const cameraName = cameraData.title || cameraData.name || raw.name || 'Hazard Webcam';
    const siteId = raw.site_id || raw.siteId || raw.SITE_ID || cameraData.source_id || null;
    const attribution = raw.attribution || sourceLabel(cameraData.source);

    const titleEl = document.getElementById('cameraViewerTitle');
    const locEl = document.getElementById('cameraViewerLocation');
    const siteEl = document.getElementById('cameraViewerSiteId');
    const attrEl = document.getElementById('cameraViewerAttribution');
    const linkEl = document.getElementById('cameraViewerLink');
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
    if (!feedUrl && cameraData.source === 'faa_weathercam') {
      const faaSiteId = raw.siteId || String(cameraData.source_id || '').split(':')[0];
      if (faaSiteId) feedUrl = `https://weathercams.faa.gov/site/${faaSiteId}`;
    }
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

    showStillImage(cameraImg, cameraError, imageUrl, cameraData, feedUrl);

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
      const img = document.getElementById('cameraFeedImg');
      if (img) {
        img.src = '';
        img.style.display = 'none';
      }
    });

    const refreshBtn = document.getElementById('refreshFeedImgBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async function () {
        const key = Object.keys(window.cameraDataStore || {}).find(
          (k) => window.cameraDataStore[k]?.id === activeCameraId
        );
        const cam = key ? window.cameraDataStore[key] : null;
        if (cam && typeof window.showCameraViewer === 'function') {
          await window.showCameraViewer(cam);
        } else {
          const img = document.getElementById('cameraFeedImg');
          if (img && img.src) {
            img.src = img.src.replace(/([?&])t=\d+/, '') + (img.src.includes('?') ? '&' : '?') + 't=' + Date.now();
          }
        }
      });
    }
  });
})();
