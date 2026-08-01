/**
 * Shenango Valley guide — HeyGen avatar clip (David twin) with spoken fallback.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DEMO_URL = '/data/shenango-heygen-demo.json';
  const MODAL_ID = 'svHeygenModal';

  let cachedDemo = null;
  let activeVideo = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadDemo() {
    if (cachedDemo) return cachedDemo;
    try {
      const res = await fetch(DEMO_URL, { cache: 'no-store' });
      cachedDemo = res.ok ? await res.json() : null;
    } catch (_) {
      cachedDemo = null;
    }
    return cachedDemo;
  }

  async function resolveVideoUrl(demo) {
    const url = demo?.heygenVideoLocalShort || demo?.heygenVideoUrlShort || '';
    if (!url || typeof url !== 'string') return null;
    if (/^https?:/i.test(url)) return url;
    try {
      const head = await fetch(url, { method: 'HEAD' });
      return head.ok ? url : null;
    } catch (_) {
      return null;
    }
  }

  function closeModal() {
    activeVideo?.pause();
    activeVideo = null;
    document.getElementById(MODAL_ID)?.remove();
    window.ShenangoContent?.stopSpeech?.();
  }

  function showModal(demo, videoUrl) {
    closeModal();

    const title = demo?.title || 'Shenango Valley — Meet David';
    const script = demo?.heygenScriptShort || '';
    const attribution = demo?.brand?.attribution || 'Avatar narration powered by HeyGen';
    const devBy = demo?.brand?.developmentBy || 'David E Lane';
    const portrait =
      demo?.avatar?.portrait ||
      '/family/assets/david-lane-time-traveler-scene.png';

    const body = videoUrl
      ? `<video class="sv-heygen-video" id="svHeygenVideo" controls playsinline autoplay preload="auto" src="${esc(videoUrl)}"></video>`
      : `<div class="sv-heygen-script">
          <img src="${esc(portrait)}" width="88" height="88" alt=""/>
          <p>${esc(script)}</p>
        </div>`;

    const root = document.createElement('div');
    root.id = MODAL_ID;
    root.className = 'sv-sheet sv-heygen-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', title);
    root.innerHTML = `
      <div class="sv-sheet-backdrop" data-heygen-close></div>
      <div class="sv-sheet-panel">
        <header class="sv-sheet-header">
          <h2>${esc(title)}</h2>
          <button type="button" class="btn-close btn-close-white" data-heygen-close aria-label="Close"></button>
        </header>
        <div class="sv-sheet-body">${body}</div>
        <footer class="sv-sheet-footer">
          <button type="button" class="sv-btn sv-btn-primary sv-btn-sm" id="svHeygenCta">
            <i class="bi bi-geo-alt"></i> ${esc(demo?.ctaLabel || 'Explore the atlas')}
          </button>
          <p class="sv-heygen-credit">${esc(attribution)} · ${esc(devBy)}</p>
        </footer>
      </div>`;

    document.body.appendChild(root);
    activeVideo = root.querySelector('#svHeygenVideo');
    root.querySelectorAll('[data-heygen-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });
    root.querySelector('#svHeygenCta')?.addEventListener('click', () => {
      closeModal();
      document.getElementById('svMap')?.scrollIntoView({ behavior: 'smooth' });
    });
    document.addEventListener('keydown', function onKey(event) {
      if (event.key === 'Escape' && document.getElementById(MODAL_ID)) {
        closeModal();
        document.removeEventListener('keydown', onKey);
      }
    });

    return Boolean(videoUrl);
  }

  async function playIntro() {
    const demo = await loadDemo();
    const videoUrl = await resolveVideoUrl(demo);
    showModal(demo, videoUrl);
    if (!videoUrl) {
      await window.ShenangoContent?.speak?.(demo?.heygenScriptShort || '');
    }
    return Boolean(videoUrl);
  }

  window.ShenangoHeygen = {
    loadDemo,
    playIntro,
    stopIntro: closeModal,
    getDemo: () => cachedDemo
  };
})();
