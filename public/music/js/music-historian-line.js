/**
 * Music Historian HeyGen line — QR landing with optional video popup.
 * Development work by David Lane
 */
(function () {
  const DATA_URL = '/data/music-heygen-demo.json';

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isAutoplayMode() {
    const q = new URLSearchParams(window.location.search).get('autoplay');
    return q === '1' || q === 'true';
  }

  function isShortMode() {
    const q = new URLSearchParams(window.location.search).get('short');
    return q === '1' || q === 'true' || isAutoplayMode();
  }

  function showPopup(title, innerHtml) {
    $('mhlPopupTitle').textContent = title;
    $('mhlPopupBody').innerHTML = innerHtml;
    $('mhlPopup').hidden = false;
  }

  function hidePopup() {
    $('mhlPopup').hidden = true;
    $('mhlPopupBody').innerHTML = '';
  }

  function resolveVideoUrl(demo) {
    return demo?.heygenVideoLocalShort || demo?.heygenVideoUrlShort || null;
  }

  function renderVideoBlock(videoUrl, demo) {
    if (videoUrl) {
      return `<video class="mhl-video" id="mhlVideo" controls playsinline preload="metadata" src="${esc(videoUrl)}"></video>`;
    }
    const script = demo?.heygenScriptShort || '';
    return `<div class="mhl-pending">
      <p class="mb-2"><i class="bi bi-camera-reels"></i> Historian clip coming soon.</p>
      <p class="mb-0 small">Paste the script from <code>docs/MUSIC_RESEARCH_HEYGEN_SCRIPT.md</code> into HeyGen, then cache the MP4.</p>
      ${script ? `<p class="small text-muted mt-2 mb-0">${esc(script)}</p>` : ''}
    </div>`;
  }

  function bindSpeech(demo) {
    $('mhlReadScript')?.addEventListener('click', () => {
      const text = demo?.heygenScriptShort;
      if (!text || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    });
  }

  function bindPopupClose() {
    $('mhlPopupClose')?.addEventListener('click', hidePopup);
    $('mhlPopup')?.addEventListener('click', (e) => {
      if (e.target === $('mhlPopup')) hidePopup();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('mhlPopup').hidden) hidePopup();
    });
  }

  async function init() {
    bindPopupClose();
    let demo = null;
    try {
      const res = await fetch(DATA_URL);
      demo = await res.json();
    } catch (_) {
      $('mhlLoading').textContent = 'Could not load Music Historian catalog.';
      return;
    }

    document.title = demo.title || 'Music Historian — DevConnect Labs';
    $('mhlTitle').textContent = demo.title || 'Music Research';
    $('mhlLede').textContent =
      'Your Historian guide to artists through era, place, and evidence — timeline, map, and chat on one page.';

    const videoUrl = resolveVideoUrl(demo);
    $('mhlPlayWrap').innerHTML = renderVideoBlock(videoUrl, demo);
    bindSpeech(demo);

    const links = (demo.relatedLinks || []).map(
      (item) =>
        `<a class="btn btn-sm btn-outline-primary" href="${esc(item.href)}">${esc(item.label)}</a>`
    );
    links.unshift(
      `<a class="btn btn-sm btn-primary" href="${esc(demo.ctaHref || '/music/music-research.html')}">${esc(demo.ctaLabel || 'Open Music Research')}</a>`
    );
    $('mhlLinks').innerHTML = links.join('');

    const brand = demo.brand || {};
    $('mhlHeygenFoot').innerHTML = `${esc(brand.attribution || 'Avatar narration powered by HeyGen')} · Development by ${esc(brand.developmentBy || 'David E Lane')}`;

    $('mhlLoading').hidden = true;
    $('mhlCard').hidden = false;

    if (isAutoplayMode() && videoUrl) {
      showPopup(
        demo.title || 'Music Research Demo',
        `<video controls playsinline autoplay preload="auto" src="${esc(videoUrl)}"></video>
         <div class="mhl-popup-foot">
           <a class="btn btn-primary btn-block w-100" href="${esc(demo.ctaHref || '/music/music-research.html')}">${esc(demo.ctaLabel || 'Open Music Research')}</a>
         </div>`
      );
    } else if (videoUrl) {
      $('mhlPlayWrap').insertAdjacentHTML(
        'beforeend',
        `<button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="mhlOpenPopup"><i class="bi bi-play-circle"></i> Watch Historian intro</button>`
      );
      $('mhlOpenPopup')?.addEventListener('click', () => {
        showPopup(
          demo.title || 'Music Research Demo',
          `<video controls playsinline autoplay preload="auto" src="${esc(videoUrl)}"></video>`
        );
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
