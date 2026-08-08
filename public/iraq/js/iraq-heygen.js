/**
 * Iraq guide intro — HeyGen avatar clip when rendered, spoken script when not.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DEMO_URL = '/data/iraq-heygen-demo.json';
  const MODAL_ID = 'iqHeygenModal';

  let cachedDemo = null;
  let activeVideo = null;

  const i18n = () => window.IraqI18N;
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

    const title = pick(demo?.title) || 'Iraq — Meet Zayd';
    const script = pick(demo?.heygenScriptShort);
    const attribution = pick(demo?.brand?.attribution);
    const devBy = demo?.brand?.developmentBy || 'David E Lane';
    const portrait =
      demo?.avatar?.portrait || '/iraq/assets/zayd-guide-portrait-256.png';

    const body = videoUrl
      ? `<video class="iq-heygen-video" id="iqHeygenVideo" controls playsinline autoplay preload="auto" src="${esc(videoUrl)}"></video>`
      : `<div class="iq-heygen-script">
          <img src="${esc(portrait)}" width="88" height="88" alt=""/>
          <p>${esc(script)}</p>
        </div>`;

    const root = document.createElement('div');
    root.id = MODAL_ID;
    root.className = 'iq-sheet iq-heygen-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', title);
    root.setAttribute('dir', i18n()?.isRtl() ? 'rtl' : 'ltr');
    root.innerHTML = `
      <div class="iq-sheet-backdrop" data-heygen-close></div>
      <div class="iq-sheet-panel">
        <header class="iq-sheet-header">
          <h2>${esc(title)}</h2>
          <button type="button" class="btn-close btn-close-white" data-heygen-close aria-label="${esc(t('close') || 'Close')}"></button>
        </header>
        <div class="iq-sheet-body">${body}</div>
        <footer class="iq-sheet-footer">
          <button type="button" class="iq-btn iq-btn-primary iq-btn-sm" id="iqHeygenCta">
            <i class="bi bi-film"></i> ${esc(pick(demo?.ctaLabel) || t('playReel'))}
          </button>
          <p class="iq-heygen-credit">${esc(attribution)} · ${esc(devBy)}</p>
        </footer>
      </div>`;

    document.body.appendChild(root);

    activeVideo = root.querySelector('#iqHeygenVideo');
    root.querySelectorAll('[data-heygen-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });
    root.querySelector('#iqHeygenCta')?.addEventListener('click', () => {
      closeModal();
      window.IraqStoryReel?.play?.();
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
      title: { en: 'Iraq — Meet Zayd', ar: 'العراق — تعرّف على زيد' },
      heygenScriptShort: {
        en: 'Ahlan wa sahlan — I am Zayd. This atlas walks Iraq: Baghdad and Babylon, masgouf and maqam, marshes and rivers. Press play on the HyperFrame tour, or ask me anything on the page.',
        ar: 'أهلاً وسهلاً — أنا زيد. هذا الأطلس يمشي العراق: بغداد وبابل، المسگوف والمقام، الأهوار والأنهار. شغّل جولة HyperFrame، أو اسألني عن أي شيء في الصفحة.'
      },
      ctaLabel: { en: 'Start the tour', ar: 'ابدأ الجولة' },
      brand: {
        attribution: { en: 'Guide narration', ar: 'سرد الدليل' },
        developmentBy: 'David E Lane'
      },
      avatar: { portrait: '/iraq/assets/zayd-guide-portrait-256.png' }
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
    document.getElementById('iqMeetGuide')?.addEventListener('click', () => {
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

  window.IraqHeyGen = {
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
