/**
 * Finance booth HeyGen popup — ?demo=heygen or ?short=1
 * Set data-finance-heygen-demo on the script tag to the JSON catalog path.
 */
(function () {
  const DEMO_RE = /[?&](?:demo=heygen|short=1)(?:&|$)/;

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

  function catalogPath() {
    const script = document.currentScript;
    return script?.getAttribute('data-finance-heygen-demo') || '';
  }

  function showModal(demo, videoUrl) {
    const title = demo?.title || demo?.heygenTitle || 'Finance Demo';
    const ctaLabel = demo?.ctaLabel || 'Open tool';
    const ctaHref = demo?.ctaHref || fullPageUrl();
    const attribution = demo?.brand?.attribution || 'Avatar narration powered by HeyGen';
    const devBy = demo?.brand?.developmentBy || 'David E Lane';

    const root = document.createElement('div');
    root.id = 'fiHeygenDemoModal';
    root.className = 'fi-heygen-demo-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', title);
    root.innerHTML = `
      <div class="fi-heygen-demo-backdrop"></div>
      <div class="fi-heygen-demo-panel">
        <header class="fi-heygen-demo-header">
          <h2 class="h5 mb-0">${esc(title)}</h2>
          <button type="button" class="btn-close" id="fiHeygenDemoClose" aria-label="Close demo"></button>
        </header>
        <div class="fi-heygen-demo-body">
          <video class="fi-heygen-demo-video" id="fiHeygenDemoVideo" controls playsinline autoplay preload="auto" src="${esc(videoUrl)}"></video>
        </div>
        <footer class="fi-heygen-demo-footer">
          <a class="btn btn-primary btn-lg w-100" id="fiHeygenDemoCta" href="${esc(ctaHref)}">
            ${esc(ctaLabel)}
          </a>
          <p class="small text-muted text-center mb-0 mt-2">${esc(attribution)} · Development by ${esc(devBy)}</p>
        </footer>
      </div>`;
    document.body.appendChild(root);

    function closeModal() {
      document.getElementById('fiHeygenDemoVideo')?.pause();
      root.remove();
      document.body.classList.remove('fi-demo-popup-active');
    }

    root.querySelector('#fiHeygenDemoClose')?.addEventListener('click', closeModal);
    root.querySelector('.fi-heygen-demo-backdrop')?.addEventListener('click', closeModal);
    document.addEventListener(
      'keydown',
      function onKey(e) {
        if (e.key === 'Escape' && document.getElementById('fiHeygenDemoModal')) {
          closeModal();
          document.removeEventListener('keydown', onKey);
        }
      },
      { once: false }
    );
  }

  function showPendingBanner(demo, jsonPath) {
    const script = demo?.heygenScriptShort || '';
    const banner = document.createElement('div');
    banner.className = 'alert alert-warning m-3';
    banner.innerHTML = `
      <strong>HeyGen demo video not cached yet.</strong>
      Run <code>npm run generate:finance-heygen-demo -- --demo … --force --direct --cache-local</code>
      or drop the MP4 referenced in <code>${esc(jsonPath)}</code>.
      ${script ? `<hr class="my-2"><p class="small mb-0"><strong>Script:</strong> ${esc(script)}</p>` : ''}`;
    document.body.prepend(banner);
  }

  async function init() {
    if (!isDemoPopup()) return;
    const jsonPath = catalogPath();
    if (!jsonPath) return;

    window.__FI_POPUP_DEMO__ = true;
    document.body.classList.add('fi-demo-popup-active');

    let demo = null;
    try {
      const res = await fetch(jsonPath);
      demo = await res.json();
    } catch (_) {
      /* catalog missing */
    }

    const videoUrl = demo?.heygenVideoLocalShort || demo?.heygenVideoUrlShort;
    if (!videoUrl) {
      showPendingBanner(demo, jsonPath);
      return;
    }

    showModal(demo, videoUrl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
