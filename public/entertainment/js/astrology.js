/**
 * Astrology page — wheel, flip cards, starfield, Rose readings.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const Z = typeof AstrologyZodiac !== 'undefined' ? AstrologyZodiac : null;
  const A = typeof AstrologyArcana !== 'undefined' ? AstrologyArcana : null;
  if (!Z) return;

  const MONTHS = [
    ['1', 'January'],
    ['2', 'February'],
    ['3', 'March'],
    ['4', 'April'],
    ['5', 'May'],
    ['6', 'June'],
    ['7', 'July'],
    ['8', 'August'],
    ['9', 'September'],
    ['10', 'October'],
    ['11', 'November'],
    ['12', 'December'],
  ];

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
  let skyRaf = 0;
  let skyElement = 'rose';
  let lastSpread = null;

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

  function fillSelect(select, items) {
    if (!select) return;
    select.innerHTML = items
      .map(([value, label]) => `<option value="${value}">${esc(label)}</option>`)
      .join('');
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
      return `<div class="astro-slot-arm" style="--angle:${angle}deg">
        <button type="button" class="astro-slot" data-sign="${sign.id}" data-element="${sign.element}" style="--angle:${angle}deg" aria-pressed="false">
          <span class="astro-slot__glyph" aria-hidden="true">${Z.textGlyph(sign)}</span>
          <span class="astro-slot__label">${esc(sign.name)}</span>
        </button>
      </div>`;
    }).join('');
  }

  function backFace(sign, opts) {
    const compact = opts && opts.compact;
    return `
      <div class="astro-flip__meta">
        <span class="astro-chip astro-chip--${sign.element}">${esc(sign.element)}</span>
        <span class="astro-chip">${esc(sign.modality)}</span>
        <span class="astro-chip">${esc(sign.ruler)}</span>
      </div>
      <h3>${Z.textGlyph(sign)} ${esc(sign.name)}</h3>
      <p class="astro-flip__oracle">${esc(sign.oracle)}</p>
      ${compact ? '' : `<p class="astro-flip__gift"><strong>Gift.</strong> ${esc(sign.gift)}</p>
      <p class="astro-flip__shadow"><strong>Watch.</strong> ${esc(sign.shadow)}</p>`}
      <ul class="astro-traits">${sign.traits.map((trait) => `<li>${esc(trait)}</li>`).join('')}</ul>
      <div class="astro-flip__actions">
        <button type="button" class="astro-ask" data-ask-rose="${esc(sign.askRose)}">Ask Rose</button>
        <button type="button" class="astro-unflip">Flip back</button>
      </div>`;
  }

  function galleryMarkup() {
    return Z.SIGNS.map((sign) => `<article class="astro-flip astro-card" data-sign="${sign.id}" data-element="${sign.element}">
      <div class="astro-flip__inner">
        <button type="button" class="astro-flip__face astro-flip__front" data-sign="${sign.id}" aria-pressed="false" aria-expanded="false">
          <div class="astro-card__top">
            <span class="astro-card__glyph" aria-hidden="true">${Z.textGlyph(sign)}</span>
            <span class="astro-chip astro-chip--${sign.element}">${esc(sign.element)}</span>
          </div>
          <h3>${esc(sign.name)}</h3>
          <p>${esc(sign.dates)}</p>
          <p>${esc(sign.kicker)}</p>
          ${Z.constellationSvg(sign)}
        </button>
        <div class="astro-flip__face astro-flip__back" data-element="${sign.element}">
          ${backFace(sign, { compact: true })}
        </div>
      </div>
    </article>`).join('');
  }

  function arcanaBackFace(card) {
    return `
      <div class="astro-flip__meta">
        <span class="astro-chip">${esc(card.roman)}</span>
        <span class="astro-chip">${esc(card.keyword)}</span>
      </div>
      <h3>${esc(card.glyph)} ${esc(card.name)}</h3>
      <p class="astro-flip__oracle">${esc(card.oracle)}</p>
      <p class="astro-flip__gift"><strong>Gift.</strong> ${esc(card.gift)}</p>
      <p class="astro-flip__shadow"><strong>Watch.</strong> ${esc(card.shadow)}</p>
      <ul class="astro-traits">${card.traits.map((trait) => `<li>${esc(trait)}</li>`).join('')}</ul>
      <div class="astro-flip__actions">
        <button type="button" class="astro-ask" data-ask-rose="${esc(card.askRose)}">Ask Rose</button>
        <button type="button" class="astro-unflip">Flip back</button>
      </div>`;
  }

  function arcanaGalleryMarkup() {
    if (!A || !A.ARCANA) return '';
    return A.ARCANA.map(
      (card) => `<article class="astro-flip astro-card astro-arcana-card" data-arcana="${card.id}">
      <div class="astro-flip__inner">
        <button type="button" class="astro-flip__face astro-flip__front" data-arcana-flip aria-expanded="false">
          <div class="astro-card__top">
            <span class="astro-card__glyph" aria-hidden="true">${esc(card.glyph)}</span>
            <span class="astro-chip">${esc(card.roman)}</span>
          </div>
          <h3>${esc(card.name)}</h3>
          <p>${esc(card.keyword)}</p>
        </button>
        <div class="astro-flip__face astro-flip__back">
          ${arcanaBackFace(card)}
        </div>
      </div>
    </article>`
    ).join('');
  }

  function renderDetail(sign) {
    const panel = $('astroDetail');
    const glyph = $('astroCoreGlyph');
    const name = $('astroCoreName');
    if (!panel || !sign) return;
    panel.dataset.element = sign.element;
    panel.dataset.sign = sign.id;
    panel.classList.add('astro-flip', 'astro-hero-card');
    panel.classList.remove('is-flipped');
    panel.innerHTML = `
      <div class="astro-flip__inner">
        <div class="astro-flip__face astro-flip__front">
          <div class="astro-detail__meta">
            <span class="astro-chip astro-chip--${sign.element}">${esc(sign.element)}</span>
          </div>
          <h2 id="astroDetailTitle">${Z.textGlyph(sign)} ${esc(sign.name)}</h2>
          <p class="astro-detail__dates">${esc(sign.dates)} · ${esc(sign.symbol)}</p>
          ${Z.constellationSvg(sign)}
          <p>${esc(sign.blurb)}</p>
          <ul class="astro-traits">${sign.traits.map((trait) => `<li>${esc(trait)}</li>`).join('')}</ul>
          <button type="button" class="astro-flip-cta" data-hero-flip>Flip the card</button>
        </div>
        <div class="astro-flip__face astro-flip__back" data-element="${sign.element}">
          ${backFace(sign)}
        </div>
      </div>
    `;
    if (glyph) glyph.textContent = Z.textGlyph(sign);
    if (name) name.textContent = sign.name;
    const core = document.querySelector('.astro-wheel__core');
    if (core) core.dataset.element = sign.element;
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
      const sign = Z.signById(card.dataset.sign);
      if (sign) speakOracle(sign.oracle);
    } else if (next && card.dataset.arcana && A) {
      const arcana = A.cardById(card.dataset.arcana);
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
      url.hash = '';
      history.replaceState(null, '', url.pathname + url.search);
    }
  }

  function todaysSign() {
    return Z.signForDate(new Date()) || Z.SIGNS[0];
  }

  function spreadCardMarkup(role, sign) {
    if (!sign) return '';
    return `<article class="astro-flip astro-spread-card" data-sign="${sign.id}" data-element="${sign.element}" data-role="${role}">
      <p class="astro-spread-card__role">${esc(role)}</p>
      <div class="astro-flip__inner">
        <button type="button" class="astro-flip__face astro-flip__front" data-spread-flip aria-expanded="false">
          <span class="astro-card__glyph" aria-hidden="true">${Z.textGlyph(sign)}</span>
          <h3>${esc(sign.name)}</h3>
          <p>${esc(sign.dates)}</p>
        </button>
        <div class="astro-flip__face astro-flip__back" data-element="${sign.element}">
          ${backFace(sign, { compact: true })}
        </div>
      </div>
    </article>`;
  }

  function renderSpread(spread) {
    const table = $('astroSpread');
    const status = $('astroFinderStatus');
    if (!table || !spread) return;
    lastSpread = spread;
    table.hidden = false;
    table.dataset.ready = '1';
    table.innerHTML = `
      <header class="astro-spread__head">
        <p class="astro-kicker">Rose · three-card draw</p>
        <h2>Sun · Cross · Path</h2>
        <p>Your sign, the tension, and the lean — tap a card to flip it.</p>
      </header>
      <div class="astro-spread__rail">
        ${spreadCardMarkup('Sun', spread.sun)}
        ${spreadCardMarkup('Cross', spread.cross)}
        ${spreadCardMarkup('Path', spread.path)}
      </div>
      <button type="button" class="astro-ask astro-ask--spread" data-ask-rose="${esc(Z.spreadPrompt(spread))}">Ask Rose about this spread</button>
    `;
    if (status) status.textContent = `${spread.sun.name} · ${spread.sun.dates}`;
    selectSign(spread.sun.id, { reading: true });
    const cards = table.querySelectorAll('.astro-spread-card');
    gsapTween(cards, { y: 28, opacity: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out', clearProps: 'all' });
  }

  function dealReading(month, day) {
    const spread = Z.spreadForMonthDay(Number(month), Number(day));
    const status = $('astroFinderStatus');
    if (!spread) {
      if (status) status.textContent = 'That date is not on the tropical wheel.';
      return null;
    }
    renderSpread(spread);
    return spread;
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

  function init() {
    const slots = $('astroSlots');
    const gallery = $('astroGallery');
    const arcanaGallery = $('astroArcanaGallery');
    const month = $('astroMonth');
    const day = $('astroDay');
    const form = $('astroFinder');
    const filters = $('astroFilters');
    const readBtn = $('astroReadBtn');

    fillSelect(month, MONTHS);
    fillSelect(day, Array.from({ length: 31 }, (_, i) => [String(i + 1), String(i + 1)]));

    if (slots) slots.innerHTML = wheelMarkup();
    if (gallery) gallery.innerHTML = galleryMarkup();
    if (arcanaGallery) arcanaGallery.innerHTML = arcanaGalleryMarkup();

    const now = new Date();
    if (month) month.value = String(now.getMonth() + 1);
    if (day) day.value = String(now.getDate());

    bindClicks(document);

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      dealReading(month.value, day.value);
    });

    readBtn?.addEventListener('click', () => {
      dealReading(month?.value || now.getMonth() + 1, day?.value || now.getDate());
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

    const fromQuery = Z.parseSignQuery(window.location.search) || Z.parseSignQuery(window.location.hash);
    const wantReading = Z.parseReadingQuery(window.location.search);
    selectSign((fromQuery || todaysSign()).id, { syncUrl: Boolean(fromQuery) });
    if (wantReading) {
      dealReading(month?.value || now.getMonth() + 1, day?.value || now.getDate());
    }
    startSky();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('pagehide', () => {
    if (skyRaf) cancelAnimationFrame(skyRaf);
  });

  window.AstrologyPage = {
    selectSign,
    dealReading,
    lastSpread: () => lastSpread,
  };
})();
