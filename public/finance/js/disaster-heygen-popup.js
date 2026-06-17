/**
 * Unified Disasters shirt / booth popup — ?demo=heygen or ?short=1
 * Development work by David Lane
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

  function fullDashboardUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    url.searchParams.delete('short');
    return url.pathname + (url.search || '');
  }

  function hideLoadingOverlay() {
    document.getElementById('roadRunnerLoading')?.classList.add('hidden');
    document.body.classList.add('du-demo-popup-active');
  }

  function showModal(videoUrl, title) {
    const root = document.createElement('div');
    root.id = 'duHeygenDemoModal';
    root.className = 'du-heygen-demo-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', title || 'Unified Disasters demo');
    root.innerHTML = `
      <div class="du-heygen-demo-backdrop"></div>
      <div class="du-heygen-demo-panel">
        <header class="du-heygen-demo-header">
          <h2 class="h5 mb-0">${esc(title || 'Unified Disasters')}</h2>
          <button type="button" class="btn-close" id="duHeygenDemoClose" aria-label="Close demo"></button>
        </header>
        <div class="du-heygen-demo-body">
          <video class="du-heygen-demo-video" id="duHeygenDemoVideo" controls playsinline autoplay preload="auto" src="${esc(videoUrl)}"></video>
        </div>
        <footer class="du-heygen-demo-footer">
          <a class="btn btn-primary btn-lg w-100" id="duHeygenDemoCta" href="${esc(fullDashboardUrl())}">
            <i class="bi bi-shield-exclamation me-2"></i>Open Unified Disasters
          </a>
          <p class="small text-muted text-center mb-0 mt-2">Avatar narration powered by HeyGen · Development by David E Lane</p>
        </footer>
      </div>`;
    document.body.appendChild(root);

    function closeModal() {
      document.getElementById('duHeygenDemoVideo')?.pause();
      root.remove();
      document.body.classList.remove('du-demo-popup-active');
    }

    root.querySelector('#duHeygenDemoClose')?.addEventListener('click', closeModal);
    root.querySelector('.du-heygen-demo-backdrop')?.addEventListener('click', closeModal);
    document.addEventListener(
      'keydown',
      function onKey(e) {
        if (e.key === 'Escape' && document.getElementById('duHeygenDemoModal')) {
          closeModal();
          document.removeEventListener('keydown', onKey);
        }
      },
      { once: false }
    );
  }

  async function init() {
    if (!isDemoPopup()) return;
    window.__DU_POPUP_DEMO__ = true;
    hideLoadingOverlay();

    let demo = null;
    try {
      const res = await fetch('/data/disaster-heygen-demo.json');
      demo = await res.json();
    } catch (_) {
      /* catalog missing */
    }

    const videoUrl = demo?.heygenVideoLocal || demo?.heygenVideoUrl;
    if (!videoUrl) {
      const banner = document.createElement('div');
      banner.className = 'alert alert-warning m-3';
      banner.textContent =
        'Demo video not cached yet. Run scripts/tools/generate-disaster-heygen-demo.mjs, then reload.';
      document.body.prepend(banner);
      return;
    }

    showModal(videoUrl, demo?.title || 'Unified Disasters Demo');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
