/**
 * Sitewide click-to-expand image lightbox.
 * @see docs/FRONTEND_PATTERNS.md
 */
(function (global) {
  'use strict';

  const ROOT_ID = 'laneImageLightbox';
  const MIN_SIZE_PX = 48;

  let bound = false;
  let lastFocus = null;
  let escapeHandler = null;

  function getRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'lane-image-lightbox';
    root.setAttribute('aria-hidden', 'true');

    const backdrop = document.createElement('div');
    backdrop.className = 'lane-image-lightbox-backdrop';
    backdrop.setAttribute('data-lane-lightbox-close', '1');

    const panel = document.createElement('div');
    panel.className = 'lane-image-lightbox-panel lane-image-lightbox-panel--image';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'laneImageLightboxCaption');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'lane-image-lightbox-close';
    closeBtn.setAttribute('data-lane-lightbox-close', '1');
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\u00d7';

    const img = document.createElement('img');
    img.className = 'lane-image-lightbox-image';
    img.alt = '';

    const elementHost = document.createElement('div');
    elementHost.id = 'laneImageLightboxElementHost';
    elementHost.className = 'lane-image-lightbox-element-host';
    elementHost.hidden = true;

    const caption = document.createElement('div');
    caption.id = 'laneImageLightboxCaption';
    caption.className = 'lane-image-lightbox-caption';

    panel.append(closeBtn, img, elementHost, caption);
    root.append(backdrop, panel);
    document.body.appendChild(root);

    root.addEventListener('click', (event) => {
      if (event.target?.closest?.('[data-lane-lightbox-close]')) {
        close();
      }
    });

    return root;
  }

  function ensureEscapeHandler() {
    if (escapeHandler) return;
    escapeHandler = (event) => {
      if (event.key === 'Escape') {
        const root = document.getElementById(ROOT_ID);
        if (root?.classList.contains('is-open')) close();
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  function isIgnoredContainer(el) {
    if (!el || el.nodeType !== 1) return true;
    return Boolean(
      el.closest(
        'button, a, [data-lane-lightbox-ignore], .lane-lightbox-ignore, #loginModal, .login-user-card, .collection-media-root, modern-navbar, .lane-pdf-lightbox, .lunar-lightbox, .lane-image-lightbox, nav, .navbar'
      )
    );
  }

  function isExpandableImage(img) {
    if (!img || img.tagName !== 'IMG') return false;
    const src = (img.currentSrc || img.src || '').trim();
    if (!src || src === '#' || src.startsWith('data:')) return false;
    if (img.classList.contains('lane-pdf-thumb')) return false;
    if (img.classList.contains('lane-lightbox-ignore')) return false;
    if (img.hasAttribute('data-lane-lightbox-ignore')) return false;
    if (img.closest('#museumPosterContent.lane-poster-expandable')) return false;
    if (isIgnoredContainer(img)) return false;

    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w > 0 && w < MIN_SIZE_PX && h > 0 && h < MIN_SIZE_PX) return false;
    if (w > 0 && w < MIN_SIZE_PX) return false;

    const alt = (img.alt || '').toLowerCase();
    if (alt.includes('qr code')) return false;

    return true;
  }

  function captionForImage(img) {
    const alt = (img.getAttribute('alt') || '').trim();
    const title = (img.getAttribute('title') || '').trim();
    if (title) return title;
    if (alt) return alt;

    const mediaItem = img.closest('.museum-media-item');
    if (mediaItem) {
      const cap = mediaItem.querySelector('.museum-media-caption, .small.text-muted');
      if (cap?.textContent?.trim()) return cap.textContent.trim();
    }

    const card = img.closest('.prominent-card, article');
    if (card) {
      const h = card.querySelector('h3, h2, .h5, .h6');
      if (h?.textContent?.trim()) return h.textContent.trim();
    }

    return '';
  }

  function close() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;

    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');

    const img = root.querySelector('.lane-image-lightbox-image');
    const host = root.querySelector('.lane-image-lightbox-element-host');
    const panel = root.querySelector('.lane-image-lightbox-panel');
    const cap = root.querySelector('.lane-image-lightbox-caption');

    if (img) {
      img.hidden = false;
      img.removeAttribute('src');
      img.alt = '';
    }
    if (host) {
      host.hidden = true;
      host.innerHTML = '';
    }
    if (panel) {
      panel.classList.remove('lane-image-lightbox-panel--element');
      panel.classList.add('lane-image-lightbox-panel--image');
    }
    if (cap) cap.textContent = '';

    document.body.style.overflow = '';

    if (lastFocus && typeof lastFocus.focus === 'function') {
      try {
        lastFocus.focus();
      } catch (_) {}
    }
    lastFocus = null;
  }

  function open({ src, alt = '', caption = '' }) {
    if (!src) return;
    if (!lastFocus) lastFocus = document.activeElement;
    const root = getRoot();
    ensureEscapeHandler();

    const panel = root.querySelector('.lane-image-lightbox-panel');
    const img = root.querySelector('.lane-image-lightbox-image');
    const host = root.querySelector('.lane-image-lightbox-element-host');
    const cap = root.querySelector('.lane-image-lightbox-caption');

    if (panel) {
      panel.classList.remove('lane-image-lightbox-panel--element');
      panel.classList.add('lane-image-lightbox-panel--image');
    }
    if (host) {
      host.hidden = true;
      host.innerHTML = '';
    }
    if (img) {
      img.hidden = false;
      img.src = src;
      img.alt = alt || caption || 'Expanded image';
    }
    if (cap) cap.textContent = caption || alt || '';

    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    root.querySelector('.lane-image-lightbox-close')?.focus();
  }

  function openElement(element, { caption = '' } = {}) {
    if (!element) return;
    lastFocus = document.activeElement;
    const root = getRoot();
    ensureEscapeHandler();

    const panel = root.querySelector('.lane-image-lightbox-panel');
    const img = root.querySelector('.lane-image-lightbox-image');
    const host = root.querySelector('.lane-image-lightbox-element-host');
    const cap = root.querySelector('.lane-image-lightbox-caption');

    if (panel) {
      panel.classList.remove('lane-image-lightbox-panel--image');
      panel.classList.add('lane-image-lightbox-panel--element');
    }
    if (img) img.hidden = true;
    if (host) {
      host.hidden = false;
      host.innerHTML = '';
      host.appendChild(element.cloneNode(true));
    }
    if (cap) cap.textContent = caption || '';

    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    root.querySelector('.lane-image-lightbox-close')?.focus();
  }

  function handleDocumentClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('#museumPosterContent.lane-poster-expandable')) return;
    if (target.closest('#loginModal, .login-user-card, .collection-media-root')) return;

    const img = target.closest('img');
    if (!img || !isExpandableImage(img)) return;

    event.preventDefault();
    event.stopPropagation();

    lastFocus = img;
    open({
      src: img.currentSrc || img.src,
      alt: img.alt || '',
      caption: captionForImage(img),
    });
  }

  function init() {
    if (bound) return;
    bound = true;
    getRoot();
    ensureEscapeHandler();
    document.addEventListener('click', handleDocumentClick, true);
  }

  global.LaneImageLightbox = {
    init,
    open,
    openElement,
    close,
    get bound() {
      return bound;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
