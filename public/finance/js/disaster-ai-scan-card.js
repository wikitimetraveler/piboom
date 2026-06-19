/**
 * Click-to-flip AI scan card with QR — disaster processor expert share
 */
(function (global) {
  'use strict';

  const qrCache = new Map();

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function generateQrDataUrl(url, size = 128) {
    if (!global.QRCode || !url) return '';
    const cacheKey = `${size}:${url}`;
    if (qrCache.has(cacheKey)) return qrCache.get(cacheKey);

    const mount = document.createElement('div');
    mount.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${size}px;height:${size}px;`;
    document.body.appendChild(mount);
    try {
      // eslint-disable-next-line no-new
      new global.QRCode(mount, { text: url, width: size, height: size });
      const canvas = mount.querySelector('canvas');
      const img = mount.querySelector('img');
      const dataUrl = canvas ? canvas.toDataURL('image/png') : (img ? img.src : '');
      qrCache.set(cacheKey, dataUrl || '');
      return dataUrl || '';
    } catch (_) {
      return '';
    } finally {
      mount.remove();
    }
  }

  function buildScanUrl(baseUrl, openAi) {
    try {
      const url = new URL(baseUrl || global.location.href, global.location.origin);
      if (openAi) url.searchParams.set('openAi', '1');
      return url.toString();
    } catch (_) {
      return String(baseUrl || global.location.href);
    }
  }

  /**
   * @param {HTMLElement} mountEl
   * @param {Object} options
   */
  function mount(mountEl, options = {}) {
    if (!mountEl) return;

    const title = options.title || 'Disaster processor expert';
    const kicker = options.kicker || 'Scan · ask · triage';
    const hint = options.hint || 'Click card to flip · scan QR on your phone';
    const imageUrl = options.imageUrl || '';
    const scanUrl = buildScanUrl(options.scanUrl, options.openAi !== false);
    const openLabel = options.openLabel || 'Open AI now';

    const artHtml = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" decoding="async" />`
      : '<i class="bi bi-robot dasc-front-icon" aria-hidden="true"></i>';

    mountEl.innerHTML = `
      <div class="dasc-wrap">
        <div class="dasc-flip-card" role="button" tabindex="0" aria-label="${escapeHtml(title)} — click to flip for QR code">
          <div class="dasc-flip-inner">
            <div class="dasc-face dasc-face--front">
              <div class="dasc-front-art">${artHtml}</div>
              <div class="dasc-front-body">
                <p class="dasc-kicker">${escapeHtml(kicker)}</p>
                <p class="dasc-title">${escapeHtml(title)}</p>
                <p class="dasc-hint"><i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i>${escapeHtml(hint)}</p>
                <button type="button" class="dasc-open-ai" data-dasc-open-ai>${escapeHtml(openLabel)}</button>
              </div>
            </div>
            <div class="dasc-face dasc-face--back">
              <div class="dasc-back-kicker">Scan to open</div>
              <div class="dasc-qr-shell">
                <img class="dasc-qr-img" alt="QR code to open disaster AI" width="118" height="118" />
              </div>
              <p class="dasc-scan-url">${escapeHtml(scanUrl)}</p>
            </div>
          </div>
        </div>
      </div>`;

    const card = mountEl.querySelector('.dasc-flip-card');
    const qrImg = mountEl.querySelector('.dasc-qr-img');
    const openBtn = mountEl.querySelector('[data-dasc-open-ai]');

    if (card) {
      card.addEventListener('click', () => card.classList.toggle('is-flipped'));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.classList.toggle('is-flipped');
        }
      });
    }

    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof options.onOpenAi === 'function') {
          options.onOpenAi();
        } else if (typeof global.openProcessorExpert === 'function') {
          global.openProcessorExpert();
        }
      });
    }

    const qrDataUrl = generateQrDataUrl(scanUrl);
    if (qrImg && qrDataUrl) qrImg.src = qrDataUrl;
  }

  global.DisasterAiScanCard = {
    mount,
    generateQrDataUrl,
    buildScanUrl,
  };
})(typeof window !== 'undefined' ? window : globalThis);
