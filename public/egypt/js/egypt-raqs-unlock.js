/**
 * Secret Raqs · Baladi section — hidden until ?raqs=1, localStorage, or Omar unlock phrase.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'egyptRaqsUnlocked';
  const SECTION_ID = 'egRaqs';

  const UNLOCK_RE =
    /show\s+me\s+the\s+dance\s+floor|open\s+the\s+dance\s+hall|unlock\s+raqs|show\s+raqs|belly\s*danc|raqs\s*sharqi|افتح\s*قاعة\s*الرقص|أظهر\s*الرقص|اظهر\s*الرقص|رقص\s*شرقي|افتح\s*الرقص/i;

  function i18n() {
    return window.EgyptI18N;
  }

  function sectionEl() {
    return document.getElementById(SECTION_ID);
  }

  function readUrlFlag() {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('raqs');
      if (raw === '0' || raw === 'false' || raw === 'off') return false;
      if (raw === '1' || raw === 'true' || raw === 'on') return true;
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function readStored() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function persist(on) {
    try {
      if (on) localStorage.setItem(STORAGE_KEY, '1');
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      /* ignore */
    }
  }

  function isUnlocked() {
    const url = readUrlFlag();
    if (url === false) return false;
    if (url === true) return true;
    return readStored();
  }

  function matchUnlock(text) {
    return UNLOCK_RE.test(String(text || '').trim());
  }

  function toast(message) {
    const host = document.getElementById('egRaqsToast');
    if (!host || !message) return;
    host.textContent = message;
    host.hidden = false;
    host.classList.add('is-visible');
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => {
      host.classList.remove('is-visible');
      host.hidden = true;
    }, 4200);
  }

  function applyVisibility(opts = {}) {
    const section = sectionEl();
    if (!section) return false;
    const unlocked = isUnlocked();
    section.classList.toggle('is-unlocked', unlocked);
    if (unlocked) {
      section.removeAttribute('hidden');
      section.setAttribute('aria-hidden', 'false');
      if (opts.expand) {
        window.EgyptSections?.expand?.(SECTION_ID);
        if (opts.scroll) {
          window.setTimeout(() => {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
        }
      }
    } else {
      section.setAttribute('hidden', '');
      section.setAttribute('aria-hidden', 'true');
      section.classList.remove('is-open');
      const panel = section.querySelector('.eg-section-panel');
      const btn = section.querySelector('.eg-section-toggle');
      if (panel) panel.setAttribute('hidden', '');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    document.documentElement.classList.toggle('eg-raqs-unlocked', unlocked);
    document.dispatchEvent(
      new CustomEvent('egypt:raqs-unlock', { detail: { unlocked, source: opts.source || 'sync' } })
    );
    return unlocked;
  }

  function unlock(opts = {}) {
    const urlOff = readUrlFlag() === false;
    if (urlOff && !opts.force) return false;
    persist(true);
    // Keep a shareable deep link when unlocking from chat / UI.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('raqs') !== '1') {
        url.searchParams.set('raqs', '1');
        window.history.replaceState({}, '', url);
      }
    } catch (_) {
      /* ignore */
    }
    const unlocked = applyVisibility({ expand: true, scroll: true, source: opts.source || 'unlock' });
    if (unlocked && opts.toast !== false) {
      const msg =
        i18n()?.t?.('raqsUnlockToast') ||
        (i18n()?.lang?.() === 'ar' ? 'عمر فتح قاعة الرقص.' : 'Omar opened the dance floor.');
      toast(msg);
    }
    return unlocked;
  }

  function lock() {
    persist(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('raqs');
      window.history.replaceState({}, '', url);
    } catch (_) {
      /* ignore */
    }
    return applyVisibility({ source: 'lock' });
  }

  function unlockFromChat() {
    unlock({ source: 'chat', toast: true });
    const lang = i18n()?.lang?.() || 'en';
    return lang === 'ar'
      ? 'تمام — فتحت لك قاعة الرقص. انزل إلى قسم «رقص · بلدي» واقلب البطاقات: بلدي، شرقي، تحطيب، والزفة.'
      : 'Done — I opened the dance floor. Scroll to Raqs · Baladi and flip the cards: baladi, sharqi, tahtib, and the zaffa.';
  }

  function init() {
    const url = readUrlFlag();
    if (url === true) persist(true);
    if (url === false) persist(false);
    applyVisibility({ expand: url === true || readStored(), scroll: url === true, source: 'init' });
  }

  window.EgyptRaqs = {
    isUnlocked,
    matchUnlock,
    unlock,
    lock,
    unlockFromChat,
    applyVisibility,
    STORAGE_KEY
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
