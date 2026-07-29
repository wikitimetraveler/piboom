/**
 * Jordan guide intro — HeyGen avatar clip when rendered, spoken script when not.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DEMO_URL = '/data/jordan-heygen-demo.json';
  const MODAL_ID = 'jdHeygenModal';

  let cachedDemo = null;
  let activeVideo = null;

  const i18n = () => window.JordanI18N;
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

    const title = pick(demo?.title) || 'Jordan — Meet Rami';
    const script = pick(demo?.heygenScriptShort);
    const attribution = pick(demo?.brand?.attribution);
    const devBy = demo?.brand?.developmentBy || 'David E Lane';
    const portrait = demo?.avatar?.portrait || '/jordan/assets/rami-guide-portrait-256.png';

    const body = videoUrl
      ? `<video class="jd-heygen-video" id="jdHeygenVideo" controls playsinline autoplay preload="auto" src="${esc(videoUrl)}"></video>`
      : `<div class="jd-heygen-script">
          <img src="${esc(portrait)}" width="88" height="88" alt=""/>
          <p>${esc(script)}</p>
        </div>`;

    const root = document.createElement('div');
    root.id = MODAL_ID;
    root.className = 'jd-sheet jd-heygen-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', title);
    root.setAttribute('dir', i18n()?.isRtl() ? 'rtl' : 'ltr');
    root.innerHTML = `
      <div class="jd-sheet-backdrop" data-heygen-close></div>
      <div class="jd-sheet-panel">
        <header class="jd-sheet-header">
          <h2>${esc(title)}</h2>
          <button type="button" class="btn-close btn-close-white" data-heygen-close aria-label="${esc(t('close') || 'Close')}"></button>
        </header>
        <div class="jd-sheet-body">${body}</div>
        <footer class="jd-sheet-footer">
          <button type="button" class="jd-btn jd-btn-primary jd-btn-sm" id="jdHeygenCta">
            <i class="bi bi-film"></i> ${esc(pick(demo?.ctaLabel) || t('playReel'))}
          </button>
          <p class="jd-heygen-credit">${esc(attribution)} · ${esc(devBy)}</p>
        </footer>
      </div>`;

    document.body.appendChild(root);

    activeVideo = root.querySelector('#jdHeygenVideo');
    root.querySelectorAll('[data-heygen-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });
    root.querySelector('#jdHeygenCta')?.addEventListener('click', () => {
      closeModal();
      window.JordanStoryReel?.play?.();
    });
    document.addEventListener('keydown', function onKey(event) {
      if (event.key === 'Escape' && document.getElementById(MODAL_ID)) {
        closeModal();
        document.removeEventListener('keydown', onKey);
      }
    });

    return Boolean(videoUrl);
  }

  /** Play the avatar clip if it is rendered; otherwise speak the same script. */
  async function playIntro() {
    const demo = await loadDemo();
    const videoUrl = await resolveVideoUrl(demo);
    showModal(demo, videoUrl);
    if (!videoUrl) {
      i18n()?.unlockAudio();
      await i18n()?.speakAsGuide(pick(demo?.heygenScriptShort));
    }
    return Boolean(videoUrl);
  }

  window.JordanHeygen = {
    loadDemo,
    playIntro,
    stopIntro: closeModal,
    getDemo: () => cachedDemo
  };
})();
