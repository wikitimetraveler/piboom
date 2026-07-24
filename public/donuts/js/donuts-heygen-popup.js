/**
 * Glazed booth HeyGen popup — ?demo=heygen or ?short=1, plus in-page Meet Pip
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DEMO_RE = /[?&](?:demo=heygen|short=1)(?:&|$)/;
  const DEMO_URL = '/data/donuts-heygen-demo.json';
  let cachedDemo = null;
  let activeVideo = null;

  function isDemoPopup() {
    return DEMO_RE.test(window.location.search);
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fullPageUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    url.searchParams.delete('short');
    url.searchParams.delete('autoplay');
    return url.pathname + (url.search || '');
  }

  async function loadDemo() {
    if (cachedDemo) return cachedDemo;
    try {
      const res = await fetch(DEMO_URL, { cache: 'no-store' });
      cachedDemo = await res.json();
    } catch (_) {
      cachedDemo = null;
    }
    return cachedDemo;
  }

  function closeModal() {
    activeVideo?.pause();
    activeVideo = null;
    document.getElementById('gzHeygenDemoModal')?.remove();
    document.body.classList.remove('gz-demo-popup-active');
  }

  function showModal(demo, videoUrl, { autoplay = true } = {}) {
    closeModal();

    const title = demo?.title || 'Glazed — Meet Pip';
    const ctaLabel = demo?.ctaLabel || 'Browse the donuts';
    const ctaHref = demo?.ctaHref || fullPageUrl();
    const attribution = demo?.brand?.attribution || 'Avatar narration powered by HeyGen';
    const devBy = demo?.brand?.developmentBy || 'David E Lane';

    const root = document.createElement('div');
    root.id = 'gzHeygenDemoModal';
    root.className = 'gz-heygen-demo-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', title);

    const bodyInner = videoUrl
      ? `<video class="gz-heygen-demo-video" id="gzHeygenDemoVideo" controls playsinline ${autoplay ? 'autoplay' : ''} preload="auto" src="${esc(videoUrl)}"></video>`
      : `<div class="gz-heygen-demo-pending">
          <strong>Pip’s HeyGen intro isn’t cached yet.</strong>
          <p class="mb-2 mt-2">Run <code>node scripts/tools/create-pip-heygen-avatar.mjs --video-only --cache-local</code>.</p>
          ${demo?.heygenScriptShort ? `<p class="mb-0"><strong>Script:</strong> ${esc(demo.heygenScriptShort)}</p>` : ''}
        </div>`;

    root.innerHTML = `
      <div class="gz-heygen-demo-backdrop"></div>
      <div class="gz-heygen-demo-panel">
        <header class="gz-heygen-demo-header">
          <h2>${esc(title)}</h2>
          <button type="button" class="btn-close" id="gzHeygenDemoClose" aria-label="Close demo"></button>
        </header>
        <div class="gz-heygen-demo-body">${bodyInner}</div>
        <footer class="gz-heygen-demo-footer">
          <a class="gz-btn gz-btn-primary" id="gzHeygenDemoCta" href="${esc(ctaHref)}">
            <i class="bi bi-stars"></i> ${esc(ctaLabel)}
          </a>
          <p class="small text-center mb-0 mt-2">${esc(attribution)} · Development by ${esc(devBy)}</p>
        </footer>
      </div>`;
    document.body.appendChild(root);
    document.body.classList.add('gz-demo-popup-active');

    activeVideo = root.querySelector('#gzHeygenDemoVideo');
    root.querySelector('#gzHeygenDemoClose')?.addEventListener('click', closeModal);
    root.querySelector('.gz-heygen-demo-backdrop')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' && document.getElementById('gzHeygenDemoModal')) {
        closeModal();
        document.removeEventListener('keydown', onKey);
      }
    });

    return Boolean(videoUrl);
  }

  async function playIntro() {
    const demo = await loadDemo();
    const videoUrl = demo?.heygenVideoLocalShort || demo?.heygenVideoUrlShort || null;
    return showModal(demo, videoUrl, { autoplay: true });
  }

  function stopIntro() {
    closeModal();
  }

  async function init() {
    window.GlazedHeygen = {
      loadDemo,
      playIntro,
      stopIntro,
      getDemo: () => cachedDemo
    };

    if (!isDemoPopup()) return;
    document.body.classList.add('gz-demo-popup-active');
    await playIntro();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
