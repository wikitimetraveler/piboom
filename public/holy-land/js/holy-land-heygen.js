/**
 * Holy Land guide intro — HeyGen avatar clip when rendered, spoken script when not.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DEMO_URL = '/data/holy-land-heygen-demo.json';
  const MODAL_ID = 'hlHeygenModal';

  let cachedDemo = null;
  let activeVideo = null;

  const i18n = () => window.HolyLandI18N;
  const pick = (value) => (i18n() ? i18n().pick(value) : String(value?.en || value || ''));
  const t = (key) => (i18n() ? i18n().t(key) : '');

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

  /** Read a per-language slot without cross-language fallback — an Arabic viewer must not get the English read. */
  function pickStrict(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    const lang = i18n() ? i18n().lang() : 'en';
    return String(value[lang] || '');
  }

  /** Confirm a cached clip actually exists before offering the video player. */
  async function resolveVideoUrl(demo) {
    const url = pickStrict(demo?.heygenVideoLocalShort) || pickStrict(demo?.heygenVideoUrlShort);
    if (!url) return null;
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
    i18n()?.stop();
  }

  function showModal(demo, videoUrl) {
    closeModal();

    const title = pick(demo?.title) || 'Palestine · Israel — Meet Noor';
    const script = pick(demo?.heygenScriptShort);
    const attribution = pick(demo?.brand?.attribution);
    const devBy = demo?.brand?.developmentBy || 'David E Lane';
    const portrait =
      demo?.avatar?.portrait || '/holy-land/assets/noor-guide-portrait-256.png';

    const body = videoUrl
      ? `<video class="hl-heygen-video" id="hlHeygenVideo" controls playsinline autoplay preload="auto" src="${esc(videoUrl)}"></video>`
      : `<div class="hl-heygen-script">
          <img src="${esc(portrait)}" width="88" height="88" alt=""/>
          <p>${esc(script)}</p>
        </div>`;

    const root = document.createElement('div');
    root.id = MODAL_ID;
    root.className = 'hl-sheet hl-heygen-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', title);
    root.setAttribute('dir', i18n()?.isRtl() ? 'rtl' : 'ltr');
    root.innerHTML = `
      <div class="hl-sheet-backdrop" data-heygen-close></div>
      <div class="hl-sheet-panel">
        <header class="hl-sheet-header">
          <h2>${esc(title)}</h2>
          <button type="button" class="btn-close btn-close-white" data-heygen-close aria-label="${esc(t('close') || 'Close')}"></button>
        </header>
        <div class="hl-sheet-body">${body}</div>
        <footer class="hl-sheet-footer">
          <button type="button" class="hl-btn hl-btn-primary hl-btn-sm" id="hlHeygenCta">
            <i class="bi bi-film"></i> ${esc(pick(demo?.ctaLabel) || t('playReel'))}
          </button>
          <p class="hl-heygen-credit">${esc(attribution)} · ${esc(devBy)}</p>
        </footer>
      </div>`;

    document.body.appendChild(root);

    activeVideo = root.querySelector('#hlHeygenVideo');
    root.querySelectorAll('[data-heygen-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });
    root.querySelector('#hlHeygenCta')?.addEventListener('click', () => {
      closeModal();
      window.HolyLandStoryReel?.play?.();
    });
    document.addEventListener('keydown', function onKey(event) {
      if (event.key === 'Escape' && document.getElementById(MODAL_ID)) {
        closeModal();
        document.removeEventListener('keydown', onKey);
      }
    });

    return Boolean(videoUrl);
  }

  function fallbackDemo() {
    return {
      title: { en: 'Palestine · Israel — Meet Noor', ar: 'فلسطين · إسرائيل — تعرّف على نور' },
      heygenScriptShort: {
        en: 'Ahlan wa sahlan — I am Noor. Walk with me across shared ground: sacred stones, olive terraces, the table, and the songs still sung here.',
        ar: 'أهلاً وسهلاً — أنا نور. امشِ معي على أرض مشتركة: حجر مقدّس، ومدرجات زيتون، ومائدة، وأغانٍ ما زالت تُغنَّى هنا.'
      },
      ctaLabel: { en: 'Start the tour', ar: 'ابدأ الجولة' },
      brand: {
        attribution: { en: 'Guide narration', ar: 'سرد الدليل' },
        developmentBy: 'David E Lane'
      },
      avatar: { portrait: '/holy-land/assets/noor-guide-portrait-256.png' }
    };
  }

  /** Play the avatar clip if it is rendered; otherwise speak the same script. */
  async function playIntro() {
    const demo = (await loadDemo()) || fallbackDemo();
    const videoUrl = await resolveVideoUrl(demo);
    showModal(demo, videoUrl);
    if (!videoUrl) {
      i18n()?.unlockAudio();
      await i18n()?.speakAsGuide(pick(demo?.heygenScriptShort));
    }
    return Boolean(videoUrl);
  }

  function bindMeetGuide() {
    document.getElementById('hlMeetGuide')?.addEventListener('click', () => {
      i18n()?.unlockAudio();
      playIntro();
    });
  }

  function maybeAutoDemo() {
    try {
      if (new URLSearchParams(window.location.search).get('demo') === 'heygen') {
        window.setTimeout(() => playIntro(), 600);
      }
    } catch (_) {
      /* ignore */
    }
  }

  function init() {
    bindMeetGuide();
    maybeAutoDemo();
  }

  window.HolyLandHeyGen = {
    loadDemo,
    playIntro,
    stopIntro: closeModal,
    getDemo: () => cachedDemo
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
