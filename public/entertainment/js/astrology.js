/**
 * Astrology page — wheel, flip cards, starfield, Rose readings.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const Z = typeof AstrologyZodiac !== 'undefined' ? AstrologyZodiac : null;
  const A = typeof AstrologyArcana !== 'undefined' ? AstrologyArcana : null;
  if (!Z) return;

  const DOB_KEY = 'astroDob';
  const ELEMENT_RGB = {
    fire: [255, 138, 91],
    earth: [212, 180, 131],
    air: [159, 212, 232],
    water: [126, 179, 224],
    rose: [196, 72, 96],
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let selectedId = '';
  let elementFilter = 'all';
  let tarotSuitFilter = 'all';
  let skyRaf = 0;
  let skyElement = 'rose';
  let lastSpread = null;
  let lastFlippedArcana = '';

  function $(id) {
    return document.getElementById(id);
  }

  function i18n() {
    return window.AstrologyI18N || null;
  }

  function t(key, fallback) {
    const value = i18n()?.t?.(key);
    return value || fallback || '';
  }

  function localizeSign(sign) {
    if (!sign) return null;
    const overlay = i18n()?.signCopy?.(sign.id);
    if (!overlay) return sign;
    return { ...sign, ...overlay };
  }

  function localizeCard(card) {
    if (!card) return null;
    const overlay = i18n()?.cardCopy?.(card.id);
    if (!overlay) return card;
    return { ...card, ...overlay };
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatIsoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function readDobInput() {
    const el = $('astroDob');
    return Z.parseDobString(el?.value || '');
  }

  function persistDob(iso) {
    try {
      if (iso) localStorage.setItem(DOB_KEY, iso);
    } catch (_) {
      /* ignore */
    }
  }

  function resolveInitialDob() {
    const fromQuery = Z.parseDobQuery(window.location.search);
    if (fromQuery) return fromQuery;
    try {
      const saved = Z.parseDobString(localStorage.getItem(DOB_KEY) || '');
      if (saved) return saved;
    } catch (_) {
      /* ignore */
    }
    const now = new Date();
    return Z.parseDobString(formatIsoDate(now));
  }

  function gsapTween(targets, vars) {
    if (reduceMotion) return;
    const gsap = window.gsap;
    if (!gsap || typeof gsap.from !== 'function') return;
    try {
      gsap.from(targets, vars);
    } catch (_) {
      /* ignore */
    }
  }

  function speakOracle(text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    if (window.AstrologyHeygen && typeof window.AstrologyHeygen.speak === 'function') {
      window.AstrologyHeygen.speak(clean);
      return;
    }
    if (window.AstrologyRose && typeof window.AstrologyRose.speak === 'function') {
      window.AstrologyRose.speak(clean);
    }
  }

  function askRose(prompt) {
    if (window.AstrologyRose && typeof window.AstrologyRose.ask === 'function') {
      window.AstrologyRose.ask(prompt);
    }
  }

  function setPageElement(element) {
    const key = ELEMENT_RGB[element] ? element : 'rose';
    skyElement = key;
    document.body.dataset.element = key;
    const wrap = document.querySelector('.astro-wrap');
    if (wrap) wrap.dataset.element = key;
  }

  function wheelMarkup() {
    const host = $('astroWedges');
    if (host && Z.wheelWedgesSvg) {
      const svg = Z.wheelWedgesSvg();
      const inner = svg.replace(/^<g class="astro-wedges">/, '').replace(/<\/g>$/, '');
      host.innerHTML = inner;
    }
    return Z.SIGNS.map((sign, index) => {
      const angle = index * 30;
      const view = localizeSign(sign) || sign;
      return `<div class="astro-slot-arm" style="--angle:${angle}deg">
        <button type="button" class="astro-slot" data-sign="${sign.id}" data-element="${sign.element}" style="--angle:${angle}deg" aria-pressed="false">
          <span class="astro-slot__glyph" aria-hidden="true">${Z.textGlyph(sign)}</span>
          <span class="astro-slot__label">${esc(view.name)}</span>
        </button>
      </div>`;
    }).join('');
  }

  function backFace(sign, opts) {
    const compact = opts && opts.compact;
    const view = localizeSign(sign) || sign;
    const ask = i18n()?.lang?.() === 'vi'
      ? `Đọc ${sign.name} giúp tôi`
      : sign.askRose;
    return `
      <div class="astro-flip__meta">
        <span class="astro-chip astro-chip--${sign.element}">${esc(t(`element_${sign.element}`, sign.element))}</span>
        <span class="astro-chip">${esc(t(`modality_${sign.modality}`, sign.modality))}</span>
        <span class="astro-chip">${esc(sign.ruler)}</span>
      </div>
      <h3>${Z.textGlyph(sign)} ${esc(view.name)}</h3>
      <p class="astro-flip__oracle">${esc(view.oracle)}</p>
      ${compact ? '' : `<p class="astro-flip__gift"><strong>${esc(t('giftLabel', 'Gift.'))}</strong> ${esc(view.gift)}</p>
      <p class="astro-flip__shadow"><strong>${esc(t('watchLabel', 'Watch.'))}</strong> ${esc(view.shadow)}</p>`}
      <ul class="astro-traits">${(view.traits || sign.traits).map((trait) => `<li>${esc(trait)}</li>`).join('')}</ul>
      <div class="astro-flip__actions">
        <button type="button" class="astro-ask" data-ask-rose="${esc(ask)}">${esc(t('askRose', 'Ask Rose'))}</button>
        <button type="button" class="astro-unflip">${esc(t('flipBack', 'Flip back'))}</button>
      </div>`;
  }

  function galleryMarkup() {
    return Z.SIGNS.map((sign) => {
      const view = localizeSign(sign) || sign;
      return `<article class="astro-flip astro-card" data-sign="${sign.id}" data-element="${sign.element}">
      <div class="astro-flip__inner">
        <button type="button" class="astro-flip__face astro-flip__front" data-sign="${sign.id}" aria-pressed="false" aria-expanded="false">
          <div class="astro-card__top">
            <span class="astro-card__glyph" aria-hidden="true">${Z.textGlyph(sign)}</span>
            <span class="astro-chip astro-chip--${sign.element}">${esc(t(`element_${sign.element}`, sign.element))}</span>
          </div>
          <h3>${esc(view.name)}</h3>
          <p>${esc(sign.dates)}</p>
          <p>${esc(view.kicker || sign.kicker)}</p>
          ${Z.constellationSvg(sign)}
        </button>
        <div class="astro-flip__face astro-flip__back" data-element="${sign.element}">
          ${backFace(sign, { compact: true })}
        </div>
      </div>
    </article>`;
    }).join('');
  }

  function arcanaBackFace(card) {
    const view = localizeCard(card) || card;
    const ask = i18n()?.lang?.() === 'vi'
      ? `Đọc ${card.name} giúp tôi`
      : card.askRose;
    return `
      <div class="astro-flip__meta">
        <span class="astro-chip">${esc(view.suitLabel || card.suitLabel || card.suit)}</span>
        <span class="astro-chip">${esc(view.keyword || card.keyword)}</span>
      </div>
      <h3>${esc(card.glyph)} ${esc(view.name)}</h3>
      <p class="astro-flip__oracle">${esc(view.oracle)}</p>
      <p class="astro-flip__gift"><strong>${esc(t('giftLabel', 'Gift.'))}</strong> ${esc(view.gift)}</p>
      <p class="astro-flip__shadow"><strong>${esc(t('watchLabel', 'Watch.'))}</strong> ${esc(view.shadow)}</p>
      <ul class="astro-traits">${(view.traits || card.traits || []).map((trait) => `<li>${esc(trait)}</li>`).join('')}</ul>
      <div class="astro-flip__actions">
        <button type="button" class="astro-ask" data-ask-rose="${esc(ask)}">${esc(t('askRose', 'Ask Rose'))}</button>
        <button type="button" class="astro-unflip">${esc(t('flipBack', 'Flip back'))}</button>
      </div>`;
  }

  function tarotImage(card) {
    const src = A && A.imageSrc ? A.imageSrc(card) : card.image || card.commonsUrl || '';
    if (!src) return '';
    return `<img class="astro-tarot-art" src="${esc(src)}" alt="" loading="lazy" width="180" height="300" onerror="this.classList.add('is-missing')"/>`;
  }

  function arcanaGalleryMarkup() {
    if (!A) return '';
    const deck = A.DECK || A.ARCANA || [];
    return deck
      .map((card) => {
        const view = localizeCard(card) || card;
        return `<article class="astro-flip astro-card astro-arcana-card" data-arcana="${card.id}" data-tarot-suit="${card.suit}">
      <div class="astro-flip__inner">
        <button type="button" class="astro-flip__face astro-flip__front astro-tarot-front" data-arcana-flip aria-expanded="false">
          ${tarotImage(card)}
          <div class="astro-tarot-front__meta">
            <span class="astro-chip">${esc(card.suit === 'major' ? card.roman : (view.suitLabel || card.suitLabel))}</span>
            <h3>${esc(view.name)}</h3>
            <p>${esc(view.keyword || card.keyword)}</p>
          </div>
        </button>
        <div class="astro-flip__face astro-flip__back">
          ${arcanaBackFace(card)}
        </div>
      </div>
    </article>`;
      })
      .join('');
  }

  function applyTarotFilter() {
    document.querySelectorAll('#astroArcanaGallery .astro-arcana-card').forEach((card) => {
      const suit = card.dataset.tarotSuit;
      const show =
        tarotSuitFilter === 'all' ||
        suit === tarotSuitFilter ||
        (tarotSuitFilter === 'major' && suit === 'major');
      card.hidden = !show;
    });
  }

  function setStageCollapsed(collapsed) {
    const panel = $('astroStagePanel');
    const toggle = $('astroStageToggle');
    const hint = $('astroStageToggleHint');
    if (!panel || !toggle) return;
    const next = Boolean(collapsed);
    panel.dataset.collapsed = String(next);
    toggle.setAttribute('aria-expanded', String(!next));
    if (hint) hint.textContent = next ? t('show', 'Show') : t('hide', 'Hide');
  }

  function updateStageToggleTitle(sign) {
    const title = $('astroStageToggleTitle');
    if (!title) return;
    if (sign) {
      const view = localizeSign(sign) || sign;
      title.textContent = `${Z.textGlyph(sign)} ${view.name} · ${t('stageTitle', 'Sign and card')}`;
    } else {
      title.textContent = t('stageTitle', 'Sign and card');
    }
  }

  function renderDetail(sign) {
    const panel = $('astroDetail');
    const glyph = $('astroCoreGlyph');
    const name = $('astroCoreName');
    if (!panel || !sign) return;
    const view = localizeSign(sign) || sign;
    panel.dataset.element = sign.element;
    panel.dataset.sign = sign.id;
    panel.classList.add('astro-flip', 'astro-hero-card');
    panel.classList.remove('is-flipped');
    panel.innerHTML = `
      <div class="astro-flip__inner">
        <div class="astro-flip__face astro-flip__front">
          <div class="astro-detail__meta">
            <span class="astro-chip astro-chip--${sign.element}">${esc(t(`element_${sign.element}`, sign.element))}</span>
          </div>
          <h2 id="astroDetailTitle">${Z.textGlyph(sign)} ${esc(view.name)}</h2>
          <p class="astro-detail__dates">${esc(sign.dates)} · ${esc(view.symbol || sign.symbol)}</p>
          ${Z.constellationSvg(sign)}
          <p>${esc(view.blurb || sign.blurb)}</p>
          <ul class="astro-traits">${(view.traits || sign.traits).map((trait) => `<li>${esc(trait)}</li>`).join('')}</ul>
          <button type="button" class="astro-flip-cta" data-hero-flip>${esc(t('flipCard', 'Flip the card'))}</button>
        </div>
        <div class="astro-flip__face astro-flip__back" data-element="${sign.element}">
          ${backFace(sign)}
        </div>
      </div>
    `;
    if (glyph) glyph.textContent = Z.textGlyph(sign);
    if (name) name.textContent = view.name;
    const core = document.querySelector('.astro-wheel__core');
    if (core) core.dataset.element = sign.element;
    updateStageToggleTitle(sign);
  }

  function applyFilter() {
    document.querySelectorAll('.astro-gallery .astro-flip').forEach((card) => {
      const show = elementFilter === 'all' || card.dataset.element === elementFilter;
      card.hidden = !show;
    });
    document.querySelectorAll('.astro-wedge').forEach((wedge) => {
      const show = elementFilter === 'all' || wedge.dataset.element === elementFilter;
      wedge.classList.toggle('is-dim', !show);
    });
  }

  function unflipAll(except) {
    document.querySelectorAll('.astro-flip.is-flipped').forEach((card) => {
      if (except && card === except) return;
      if (card.id === 'astroDetail') return;
      card.classList.remove('is-flipped');
      card.querySelectorAll('[aria-expanded]').forEach((el) => el.setAttribute('aria-expanded', 'false'));
    });
  }

  function flipCard(card, flipped) {
    if (!card) return;
    const next = typeof flipped === 'boolean' ? flipped : !card.classList.contains('is-flipped');
    card.classList.toggle('is-flipped', next);
    card.querySelectorAll('[aria-expanded]').forEach((el) => el.setAttribute('aria-expanded', String(next)));
    if (next && card.dataset.sign) {
      const sign = localizeSign(Z.signById(card.dataset.sign)) || Z.signById(card.dataset.sign);
      if (sign) speakOracle(sign.oracle);
    } else if (next && card.dataset.arcana && A) {
      lastFlippedArcana = card.dataset.arcana;
      const arcana = localizeCard(A.cardById(card.dataset.arcana)) || A.cardById(card.dataset.arcana);
      if (arcana) speakOracle(arcana.oracle);
    }
  }

  function selectSign(id, opts) {
    const sign = Z.signById(id);
    if (!sign) return;
    selectedId = sign.id;
    setPageElement(sign.element);
    renderDetail(sign);
    document.querySelectorAll('.astro-slot[data-sign], .astro-flip__front[data-sign]').forEach((el) => {
      el.setAttribute('aria-pressed', String(el.dataset.sign === sign.id));
    });
    document.querySelectorAll('.astro-wedge').forEach((wedge) => {
      wedge.classList.toggle('is-selected', wedge.dataset.sign === sign.id);
    });
    document.querySelectorAll('.astro-gallery .astro-flip').forEach((card) => {
      card.classList.toggle('is-selected', card.dataset.sign === sign.id);
    });
    if (!opts || opts.syncUrl !== false) {
      const url = new URL(window.location.href);
      url.searchParams.set('sign', sign.id);
      if (opts && opts.reading) url.searchParams.set('reading', '1');
      if (opts && opts.dob) url.searchParams.set('dob', opts.dob);
      url.hash = '';
      history.replaceState(null, '', url.pathname + url.search);
    }
  }

  function todaysSign() {
    return Z.signForDate(new Date()) || Z.SIGNS[0];
  }

  function spreadOracleMarkup(card) {
    const view = localizeCard(card) || card;
    const ask = i18n()?.lang?.() === 'vi'
      ? `Đọc ${card.name} giúp tôi`
      : card.askRose;
    return `
      <div class="astro-flip__meta">
        <span class="astro-chip">${esc(view.suitLabel || card.suitLabel || card.suit)}</span>
        <span class="astro-chip">${esc(view.keyword || card.keyword)}</span>
      </div>
      <p class="astro-flip__oracle">${esc(view.oracle)}</p>
      <p class="astro-flip__gift"><strong>${esc(t('giftLabel', 'Gift.'))}</strong> ${esc(view.gift)}</p>
      <p class="astro-flip__shadow"><strong>${esc(t('watchLabel', 'Watch.'))}</strong> ${esc(view.shadow)}</p>
      <ul class="astro-traits">${(view.traits || card.traits || []).map((trait) => `<li>${esc(trait)}</li>`).join('')}</ul>
      <div class="astro-flip__actions">
        <button type="button" class="astro-ask" data-ask-rose="${esc(ask)}">${esc(t('askRose', 'Ask Rose'))}</button>
        <button type="button" data-spread-oracle-hide>${esc(t('hideReading', 'Hide reading'))}</button>
      </div>`;
  }

  function tarotSpreadCardMarkup(role, card) {
    if (!card) return '';
    const view = localizeCard(card) || card;
    return `<article class="astro-flip astro-spread-card astro-spread-card--tarot is-pending" data-arcana="${card.id}" data-tarot-suit="${card.suit}" data-role="${role}" data-phase="back">
      <p class="astro-spread-card__role">${esc(role)}</p>
      <div class="astro-flip__inner">
        <div class="astro-flip__face astro-flip__front astro-tarot-deck-back" aria-hidden="true">
          <div class="astro-tarot-deck-back__mark">
            <span class="astro-tarot-deck-back__rose" aria-hidden="true">✦</span>
            <span>${esc(t('deckBackMark', 'Rose'))}</span>
          </div>
        </div>
        <button type="button" class="astro-flip__face astro-flip__back astro-tarot-front astro-tarot-revealed" data-spread-tarot-flip aria-expanded="false">
          ${tarotImage(card)}
          <div class="astro-tarot-front__meta">
            <span class="astro-chip">${esc(card.suit === 'major' ? card.roman : (view.suitLabel || card.suitLabel))}</span>
            <h3>${esc(view.name)}</h3>
            <p>${esc(view.keyword || card.keyword)}</p>
          </div>
          <div class="astro-tarot-oracle" hidden>${spreadOracleMarkup(card)}</div>
        </button>
      </div>
    </article>`;
  }

  function toggleSpreadReading(card, open) {
    if (!card || !card.classList.contains('is-revealed')) return;
    const next = typeof open === 'boolean' ? open : !card.classList.contains('is-reading');
    card.classList.toggle('is-reading', next);
    card.dataset.phase = next ? 'oracle' : 'art';
    const oracle = card.querySelector('.astro-tarot-oracle');
    if (oracle) oracle.hidden = !next;
    card.querySelectorAll('[aria-expanded]').forEach((el) => el.setAttribute('aria-expanded', String(next)));
    if (next && card.dataset.arcana && A) {
      lastFlippedArcana = card.dataset.arcana;
      const arcana = localizeCard(A.cardById(card.dataset.arcana)) || A.cardById(card.dataset.arcana);
      if (arcana) speakOracle(arcana.oracle);
    }
  }

  function tarotSpreadPrompt(spread) {
    if (!spread?.sun || !spread?.situation || !spread?.cross || !spread?.path) return '';
    if (i18n()?.lang?.() === 'vi') {
      return `Đọc trải bài sinh nhật này: Mặt trời ${spread.sun.name}; Tình huống ${spread.situation.name}, Giao cắt ${spread.cross.name}, Đường đi ${spread.path.name}`;
    }
    return Z.spreadPrompt(spread);
  }

  function renderSpread(spread, opts) {
    const table = $('astroSpread');
    const status = $('astroFinderStatus');
    if (!table || !spread) return;
    if (window.AstrologyTarotCeremony?.cancel) {
      window.AstrologyTarotCeremony.cancel();
    }
    lastSpread = spread;
    table.hidden = false;
    table.dataset.ready = '1';
    table.classList.remove('is-ceremony');
    const sunView = localizeSign(spread.sun) || spread.sun;
    const roleSit = t('roleSituation', 'Situation');
    const roleCross = t('roleCross', 'Cross');
    const rolePath = t('rolePath', 'Path');
    const pileHtml = window.AstrologyTarotCeremony?.buildPileMarkup
      ? window.AstrologyTarotCeremony.buildPileMarkup()
      : '';
    table.innerHTML = `
      <header class="astro-spread__head">
        <p class="astro-kicker">${esc(t('spreadKicker', 'Rose · three-card draw'))}</p>
        <h2>${esc(t('spreadTitle', 'Situation · Cross · Path'))}</h2>
        <p>${esc(t('spreadLead', 'Rose shuffles, deals face-down, then turns each card — tap one for her reading.'))}
          ${sunView ? ` · ${esc(t('sunSignLabel', 'Sun'))}: ${esc(sunView.name)}` : ''}</p>
        <p class="astro-spread__status" data-spread-status></p>
      </header>
      <div class="astro-deck-pile" id="astroDeckPile" aria-hidden="true">${pileHtml}</div>
      <div class="astro-spread__rail">
        ${tarotSpreadCardMarkup(roleSit, spread.situation)}
        ${tarotSpreadCardMarkup(roleCross, spread.cross)}
        ${tarotSpreadCardMarkup(rolePath, spread.path)}
      </div>
      <button type="button" class="astro-ask astro-ask--spread" data-ask-rose="${esc(tarotSpreadPrompt(spread))}">${esc(t('askSpread', 'Ask Rose about this spread'))}</button>
    `;
    if (status) {
      status.textContent = sunView
        ? `${sunView.name} · ${spread.sun.dates}${spread.birthDate ? ` · ${spread.birthDate}` : ''}`
        : '';
    }
    if (spread.sun) {
      selectSign(spread.sun.id, { reading: true, dob: spread.birthDate, syncUrl: true });
    }
    setStageCollapsed(true);

    const skipCeremony = opts && opts.skipCeremony;
    if (skipCeremony) {
      if (window.AstrologyTarotCeremony?.finishInstant) {
        window.AstrologyTarotCeremony.finishInstant(table);
      } else {
        table.querySelectorAll('.astro-spread-card--tarot').forEach((card) => {
          card.classList.remove('is-pending');
          card.classList.add('is-dealt', 'is-revealed');
          card.dataset.phase = 'art';
        });
        const pile = table.querySelector('#astroDeckPile');
        if (pile) pile.hidden = true;
      }
      return;
    }

    if (window.AstrologyTarotCeremony?.play) {
      window.AstrologyTarotCeremony.play(table, { seed: spread.seed });
    } else {
      table.querySelectorAll('.astro-spread-card--tarot').forEach((card) => {
        card.classList.remove('is-pending');
        card.classList.add('is-dealt', 'is-revealed');
        card.dataset.phase = 'art';
      });
      const pile = table.querySelector('#astroDeckPile');
      if (pile) pile.hidden = true;
    }
  }

  function dealReading(dobParts) {
    const status = $('astroFinderStatus');
    const parsed = dobParts || readDobInput();
    if (!parsed) {
      if (status) status.textContent = t('invalidDate', 'That date is not on the tropical wheel.');
      return null;
    }
    const sun = Z.signForMonthDay(parsed.month, parsed.day);
    if (!sun || !A?.spreadFromDeck) {
      if (status) status.textContent = t('invalidDate', 'That date is not on the tropical wheel.');
      return null;
    }
    const seed = Z.dobSeed(parsed.year, parsed.month, parsed.day);
    const tarot = A.spreadFromDeck(seed);
    if (!tarot) {
      if (status) status.textContent = t('invalidDate', 'That date is not on the tropical wheel.');
      return null;
    }
    const spread = {
      sun,
      situation: tarot.situation,
      cross: tarot.cross,
      path: tarot.path,
      birthDate: parsed.iso,
      birthYear: parsed.year,
      month: parsed.month,
      day: parsed.day,
      seed: tarot.seed,
    };
    persistDob(parsed.iso);
    renderSpread(spread);
    return spread;
  }

  function findSignOnly(dobParts) {
    const status = $('astroFinderStatus');
    const parsed = dobParts || readDobInput();
    if (!parsed) {
      if (status) status.textContent = t('invalidDate', 'That date is not on the tropical wheel.');
      return null;
    }
    const sun = Z.signForMonthDay(parsed.month, parsed.day);
    if (!sun) {
      if (status) status.textContent = t('invalidDate', 'That date is not on the tropical wheel.');
      return null;
    }
    persistDob(parsed.iso);
    selectSign(sun.id, { dob: parsed.iso });
    if (status) {
      const view = localizeSign(sun) || sun;
      status.textContent = `${view.name} · ${sun.dates}`;
    }
    return sun;
  }

  function bindClicks(root) {
    root.addEventListener('click', (event) => {
      const ask = event.target.closest('[data-ask-rose]');
      if (ask && root.contains(ask)) {
        event.preventDefault();
        event.stopPropagation();
        askRose(ask.getAttribute('data-ask-rose'));
        return;
      }
      const hideOracle = event.target.closest('[data-spread-oracle-hide]');
      if (hideOracle) {
        event.preventDefault();
        event.stopPropagation();
        toggleSpreadReading(hideOracle.closest('.astro-spread-card--tarot'), false);
        return;
      }
      const unflip = event.target.closest('.astro-unflip');
      if (unflip) {
        event.preventDefault();
        const card = unflip.closest('.astro-flip');
        flipCard(card, false);
        return;
      }
      const heroFlip = event.target.closest('[data-hero-flip]');
      if (heroFlip) {
        event.preventDefault();
        flipCard($('astroDetail'), true);
        return;
      }
      const spreadFlip = event.target.closest('[data-spread-flip]');
      if (spreadFlip) {
        event.preventDefault();
        const card = spreadFlip.closest('.astro-flip');
        flipCard(card);
        if (card?.dataset.sign) selectSign(card.dataset.sign, { syncUrl: false });
        return;
      }
      const spreadTarotFlip = event.target.closest('[data-spread-tarot-flip]');
      if (spreadTarotFlip) {
        event.preventDefault();
        const card = spreadTarotFlip.closest('.astro-spread-card--tarot');
        if (!card || !card.classList.contains('is-revealed')) return;
        document.querySelectorAll('.astro-spread-card--tarot.is-reading').forEach((other) => {
          if (other !== card) toggleSpreadReading(other, false);
        });
        toggleSpreadReading(card);
        return;
      }
      const arcanaFlip = event.target.closest('[data-arcana-flip]');
      if (arcanaFlip) {
        event.preventDefault();
        const card = arcanaFlip.closest('.astro-flip');
        unflipAll(card);
        flipCard(card, true);
        return;
      }
      const slot = event.target.closest('.astro-slot[data-sign]');
      if (slot && root.contains(slot)) {
        selectSign(slot.dataset.sign);
        return;
      }
      const front = event.target.closest('.astro-gallery .astro-flip__front[data-sign]');
      if (front && root.contains(front)) {
        const card = front.closest('.astro-flip');
        selectSign(front.dataset.sign);
        unflipAll(card);
        flipCard(card, true);
      }
    });
  }

  function startSky() {
    const canvas = $('astroSky');
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars = [];
    const petals = [];
    const nebulae = [];
    let width = 0;
    let height = 0;
    let wash = ELEMENT_RGB.rose.slice();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      const count = width < 700 ? 80 : 140;
      stars.length = 0;
      for (let i = 0; i < count; i += 1) {
        const tint = ['rose', 'fire', 'earth', 'air', 'water'][i % 5];
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.6 + 0.3,
          tw: Math.random() * Math.PI * 2,
          sp: 0.008 + Math.random() * 0.02,
          tint,
          bright: i % 17 === 0,
        });
      }
      nebulae.length = 0;
      nebulae.push(
        { x: width * 0.5, y: height * 0.08, rx: width * 0.48, ry: height * 0.26, tint: 'wash', a: 0.28 },
        { x: width * 0.18, y: height * 0.72, rx: width * 0.3, ry: height * 0.22, tint: 'water', a: 0.16 },
        { x: width * 0.86, y: height * 0.24, rx: width * 0.26, ry: height * 0.2, tint: 'fire', a: 0.16 },
        { x: width * 0.72, y: height * 0.78, rx: width * 0.22, ry: height * 0.16, tint: 'earth', a: 0.12 },
        { x: width * 0.12, y: height * 0.22, rx: width * 0.2, ry: height * 0.14, tint: 'air', a: 0.12 }
      );
      petals.length = 0;
      const petalCount = width < 700 ? 10 : 16;
      for (let i = 0; i < petalCount; i += 1) {
        petals.push({
          x: Math.random() * width,
          y: Math.random() * height,
          s: 4 + Math.random() * 7,
          v: 0.18 + Math.random() * 0.35,
          w: Math.random() * Math.PI * 2,
        });
      }
    }

    function mixWash() {
      const target = ELEMENT_RGB[skyElement] || ELEMENT_RGB.rose;
      wash[0] += (target[0] - wash[0]) * 0.04;
      wash[1] += (target[1] - wash[1]) * 0.04;
      wash[2] += (target[2] - wash[2]) * 0.04;
    }

    function tick() {
      if (document.hidden) {
        skyRaf = requestAnimationFrame(tick);
        return;
      }
      mixWash();
      ctx.clearRect(0, 0, width, height);
      nebulae.forEach((cloud) => {
        const rgb =
          cloud.tint === 'wash' || cloud.tint === 'rose'
            ? wash
            : ELEMENT_RGB[cloud.tint] || wash;
        const alpha = cloud.a || 0.22;
        const grd = ctx.createRadialGradient(cloud.x, cloud.y, 10, cloud.x, cloud.y, cloud.rx);
        grd.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(cloud.x, cloud.y, cloud.rx, cloud.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      // Selected-element bloom follows the wash toward mid-page
      const bloom = ctx.createRadialGradient(width * 0.5, height * 0.42, 20, width * 0.5, height * 0.42, width * 0.38);
      bloom.addColorStop(0, `rgba(${wash[0]}, ${wash[1]}, ${wash[2]}, 0.14)`);
      bloom.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, height);
      if (!reduceMotion) {
        petals.forEach((petal) => {
          petal.y -= petal.v;
          petal.x += Math.sin(petal.w + petal.y * 0.01) * 0.4;
          petal.w += 0.02;
          if (petal.y < -12) {
            petal.y = height + 10;
            petal.x = Math.random() * width;
          }
          ctx.save();
          ctx.translate(petal.x, petal.y);
          ctx.rotate(petal.w);
          ctx.fillStyle = 'rgba(196, 72, 96, 0.28)';
          ctx.beginPath();
          ctx.ellipse(0, 0, petal.s, petal.s * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }
      for (let i = 0; i < stars.length; i += 1) {
        const star = stars[i];
        if (!reduceMotion) star.tw += star.sp;
        const a = 0.28 + Math.abs(Math.sin(star.tw)) * 0.7;
        const rgb = ELEMENT_RGB[star.tint] || ELEMENT_RGB.rose;
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.bright ? star.r * 1.8 : star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      skyRaf = requestAnimationFrame(tick);
    }

    resize();
    seed();
    tick();
    window.addEventListener('resize', () => {
      resize();
      seed();
    });
  }

  function refreshLocalizedMarkup() {
    const slots = $('astroSlots');
    const gallery = $('astroGallery');
    const arcanaGallery = $('astroArcanaGallery');
    if (slots) slots.innerHTML = wheelMarkup();
    if (gallery) gallery.innerHTML = galleryMarkup();
    if (arcanaGallery) arcanaGallery.innerHTML = arcanaGalleryMarkup();
    applyFilter();
    applyTarotFilter();
    if (selectedId) selectSign(selectedId, { syncUrl: false });
    if (lastSpread) renderSpread(lastSpread, { skipCeremony: true });
  }

  function init() {
    const slots = $('astroSlots');
    const gallery = $('astroGallery');
    const arcanaGallery = $('astroArcanaGallery');
    const dob = $('astroDob');
    const form = $('astroFinder');
    const filters = $('astroFilters');
    const readBtn = $('astroReadBtn');

    if (slots) slots.innerHTML = wheelMarkup();
    if (gallery) gallery.innerHTML = galleryMarkup();
    if (arcanaGallery) arcanaGallery.innerHTML = arcanaGalleryMarkup();

    const initialDob = resolveInitialDob();
    if (dob && initialDob) {
      dob.value = initialDob.iso;
      dob.max = formatIsoDate(new Date());
    }

    bindClicks(document);

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      findSignOnly();
    });

    dob?.addEventListener('change', () => {
      const parsed = readDobInput();
      if (parsed) persistDob(parsed.iso);
    });

    readBtn?.addEventListener('click', () => {
      dealReading();
      $('astroSpread')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    });

    filters?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-element-filter]');
      if (!btn) return;
      elementFilter = btn.dataset.elementFilter;
      filters.querySelectorAll('[data-element-filter]').forEach((el) => {
        el.setAttribute('aria-pressed', String(el === btn));
      });
      applyFilter();
    });

    const tarotFilters = $('astroTarotFilters');
    tarotFilters?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tarot-suit]');
      if (!btn) return;
      tarotSuitFilter = btn.dataset.tarotSuit;
      tarotFilters.querySelectorAll('[data-tarot-suit]').forEach((el) => {
        el.setAttribute('aria-pressed', String(el === btn));
      });
      applyTarotFilter();
    });
    applyTarotFilter();

    const fromQuery = Z.parseSignQuery(window.location.search) || Z.parseSignQuery(window.location.hash);
    const wantReading = Z.parseReadingQuery(window.location.search);
    const dobFromQuery = Z.parseDobQuery(window.location.search);
    selectSign((fromQuery || (initialDob && Z.signForMonthDay(initialDob.month, initialDob.day)) || todaysSign()).id, {
      syncUrl: Boolean(fromQuery),
      dob: initialDob?.iso,
    });
    $('astroStageToggle')?.addEventListener('click', () => {
      const panel = $('astroStagePanel');
      const collapsed = panel?.dataset.collapsed === 'true';
      setStageCollapsed(!collapsed);
    });
    if (wantReading) {
      dealReading(dobFromQuery || initialDob);
    }
    i18n()?.onChange?.(() => refreshLocalizedMarkup());
    startSky();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('pagehide', () => {
    if (skyRaf) cancelAnimationFrame(skyRaf);
    if (window.AstrologyTarotCeremony?.cancel) {
      window.AstrologyTarotCeremony.cancel();
    }
  });

  window.AstrologyPage = {
    selectSign,
    dealReading,
    findSignOnly,
    lastSpread: () => lastSpread,
    lastFlippedArcana: () => lastFlippedArcana,
    birthDate: () => readDobInput()?.iso || lastSpread?.birthDate || '',
    refreshLocalizedMarkup,
  };
})();
