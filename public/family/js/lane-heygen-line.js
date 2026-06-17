/**
 * Lane HeyGen line — QR landing page with optional HeyGen video popup.
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

  function isShortMode() {
    const q = new URLSearchParams(window.location.search).get('short');
    return q === '1' || q === 'true';
  }

  function showPopup(title, innerHtml) {
    $('lhlPopupTitle').textContent = title;
    $('lhlPopupBody').innerHTML = innerHtml;
    $('lhlPopup').hidden = false;
  }

  function hidePopup() {
    $('lhlPopup').hidden = true;
    $('lhlPopupBody').innerHTML = '';
  }

  async function resolveVideoUrl(person) {
    const short = isShortMode();
    const local = short ? person.heygenVideoLocalShort : person.heygenVideoLocal;
    if (local) return local;
    const cached = short ? person.heygenVideoUrlShort : person.heygenVideoUrl;
    if (cached) return cached;
    const videoId = short ? person.heygenVideoIdShort : person.heygenVideoId;
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

  function scriptForPerson(person) {
    return isShortMode() && person.heygenScriptShort ? person.heygenScriptShort : person.heygenScript;
  }

  function renderVideoBlock(videoUrl, person) {
    if (videoUrl) {
      return `<video class="lhl-video" id="lhlVideo" controls playsinline autoplay preload="metadata" src="${esc(videoUrl)}"></video>`;
    }
    return `<div class="lhl-pending">
      <p class="mb-2"><i class="bi bi-camera-reels"></i> HeyGen line coming soon.</p>
      <p class="mb-0 small">Video will appear here after <code>heygenVideoUrl</code> is set in the catalog.</p>
      <button type="button" class="btn btn-sm btn-outline-primary mt-2" id="lhlReadScript">Read script with browser voice</button>
      <p class="small text-muted mt-2 mb-0">${esc(scriptForPerson(person) || '')}</p>
    </div>`;
  }

  function bindSpeech(person) {
    $('lhlReadScript')?.addEventListener('click', () => {
      const text = scriptForPerson(person);
      if (!text || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    });
  }

  async function init() {
    const slug = getSlug();
    try {
      const res = await fetch(DATA_URL);
      const catalog = await res.json();
      const person = catalog?.people?.[slug];
      if (!person) throw new Error('Unknown Lane HeyGen line.');

      document.title = `${person.name} — Lane HeyGen Line`;
      $('lhlPortrait').src = person.portraitUrl;
      $('lhlPortrait').alt = `${person.name} portrait`;
      $('lhlName').textContent = person.name;
      $('lhlYears').textContent = person.years;
      $('lhlTagline').textContent = person.tagline;

      const videoUrl = await resolveVideoUrl(person);
      $('lhlPlayWrap').innerHTML = renderVideoBlock(videoUrl, person);
      bindSpeech(person);

      const linkParts = [];
      if (person.chapterUrl) {
        const chapterLabel = person.chapterLinkLabel || 'Chapter';
        linkParts.push(
          `<a class="btn btn-sm btn-outline-dark" href="${esc(person.chapterUrl)}">${esc(chapterLabel)}</a>`
        );
      }
      if (person.museumUrl) {
        linkParts.push(
          `<a class="btn btn-sm btn-outline-secondary" href="${esc(person.museumUrl)}">Lane Museum</a>`
        );
      }
      if (person.presentationVideoUrl) {
        linkParts.push(
          `<a class="btn btn-sm btn-outline-primary" href="${esc(person.presentationVideoUrl)}" target="_blank" rel="noopener noreferrer">Watch presentation</a>`
        );
      }
      if (person.tradingCardId) {
        linkParts.push(
          `<a class="btn btn-sm btn-outline-secondary" href="/family/lane-trading-cards.html?cardId=${encodeURIComponent(person.tradingCardId)}">Trading card</a>`
        );
      }
      $('lhlLinks').innerHTML = linkParts.join('');

      $('lhlHeygenFoot').innerHTML = `${esc(catalog?.brand?.attribution || 'Avatar narration powered by HeyGen')} · <a href="${esc(catalog?.brand?.attributionUrl || 'https://www.heygen.com')}" target="_blank" rel="noopener">HeyGen</a>`;

      const devEl = $('lhlCreditsDev');
      if (devEl) {
        devEl.innerHTML = `${esc(catalog?.brand?.developmentLabel || 'Development by David E Lane')} · <a href="${esc(catalog?.brand?.attributionUrl || 'https://www.heygen.com')}" target="_blank" rel="noopener">HeyGen</a>`;
      }

      $('lhlLoading').hidden = true;
      $('lhlCard').hidden = false;

      if (videoUrl) {
        showPopup(
          `${person.name} speaks`,
          `<video class="lhl-video" controls playsinline autoplay src="${esc(videoUrl)}"></video>`
        );
      }
    } catch (err) {
      $('lhlLoading').textContent = err.message || 'Could not load.';
    }

    $('lhlPopupClose')?.addEventListener('click', hidePopup);
    $('lhlPopup')?.addEventListener('click', (e) => {
      if (e.target === $('lhlPopup')) hidePopup();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
