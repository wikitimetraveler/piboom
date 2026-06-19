/**
 * Lane Family quick-start guide — QR landing with tutorial video.
 * Development work by David Lane
 */
(function () {
  const DATA_URL = '/data/lane-family-guide.json';

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

  function isAutoplayQr() {
    return new URLSearchParams(window.location.search).get('autoplay') === '1';
  }

  function showPopup(title, innerHtml) {
    $('lfgPopupTitle').textContent = title;
    $('lfgPopupBody').innerHTML = innerHtml;
    $('lfgPopup').hidden = false;
  }

  function hidePopup() {
    $('lfgPopup').hidden = true;
    $('lfgPopupBody').innerHTML = '';
  }

  async function resolveVideoUrl(guide) {
    const local = guide.heygenVideoLocalShort || guide.heygenVideoLocal;
    if (local) return local;
    const cached = guide.heygenVideoUrlShort || guide.heygenVideoUrl;
    if (cached && cached.startsWith('/')) return cached;
    if (cached) return cached;
    const videoId = guide.heygenVideoIdShort || guide.heygenVideoId;
    if (!videoId) return null;
    try {
      const res = await fetch(`/api/heygen/videos/${encodeURIComponent(videoId)}`);
      const json = await res.json();
      if (json.videoUrl) return json.videoUrl;
      if (json.status === 'completed' && json.data?.video_url) return json.data.video_url;
    } catch (_) {
      /* offline */
    }
    return null;
  }

  function renderSteps(steps) {
    const host = $('lfgSteps');
    if (!host || !Array.isArray(steps)) return;
    host.innerHTML = steps
      .map(
        (step) => `<li class="lfg-step">
          <span class="lfg-step-n" aria-hidden="true">${esc(step.n)}</span>
          <div>
            <p class="lfg-step-title"><a href="${esc(step.href)}">${esc(step.title)}</a></p>
            <p class="lfg-step-body">${esc(step.body)}</p>
          </div>
        </li>`
      )
      .join('');
  }

  async function init() {
    try {
      const res = await fetch(DATA_URL);
      const guide = await res.json();
      document.title = `${guide.title || 'Lane Family guide'} — DevConnect Labs`;

      $('lfgKicker').textContent = guide.kicker || 'Quick start';
      $('lfgTitle').textContent = guide.title || 'Lane Family · Quick start';
      $('lfgTagline').textContent = guide.tagline || '';

      const hero = $('lfgHero');
      if (hero && guide.portraitUrl) {
        hero.style.backgroundImage = `url("${guide.portraitUrl}")`;
      }

      renderSteps(guide.steps);

      const videoUrl = await resolveVideoUrl(guide);
      const video = $('lfgVideo');
      const wrap = $('lfgVideoWrap');
      const popupTitle = guide.heygenTitle || guide.title || 'David Lane · HeyGen';
      if (videoUrl && video && wrap) {
        video.src = videoUrl;
        wrap.hidden = false;
        if (isAutoplayQr()) {
          showPopup(
            popupTitle,
            `<video class="lfg-video lfg-popup-video" controls playsinline autoplay preload="metadata" src="${esc(videoUrl)}"></video>`
          );
        }
      }

      const share = $('lfgShareCard');
      const shareImg = $('lfgShareCardImg');
      if (share && shareImg && guide.cardImageUrl) {
        shareImg.src = guide.cardImageUrl;
        if (new URLSearchParams(window.location.search).get('card') === '1') {
          share.hidden = false;
        }
      }

      $('lfgCreditsDev').textContent = 'Development by David E Lane';
    } catch (err) {
      $('lfgTagline').textContent = err.message || 'Could not load guide.';
    }

    $('lfgPopupClose')?.addEventListener('click', hidePopup);
    $('lfgPopup')?.addEventListener('click', (e) => {
      if (e.target === $('lfgPopup')) hidePopup();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
