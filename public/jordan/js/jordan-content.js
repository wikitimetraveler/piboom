/**
 * Jordan page — loads bilingual content and renders eras, food, music, hookah, living and phrases.
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
              <button type="button" class="jd-btn jd-btn-sand jd-btn-sm jd-listen-btn" data-era-listen="${esc(era.id)}"
                aria-pressed="false">
                <i class="bi bi-volume-up-fill" aria-hidden="true"></i>
                <span class="jd-listen-label">${esc(t('listen'))}</span>
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
    const audioSrc = kind === 'music' && item.audio?.src ? String(item.audio.src) : '';
    const audioCredit = audioSrc ? pick(item.audio.credit) : '';
    const playBtn = audioSrc
      ? `<button type="button" class="jd-btn jd-btn-rose jd-btn-sm jd-card-play" data-card-play="${esc(item.id)}"
            aria-pressed="false" aria-label="${esc(t('playMusic') || 'Play music')}">
            <i class="bi bi-play-fill" aria-hidden="true"></i>
            <span class="jd-card-play-label">${esc(t('playMusic') || 'Play music')}</span>
          </button>`
      : '';
    const creditHtml = audioCredit
      ? `<p class="jd-card-audio-credit" hidden data-card-audio-credit>${esc(audioCredit)}</p>`
      : '';

    return `<article class="jd-card" data-kind="${esc(kind)}" data-id="${esc(item.id)}"${
      audioSrc ? ` data-audio-src="${esc(audioSrc)}"` : ''
    }>
      <div class="jd-card-inner">
        <button type="button" class="jd-card-face jd-card-front jd-card-flip" aria-expanded="false"
          aria-label="${esc(pick(item.name))} — ${esc(t('flipHint'))}">
          ${art}
          <h3 class="jd-card-name">${esc(pick(item.name))}</h3>
          <p class="jd-card-tagline">${esc(pick(item.tagline))}</p>
          <div class="jd-card-tags">${tagHtml}</div>
          <p class="jd-card-hint">${esc(t('flipHint'))}</p>
        </button>
        <div class="jd-card-face jd-card-back" data-card-back-flip>
          <h3 class="jd-card-name">${esc(pick(item.name))}</h3>
          <p class="jd-card-history">${esc(pick(item.history))}</p>
          ${creditHtml}
          <div class="jd-card-actions">
            ${playBtn}
            <button type="button" class="jd-btn jd-btn-sand jd-btn-sm jd-listen-btn" data-card-listen="${esc(item.id)}" data-card-kind="${esc(kind)}"
              aria-pressed="false">
              <i class="bi bi-volume-up-fill" aria-hidden="true"></i>
              <span class="jd-listen-label">${esc(t('listen'))}</span>
            </button>
            ${
              item.siteId
                ? `<button type="button" class="jd-btn jd-btn-ghost jd-btn-sm" data-card-map="${esc(item.siteId)}">
                    <i class="bi bi-geo-alt"></i> ${esc(t('mapHeading'))}
                  </button>`
                : ''
            }
            <button type="button" class="jd-btn jd-btn-ghost jd-btn-sm jd-card-flip" aria-label="${esc(t('back') || 'Back')}">
              <i class="bi bi-arrow-counterclockwise"></i> ${esc(t('back') || 'Back')}
            </button>
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderCards() {
    const foodGrid = document.getElementById('jdFoodGrid');
    const musicGrid = document.getElementById('jdMusicGrid');
    const hookahGrid = document.getElementById('jdHookahGrid');
    if (foodGrid) foodGrid.innerHTML = state.data.foods.map((f) => cardMarkup(f, 'food')).join('');
    if (musicGrid) musicGrid.innerHTML = state.data.music.map((m) => cardMarkup(m, 'music')).join('');
    if (hookahGrid) {
      const items = Array.isArray(state.data.hookah) ? state.data.hookah : [];
      hookahGrid.innerHTML = items.map((h) => cardMarkup(h, 'hookah')).join('');
    }
    const livingGrid = document.getElementById('jdLivingGrid');
    if (livingGrid) {
      const items = Array.isArray(state.data.living) ? state.data.living : [];
      livingGrid.innerHTML = items.map((item) => cardMarkup(item, 'living')).join('');
    }
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
        ain: 'Ain Ghazal plaster statues',
        rome: 'Rome annexes Nabataea',
        ind: 'Independence, 1946',
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
    const keepPlayingId = musicPlayingId;
    const keepTime = musicAudio && !musicAudio.paused ? musicAudio.currentTime : 0;
    renderGuide();
    renderFacts();
    renderEras();
    renderCards();
    renderPhrases();
    i18n()?.applyStaticStrings();
    // Language toggle re-renders cards — keep the sample playing and refresh button labels.
    if (keepPlayingId && musicAudio && !musicAudio.paused) {
      musicPlayingId = keepPlayingId;
      try {
        if (Math.abs((musicAudio.currentTime || 0) - keepTime) > 0.5) {
          musicAudio.currentTime = keepTime;
        }
      } catch (_) {
        /* ignore */
      }
      syncMusicPlayButtons();
    } else if (keepPlayingId && (!musicAudio || musicAudio.paused)) {
      stopMusic();
    }
    if (listenSpeakingKey) syncListenButtons();
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

  let musicAudio = null;
  let musicPlayingId = null;
  let listenSpeakingKey = null;
  let listenGeneration = 0;

  function findItem(kind, id) {
    const sources = {
      music: state.data?.music,
      food: state.data?.foods,
      hookah: state.data?.hookah,
      living: state.data?.living
    };
    const source = sources[kind] || state.data?.foods;
    return (source || []).find((item) => item.id === id) || null;
  }

  function applyListenButtonState(btn, active) {
    const listenLabel = t('listen') || 'Listen';
    const stopLabel = t('stop') || 'Stop';
    const label = active ? stopLabel : listenLabel;
    btn.classList.toggle('is-listening', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.setAttribute('aria-label', label);
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = active ? 'bi bi-stop-fill' : 'bi bi-volume-up-fill';
    }
    const text = btn.querySelector('.jd-listen-label');
    if (text) text.textContent = label;
    else if (!btn.querySelector('img')) {
      // Phrase / compact buttons keep their own copy; only flip aria + icon class above.
    }
  }

  function syncListenButtons() {
    document.querySelectorAll('[data-card-listen]').forEach((btn) => {
      const key = `card:${btn.getAttribute('data-card-kind')}:${btn.getAttribute('data-card-listen')}`;
      applyListenButtonState(btn, listenSpeakingKey === key);
    });
    document.querySelectorAll('[data-era-listen]').forEach((btn) => {
      const key = `era:${btn.getAttribute('data-era-listen')}`;
      applyListenButtonState(btn, listenSpeakingKey === key);
    });
    const sheetBtn = document.getElementById('jdSheetListen');
    if (sheetBtn) applyListenButtonState(sheetBtn, listenSpeakingKey === 'sheet');
    document.querySelectorAll('[data-phrase-index]').forEach((btn) => {
      const key = `phrase:${btn.getAttribute('data-phrase-index')}`;
      const active = listenSpeakingKey === key;
      btn.classList.toggle('is-speaking', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function clearListenUi() {
    listenSpeakingKey = null;
    syncListenButtons();
  }

  /** Stop guide/phrase speech and reset Listen → Stop toggles (does not touch music samples). */
  function stopListenSpeech() {
    listenGeneration += 1;
    clearListenUi();
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    document.getElementById('jdGuide')?.classList.remove('is-speaking');
  }

  /**
   * Toggle guide narration for a Listen control.
   * Second click on the same key stops; another key switches over.
   * @param {string} key
   * @param {() => Promise<void>|void} speakFn
   */
  async function toggleGuideSpeech(key, speakFn) {
    if (!key || typeof speakFn !== 'function') return;
    if (listenSpeakingKey === key) {
      stopListenSpeech();
      return;
    }

    stopMusic();
    stopListenSpeech();
    const gen = ++listenGeneration;
    listenSpeakingKey = key;
    syncListenButtons();
    i18n()?.unlockAudio();
    try {
      await speakFn();
    } finally {
      if (gen === listenGeneration) clearListenUi();
    }
  }

  function syncMusicPlayButtons() {
    document.querySelectorAll('[data-card-play]').forEach((btn) => {
      const id = btn.getAttribute('data-card-play');
      const playing = musicPlayingId === id;
      const label = playing ? t('stopMusic') || 'Stop music' : t('playMusic') || 'Play music';
      btn.classList.toggle('is-playing', playing);
      btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      btn.setAttribute('aria-label', label);
      const icon = btn.querySelector('i');
      if (icon) icon.className = playing ? 'bi bi-stop-fill' : 'bi bi-play-fill';
      const text = btn.querySelector('.jd-card-play-label');
      if (text) text.textContent = label;
      const card = btn.closest('.jd-card');
      card?.classList.toggle('is-playing-music', playing);
      const credit = card?.querySelector('[data-card-audio-credit]');
      if (credit) credit.hidden = !playing;
    });
  }

  function stopMusic() {
    if (musicAudio) {
      try {
        musicAudio.pause();
        musicAudio.currentTime = 0;
      } catch (_) {
        /* ignore */
      }
      musicAudio = null;
    }
    musicPlayingId = null;
    syncMusicPlayButtons();
  }

  function playMusic(id) {
    const item = findItem('music', id);
    const src = item?.audio?.src;
    if (!src) return;

    if (musicPlayingId === id) {
      stopMusic();
      return;
    }

    stopMusic();
    stopListenSpeech();
    i18n()?.unlockAudio();

    const audio = new Audio(src);
    audio.volume = 0.9;
    musicAudio = audio;
    musicPlayingId = id;
    syncMusicPlayButtons();

    const clearIfCurrent = () => {
      if (musicAudio === audio) {
        musicAudio = null;
        musicPlayingId = null;
        syncMusicPlayButtons();
      }
    };
    audio.addEventListener('ended', clearIfCurrent);
    audio.addEventListener('error', () => {
      console.warn('Jordan music sample failed to load', src);
      clearIfCurrent();
    });

    audio.play().catch((err) => {
      console.warn('Jordan music play blocked', err);
      clearIfCurrent();
    });
  }

  function speakItem(kind, id) {
    const item = findItem(kind, id);
    if (!item) return;
    return toggleGuideSpeech(`card:${kind}:${id}`, () =>
      i18n()?.speakAsGuide(`${pick(item.name)}. ${pick(item.history)}`)
    );
  }

  function speakEra(eraId) {
    const era = state.data?.eras.find((e) => e.id === eraId);
    if (!era) return;
    return toggleGuideSpeech(`era:${eraId}`, () =>
      i18n()?.speakAsGuide(pick(era.narration) || pick(era.copy))
    );
  }

  function speakPhrase(index) {
    const phrase = state.data?.phrases?.[index];
    if (!phrase) return;
    return toggleGuideSpeech(`phrase:${index}`, () => i18n()?.speak(phrase.ar, { lang: 'ar' }));
  }

  function speakSheet() {
    const speech = state.sheet.speech;
    if (!speech) return;
    return toggleGuideSpeech('sheet', () => i18n()?.speakAsGuide(speech));
  }

  function toggleCard(card) {
    const flipped = card.classList.toggle('is-flipped');
    card.querySelectorAll('.jd-card-flip').forEach((btn) => {
      if (btn.classList.contains('jd-card-front')) {
        btn.setAttribute('aria-expanded', flipped ? 'true' : 'false');
      }
    });
    if (!flipped && musicPlayingId && card.getAttribute('data-id') === musicPlayingId) {
      stopMusic();
    }
  }

  function unflipAll() {
    stopMusic();
    document.querySelectorAll('.jd-card.is-flipped').forEach((card) => {
      card.classList.remove('is-flipped');
      card.querySelectorAll('.jd-card-front.jd-card-flip').forEach((btn) => {
        btn.setAttribute('aria-expanded', 'false');
      });
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

      const cardPlay = event.target.closest('[data-card-play]');
      if (cardPlay) {
        event.preventDefault();
        event.stopPropagation();
        playMusic(cardPlay.getAttribute('data-card-play'));
        return;
      }

      const cardMap = event.target.closest('[data-card-map]');
      if (cardMap) {
        event.stopPropagation();
        focusSite(cardMap.getAttribute('data-card-map'));
        return;
      }

      const cardFlip = event.target.closest('.jd-card-flip');
      if (cardFlip) {
        event.preventDefault();
        event.stopPropagation();
        toggleCard(cardFlip.closest('.jd-card'));
        return;
      }

      // Click anywhere on the back (outside action buttons) flips — same as front
      const cardBack = event.target.closest('[data-card-back-flip]');
      if (cardBack && !event.target.closest('button, a')) {
        event.preventDefault();
        event.stopPropagation();
        toggleCard(cardBack.closest('.jd-card'));
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
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSheet();
    });

    document.getElementById('jdSheetClose')?.addEventListener('click', closeSheet);
    document.getElementById('jdSheetBackdrop')?.addEventListener('click', closeSheet);
    document.getElementById('jdSheetListen')?.addEventListener('click', () => {
      speakSheet();
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
    playMusic,
    stopMusic,
    toggleGuideSpeech,
    clearListenUi,
    stopListenSpeech,
    focusSite
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
