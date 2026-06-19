/**
 * Lane HyperFrame line — QR landing with story reel (HyperFrame MP4) + HeyGen fallback.
 * Development work by David Lane
 */
(function () {
  const DATA_URL = '/data/lane-heygen-lines.json';

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

  function getSlug() {
    return new URLSearchParams(window.location.search).get('person') || 'jonathan-homer-lane';
  }

  function showPopup(title, innerHtml) {
    $('lhfPopupTitle').textContent = title;
    $('lhfPopupBody').innerHTML = innerHtml;
    $('lhfPopup').hidden = false;
  }

  function hidePopup() {
    $('lhfPopup').hidden = true;
    $('lhfPopupBody').innerHTML = '';
  }

  async function resolveHeygenVideoUrl(person) {
    const local = person.heygenVideoLocalShort || person.heygenVideoLocal;
    if (local) return local;
    const cached = person.heygenVideoUrlShort || person.heygenVideoUrl;
    if (cached) return cached;
    const videoId = person.heygenVideoIdShort || person.heygenVideoId;
    if (!videoId) return null;
    try {
      const res = await fetch(`/api/heygen/videos/${encodeURIComponent(videoId)}`);
      const json = await res.json();
      if (json.videoUrl) return json.videoUrl;
      if (json.status === 'completed' && json.data?.video_url) return json.data.video_url;
    } catch (_) {
      /* offline or not configured */
    }
    return null;
  }

  function primaryStoryUrl(person) {
    return person.hyperframeVideoUrl || person.presentationVideoUrl || null;
  }

  function renderPlayBlock(storyUrl, heygenUrl, person) {
    if (storyUrl) {
      return `<video class="lhf-video" id="lhfStoryVideo" controls playsinline autoplay preload="metadata" src="${esc(storyUrl)}"></video>`;
    }
    if (heygenUrl) {
      return `<video class="lhf-video" id="lhfStoryVideo" controls playsinline autoplay preload="metadata" src="${esc(heygenUrl)}"></video>`;
    }
    const script = person.heygenScriptShort || person.heygenScript || '';
    return `<div class="lhf-pending">
      <p class="mb-2"><i class="bi bi-film"></i> HyperFrame story coming soon.</p>
      <p class="mb-0 small">After you render the composition, set <code>hyperframeVideoUrl</code> in the catalog.</p>
      ${script ? `<p class="small text-muted mt-2 mb-0">${esc(script)}</p>` : ''}
    </div>`;
  }

  async function init() {
    const slug = getSlug();
    if (slug === 'jonathan-homer-lane') {
      window.location.replace('/family/lane-scientific-lane.html?story=1');
      return;
    }
    try {
      const res = await fetch(DATA_URL);
      const catalog = await res.json();
      const person = catalog?.people?.[slug];
      if (!person) throw new Error('Unknown Lane HyperFrame line.');

      document.title = `${person.name} — Lane HyperFrame`;
      $('lhfPortrait').src = person.portraitUrl;
      $('lhfPortrait').alt = `${person.name} portrait`;
      $('lhfName').textContent = person.name;
      $('lhfYears').textContent = person.years || '';
      $('lhfTagline').textContent = person.tagline || '';

      const storyUrl = primaryStoryUrl(person);
      const heygenUrl = storyUrl ? null : await resolveHeygenVideoUrl(person);
      $('lhfPlayWrap').innerHTML = renderPlayBlock(storyUrl, heygenUrl, person);

      const linkParts = [];
      if (person.chapterUrl) {
        const chapterLabel = person.chapterLinkLabel || 'Open chapter';
        linkParts.push(
          `<a class="btn btn-sm btn-outline-light" href="${esc(person.chapterUrl)}">${esc(chapterLabel)}</a>`
        );
      }
      if (person.museumUrl) {
        linkParts.push(
          `<a class="btn btn-sm btn-outline-secondary" href="${esc(person.museumUrl)}">Lane Museum</a>`
        );
      }
      if (person.tradingCardId) {
        linkParts.push(
          `<a class="btn btn-sm btn-outline-secondary" href="/family/lane-trading-cards.html?cardId=${encodeURIComponent(person.tradingCardId)}">Trading card</a>`
        );
      }
      $('lhfLinks').innerHTML = linkParts.join('');

      const devEl = $('lhfCreditsDev');
      if (devEl) {
        devEl.textContent = catalog?.brand?.developmentLabel || 'Development by David E Lane';
      }

      $('lhfLoading').hidden = true;
      $('lhfCard').hidden = false;

      const popupVideo = storyUrl || heygenUrl;
      if (popupVideo) {
        showPopup(
          `${person.name} — story reel`,
          `<video class="lhf-video" controls playsinline autoplay src="${esc(popupVideo)}"></video>`
        );
      }
    } catch (err) {
      $('lhfLoading').textContent = err.message || 'Could not load.';
    }

    $('lhfPopupClose')?.addEventListener('click', hidePopup);
    $('lhfPopup')?.addEventListener('click', (e) => {
      if (e.target === $('lhfPopup')) hidePopup();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
