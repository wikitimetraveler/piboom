/**
 * Jordan page — loads bilingual content and renders eras, food, music and phrases.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const CONTENT_URL = '/jordan/data/jordan-content.json';

  const state = {
    data: null,
    activeEra: null,
    sheet: { title: '', body: '', speech: '', lang: null }
  };

  const i18n = () => window.JordanI18N;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pick(value) {
    return i18n() ? i18n().pick(value) : String(value?.en || value || '');
  }

  function t(key) {
    return i18n() ? i18n().t(key) : '';
  }

  /* ------------------------------------------------------------- rendering */

  function renderEras() {
    const list = document.getElementById('jdEraList');
    if (!list || !state.data) return;

    list.innerHTML = state.data.eras
      .map((era) => {
        const active = state.activeEra === era.id ? ' is-active' : '';
        return `<li class="jd-era${active}" data-era-id="${esc(era.id)}">
          <div class="jd-era-btn">
            <span class="jd-era-years">${esc(pick(era.years))}</span>
            <h3 class="jd-era-title">
              <button type="button" class="jd-era-open">${esc(pick(era.title))}</button>
            </h3>
            <p class="jd-era-copy">${esc(pick(era.copy))}</p>
            <div class="jd-era-tools">
              <button type="button" class="jd-btn jd-btn-sand jd-btn-sm" data-era-listen="${esc(era.id)}">
                <i class="bi bi-volume-up-fill"></i> ${esc(t('listen'))}
              </button>
              ${
                era.siteId
                  ? `<button type="button" class="jd-btn jd-btn-ghost jd-btn-sm" data-era-map="${esc(era.siteId)}">
                      <i class="bi bi-geo-alt"></i> ${esc(t('mapHeading'))}
                    </button>`
                  : ''
              }
            </div>
          </div>
        </li>`;
      })
      .join('');
  }

  function cardMarkup(item, kind) {
    const langKey = i18n()?.lang() || 'en';
    const tags = (item.tags && (item.tags[langKey] || item.tags.en)) || [];
    const tagHtml = (Array.isArray(tags) ? tags : [])
      .map((tag) => `<span class="jd-tag">${esc(tag)}</span>`)
      .join('');
    const art = item.image
      ? `<div class="jd-card-photo">
          <img src="${esc(item.image)}" alt="" loading="lazy" width="220" height="220"/>
        </div>`
      : `<span class="jd-card-emoji" aria-hidden="true">${esc(item.emoji || '')}</span>`;

    return `<div class="jd-card" role="button" tabindex="0" data-kind="${esc(kind)}" data-id="${esc(item.id)}"
        aria-pressed="false" aria-label="${esc(pick(item.name))}">
      <div class="jd-card-inner">
        <div class="jd-card-face jd-card-front">
          ${art}
          <h3 class="jd-card-name">${esc(pick(item.name))}</h3>
          <p class="jd-card-tagline">${esc(pick(item.tagline))}</p>
          <div class="jd-card-tags">${tagHtml}</div>
          <p class="jd-card-hint">${esc(t('flipHint'))}</p>
        </div>
        <div class="jd-card-face jd-card-back">
          <h3 class="jd-card-name">${esc(pick(item.name))}</h3>
          <p class="jd-card-history">${esc(pick(item.history))}</p>
          <div class="jd-card-actions">
            <button type="button" class="jd-btn jd-btn-sand jd-btn-sm" data-card-listen="${esc(item.id)}" data-card-kind="${esc(kind)}">
              <i class="bi bi-volume-up-fill"></i> ${esc(t('listen'))}
            </button>
            ${
              item.siteId
                ? `<button type="button" class="jd-btn jd-btn-ghost jd-btn-sm" data-card-map="${esc(item.siteId)}">
                    <i class="bi bi-geo-alt"></i> ${esc(t('mapHeading'))}
                  </button>`
                : ''
            }
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderCards() {
    const foodGrid = document.getElementById('jdFoodGrid');
    const musicGrid = document.getElementById('jdMusicGrid');
    if (foodGrid) foodGrid.innerHTML = state.data.foods.map((f) => cardMarkup(f, 'food')).join('');
    if (musicGrid) musicGrid.innerHTML = state.data.music.map((m) => cardMarkup(m, 'music')).join('');
  }

  function renderPhrases() {
    const list = document.getElementById('jdPhraseList');
    if (!list || !state.data) return;
    list.innerHTML = state.data.phrases
      .map(
        (phrase, index) => `<li>
          <button type="button" class="jd-phrase" data-phrase-index="${index}">
            <i class="bi bi-volume-up-fill jd-phrase-icon" aria-hidden="true"></i>
            <span class="jd-phrase-copy">
              <span class="jd-phrase-ar" lang="ar" dir="rtl">${esc(phrase.ar)}</span>
              <span class="jd-phrase-translit">${esc(phrase.translit)}</span>
              <span class="jd-phrase-en">${esc(phrase.en)}</span>
            </span>
          </button>
        </li>`
      )
      .join('');
  }

  function renderGuide() {
    const guide = state.data?.guide;
    if (!guide) return;
    const name = document.getElementById('jdGuideName');
    const title = document.getElementById('jdGuideTitle');
    const status = document.getElementById('jdGuideStatus');
    const portrait = document.getElementById('jdGuidePortrait');
    if (name) name.textContent = pick(guide.name);
    if (title) title.textContent = pick(guide.title);
    if (status) status.textContent = pick(guide.greeting);
    if (portrait && guide.portrait) portrait.src = guide.portrait;
  }

  function renderFacts() {
    const map = {
      en: {
        ain: 'Ain Ghazal statues',
        rome: 'Rome annexes Nabataea',
        ind: 'Independence',
        dead: 'Dead Sea, lowest on Earth'
      },
      ar: {
        ain: 'تماثيل عين غزال',
        rome: 'روما تضمّ الأنباط',
        ind: 'الاستقلال',
        dead: 'البحر الميت، أخفض بقعة'
      }
    };
    const table = map[i18n()?.lang() || 'en'] || map.en;
    document.querySelectorAll('[data-i18n-fact]').forEach((el) => {
      const key = el.getAttribute('data-i18n-fact');
      if (table[key]) el.textContent = table[key];
    });
  }

  function renderAll() {
    if (!state.data) return;
    renderGuide();
    renderFacts();
    renderEras();
    renderCards();
    renderPhrases();
    i18n()?.applyStaticStrings();
    document.dispatchEvent(new CustomEvent('jordan:rendered'));
  }

  /* ---------------------------------------------------------------- sheet */

  function openSheet({ title, label, body, speech }) {
    const sheet = document.getElementById('jdSheet');
    const titleEl = document.getElementById('jdSheetTitle');
    const bodyEl = document.getElementById('jdSheetBody');
    if (!sheet) return;
    state.sheet.speech = speech || body || '';
    if (titleEl) titleEl.textContent = title || '';
    if (bodyEl) {
      bodyEl.innerHTML = `${label ? `<span class="jd-sheet-label">${esc(label)}</span>` : ''}<p>${esc(body || '')}</p>`;
    }
    sheet.hidden = false;
    document.getElementById('jdSheetClose')?.focus();
  }

  function closeSheet() {
    const sheet = document.getElementById('jdSheet');
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    i18n()?.stop();
  }

  function openEra(eraId) {
    const era = state.data?.eras.find((e) => e.id === eraId);
    if (!era) return;
    state.activeEra = eraId;
    document.querySelectorAll('.jd-era').forEach((el) => {
      el.classList.toggle('is-active', el.getAttribute('data-era-id') === eraId);
    });
    openSheet({
      title: pick(era.title),
      label: `${t('context')} · ${pick(era.years)}`,
      body: pick(era.copy),
      speech: pick(era.narration) || pick(era.copy)
    });
  }

  /* --------------------------------------------------------------- actions */

  function findItem(kind, id) {
    const source = kind === 'music' ? state.data?.music : state.data?.foods;
    return (source || []).find((item) => item.id === id) || null;
  }

  function speakItem(kind, id) {
    const item = findItem(kind, id);
    if (!item) return;
    i18n()?.unlockAudio();
    i18n()?.speakAsGuide(`${pick(item.name)}. ${pick(item.history)}`);
  }

  function speakEra(eraId) {
    const era = state.data?.eras.find((e) => e.id === eraId);
    if (!era) return;
    i18n()?.unlockAudio();
    i18n()?.speakAsGuide(pick(era.narration) || pick(era.copy));
  }

  function speakPhrase(index) {
    const phrase = state.data?.phrases?.[index];
    if (!phrase) return;
    i18n()?.unlockAudio();
    const button = document.querySelector(`[data-phrase-index="${index}"]`);
    button?.classList.add('is-speaking');
    i18n()
      .speak(phrase.ar, { lang: 'ar' })
      .finally(() => button?.classList.remove('is-speaking'));
  }

  function toggleCard(card) {
    const flipped = card.classList.toggle('is-flipped');
    card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
  }

  function unflipAll() {
    document.querySelectorAll('.jd-card.is-flipped').forEach((card) => {
      card.classList.remove('is-flipped');
      card.setAttribute('aria-pressed', 'false');
    });
  }

  function flipFirst(gridId) {
    const card = document.querySelector(`#${gridId} .jd-card`);
    if (card && !card.classList.contains('is-flipped')) toggleCard(card);
  }

  function focusSite(siteId) {
    if (window.JordanMap?.focusSite) {
      window.JordanMap.focusSite(siteId);
      document.getElementById('jdMap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* --------------------------------------------------------------- binding */

  function bindDelegates() {
    document.addEventListener('click', (event) => {
      const eraListen = event.target.closest('[data-era-listen]');
      if (eraListen) {
        event.stopPropagation();
        speakEra(eraListen.getAttribute('data-era-listen'));
        return;
      }

      const eraMap = event.target.closest('[data-era-map]');
      if (eraMap) {
        event.stopPropagation();
        focusSite(eraMap.getAttribute('data-era-map'));
        return;
      }

      const cardListen = event.target.closest('[data-card-listen]');
      if (cardListen) {
        event.stopPropagation();
        speakItem(cardListen.getAttribute('data-card-kind'), cardListen.getAttribute('data-card-listen'));
        return;
      }

      const cardMap = event.target.closest('[data-card-map]');
      if (cardMap) {
        event.stopPropagation();
        focusSite(cardMap.getAttribute('data-card-map'));
        return;
      }

      const phrase = event.target.closest('[data-phrase-index]');
      if (phrase) {
        speakPhrase(Number(phrase.getAttribute('data-phrase-index')));
        return;
      }

      const eraTitle = event.target.closest('.jd-era-title');
      if (eraTitle) {
        openEra(eraTitle.closest('.jd-era')?.getAttribute('data-era-id'));
        return;
      }

      const card = event.target.closest('.jd-card');
      if (card) toggleCard(card);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSheet();
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest?.('.jd-card');
      if (card && event.target === card) {
        event.preventDefault();
        toggleCard(card);
      }
    });

    document.getElementById('jdSheetClose')?.addEventListener('click', closeSheet);
    document.getElementById('jdSheetBackdrop')?.addEventListener('click', closeSheet);
    document.getElementById('jdSheetListen')?.addEventListener('click', () => {
      i18n()?.unlockAudio();
      i18n()?.speakAsGuide(state.sheet.speech);
    });
    document.getElementById('jdMeetGuide')?.addEventListener('click', () => {
      i18n()?.unlockAudio();
      if (window.JordanHeygen?.playIntro) window.JordanHeygen.playIntro();
      else i18n()?.speakAsGuide(pick(state.data?.guide?.greeting));
    });

    const year = document.getElementById('jdFooterYear');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  /* ------------------------------------------------------------------ init */

  async function init() {
    bindDelegates();
    try {
      const res = await fetch(CONTENT_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
    } catch (err) {
      console.error('Jordan content failed to load', err);
      const list = document.getElementById('jdEraList');
      if (list) {
        list.innerHTML =
          '<li class="jd-loading">Content could not be loaded. Refresh the page to try again.</li>';
      }
      return;
    }

    i18n()?.setUiStrings(state.data.ui);
    renderAll();
    i18n()?.onChange(() => renderAll());
    document.dispatchEvent(new CustomEvent('jordan:content-ready', { detail: state.data }));
  }

  window.JordanContent = {
    getData: () => state.data,
    openEra,
    openFirstEra: () => openEra(state.data?.eras?.[0]?.id),
    closeSheet,
    flipFirst,
    unflipAll,
    speakPhrase,
    speakFirstPhrase: () => speakPhrase(0),
    focusSite
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
