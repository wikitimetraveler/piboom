/**
 * Shenango Valley — load content, render eras/cards, speak helper.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const CONTENT_URL = '/nature/data/shenango-content.json';
  const BUHL_CENTER = { lat: 41.245889, lng: -80.477848 };

  const state = {
    data: null,
    activeEra: null,
    sheetSpeech: ''
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pick(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    return String(value.en || Object.values(value)[0] || '');
  }

  function t(key) {
    return pick(state.data?.ui?.en?.[key]) || key;
  }

  function stopSpeech() {
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  async function speak(text) {
    const line = String(text || '').trim();
    if (!line) return;
    stopSpeech();
    if (typeof window.speakWithGoogle === 'function') {
      try {
        await window.speakWithGoogle(line, { lang: 'en-US' });
        return;
      } catch (_) {
        /* fall through */
      }
    }
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(line);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  }

  function renderGuide() {
    const guide = state.data?.guide;
    if (!guide) return;
    const name = document.getElementById('svGuideName');
    const title = document.getElementById('svGuideTitle');
    const status = document.getElementById('svGuideStatus');
    const portrait = document.getElementById('svGuidePortrait');
    if (name) name.textContent = pick(guide.name);
    if (title) title.textContent = pick(guide.title);
    if (status) status.textContent = pick(guide.greeting);
    if (portrait && guide.portrait) portrait.src = guide.portrait;
  }

  function renderStaticUi() {
    const ui = state.data?.ui?.en || {};
    const map = [
      ['svHeroKicker', 'heroKicker'],
      ['svHeroTitle', 'heroTitle'],
      ['svHeroLine', 'heroLine'],
      ['svExploreLabel', 'exploreMap'],
      ['svMeetLabel', 'meetGuide'],
      ['svAskLabel', 'askGuide'],
      ['svTimelineHeading', 'timelineHeading'],
      ['svTimelineLead', 'timelineLead'],
      ['svMapHeading', 'mapHeading'],
      ['svMapLead', 'mapLead'],
      ['svFoodHeading', 'foodHeading'],
      ['svFoodLead', 'foodLead'],
      ['svLivingHeading', 'livingHeading'],
      ['svLivingLead', 'livingLead']
    ];
    map.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el && ui[key]) el.textContent = ui[key];
    });
    const year = document.getElementById('svFooterYear');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  function renderEras() {
    const list = document.getElementById('svEraList');
    if (!list || !state.data) return;
    list.innerHTML = state.data.eras
      .map((era) => {
        const active = state.activeEra === era.id ? ' is-active' : '';
        return `<li class="sv-era${active}" data-era-id="${esc(era.id)}">
          <span class="sv-era-years">${esc(pick(era.years))}</span>
          <h3 class="sv-era-title">
            <button type="button" class="sv-era-open">${esc(pick(era.title))}</button>
          </h3>
          <p class="sv-era-copy">${esc(pick(era.copy))}</p>
          <div class="sv-era-tools">
            <button type="button" class="sv-btn sv-btn-sand sv-btn-sm" data-era-listen="${esc(era.id)}">
              <i class="bi bi-volume-up-fill"></i> ${esc(t('listen'))}
            </button>
            ${
              era.siteId
                ? `<button type="button" class="sv-btn sv-btn-ghost sv-btn-sm" data-era-map="${esc(era.siteId)}">
                    <i class="bi bi-geo-alt"></i> ${esc(t('mapShow'))}
                  </button>`
                : ''
            }
          </div>
        </li>`;
      })
      .join('');
  }

  function cardMarkup(item, kind) {
    const tags = (item.tags && (item.tags.en || item.tags)) || [];
    const tagHtml = (Array.isArray(tags) ? tags : [])
      .map((tag) => `<span class="sv-tag">${esc(tag)}</span>`)
      .join('');
    return `<article class="sv-card" data-kind="${esc(kind)}" data-id="${esc(item.id)}">
      <div class="sv-card-inner">
        <button type="button" class="sv-card-face sv-card-front sv-card-flip" aria-expanded="false"
          aria-label="${esc(pick(item.name))} — ${esc(t('flipHint'))}">
          <span class="sv-card-emoji" aria-hidden="true">${esc(item.emoji || '')}</span>
          <h3 class="sv-card-name">${esc(pick(item.name))}</h3>
          <p class="sv-card-tagline">${esc(pick(item.tagline))}</p>
          <div class="sv-card-tags">${tagHtml}</div>
          <p class="sv-card-hint">${esc(t('flipHint'))}</p>
        </button>
        <div class="sv-card-face sv-card-back">
          <h3 class="sv-card-name">${esc(pick(item.name))}</h3>
          <p class="sv-card-history">${esc(pick(item.history))}</p>
          <div class="sv-card-actions">
            <button type="button" class="sv-btn sv-btn-sand sv-btn-sm" data-card-listen="${esc(item.id)}" data-card-kind="${esc(kind)}">
              <i class="bi bi-volume-up-fill"></i> ${esc(t('listen'))}
            </button>
            ${
              item.siteId
                ? `<button type="button" class="sv-btn sv-btn-ghost sv-btn-sm" data-card-map="${esc(item.siteId)}">
                    <i class="bi bi-geo-alt"></i> ${esc(t('mapShow'))}
                  </button>`
                : ''
            }
            <button type="button" class="sv-btn sv-btn-ghost sv-btn-sm sv-card-flip">
              <i class="bi bi-arrow-counterclockwise"></i> ${esc(t('back'))}
            </button>
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderCards() {
    const foodGrid = document.getElementById('svFoodGrid');
    const livingGrid = document.getElementById('svLivingGrid');
    if (foodGrid) {
      foodGrid.innerHTML = (state.data.foods || []).map((f) => cardMarkup(f, 'food')).join('');
    }
    if (livingGrid) {
      livingGrid.innerHTML = (state.data.living || []).map((item) => cardMarkup(item, 'living')).join('');
    }
  }

  function openSheet({ title, label, body, speech }) {
    const sheet = document.getElementById('svSheet');
    const titleEl = document.getElementById('svSheetTitle');
    const bodyEl = document.getElementById('svSheetBody');
    if (!sheet) return;
    state.sheetSpeech = speech || body || '';
    if (titleEl) titleEl.textContent = title || '';
    if (bodyEl) {
      bodyEl.innerHTML = `${label ? `<span class="sv-sheet-label">${esc(label)}</span>` : ''}<p>${esc(body || '')}</p>`;
    }
    sheet.hidden = false;
  }

  function closeSheet() {
    const sheet = document.getElementById('svSheet');
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    stopSpeech();
  }

  function openEra(eraId) {
    const era = state.data?.eras.find((e) => e.id === eraId);
    if (!era) return;
    state.activeEra = eraId;
    document.querySelectorAll('.sv-era').forEach((el) => {
      el.classList.toggle('is-active', el.getAttribute('data-era-id') === eraId);
    });
    openSheet({
      title: pick(era.title),
      label: `${t('context')} · ${pick(era.years)}`,
      body: pick(era.copy),
      speech: pick(era.narration) || pick(era.copy)
    });
  }

  function findItem(kind, id) {
    const source = kind === 'living' ? state.data?.living : state.data?.foods;
    return (source || []).find((item) => item.id === id) || null;
  }

  function bind() {
    document.getElementById('svEraList')?.addEventListener('click', (event) => {
      const openBtn = event.target.closest('.sv-era-open');
      if (openBtn) {
        const era = openBtn.closest('[data-era-id]');
        if (era) openEra(era.getAttribute('data-era-id'));
        return;
      }
      const listen = event.target.closest('[data-era-listen]');
      if (listen) {
        const era = state.data.eras.find((e) => e.id === listen.getAttribute('data-era-listen'));
        if (era) speak(pick(era.narration) || pick(era.copy));
        return;
      }
      const mapBtn = event.target.closest('[data-era-map]');
      if (mapBtn) {
        document.getElementById('svMap')?.scrollIntoView({ behavior: 'smooth' });
        window.ShenangoMap?.focusSite(mapBtn.getAttribute('data-era-map'), { speak: true });
      }
    });

    document.getElementById('svFoodGrid')?.addEventListener('click', onCardClick);
    document.getElementById('svLivingGrid')?.addEventListener('click', onCardClick);

    document.getElementById('svSheetClose')?.addEventListener('click', closeSheet);
    document.getElementById('svSheetBackdrop')?.addEventListener('click', closeSheet);
    document.getElementById('svSheetListen')?.addEventListener('click', () => speak(state.sheetSpeech));
    document.getElementById('svStopAudio')?.addEventListener('click', () => {
      stopSpeech();
      window.ShenangoHeygen?.stopIntro?.();
    });
    document.getElementById('svMeetGuide')?.addEventListener('click', () => {
      window.ShenangoHeygen?.playIntro?.();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSheet();
    });
  }

  function onCardClick(event) {
    const flip = event.target.closest('.sv-card-flip');
    if (flip) {
      const card = flip.closest('.sv-card');
      card?.classList.toggle('is-flipped');
      return;
    }
    const listen = event.target.closest('[data-card-listen]');
    if (listen) {
      const item = findItem(listen.getAttribute('data-card-kind'), listen.getAttribute('data-card-listen'));
      if (item) speak(`${pick(item.name)}. ${pick(item.history)}`);
      return;
    }
    const mapBtn = event.target.closest('[data-card-map]');
    if (mapBtn) {
      document.getElementById('svMap')?.scrollIntoView({ behavior: 'smooth' });
      window.ShenangoMap?.focusSite(mapBtn.getAttribute('data-card-map'), { speak: true });
    }
  }

  async function boot() {
    try {
      const res = await fetch(CONTENT_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load Shenango content');
      state.data = await res.json();
      renderStaticUi();
      renderGuide();
      renderEras();
      renderCards();
      bind();
      document.dispatchEvent(
        new CustomEvent('shenango:content-ready', {
          detail: { sites: state.data.sites || [], center: BUHL_CENTER, data: state.data }
        })
      );

      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === 'heygen') {
        window.setTimeout(() => window.ShenangoHeygen?.playIntro?.(), 400);
      }
    } catch (err) {
      console.error('shenango-content:', err);
      const list = document.getElementById('svEraList');
      if (list) list.innerHTML = `<li class="text-danger">Could not load valley content.</li>`;
    }
  }

  window.ShenangoContent = {
    pick,
    t,
    speak,
    stopSpeech,
    getData: () => state.data,
    BUHL_CENTER
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
