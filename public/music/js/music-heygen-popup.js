/**
 * Music Research booth popup — ?demo=heygen or ?short=1
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

  function fullPageUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    url.searchParams.delete('short');
    url.searchParams.delete('autoplay');
    return url.pathname + (url.search || '');
  }

  function showModal(demo, videoUrl) {
    const title = demo?.title || 'Music Research Demo';
    const ctaLabel = demo?.ctaLabel || 'Open Music Research';
    const ctaHref = demo?.ctaHref || fullPageUrl();
    const attribution = demo?.brand?.attribution || 'Avatar narration powered by HeyGen';
    const devBy = demo?.brand?.developmentBy || 'David E Lane';

    const root = document.createElement('div');
    root.id = 'mrHeygenDemoModal';
    root.className = 'mr-heygen-demo-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', title);
    root.innerHTML = `
      <div class="mr-heygen-demo-backdrop"></div>
      <div class="mr-heygen-demo-panel">
        <header class="mr-heygen-demo-header">
          <h2 class="h5 mb-0"><i class="bi bi-music-note-beamed"></i> ${esc(title)}</h2>
          <button type="button" class="btn-close" id="mrHeygenDemoClose" aria-label="Close demo"></button>
        </header>
        <div class="mr-heygen-demo-body">
          <video class="mr-heygen-demo-video" id="mrHeygenDemoVideo" controls playsinline autoplay preload="auto" src="${esc(videoUrl)}"></video>
        </div>
        <footer class="mr-heygen-demo-footer">
          <a class="btn btn-primary btn-lg btn-block" id="mrHeygenDemoCta" href="${esc(ctaHref)}">
            <i class="bi bi-search"></i> ${esc(ctaLabel)}
          </a>
          <p class="small text-muted text-center mb-0 mt-2">${esc(attribution)} · Development by ${esc(devBy)}</p>
        </footer>
      </div>`;
    document.body.appendChild(root);

    function closeModal() {
      document.getElementById('mrHeygenDemoVideo')?.pause();
      root.remove();
      document.body.classList.remove('mr-demo-popup-active');
    }

    root.querySelector('#mrHeygenDemoClose')?.addEventListener('click', closeModal);
    root.querySelector('.mr-heygen-demo-backdrop')?.addEventListener('click', closeModal);
    document.addEventListener(
      'keydown',
      function onKey(e) {
        if (e.key === 'Escape' && document.getElementById('mrHeygenDemoModal')) {
          closeModal();
          document.removeEventListener('keydown', onKey);
        }
      },
      { once: false }
    );
  }

  function showPendingBanner(demo) {
    const script = demo?.heygenScriptShort || '';
    const banner = document.createElement('div');
    banner.className = 'alert alert-warning m-3';
    banner.innerHTML = `
      <strong>HeyGen demo video not cached yet.</strong>
      Paste the script from <code>docs/MUSIC_RESEARCH_HEYGEN_SCRIPT.md</code> into HeyGen Wednesday,
      then run <code>node scripts/tools/generate-music-heygen-demo.mjs --cache-local</code>
      or drop the MP4 at <code>public/music/assets/video/music-research-heygen-short.mp4</code>.
      ${script ? `<hr class="my-2"><p class="small mb-0"><strong>Script:</strong> ${esc(script)}</p>` : ''}`;
    document.body.prepend(banner);
  }

  async function init() {
    if (!isDemoPopup()) return;
    window.__MR_POPUP_DEMO__ = true;
    document.body.classList.add('mr-demo-popup-active');

    let demo = null;
    try {
      const res = await fetch('/data/music-heygen-demo.json');
      demo = await res.json();
    } catch (_) {
      /* catalog missing */
    }

    const videoUrl = demo?.heygenVideoLocalShort || demo?.heygenVideoUrlShort;
    if (!videoUrl) {
      showPendingBanner(demo);
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
