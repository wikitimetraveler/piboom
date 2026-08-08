/**
 * Egypt page — loads bilingual content and renders eras, food, music, hookah, raqs, living and phrases.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const CONTENT_URL = '/egypt/data/egypt-content.json';

  const state = {
    data: null,
    activeEra: null,
    sheet: { title: '', body: '', speech: '', lang: null }
  };

  const i18n = () => window.EgyptI18N;

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

  /** Approximate year CE for calendar tick placement, authored per era (BCE negative). */
  function eraYear(era) {
    const year = Number(era?.yearCE);
    return Number.isFinite(year) ? year : null;
  }

  const CAL_MIN = -3200;
  const CAL_MAX = 2026;
  const CAL_RANGE_LABEL = '3200 BCE → today';

  function yearToPct(year) {
    return Math.max(0, Math.min(1, (year - CAL_MIN) / (CAL_MAX - CAL_MIN))) * 100;
  }

  const CAL_MARKERS = [
    { year: -3000, label: '3000 BCE' },
    { year: -1000, label: '1000 BCE' },
    { year: 1, label: 'CE' },
    { year: 1000, label: '1000' },
    { year: 1900, label: '1900' },
    { year: 2026, label: 'Now' }
  ];

  function renderCalendarScale() {
    const host = document.getElementById('egCalendarScale');
    if (!host) return;
    host.innerHTML = CAL_MARKERS.map(
      (m) =>
        `<span class="eg-calendar__mark" style="inset-inline-start:${yearToPct(m.year).toFixed(2)}%">${esc(m.label)}</span>`
    ).join('');
  }

  function renderCalendarTicks() {
    const host = document.getElementById('egCalendarTicks');
    if (!host || !state.data?.eras) return;
    host.innerHTML = state.data.eras
      .map((era) => {
        const year = eraYear(era);
        if (year == null) return '';
        const pct = yearToPct(year);
        const active = state.activeEra === era.id ? ' is-active' : '';
        return `<button type="button" class="eg-calendar__tick${active}" data-era-tick="${esc(era.id)}"
          style="inset-inline-start:${pct.toFixed(2)}%" title="${esc(pick(era.title))} · ${esc(pick(era.years))}"
          aria-label="${esc(pick(era.title))} · ${esc(pick(era.years))}">
          <span class="eg-calendar__tick-date">${esc(pick(era.years))}</span>
        </button>`;
      })
      .join('');
    renderCalendarScale();
    syncSelectedEraBox(state.activeEra);
  }

  function syncSelectedEraBox(eraId) {
    const card = document.getElementById('egTimelineSelectedCard');
    const empty = document.getElementById('egTimelineSelectedEmpty');
    const media = document.getElementById('egTimelineSelectedMedia');
    const dateEl = document.getElementById('egTimelineSelectedDate');
    const titleEl = document.getElementById('egTimelineSelectedTitle');
    const fill = document.getElementById('egCalendarFill');
    const headRange = document.getElementById('egCalendarHeadRange');
    const root = document.getElementById('egTimelineSelected');
    const era = eraId ? state.data?.eras?.find((e) => e.id === eraId) : null;

    if (!era) {
      if (card) card.hidden = true;
      if (empty) empty.hidden = false;
      if (root) root.classList.remove('has-selection');
      if (fill) fill.style.width = '0%';
      if (media) media.innerHTML = '';
      if (headRange) headRange.textContent = CAL_RANGE_LABEL;
      return;
    }

    const years = pick(era.years);
    const year = eraYear(era);
    if (card) card.hidden = false;
    if (empty) empty.hidden = true;
    if (root) root.classList.add('has-selection');
    if (media) {
      media.innerHTML = era.image
        ? `<img class="eg-timeline-selected__img" src="${esc(era.image)}" alt="" width="200" height="200" decoding="async"/>`
        : '';
    }
    if (dateEl) dateEl.textContent = years;
    if (titleEl) titleEl.textContent = pick(era.title);
    if (fill && year != null) fill.style.width = `${yearToPct(year).toFixed(2)}%`;
    if (headRange) headRange.textContent = years;
  }

  function syncCalendarActive(eraId) {
    document.querySelectorAll('.eg-calendar__tick').forEach((el) => {
      el.classList.toggle('is-active', !!eraId && el.getAttribute('data-era-tick') === eraId);
    });
    syncSelectedEraBox(eraId);
  }

  function renderEras() {
    const list = document.getElementById('egEraList');
    if (!list || !state.data) return;
    const flipHint = t('flipHint') || 'Flip for the history';
    const backHint = t('back') || 'Back';

    list.innerHTML = state.data.eras
      .map((era, index) => {
        const flipped = state.activeEra === era.id ? ' is-active is-flipped' : '';
        const years = pick(era.years);
        const history = pick(era.history) || pick(era.copy);
        const art = era.image
          ? `<img class="eg-era-cal__img" src="${esc(era.image)}" alt="" loading="lazy" width="160" height="160" decoding="async"/>`
          : `<span class="eg-era-cal__tick"></span>`;
        const mapBtn = era.siteId
          ? `<button type="button" class="eg-btn eg-btn-ghost eg-btn-sm" data-era-map="${esc(era.siteId)}">
              <i class="bi bi-geo-alt"></i> ${esc(t('mapHeading'))}
            </button>`
          : '';
        return `<li class="eg-era${flipped}" data-era-id="${esc(era.id)}" style="--eg-era-i:${index}">
          <span class="eg-era-node" aria-hidden="true"></span>
          <article class="eg-era-card">
            <div class="eg-era-card-inner">
              <button type="button" class="eg-era-face eg-era-front eg-era-flip"
                aria-expanded="${flipped ? 'true' : 'false'}"
                aria-label="${esc(pick(era.title))} — ${esc(flipHint)}">
                <div class="eg-era-cal${era.image ? ' has-image' : ''}" aria-hidden="true">
                  ${art}
                  <span class="eg-era-cal__band">${esc(years)}</span>
                </div>
                <div class="eg-era-body">
                  <span class="eg-era-years">${esc(years)}</span>
                  <h3 class="eg-era-title">${esc(pick(era.title))}</h3>
                  <p class="eg-era-copy">${esc(pick(era.copy))}</p>
                  <p class="eg-era-hint">${esc(flipHint)}</p>
                </div>
              </button>
              <div class="eg-era-face eg-era-back" data-era-back-flip>
                <p class="eg-era-back__label">${esc(t('evidence') || 'On the ground')} · ${esc(years)}</p>
                <h3 class="eg-era-back__title">${esc(pick(era.title))}</h3>
                <div class="eg-era-back__scroll">
                  <p class="eg-era-history">${esc(history)}</p>
                </div>
                <div class="eg-era-tools">
                  <button type="button" class="eg-btn eg-btn-sand eg-btn-sm eg-listen-btn" data-era-listen="${esc(era.id)}"
                    aria-pressed="false">
                    <i class="bi bi-volume-up-fill" aria-hidden="true"></i>
                    <span class="eg-listen-label">${esc(t('listen'))}</span>
                  </button>
                  ${mapBtn}
                  <button type="button" class="eg-btn eg-btn-ghost eg-btn-sm eg-era-flip-back">
                    <i class="bi bi-arrow-repeat"></i> ${esc(backHint)}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </li>`;
      })
      .join('');

    renderCalendarTicks();
  }

  function cardMarkup(item, kind) {
    const langKey = i18n()?.lang() || 'en';
    const tags = (item.tags && (item.tags[langKey] || item.tags.en)) || [];
    const tagHtml = (Array.isArray(tags) ? tags : [])
      .map((tag) => `<span class="eg-tag">${esc(tag)}</span>`)
      .join('');
    const art = item.image
      ? `<div class="eg-card-photo">
          <img src="${esc(item.image)}" alt="" loading="lazy" width="220" height="220"/>
        </div>`
      : `<span class="eg-card-emoji" aria-hidden="true">${esc(item.emoji || '')}</span>`;
    const audioSrc = kind === 'music' && item.audio?.src ? String(item.audio.src) : '';
    const audioCredit = audioSrc ? pick(item.audio.credit) : '';
    const playBtn = audioSrc
      ? `<button type="button" class="eg-btn eg-btn-rose eg-btn-sm eg-card-play" data-card-play="${esc(item.id)}"
            aria-pressed="false" aria-label="${esc(t('playMusic') || 'Play music')}">
            <i class="bi bi-play-fill" aria-hidden="true"></i>
            <span class="eg-card-play-label">${esc(t('playMusic') || 'Play music')}</span>
          </button>`
      : '';
    const creditHtml = audioCredit
      ? `<p class="eg-card-audio-credit" hidden data-card-audio-credit>${esc(audioCredit)}</p>`
      : '';

    return `<article class="eg-card" data-kind="${esc(kind)}" data-id="${esc(item.id)}"${
      audioSrc ? ` data-audio-src="${esc(audioSrc)}"` : ''
    }>
      <div class="eg-card-inner">
        <button type="button" class="eg-card-face eg-card-front eg-card-flip" aria-expanded="false"
          aria-label="${esc(pick(item.name))} — ${esc(t('flipHint'))}">
          ${art}
          <h3 class="eg-card-name">${esc(pick(item.name))}</h3>
          <p class="eg-card-tagline">${esc(pick(item.tagline))}</p>
          <div class="eg-card-tags">${tagHtml}</div>
          <p class="eg-card-hint">${esc(t('flipHint'))}</p>
        </button>
        <div class="eg-card-face eg-card-back" data-card-back-flip>
          <h3 class="eg-card-name">${esc(pick(item.name))}</h3>
          <p class="eg-card-history">${esc(pick(item.history))}</p>
          ${creditHtml}
          <div class="eg-card-actions">
            ${playBtn}
            <button type="button" class="eg-btn eg-btn-sand eg-btn-sm eg-listen-btn" data-card-listen="${esc(item.id)}" data-card-kind="${esc(kind)}"
              aria-pressed="false">
              <i class="bi bi-volume-up-fill" aria-hidden="true"></i>
              <span class="eg-listen-label">${esc(t('listen'))}</span>
            </button>
            ${
              item.siteId
                ? `<button type="button" class="eg-btn eg-btn-ghost eg-btn-sm" data-card-map="${esc(item.siteId)}">
                    <i class="bi bi-geo-alt"></i> ${esc(t('mapHeading'))}
                  </button>`
                : ''
            }
            <button type="button" class="eg-btn eg-btn-ghost eg-btn-sm eg-card-flip" aria-label="${esc(t('back') || 'Back')}">
              <i class="bi bi-arrow-counterclockwise"></i> ${esc(t('back') || 'Back')}
            </button>
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderCards() {
    const foodGrid = document.getElementById('egFoodGrid');
    const musicGrid = document.getElementById('egMusicGrid');
    const hookahGrid = document.getElementById('egHookahGrid');
    if (foodGrid) foodGrid.innerHTML = state.data.foods.map((f) => cardMarkup(f, 'food')).join('');
    if (musicGrid) musicGrid.innerHTML = state.data.music.map((m) => cardMarkup(m, 'music')).join('');
    if (hookahGrid) {
      const items = Array.isArray(state.data.hookah) ? state.data.hookah : [];
      hookahGrid.innerHTML = items.map((h) => cardMarkup(h, 'hookah')).join('');
    }
    const livingGrid = document.getElementById('egLivingGrid');
    if (livingGrid) {
      const items = Array.isArray(state.data.living) ? state.data.living : [];
      livingGrid.innerHTML = items.map((item) => cardMarkup(item, 'living')).join('');
    }
    const raqsGrid = document.getElementById('egRaqsGrid');
    if (raqsGrid) {
      const unlocked = window.EgyptRaqs?.isUnlocked?.() === true;
      const items = unlocked && Array.isArray(state.data.raqs) ? state.data.raqs : [];
      raqsGrid.innerHTML = items.map((item) => cardMarkup(item, 'raqs')).join('');
    }
  }

  function renderPhrases() {
    const list = document.getElementById('egPhraseList');
    if (!list || !state.data) return;
    list.innerHTML = state.data.phrases
      .map(
        (phrase, index) => `<li>
          <button type="button" class="eg-phrase" data-phrase-index="${index}">
            <i class="bi bi-volume-up-fill eg-phrase-icon" aria-hidden="true"></i>
            <span class="eg-phrase-copy">
              <span class="eg-phrase-ar" lang="ar" dir="rtl">${esc(phrase.ar)}</span>
              <span class="eg-phrase-translit">${esc(phrase.translit)}</span>
              <span class="eg-phrase-en">${esc(phrase.en)}</span>
            </span>
          </button>
        </li>`
      )
      .join('');
  }

  function renderGuide() {
    const guide = state.data?.guide;
    if (!guide) return;
    const name = document.getElementById('egGuideName');
    const title = document.getElementById('egGuideTitle');
    const status = document.getElementById('egGuideStatus');
    const portrait = document.getElementById('egGuidePortrait');
    if (name) name.textContent = pick(guide.name);
    if (title) title.textContent = pick(guide.title);
    if (status) status.textContent = pick(guide.greeting);
    if (portrait && guide.portrait) portrait.src = guide.portrait;
  }

  function renderFacts() {
    const map = {
      en: {
        pyramids: 'Old Kingdom pyramids crown the desert edge',
        nile: 'The Nile organizes farms, cities, and song',
        azhar: 'Al-Azhar still teaches in Historic Cairo',
        contemporary: 'The republic shapes modern Egyptian life'
      },
      ar: {
        pyramids: 'أهرام الدولة القديمة تُتوّج حافة الصحراء',
        nile: 'النيل ينظّم المزارع والمدن والغناء',
        azhar: 'الأزهر ما زال يعلّم في القاهرة التاريخية',
        contemporary: 'الجمهورية تشكّل حياة مصر الحديثة'
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
    document.dispatchEvent(new CustomEvent('egypt:rendered'));
  }

  /* ---------------------------------------------------------------- sheet */

  function openSheet({ title, label, body, speech }) {
    const sheet = document.getElementById('egSheet');
    const titleEl = document.getElementById('egSheetTitle');
    const bodyEl = document.getElementById('egSheetBody');
    if (!sheet) return;
    state.sheet.speech = speech || body || '';
    if (titleEl) titleEl.textContent = title || '';
    if (bodyEl) {
      bodyEl.innerHTML = `${label ? `<span class="eg-sheet-label">${esc(label)}</span>` : ''}<p>${esc(body || '')}</p>`;
    }
    sheet.hidden = false;
    document.getElementById('egSheetClose')?.focus();
  }

  function closeSheet() {
    const sheet = document.getElementById('egSheet');
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    i18n()?.stop();
  }

  function setEraFlipped(eraId, flip) {
    document.querySelectorAll('.eg-era').forEach((el) => {
      const id = el.getAttribute('data-era-id');
      const on = flip && id === eraId;
      el.classList.toggle('is-active', on);
      el.classList.toggle('is-flipped', on);
      const front = el.querySelector('.eg-era-flip');
      if (front) front.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    syncCalendarActive(flip ? eraId : null);
  }

  /** Flip era card in-place — no sheet/popup. Toggle if already open. */
  function openEra(eraId) {
    const era = state.data?.eras.find((e) => e.id === eraId);
    if (!era) return;
    // Flipping eras always cuts narration so speech is easy to silence.
    stopListenSpeech();
    window.EgyptSections?.expand('egTimeline');
    const togglingOff = state.activeEra === eraId;
    state.activeEra = togglingOff ? null : eraId;
    setEraFlipped(eraId, !togglingOff);
    if (!togglingOff) {
      closeSheet();
      const eraEl = document.querySelector(`.eg-era[data-era-id="${eraId}"]`);
      eraEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      eraEl?.querySelector('[data-era-listen]')?.focus({ preventScroll: true });
    }
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
      living: state.data?.living,
      raqs: state.data?.raqs
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
    const text = btn.querySelector('.eg-listen-label');
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
    const sheetBtn = document.getElementById('egSheetListen');
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
    document.getElementById('egGuide')?.classList.remove('is-speaking');
  }

  /**
   * Toggle guide narration for a Listen control.
   * Second click on the same key stops; another key switches over.
   * @param {string} key
   * @param {() => Promise<void>|void} speakFn
   */
  /**
   * @param {string} key
   * @param {() => Promise<void>|void} speakFn
   * @param {{ force?: boolean }} [options] force=true bypasses the page Narration toggle
   */
  async function toggleGuideSpeech(key, speakFn, options = {}) {
    if (!key || typeof speakFn !== 'function') return;
    if (listenSpeakingKey === key) {
      stopListenSpeech();
      return;
    }
    // Master Narration checkbox — skip for explicit practice audio (e.g. phrases).
    if (
      !options.force &&
      i18n() &&
      typeof i18n().narrationEnabled === 'function' &&
      !i18n().narrationEnabled()
    ) {
      return;
    }

    stopMusic();
    // Stop prior audio without bumping the generation twice (that raced the new token).
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    document.getElementById('egGuide')?.classList.remove('is-speaking');

    const gen = ++listenGeneration;
    listenSpeakingKey = key;
    syncListenButtons();
    // Re-prime AFTER stop, in the same click — needed for English Listen and Arabic phrases.
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
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
      const text = btn.querySelector('.eg-card-play-label');
      if (text) text.textContent = label;
      const card = btn.closest('.eg-card');
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
      console.warn('Egypt music sample failed to load', src);
      clearIfCurrent();
    });

    audio.play().catch((err) => {
      console.warn('Egypt music play blocked', err);
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
    // Keep history on the flipped card — never open the sheet for eras.
    if (state.activeEra !== eraId) {
      state.activeEra = eraId;
      setEraFlipped(eraId, true);
    }
    return toggleGuideSpeech(`era:${eraId}`, () =>
      i18n()?.speakAsGuide(pick(era.narration) || pick(era.copy))
    );
  }

  async function speakPhrase(index) {
    const phrase = state.data?.phrases?.[index];
    if (!phrase?.ar) return;
    const key = `phrase:${index}`;
    if (listenSpeakingKey === key) {
      stopListenSpeech();
      return;
    }
    // Practice audio: always on. Stop prior clip, then re-prime in the same click.
    stopMusic();
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    i18n()?.unlockAudio?.();

    const gen = ++listenGeneration;
    listenSpeakingKey = key;
    syncListenButtons();

    try {
      const api = i18n();
      if (!api?.speak) return;
      await api.speak(phrase.ar, { lang: 'ar', force: true });
    } finally {
      if (gen === listenGeneration) clearListenUi();
    }
  }

  function speakSheet() {
    const speech = state.sheet.speech;
    if (!speech) return;
    return toggleGuideSpeech('sheet', () => i18n()?.speakAsGuide(speech));
  }

  function toggleCard(card) {
    if (!card) return;
    // Any flip (open or close) stops guide speech — Listen again if you want more.
    stopListenSpeech();
    const flipped = card.classList.toggle('is-flipped');
    card.querySelectorAll('.eg-card-flip').forEach((btn) => {
      if (btn.classList.contains('eg-card-front')) {
        btn.setAttribute('aria-expanded', flipped ? 'true' : 'false');
      }
    });
    if (!flipped && musicPlayingId && card.getAttribute('data-id') === musicPlayingId) {
      stopMusic();
    }
  }

  function unflipAll() {
    stopListenSpeech();
    stopMusic();
    document.querySelectorAll('.eg-card.is-flipped').forEach((card) => {
      card.classList.remove('is-flipped');
      card.querySelectorAll('.eg-card-front.eg-card-flip').forEach((btn) => {
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function flipFirst(gridId) {
    const grid = document.getElementById(gridId);
    window.EgyptSections?.expandFor(grid);
    const card = document.querySelector(`#${gridId} .eg-card`);
    if (card && !card.classList.contains('is-flipped')) toggleCard(card);
  }

  function focusSite(siteId) {
    if (window.EgyptMap?.focusSite) {
      window.EgyptSections?.expand('egMap');
      window.EgyptMap.focusSite(siteId);
      document.getElementById('egMap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* --------------------------------------------------------------- binding */

  function bindDelegates() {
    // Prime the shared Audio element on pointerdown so Google TTS can play after fetch.
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (event.target.closest('[data-phrase-index], [data-card-listen], [data-era-listen], #egSheetListen')) {
          i18n()?.unlockAudio();
        }
      },
      true
    );

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

      const eraTick = event.target.closest('[data-era-tick]');
      if (eraTick) {
        event.stopPropagation();
        openEra(eraTick.getAttribute('data-era-tick'));
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

      const cardFlip = event.target.closest('.eg-card-flip');
      if (cardFlip) {
        event.preventDefault();
        event.stopPropagation();
        toggleCard(cardFlip.closest('.eg-card'));
        return;
      }

      // Click anywhere on the back (outside action buttons) flips — same as front
      const cardBack = event.target.closest('[data-card-back-flip]');
      if (cardBack && !event.target.closest('button, a')) {
        event.preventDefault();
        event.stopPropagation();
        toggleCard(cardBack.closest('.eg-card'));
        return;
      }

      const phrase = event.target.closest('[data-phrase-index]');
      if (phrase) {
        event.preventDefault();
        event.stopPropagation();
        speakPhrase(Number(phrase.getAttribute('data-phrase-index')));
        return;
      }

      const eraFlipBack = event.target.closest('.eg-era-flip-back');
      if (eraFlipBack) {
        event.stopPropagation();
        openEra(eraFlipBack.closest('.eg-era')?.getAttribute('data-era-id'));
        return;
      }

      const eraFlip = event.target.closest('.eg-era-flip');
      if (eraFlip) {
        event.preventDefault();
        openEra(eraFlip.closest('.eg-era')?.getAttribute('data-era-id'));
        return;
      }

      const eraBack = event.target.closest('[data-era-back-flip]');
      if (eraBack && !event.target.closest('button, a')) {
        event.preventDefault();
        openEra(eraBack.closest('.eg-era')?.getAttribute('data-era-id'));
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeSheet();
      stopListenSpeech();
      stopMusic();
    });

    document.getElementById('egSheetClose')?.addEventListener('click', closeSheet);
    document.getElementById('egSheetBackdrop')?.addEventListener('click', closeSheet);
    document.getElementById('egSheetListen')?.addEventListener('click', () => {
      speakSheet();
    });

    const year = document.getElementById('egFooterYear');
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
      console.error('Egypt content failed to load', err);
      const list = document.getElementById('egEraList');
      if (list) {
        list.innerHTML =
          '<li class="eg-loading">Content could not be loaded. Refresh the page to try again.</li>';
      }
      return;
    }

    i18n()?.setUiStrings(state.data.ui);
    renderAll();
    i18n()?.onChange(() => renderAll());
    document.addEventListener('egypt:raqs-unlock', () => {
      if (state.data) renderCards();
    });
    document.dispatchEvent(new CustomEvent('egypt:content-ready', { detail: state.data }));
  }

  window.EgyptContent = {
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
